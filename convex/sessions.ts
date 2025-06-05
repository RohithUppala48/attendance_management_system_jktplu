import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Simple encryption for demo purposes - in production use proper encryption
function encryptSessionData(data: any): string {
  return btoa(JSON.stringify(data));
}

function decryptSessionData(encrypted: string): any {
  try {
    return JSON.parse(atob(encrypted));
  } catch {
    return null;
  }
}

export const createSession = mutation({
  args: {
    courseId: v.id("courses"),
    sessionName: v.string(),
    location: v.object({
      type: v.union(v.literal("gps"), v.literal("manual")),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      address: v.optional(v.string()),
      radius: v.optional(v.number()),
    }),
    expiryMinutes: v.number(),
    maxAttendanceTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user is teacher of this course
    const course = await ctx.db.get(args.courseId);
    if (!course || course.teacherId !== userId) {
      throw new Error("Not authorized to create sessions for this course");
    }

    const sessionId = crypto.randomUUID();
    const timestamp = Date.now();
    
    const sessionData = {
      sessionId,
      courseId: args.courseId,
      timestamp,
      teacherId: userId,
    };

    const encryptedData = encryptSessionData(sessionData);

    return await ctx.db.insert("sessions", {
      courseId: args.courseId,
      teacherId: userId,
      sessionName: args.sessionName,
      location: args.location,
      qrData: {
        sessionId,
        courseId: args.courseId,
        timestamp,
        expiryMinutes: args.expiryMinutes,
        encryptedData,
      },
      startTime: timestamp,
      isActive: true,
      maxAttendanceTime: args.maxAttendanceTime,
    });
  },
});

export const getActiveSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("sessions")
      .withIndex("by_teacher", (q) => q.eq("teacherId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const endSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teacherId !== userId) {
      throw new Error("Not authorized to end this session");
    }

    await ctx.db.patch(args.sessionId, {
      isActive: false,
      endTime: Date.now(),
    });
  },
});

export const getSessionAttendance = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teacherId !== userId) {
      return [];
    }

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const attendanceWithStudents = await Promise.all(
      attendanceRecords.map(async (record) => {
        const user = await ctx.db.get(record.studentId);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", record.studentId))
          .unique();
        return { ...record, user, profile };
      })
    );

    return attendanceWithStudents;
  },
});

export const getUnauthorizedAttempts = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.teacherId !== userId) {
      return [];
    }

    return await ctx.db
      .query("unauthorizedAttempts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const validateQRCode = query({
  args: { 
    encryptedData: v.string(),
    studentLocation: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const sessionData = decryptSessionData(args.encryptedData);
    if (!sessionData) {
      return { valid: false, error: "Invalid QR code" };
    }

    const session = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("qrData.sessionId"), sessionData.sessionId))
      .first();

    if (!session) {
      return { valid: false, error: "Session not found" };
    }

    if (!session.isActive) {
      return { valid: false, error: "Session has ended" };
    }

    // Check if QR code has expired
    const now = Date.now();
    const expiryTime = sessionData.timestamp + (session.qrData.expiryMinutes * 60 * 1000);
    if (now > expiryTime) {
      return { valid: false, error: "QR code has expired" };
    }

    // Check location if GPS-based
    if (session.location.type === "gps" && args.studentLocation) {
      const distance = calculateDistance(
        session.location.latitude!,
        session.location.longitude!,
        args.studentLocation.latitude,
        args.studentLocation.longitude
      );

      if (distance > (session.location.radius || 100)) {
        return { valid: false, error: "Location verification failed" };
      }
    }

    return { 
      valid: true, 
      sessionId: session._id,
      courseId: session.courseId,
      sessionName: session.sessionName,
    };
  },
});

export const markAttendance = mutation({
  args: {
    sessionId: v.id("sessions"),
    studentLocation: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
      accuracy: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the session
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (!session.isActive) {
      throw new Error("Session has ended");
    }

    // Check if student is enrolled in the course
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_course_student", (q) => 
        q.eq("courseId", session.courseId).eq("studentId", userId)
      )
      .unique();

    if (!enrollment) {
      throw new Error("You are not enrolled in this course");
    }

    // Check if attendance already marked
    const existingAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_session_student", (q) => 
        q.eq("sessionId", args.sessionId).eq("studentId", userId)
      )
      .unique();

    if (existingAttendance) {
      throw new Error("Attendance already marked for this session");
    }

    // Check location if GPS-based
    if (session.location.type === "gps" && args.studentLocation) {
      const distance = calculateDistance(
        session.location.latitude!,
        session.location.longitude!,
        args.studentLocation.latitude,
        args.studentLocation.longitude
      );

      if (distance > (session.location.radius || 100)) {
        // Record unauthorized attempt
        await ctx.db.insert("unauthorizedAttempts", {
          sessionId: args.sessionId,
          studentId: userId,
          attemptType: "location_spoofing",
          timestamp: Date.now(),
          location: args.studentLocation,
          details: `Distance: ${Math.round(distance)}m, Max allowed: ${session.location.radius || 100}m`
        });
        throw new Error("Location verification failed");
      }
    }

    // Determine attendance status
    let status: "present" | "late" = "present";
    if (session.maxAttendanceTime) {
      const timeElapsed = (Date.now() - session.startTime) / (1000 * 60); // in minutes
      if (timeElapsed > session.maxAttendanceTime) {
        status = "late";
      }
    }

    // Mark attendance
    await ctx.db.insert("attendance", {
      sessionId: args.sessionId,
      studentId: userId,
      courseId: session.courseId,
      markedAt: Date.now(),
      location: args.studentLocation,
      status,
    });

    return { success: true, status };
  },
});

// Helper function to calculate distance between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
