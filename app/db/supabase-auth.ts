/**
 * Supabase Authentication Integration
 * 
 * This file contains utilities for integrating Supabase Auth with the Fighter Management system.
 * 
 * Architecture:
 * - auth.users (Supabase managed) - Authentication
 * - public.profiles - User profiles and roles
 * - public.fighters - Fighter-specific data (linked via user_id)
 * 
 * Flow:
 * 1. User signs up → auth.users created by Supabase
 * 2. Trigger creates profile → public.profiles
 * 3. If user is a fighter → public.fighters (user_id linked)
 */

import { db } from './index';
import { profiles, fighters, fighterStats } from './schema';
import { eq } from 'drizzle-orm';
import type { NewProfile, NewFighter } from './types';

// ===========================
// PROFILE MANAGEMENT
// ===========================

/**
 * Create a user profile after Supabase auth signup
 * This should be called from a database trigger or API endpoint
 */
async function createProfile(userId: string, email: string, fullName?: string) {
  const newProfile: NewProfile = {
    id: userId, // UUID from auth.users
    email,
    fullName: fullName || null,
    role: 'viewer', // Default role
    isActive: true,
  };

  const [profile] = await db.insert(profiles).values(newProfile).returning();
  return profile;
}

/**
 * Get profile by user ID
 */
async function getProfileById(userId: string) {
  const result = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get profile with associated fighter data
 */
async function getProfileWithFighter(userId: string) {
  const result = await db
    .select()
    .from(profiles)
    .leftJoin(fighters, eq(profiles.id, fighters.userId))
    .where(eq(profiles.id, userId))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0].profiles,
    fighter: result[0].fighters,
  };
}

/**
 * Update profile role (admin only)
 */
async function updateProfileRole(
  userId: string, 
  role: 'fighter' | 'admin' | 'manager' | 'viewer'
) {
  const [profile] = await db
    .update(profiles)
    .set({ role, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();

  return profile;
}

/**
 * Update profile information
 */
async function updateProfile(
  userId: string,
  data: {
    fullName?: string;
    avatarUrl?: string;
    phoneNumber?: string;
  }
) {
  const [profile] = await db
    .update(profiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();

  return profile;
}

// ===========================
// FIGHTER-USER LINKING
// ===========================

/**
 * Link an existing user to a fighter profile
 * Use this when a user signs up and wants to become a fighter
 */
async function linkUserToFighter(userId: string, fighterId: number) {
  // Update user role to fighter
  await updateProfileRole(userId, 'fighter');

  // Link fighter to user
  const [fighter] = await db
    .update(fighters)
    .set({ userId, updatedAt: new Date() })
    .where(eq(fighters.id, fighterId))
    .returning();

  return fighter;
}

/**
 * Create a fighter profile for an authenticated user
 * This creates both the fighter record and links it to the user
 */
async function createFighterForUser(
  userId: string,
  fighterData: Omit<NewFighter, 'userId'>
) {
  // Update user role to fighter
  await updateProfileRole(userId, 'fighter');

  // Create fighter with user_id link
  const [fighter] = await db
    .insert(fighters)
    .values({
      ...fighterData,
      userId,
    })
    .returning();

  // Initialize fighter stats
  await db.insert(fighterStats).values({
    fighterId: fighter.id,
    totalFights: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    rankingPoints: '1000',
  });

  return fighter;
}

/**
 * Get fighter by user ID
 */
async function getFighterByUserId(userId: string) {
  const result = await db
    .select()
    .from(fighters)
    .where(eq(fighters.userId, userId))
    .limit(1);

  return result[0] || null;
}

/**
 * Unlink user from fighter (soft delete - keeps fighter history)
 */
async function unlinkUserFromFighter(userId: string) {
  // Set user_id to null but keep fighter record
  await db
    .update(fighters)
    .set({ userId: null, updatedAt: new Date() })
    .where(eq(fighters.userId, userId));

  // Update user role back to viewer
  await updateProfileRole(userId, 'viewer');
}

// ===========================
// AUTHORIZATION HELPERS
// ===========================

/**
 * Check if user has a specific role
 */
async function userHasRole(
  userId: string, 
  allowedRoles: ('fighter' | 'admin' | 'manager' | 'viewer')[]
) {
  const profile = await getProfileById(userId);
  if (!profile) return false;
  return allowedRoles.includes(profile.role);
}

/**
 * Check if user is a fighter
 */
async function isUserFighter(userId: string) {
  return userHasRole(userId, ['fighter']);
}

/**
 * Check if user is admin or manager
 */
async function isUserStaff(userId: string) {
  return userHasRole(userId, ['admin', 'manager']);
}

/**
 * Check if user is admin
 */
async function isUserAdmin(userId: string) {
  return userHasRole(userId, ['admin']);
}

/**
 * Check if user owns a fighter profile
 */
async function userOwnsFighter(userId: string, fighterId: number) {
  const fighter = await db
    .select()
    .from(fighters)
    .where(eq(fighters.id, fighterId))
    .limit(1);

  return fighter[0]?.userId === userId;
}

// ===========================
// BULK OPERATIONS
// ===========================

/**
 * Get all fighters with their linked users
 */
async function getAllFightersWithUsers() {
  const result = await db
    .select()
    .from(fighters)
    .leftJoin(profiles, eq(fighters.userId, profiles.id));

  return result.map(row => ({
    ...row.fighters,
    user: row.profiles,
  }));
}

/**
 * Get all profiles with their fighter data
 */
async function getAllProfilesWithFighters() {
  const result = await db
    .select()
    .from(profiles)
    .leftJoin(fighters, eq(profiles.id, fighters.userId));

  return result.map(row => ({
    ...row.profiles,
    fighter: row.fighters,
  }));
}

// ===========================
// EXPORTS
// ===========================

export {
  // Profile management
  createProfile,
  getProfileById,
  getProfileWithFighter,
  updateProfileRole,
  updateProfile,
  
  // Fighter-user linking
  linkUserToFighter,
  createFighterForUser,
  getFighterByUserId,
  unlinkUserFromFighter,
  
  // Authorization
  userHasRole,
  isUserFighter,
  isUserStaff,
  isUserAdmin,
  userOwnsFighter,
  
  // Bulk operations
  getAllFightersWithUsers,
  getAllProfilesWithFighters,
};

