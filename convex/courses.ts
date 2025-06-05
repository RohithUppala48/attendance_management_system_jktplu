import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createCourse = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    department: v.string(),
    semester: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user is a teacher
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.role !== "teacher") {
      throw new Error("Only teachers can create courses");
    }

    return await ctx.db.insert("courses", {
      name: args.name,
      code: args.code,
      department: args.department,
      semester: args.semester,
      teacherId: userId,
      description: args.description,
      isActive: true,
    });
  },
});

export const getTeacherCourses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("courses")
      .withIndex("by_teacher", (q) => q.eq("teacherId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getStudentCourses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", userId))
      .collect();

    const courses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = await ctx.db.get(enrollment.courseId);
        return course;
      })
    );

    return courses.filter(Boolean);
  },
});

export const findUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Find user by email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .unique();

    if (!user) return null;

    // Get user profile to verify it's a student
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!profile || profile.role !== "student") return null;

    return user;
  },
});

export const enrollStudent = mutation({
  args: {
    courseId: v.id("courses"),
    studentEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user is a teacher of this course
    const course = await ctx.db.get(args.courseId);
    if (!course || course.teacherId !== userId) {
      throw new Error("Not authorized to enroll students in this course");
    }

    // Find student by email
    const student = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.studentEmail))
      .unique();

    if (!student) {
      throw new Error("Student not found");
    }

    // Verify student profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", student._id))
      .unique();

    if (!profile || profile.role !== "student") {
      throw new Error("User is not a student");
    }

    // Check if already enrolled
    const existing = await ctx.db
      .query("enrollments")
      .withIndex("by_course_student", (q) => 
        q.eq("courseId", args.courseId).eq("studentId", student._id)
      )
      .unique();

    if (existing) {
      throw new Error("Student already enrolled");
    }

    return await ctx.db.insert("enrollments", {
      courseId: args.courseId,
      studentId: student._id,
      enrolledAt: Date.now(),
    });
  },
});

export const getCourseStudents = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify user is teacher of this course
    const course = await ctx.db.get(args.courseId);
    if (!course || course.teacherId !== userId) {
      return [];
    }

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
        return { user, profile };
      })
    );

    return students.filter(s => s.user && s.profile);
  },
});
