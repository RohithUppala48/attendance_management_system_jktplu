import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const markAttendance = mutation({
  args: {
    sessionId: v.id("sessions"),
    location: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
      accuracy: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    if (!session.isActive) {
      await ctx.db.insert("unauthorizedAttempts", {
        sessionId: args.sessionId,
        studentId: userId,
        attemptType: "expired_qr",
        timestamp: Date.now(),
        details: "Attempted to mark attendance on inactive session",
      });
      throw new Error("Session is no longer active");
    }

    // Check if student is enrolled in the course
    const enrollment = await ctx.db
      .query("enrollments")
      .withIndex("by_course_student", (q) => 
        q.eq("courseId", session.courseId).eq("studentId", userId)
      )
      .unique();

    if (!enrollment) {
      throw new Error("Not enrolled in this course");
    }

    // Check if already marked attendance
    const existingAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_session_student", (q) => 
        q.eq("sessionId", args.sessionId).eq("studentId", userId)
      )
      .unique();

    if (existingAttendance) {
      await ctx.db.insert("unauthorizedAttempts", {
        sessionId: args.sessionId,
        studentId: userId,
        attemptType: "duplicate_attempt",
        timestamp: Date.now(),
        details: "Attempted to mark attendance multiple times",
      });
      throw new Error("Attendance already marked for this session");
    }

    // Determine attendance status based on timing
    const now = Date.now();
    const sessionStart = session.startTime;
    const maxLateTime = session.maxAttendanceTime ? 
      sessionStart + (session.maxAttendanceTime * 60 * 1000) : 
      sessionStart + (15 * 60 * 1000); // Default 15 minutes

    let status: "present" | "late" | "absent";
    if (now <= sessionStart + (5 * 60 * 1000)) { // 5 minutes grace period
      status = "present";
    } else if (now <= maxLateTime) {
      status = "late";
    } else {
      status = "absent";
    }

    return await ctx.db.insert("attendance", {
      sessionId: args.sessionId,
      studentId: userId,
      courseId: session.courseId,
      markedAt: now,
      location: args.location,
      status,
    });
  },
});

export const getStudentAttendance = query({
  args: { courseId: v.optional(v.id("courses")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let query = ctx.db.query("attendance").withIndex("by_student", (q) => q.eq("studentId", userId));
    
    if (args.courseId) {
      const records = await query.collect();
      return records.filter(record => record.courseId === args.courseId);
    }

    return await query.collect();
  },
});

export const getCourseAttendanceStats = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Verify user is teacher of this course
    const course = await ctx.db.get(args.courseId);
    if (!course || course.teacherId !== userId) {
      return null;
    }

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const totalSessions = sessions.length;
    const totalStudents = enrollments.length;
    const totalPossibleAttendance = totalSessions * totalStudents;

    const presentCount = attendanceRecords.filter(r => r.status === "present").length;
    const lateCount = attendanceRecords.filter(r => r.status === "late").length;
    const absentCount = totalPossibleAttendance - attendanceRecords.length;

    const averageAttendance = totalPossibleAttendance > 0 ? 
      ((presentCount + lateCount) / totalPossibleAttendance) * 100 : 0;

    return {
      totalSessions,
      totalStudents,
      presentCount,
      lateCount,
      absentCount,
      averageAttendance: Math.round(averageAttendance * 100) / 100,
      attendanceRecords: attendanceRecords.length,
    };
  },
});

export const getStudentAttendanceStats = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .filter((q) => q.eq(q.field("studentId"), userId))
      .collect();

    const totalSessions = sessions.length;
    const attendedSessions = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === "present").length;
    const lateCount = attendanceRecords.filter(r => r.status === "late").length;
    const missedSessions = totalSessions - attendedSessions;

    const attendancePercentage = totalSessions > 0 ? 
      (attendedSessions / totalSessions) * 100 : 0;

    return {
      totalSessions,
      attendedSessions,
      missedSessions,
      presentCount,
      lateCount,
      attendancePercentage: Math.round(attendancePercentage * 100) / 100,
    };
  },
});
