import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Get the current user record (email, id)
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return user ? { _id: user._id, email: user.email } : null;
  },
});

// Get the current user's profile (role, etc)
export const getUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return profile || null;
  },
});

// Create or update the current user's profile (with role selection)
export const createUserProfile = mutation({
  args: {
    role: v.union(v.literal("teacher"), v.literal("student")),
    institutionalId: v.optional(v.string()),
    rollNumber: v.optional(v.string()),
    department: v.optional(v.string()),
    semester: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Check for existing profile
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        role: args.role,
        institutionalId: args.institutionalId,
        rollNumber: args.rollNumber,
        department: args.department,
        semester: args.semester,
      });
      return existingProfile._id;
    } else {
      return await ctx.db.insert("userProfiles", {
        userId,
        role: args.role,
        institutionalId: args.institutionalId,
        rollNumber: args.rollNumber,
        department: args.department,
        semester: args.semester,
      });
    }
  },
});

export const updateProfilePhoto = mutation({
  args: {
    profilePhotoId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      profilePhotoId: args.profilePhotoId,
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});
