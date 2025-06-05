import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Extended user profiles
  userProfiles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("teacher"), v.literal("student")),
    institutionalId: v.optional(v.string()),
    rollNumber: v.optional(v.string()),
    profilePhotoId: v.optional(v.id("_storage")),
    department: v.optional(v.string()),
    semester: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_institutional_id", ["institutionalId"])
    .index("by_roll_number", ["rollNumber"]),

  // Courses
  courses: defineTable({
    name: v.string(),
    code: v.string(),
    department: v.string(),
    semester: v.number(),
    teacherId: v.id("users"),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_department_semester", ["department", "semester"])
    .index("by_code", ["code"]),

  // Course enrollments
  enrollments: defineTable({
    courseId: v.id("courses"),
    studentId: v.id("users"),
    enrolledAt: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_student", ["studentId"])
    .index("by_course_student", ["courseId", "studentId"]),

  // Class sessions
  sessions: defineTable({
    courseId: v.id("courses"),
    teacherId: v.id("users"),
    sessionName: v.string(),
    location: v.object({
      type: v.union(v.literal("gps"), v.literal("manual")),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      address: v.optional(v.string()),
      radius: v.optional(v.number()), // in meters
    }),
    qrData: v.object({
      sessionId: v.string(),
      courseId: v.id("courses"),
      timestamp: v.number(),
      expiryMinutes: v.number(),
      encryptedData: v.string(),
    }),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    isActive: v.boolean(),
    maxAttendanceTime: v.optional(v.number()), // minutes after start
  })
    .index("by_course", ["courseId"])
    .index("by_teacher", ["teacherId"])
    .index("by_active", ["isActive"])
    .index("by_start_time", ["startTime"]),

  // Attendance records
  attendance: defineTable({
    sessionId: v.id("sessions"),
    studentId: v.id("users"),
    courseId: v.id("courses"),
    markedAt: v.number(),
    location: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
      accuracy: v.optional(v.number()),
    })),
    status: v.union(
      v.literal("present"),
      v.literal("late"),
      v.literal("absent")
    ),
  })
    .index("by_session", ["sessionId"])
    .index("by_student", ["studentId"])
    .index("by_course", ["courseId"])
    .index("by_session_student", ["sessionId", "studentId"])
    .index("by_marked_at", ["markedAt"]),

  // Unauthorized attempts
  unauthorizedAttempts: defineTable({
    sessionId: v.id("sessions"),
    studentId: v.optional(v.id("users")),
    attemptType: v.union(
      v.literal("face_mismatch"),
      v.literal("location_spoofing"),
      v.literal("expired_qr"),
      v.literal("invalid_qr"),
      v.literal("duplicate_attempt")
    ),
    timestamp: v.number(),
    details: v.optional(v.string()),
    location: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
    })),
  })
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_attempt_type", ["attemptType"]),

  // OTP for student login
  otpCodes: defineTable({
    identifier: v.string(), // email or roll number
    code: v.string(),
    expiresAt: v.number(),
    verified: v.boolean(),
  })
    .index("by_identifier", ["identifier"])
    .index("by_expires_at", ["expiresAt"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
