/**
 * Common database queries
 * Reusable query functions for the Fighter Management App
 */

import { db } from './index';
import { 
  fighters, 
  fighterStats, 
  fights, 
  championships,
  championshipParticipants,
  championshipMatches,
  weightClasses 
} from './schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import type { FighterWithStats, FightWithDetails, ChampionshipWithDetails } from './types';

// ===========================
// FIGHTER QUERIES
// ===========================

/**
 * Get fighter with stats and weight class
 */
export async function getFighterById(id: number) {
  const result = await db
    .select()
    .from(fighters)
    .leftJoin(fighterStats, eq(fighters.id, fighterStats.fighterId))
    .leftJoin(weightClasses, eq(fighters.weightClassId, weightClasses.id))
    .where(eq(fighters.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0].fighters,
    stats: result[0].fighter_stats,
    weightClass: result[0].weight_classes,
  } as FighterWithStats;
}

/**
 * Get all active fighters with stats
 */
export async function getActiveFighters(limit = 100) {
  const result = await db
    .select()
    .from(fighters)
    .leftJoin(fighterStats, eq(fighters.id, fighterStats.fighterId))
    .leftJoin(weightClasses, eq(fighters.weightClassId, weightClasses.id))
    .where(eq(fighters.isActive, true))
    .orderBy(desc(fighterStats.rankingPoints))
    .limit(limit);

  return result.map(row => ({
    ...row.fighters,
    stats: row.fighter_stats,
    weightClass: row.weight_classes,
  })) as FighterWithStats[];
}

/**
 * Get fighters ranked by weight class
 */
export async function getFightersByWeightClass(weightClassId: number) {
  const result = await db
    .select()
    .from(fighters)
    .leftJoin(fighterStats, eq(fighters.id, fighterStats.fighterId))
    .where(
      and(
        eq(fighters.weightClassId, weightClassId),
        eq(fighters.isActive, true)
      )
    )
    .orderBy(desc(fighterStats.rankingPoints));

  return result.map(row => ({
    ...row.fighters,
    stats: row.fighter_stats,
  }));
}

/**
 * Get top ranked fighters globally
 */
export async function getTopRankedFighters(limit = 10) {
  const result = await db
    .select()
    .from(fighters)
    .leftJoin(fighterStats, eq(fighters.id, fighterStats.fighterId))
    .leftJoin(weightClasses, eq(fighters.weightClassId, weightClasses.id))
    .where(eq(fighters.isActive, true))
    .orderBy(desc(fighterStats.rankingPoints))
    .limit(limit);

  return result.map((row, index) => ({
    rank: index + 1,
    ...row.fighters,
    stats: row.fighter_stats,
    weightClass: row.weight_classes,
  }));
}

// ===========================
// FIGHT QUERIES
// ===========================

/**
 * Get fight with all details
 */
export async function getFightById(id: number) {
  const result = await db
    .select()
    .from(fights)
    .leftJoin(fighters, eq(fights.fighter1Id, fighters.id))
    .where(eq(fights.id, id))
    .limit(1);

  // Would need more complex joins for complete details
  return result[0] || null;
}

/**
 * Get upcoming scheduled fights
 */
export async function getUpcomingFights(limit = 20) {
  return await db
    .select()
    .from(fights)
    .where(
      or(
        eq(fights.status, 'scheduled'),
        eq(fights.status, 'in_progress')
      )
    )
    .orderBy(fights.scheduledDate)
    .limit(limit);
}

/**
 * Get fight history for a fighter
 */
export async function getFighterFightHistory(fighterId: number, limit = 20) {
  return await db
    .select()
    .from(fights)
    .where(
      and(
        or(
          eq(fights.fighter1Id, fighterId),
          eq(fights.fighter2Id, fighterId)
        ),
        eq(fights.status, 'completed')
      )
    )
    .orderBy(desc(fights.actualDate))
    .limit(limit);
}

// ===========================
// CHAMPIONSHIP QUERIES
// ===========================

/**
 * Get championship with participants
 */
export async function getChampionshipById(id: number) {
  const championship = await db
    .select()
    .from(championships)
    .leftJoin(weightClasses, eq(championships.weightClassId, weightClasses.id))
    .where(eq(championships.id, id))
    .limit(1);

  if (championship.length === 0) return null;

  const participants = await db
    .select()
    .from(championshipParticipants)
    .leftJoin(fighters, eq(championshipParticipants.fighterId, fighters.id))
    .where(eq(championshipParticipants.championshipId, id))
    .orderBy(championshipParticipants.seedNumber);

  const matches = await db
    .select()
    .from(championshipMatches)
    .leftJoin(fights, eq(championshipMatches.fightId, fights.id))
    .where(eq(championshipMatches.championshipId, id))
    .orderBy(championshipMatches.round, championshipMatches.matchNumber);

  return {
    ...championship[0].championships,
    weightClass: championship[0].weight_classes,
    participants: participants.map(p => ({
      ...p.championship_participants,
      fighter: p.fighters,
    })),
    matches: matches.map(m => ({
      ...m.championship_matches,
      fight: m.fights,
    })),
  };
}

/**
 * Get active championships
 */
export async function getActiveChampionships() {
  return await db
    .select()
    .from(championships)
    .leftJoin(weightClasses, eq(championships.weightClassId, weightClasses.id))
    .where(
      or(
        eq(championships.status, 'registration_open'),
        eq(championships.status, 'in_progress')
      )
    )
    .orderBy(championships.startDate);
}

/**
 * Get championship participants by championship
 */
export async function getChampionshipParticipants(championshipId: number) {
  const result = await db
    .select()
    .from(championshipParticipants)
    .leftJoin(fighters, eq(championshipParticipants.fighterId, fighters.id))
    .leftJoin(fighterStats, eq(fighters.id, fighterStats.fighterId))
    .where(eq(championshipParticipants.championshipId, championshipId))
    .orderBy(championshipParticipants.seedNumber);

  return result.map(row => ({
    ...row.championship_participants,
    fighter: {
      ...row.fighters,
      stats: row.fighter_stats,
    },
  }));
}

// ===========================
// WEIGHT CLASS QUERIES
// ===========================

/**
 * Get all active weight classes
 */
export async function getActiveWeightClasses() {
  return await db
    .select()
    .from(weightClasses)
    .where(eq(weightClasses.isActive, true))
    .orderBy(weightClasses.gender, weightClasses.minWeight);
}

/**
 * Get weight class by ID
 */
export async function getWeightClassById(id: number) {
  const result = await db
    .select()
    .from(weightClasses)
    .where(eq(weightClasses.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Find appropriate weight class for a fighter's weight
 */
export async function findWeightClassForWeight(weight: number, gender: 'male' | 'female' | 'other') {
  const result = await db
    .select()
    .from(weightClasses)
    .where(
      and(
        eq(weightClasses.gender, gender),
        eq(weightClasses.isActive, true),
        sql`${weightClasses.minWeight} <= ${weight}`,
        sql`${weightClasses.maxWeight} >= ${weight}`
      )
    )
    .limit(1);

  return result[0] || null;
}

// ===========================
// STATS QUERIES
// ===========================

/**
 * Get fighter stats summary
 */
export async function getFighterStats(fighterId: number) {
  const result = await db
    .select()
    .from(fighterStats)
    .where(eq(fighterStats.fighterId, fighterId))
    .limit(1);

  return result[0] || null;
}

/**
 * Get fighters with longest win streaks
 */
export async function getTopWinStreaks(limit = 10) {
  const result = await db
    .select()
    .from(fighterStats)
    .leftJoin(fighters, eq(fighterStats.fighterId, fighters.id))
    .where(and(
      eq(fighters.isActive, true),
      sql`${fighterStats.currentStreak} > 0`
    ))
    .orderBy(desc(fighterStats.currentStreak))
    .limit(limit);

  return result.map(row => ({
    fighter: row.fighters,
    stats: row.fighter_stats,
  }));
}

