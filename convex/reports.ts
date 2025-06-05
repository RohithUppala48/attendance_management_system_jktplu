import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const generateAttendanceReport = query({
  args: { 
    courseId: v.id("courses"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Verify user is teacher of this course
    const course = await ctx.db.get(args.courseId);
    if (!course || course.teacherId !== userId) {
      return null;
    }

    // Get all sessions for the course within date range
    let sessions = await ctx.db
      .query("sessions")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    if (args.startDate || args.endDate) {
      sessions = sessions.filter(session => {
        if (args.startDate && session.startTime < args.startDate) return false;
        if (args.endDate && session.startTime > args.endDate) return false;
        return true;
      });
    }

    // Get all enrolled students
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();

    const students = await Promise.all(
      enrollments.map(async (enrollment) => {
        const user = await ctx.db.get(enrollment.studentId);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", enrollment.studentId))
          .unique();
        return { user, profile, enrollment };
      })
    );

    // Get attendance records for all sessions
    const attendanceRecords = await Promise.all(
      sessions.map(async (session) => {
        const records = await ctx.db
          .query("attendance")
          .withIndex("by_session", (q) => q.eq("sessionId", session._id))
          .collect();
        return { session, records };
      })
    );

    // Generate report data
    const reportData = students.map(({ user, profile }) => {
      if (!user || !profile) return null;

      const studentAttendance = sessions.map(session => {
        const sessionAttendance = attendanceRecords
          .find(ar => ar.session._id === session._id)
          ?.records.find(r => r.studentId === user._id);

        return {
          sessionId: session._id,
          sessionName: session.sessionName,
          date: new Date(session.startTime).toLocaleDateString(),
          status: sessionAttendance?.status || "absent",
          markedAt: sessionAttendance?.markedAt,
        };
      });

      const totalSessions = sessions.length;
      const attendedSessions = studentAttendance.filter(sa => sa.status !== "absent").length;
      const presentSessions = studentAttendance.filter(sa => sa.status === "present").length;
      const lateSessions = studentAttendance.filter(sa => sa.status === "late").length;

      return {
        studentId: user._id,
        name: user.name || "Unknown",
        email: user.email,
        rollNumber: profile.rollNumber,
        totalSessions,
        attendedSessions,
        presentSessions,
        lateSessions,
        missedSessions: totalSessions - attendedSessions,
        attendancePercentage: totalSessions > 0 ? 
          Math.round((attendedSessions / totalSessions) * 100 * 100) / 100 : 0,
        sessionDetails: studentAttendance,
      };
    }).filter(Boolean);

    return {
      course: {
        name: course.name,
        code: course.code,
        department: course.department,
        semester: course.semester,
      },
      dateRange: {
        start: args.startDate ? new Date(args.startDate).toLocaleDateString() : "All time",
        end: args.endDate ? new Date(args.endDate).toLocaleDateString() : "All time",
      },
      totalSessions: sessions.length,
      totalStudents: students.length,
      reportData,
      generatedAt: Date.now(),
    };
  },
});

export const getSessionsForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify user is teacher of this course
    const course = await ctx.db.get(args.courseId);
    if (!course || course.teacherId !== userId) {
      return [];
    }

    // Get all sessions for the course, ordered by startTime descending
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_course", q => q.eq("courseId", args.courseId))
      .order("desc")
      .collect();

    return sessions;
  },
});
