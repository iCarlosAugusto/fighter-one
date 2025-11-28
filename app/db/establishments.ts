/**
 * Establishment Management Functions
 * 
 * This file contains utilities for managing establishments (gyms, schools, etc.)
 * and their relationships with users and championships.
 * 
 * Architecture:
 * - establishments: Organizations that can create championships
 * - establishment_admins: Users who can manage establishments
 * - Only establishment admins can create/manage championships for their establishment
 */

import { db } from './index';
import { establishments, establishmentAdmins, championships, fighters, profiles } from './schema';
import { eq, and, or } from 'drizzle-orm';
import type { NewEstablishment, NewEstablishmentAdmin } from './types';

// ===========================
// ESTABLISHMENT MANAGEMENT
// ===========================

/**
 * Create a new establishment
 */
async function createEstablishment(establishmentData: NewEstablishment) {
  const [establishment] = await db
    .insert(establishments)
    .values(establishmentData)
    .returning();

  return establishment;
}

/**
 * Get establishment by ID with all details
 */
async function getEstablishmentById(id: number) {
  const result = await db
    .select()
    .from(establishments)
    .where(eq(establishments.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Get establishment with admins
 */
async function getEstablishmentWithAdmins(id: number) {
  const establishment = await getEstablishmentById(id);
  if (!establishment) return null;

  const admins = await db
    .select()
    .from(establishmentAdmins)
    .leftJoin(profiles, eq(establishmentAdmins.userId, profiles.id))
    .where(eq(establishmentAdmins.establishmentId, id));

  return {
    ...establishment,
    admins: admins.map(row => ({
      ...row.establishment_admins!,
      user: row.profiles,
    })),
  };
}

/**
 * Get establishment with complete details (admins, fighters, championships)
 */
async function getEstablishmentDetails(id: number) {
  const establishment = await getEstablishmentById(id);
  if (!establishment) return null;

  const [admins, establishmentFighters, establishmentChampionships] = await Promise.all([
    db
      .select()
      .from(establishmentAdmins)
      .leftJoin(profiles, eq(establishmentAdmins.userId, profiles.id))
      .where(eq(establishmentAdmins.establishmentId, id)),
    
    db
      .select()
      .from(fighters)
      .where(eq(fighters.establishmentId, id)),
    
    db
      .select()
      .from(championships)
      .where(eq(championships.establishmentId, id)),
  ]);

  return {
    ...establishment,
    admins: admins.map(row => ({
      ...row.establishment_admins!,
      user: row.profiles,
    })),
    fighters: establishmentFighters,
    championships: establishmentChampionships,
  };
}

/**
 * Update establishment information
 */
async function updateEstablishment(
  id: number,
  data: Partial<Omit<NewEstablishment, 'id'>>
) {
  const [establishment] = await db
    .update(establishments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(establishments.id, id))
    .returning();

  return establishment;
}

/**
 * Deactivate establishment (soft delete)
 */
async function deactivateEstablishment(id: number) {
  return updateEstablishment(id, { isActive: false });
}

/**
 * Verify establishment (platform admin only)
 */
async function verifyEstablishment(id: number) {
  return updateEstablishment(id, { isVerified: true });
}

/**
 * Get all active establishments
 */
async function getActiveEstablishments(limit = 50) {
  return await db
    .select()
    .from(establishments)
    .where(eq(establishments.isActive, true))
    .orderBy(establishments.name)
    .limit(limit);
}

/**
 * Get establishments by type
 */
async function getEstablishmentsByType(
  type: 'gym' | 'school' | 'academy' | 'federation' | 'promotion' | 'club' | 'other'
) {
  return await db
    .select()
    .from(establishments)
    .where(and(
      eq(establishments.type, type),
      eq(establishments.isActive, true)
    ))
    .orderBy(establishments.name);
}

// ===========================
// ESTABLISHMENT ADMIN MANAGEMENT
// ===========================

/**
 * Add user as admin to an establishment
 */
async function addEstablishmentAdmin(
  establishmentId: number,
  userId: string,
  role: string = 'admin',
  permissions: {
    canCreateChampionships?: boolean;
    canManageFighters?: boolean;
    canScheduleFights?: boolean;
  } = {}
) {
  const adminData: NewEstablishmentAdmin = {
    establishmentId,
    userId,
    role,
    canCreateChampionships: permissions.canCreateChampionships ?? true,
    canManageFighters: permissions.canManageFighters ?? true,
    canScheduleFights: permissions.canScheduleFights ?? true,
    isActive: true,
  };

  const [admin] = await db
    .insert(establishmentAdmins)
    .values(adminData)
    .returning();

  // Update user role to 'manager' if not already admin
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (profile && profile.role === 'viewer') {
    await db
      .update(profiles)
      .set({ role: 'manager', updatedAt: new Date() })
      .where(eq(profiles.id, userId));
  }

  return admin;
}

/**
 * Remove admin from establishment
 */
async function removeEstablishmentAdmin(establishmentId: number, userId: string) {
  await db
    .delete(establishmentAdmins)
    .where(
      and(
        eq(establishmentAdmins.establishmentId, establishmentId),
        eq(establishmentAdmins.userId, userId)
      )
    );
}

/**
 * Update establishment admin permissions
 */
async function updateEstablishmentAdminPermissions(
  establishmentId: number,
  userId: string,
  permissions: {
    canCreateChampionships?: boolean;
    canManageFighters?: boolean;
    canScheduleFights?: boolean;
    role?: string;
  }
) {
  const [admin] = await db
    .update(establishmentAdmins)
    .set({ ...permissions, updatedAt: new Date() })
    .where(
      and(
        eq(establishmentAdmins.establishmentId, establishmentId),
        eq(establishmentAdmins.userId, userId)
      )
    )
    .returning();

  return admin;
}

/**
 * Get all establishments managed by a user
 */
async function getUserEstablishments(userId: string) {
  const result = await db
    .select()
    .from(establishmentAdmins)
    .leftJoin(establishments, eq(establishmentAdmins.establishmentId, establishments.id))
    .where(
      and(
        eq(establishmentAdmins.userId, userId),
        eq(establishmentAdmins.isActive, true)
      )
    );

  return result.map(row => ({
    ...row.establishments!,
    adminRole: row.establishment_admins!.role,
    permissions: {
      canCreateChampionships: row.establishment_admins!.canCreateChampionships,
      canManageFighters: row.establishment_admins!.canManageFighters,
      canScheduleFights: row.establishment_admins!.canScheduleFights,
    },
  }));
}

/**
 * Get establishment admins
 */
async function getEstablishmentAdmins(establishmentId: number) {
  const result = await db
    .select()
    .from(establishmentAdmins)
    .leftJoin(profiles, eq(establishmentAdmins.userId, profiles.id))
    .where(
      and(
        eq(establishmentAdmins.establishmentId, establishmentId),
        eq(establishmentAdmins.isActive, true)
      )
    );

  return result.map(row => ({
    ...row.establishment_admins!,
    user: row.profiles,
  }));
}

// ===========================
// AUTHORIZATION HELPERS
// ===========================

/**
 * Check if user is admin of a specific establishment
 */
async function isEstablishmentAdmin(userId: string, establishmentId: number) {
  const result = await db
    .select()
    .from(establishmentAdmins)
    .where(
      and(
        eq(establishmentAdmins.userId, userId),
        eq(establishmentAdmins.establishmentId, establishmentId),
        eq(establishmentAdmins.isActive, true)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user can create championships for establishment
 */
async function canUserCreateChampionships(userId: string, establishmentId: number) {
  const result = await db
    .select()
    .from(establishmentAdmins)
    .where(
      and(
        eq(establishmentAdmins.userId, userId),
        eq(establishmentAdmins.establishmentId, establishmentId),
        eq(establishmentAdmins.isActive, true),
        eq(establishmentAdmins.canCreateChampionships, true)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user can manage fighters for establishment
 */
async function canUserManageFighters(userId: string, establishmentId: number) {
  const result = await db
    .select()
    .from(establishmentAdmins)
    .where(
      and(
        eq(establishmentAdmins.userId, userId),
        eq(establishmentAdmins.establishmentId, establishmentId),
        eq(establishmentAdmins.isActive, true),
        eq(establishmentAdmins.canManageFighters, true)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user can schedule fights for establishment
 */
async function canUserScheduleFights(userId: string, establishmentId: number) {
  const result = await db
    .select()
    .from(establishmentAdmins)
    .where(
      and(
        eq(establishmentAdmins.userId, userId),
        eq(establishmentAdmins.establishmentId, establishmentId),
        eq(establishmentAdmins.isActive, true),
        eq(establishmentAdmins.canScheduleFights, true)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user manages any establishment
 */
async function isUserEstablishmentManager(userId: string) {
  const result = await db
    .select()
    .from(establishmentAdmins)
    .where(
      and(
        eq(establishmentAdmins.userId, userId),
        eq(establishmentAdmins.isActive, true)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Get user's establishment admin role
 */
async function getUserEstablishmentRole(userId: string, establishmentId: number) {
  const result = await db
    .select()
    .from(establishmentAdmins)
    .where(
      and(
        eq(establishmentAdmins.userId, userId),
        eq(establishmentAdmins.establishmentId, establishmentId),
        eq(establishmentAdmins.isActive, true)
      )
    )
    .limit(1);

  return result[0] || null;
}

// ===========================
// FIGHTER-ESTABLISHMENT LINKING
// ===========================

/**
 * Link fighter to establishment
 */
async function linkFighterToEstablishment(fighterId: number, establishmentId: number) {
  const [fighter] = await db
    .update(fighters)
    .set({ establishmentId, updatedAt: new Date() })
    .where(eq(fighters.id, fighterId))
    .returning();

  return fighter;
}

/**
 * Unlink fighter from establishment
 */
async function unlinkFighterFromEstablishment(fighterId: number) {
  const [fighter] = await db
    .update(fighters)
    .set({ establishmentId: null, updatedAt: new Date() })
    .where(eq(fighters.id, fighterId))
    .returning();

  return fighter;
}

/**
 * Get all fighters for an establishment
 */
async function getEstablishmentFighters(establishmentId: number) {
  return await db
    .select()
    .from(fighters)
    .where(eq(fighters.establishmentId, establishmentId));
}

// ===========================
// CHAMPIONSHIP-ESTABLISHMENT
// ===========================

/**
 * Get championships for an establishment
 */
async function getEstablishmentChampionships(establishmentId: number) {
  return await db
    .select()
    .from(championships)
    .where(eq(championships.establishmentId, establishmentId))
    .orderBy(championships.startDate);
}

// ===========================
// EXPORTS
// ===========================

export {
  // Establishment management
  createEstablishment,
  getEstablishmentById,
  getEstablishmentWithAdmins,
  getEstablishmentDetails,
  updateEstablishment,
  deactivateEstablishment,
  verifyEstablishment,
  getActiveEstablishments,
  getEstablishmentsByType,
  
  // Admin management
  addEstablishmentAdmin,
  removeEstablishmentAdmin,
  updateEstablishmentAdminPermissions,
  getUserEstablishments,
  getEstablishmentAdmins,
  
  // Authorization
  isEstablishmentAdmin,
  canUserCreateChampionships,
  canUserManageFighters,
  canUserScheduleFights,
  isUserEstablishmentManager,
  getUserEstablishmentRole,
  
  // Fighter-establishment linking
  linkFighterToEstablishment,
  unlinkFighterFromEstablishment,
  getEstablishmentFighters,
  
  // Championships
  getEstablishmentChampionships,
};

