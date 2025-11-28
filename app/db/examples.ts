/**
 * Example usage patterns for the Fighter Management database
 * These examples show how to use the schema, queries, and types
 */

import { db } from './index';
import { 
  fighters, 
  fighterStats, 
  fights, 
  championships,
  championshipParticipants,
  weightClasses 
} from './schema';
import { 
  getFighterById, 
  getActiveFighters, 
  getTopRankedFighters,
  getFighterFightHistory,
  getChampionshipById,
  findWeightClassForWeight
} from './queries';
import type { NewFighter, NewFighterStats, NewFight } from './types';
import { eq } from 'drizzle-orm';

// ===========================
// EXAMPLE 1: Register a New Fighter
// ===========================

async function registerFighter() {
  // Step 1: Find appropriate weight class
  const weightClass = await findWeightClassForWeight(70.5, 'male');
  
  if (!weightClass) {
    throw new Error('No weight class found for this weight');
  }

  // Step 2: Insert fighter
  const newFighter: NewFighter = {
    name: 'John "The Destroyer" Doe',
    nickname: 'The Destroyer',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    weight: '70.50',
    height: 180, // cm
    reach: 185, // cm
    gender: 'male',
    birthDate: new Date('1995-05-15'),
    nationality: 'American',
    country: 'USA',
    city: 'Las Vegas',
    state: 'Nevada',
    weightClassId: weightClass.id,
    stance: 'orthodox',
    fightingStyle: 'striker',
    isActive: true,
  };

  const [fighter] = await db.insert(fighters).values(newFighter).returning();

  // Step 3: Initialize fighter stats
  const newStats: NewFighterStats = {
    fighterId: fighter.id,
    totalFights: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    rankingPoints: '1000', // Starting ELO
  };

  await db.insert(fighterStats).values(newStats);

  console.log('Fighter registered:', fighter.name);
  return fighter;
}

// ===========================
// EXAMPLE 2: Schedule a Fight
// ===========================

async function scheduleFight(fighter1Id: number, fighter2Id: number) {
  // Verify both fighters exist and are active
  const [fighter1, fighter2] = await Promise.all([
    getFighterById(fighter1Id),
    getFighterById(fighter2Id),
  ]);

  if (!fighter1 || !fighter2) {
    throw new Error('One or both fighters not found');
  }

  if (!fighter1.isActive || !fighter2.isActive) {
    throw new Error('Both fighters must be active');
  }

  // Create fight
  const newFight: NewFight = {
    fighter1Id: fighter1.id,
    fighter2Id: fighter2.id,
    scheduledDate: new Date('2024-12-31T20:00:00Z'),
    location: 'Las Vegas, Nevada',
    venue: 'T-Mobile Arena',
    weightClassId: fighter1.weightClassId!,
    scheduledRounds: 3,
    roundDuration: 300, // 5 minutes
    status: 'scheduled',
    isMainEvent: false,
    isTitleFight: false,
  };

  const [fight] = await db.insert(fights).values(newFight).returning();

  console.log(`Fight scheduled: ${fighter1.name} vs ${fighter2.name}`);
  return fight;
}

// ===========================
// EXAMPLE 3: Record Fight Result
// ===========================

async function recordFightResult(
  fightId: number,
  winnerId: number,
  loserId: number,
  result: 'ko' | 'tko' | 'submission' | 'decision',
  endedInRound: number,
  fightDuration: number
) {
  // Update fight
  await db
    .update(fights)
    .set({
      status: 'completed',
      actualDate: new Date(),
      winnerId,
      loserId,
      result,
      endedInRound,
      fightDuration,
      resultDetails: `Round ${endedInRound}, ${Math.floor(fightDuration / 60)}:${fightDuration % 60}`,
    })
    .where(eq(fights.id, fightId));

  // Update winner stats
  const [winnerStats] = await db
    .select()
    .from(fighterStats)
    .where(eq(fighterStats.fighterId, winnerId));

  const newWinnerStreak = winnerStats.currentStreak >= 0 
    ? winnerStats.currentStreak + 1 
    : 1;

  const winTypeField = 
    result === 'ko' ? 'winsKo' :
    result === 'tko' ? 'winsTko' :
    result === 'submission' ? 'winsSubmission' : 'winsDecision';

  await db
    .update(fighterStats)
    .set({
      totalFights: winnerStats.totalFights + 1,
      wins: winnerStats.wins + 1,
      [winTypeField]: winnerStats[winTypeField] + 1,
      currentStreak: newWinnerStreak,
      longestWinStreak: Math.max(winnerStats.longestWinStreak, newWinnerStreak),
      lastFightDate: new Date(),
      // TODO: Calculate new ranking points using ELO
    })
    .where(eq(fighterStats.fighterId, winnerId));

  // Update loser stats
  const [loserStats] = await db
    .select()
    .from(fighterStats)
    .where(eq(fighterStats.fighterId, loserId));

  const newLoserStreak = loserStats.currentStreak <= 0 
    ? loserStats.currentStreak - 1 
    : -1;

  await db
    .update(fighterStats)
    .set({
      totalFights: loserStats.totalFights + 1,
      losses: loserStats.losses + 1,
      currentStreak: newLoserStreak,
      lastFightDate: new Date(),
      // TODO: Calculate new ranking points using ELO
    })
    .where(eq(fighterStats.fighterId, loserId));

  console.log('Fight result recorded');
}

// ===========================
// EXAMPLE 4: Create Championship
// ===========================

async function createChampionship() {
  const [championship] = await db
    .insert(championships)
    .values({
      name: 'Lightweight World Championship 2024',
      description: 'Single elimination tournament to crown the lightweight champion',
      type: 'single_elimination',
      weightClassId: 4, // Lightweight
      maxParticipants: 8, // Must be power of 2
      minParticipants: 8,
      registrationStartDate: new Date('2024-01-01'),
      registrationEndDate: new Date('2024-01-31'),
      startDate: new Date('2024-03-01'),
      status: 'registration_open',
      prizePool: '100000',
      rankingPointsMultiplier: '1.5',
    })
    .returning();

  console.log('Championship created:', championship.name);
  return championship;
}

// ===========================
// EXAMPLE 5: Register Fighter for Championship
// ===========================

async function registerForChampionship(championshipId: number, fighterId: number) {
  // Verify fighter eligibility
  const fighter = await getFighterById(fighterId);
  
  if (!fighter || !fighter.isActive) {
    throw new Error('Fighter not eligible');
  }

  // Get championship
  const championship = await getChampionshipById(championshipId);
  
  if (!championship || championship.status !== 'registration_open') {
    throw new Error('Championship registration is not open');
  }

  // Check weight class match
  if (fighter.weightClassId !== championship.weightClassId) {
    throw new Error('Fighter weight class does not match championship');
  }

  // Register
  await db
    .insert(championshipParticipants)
    .values({
      championshipId,
      fighterId,
      registeredAt: new Date(),
      approvedAt: new Date(), // Auto-approve for now
    });

  console.log(`${fighter.name} registered for ${championship.name}`);
}

// ===========================
// EXAMPLE 6: Get Fighter Profile with Stats
// ===========================

async function getFighterProfile(fighterId: number) {
  const fighter = await getFighterById(fighterId);
  
  if (!fighter) {
    throw new Error('Fighter not found');
  }

  const fightHistory = await getFighterFightHistory(fighterId, 10);

  return {
    profile: {
      name: fighter.name,
      nickname: fighter.nickname,
      record: fighter.stats 
        ? `${fighter.stats.wins}-${fighter.stats.losses}-${fighter.stats.draws}`
        : '0-0-0',
      weightClass: fighter.weightClass?.name,
      ranking: fighter.stats?.rankingPosition,
      rankingPoints: fighter.stats?.rankingPoints,
    },
    stats: fighter.stats,
    recentFights: fightHistory,
  };
}

// ===========================
// EXAMPLE 7: Get Leaderboard
// ===========================

async function getLeaderboard(limit = 10) {
  const topFighters = await getTopRankedFighters(limit);

  return topFighters.map((fighter, index) => ({
    rank: index + 1,
    name: fighter.name,
    record: fighter.stats 
      ? `${fighter.stats.wins}-${fighter.stats.losses}-${fighter.stats.draws}`
      : '0-0-0',
    weightClass: fighter.weightClass?.name,
    rankingPoints: fighter.stats?.rankingPoints,
    streak: fighter.stats?.currentStreak,
  }));
}

// ===========================
// EXAMPLE 8: Get Active Championships
// ===========================

async function getActiveChampionshipsList() {
  const activeChampionships = await db
    .select()
    .from(championships)
    .leftJoin(weightClasses, eq(championships.weightClassId, weightClasses.id))
    .where(eq(championships.status, 'in_progress'));

  return activeChampionships.map(row => ({
    id: row.championships.id,
    name: row.championships.name,
    weightClass: row.weight_classes?.name,
    currentRound: row.championships.currentRound,
    startDate: row.championships.startDate,
  }));
}

// ===========================
// EXAMPLE 9: Bulk Fighter Import
// ===========================

async function bulkImportFighters(fightersData: NewFighter[]) {
  // Insert all fighters
  const insertedFighters = await db
    .insert(fighters)
    .values(fightersData)
    .returning();

  // Create stats for each fighter
  const statsData = insertedFighters.map(fighter => ({
    fighterId: fighter.id,
    totalFights: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    rankingPoints: '1000',
  }));

  await db.insert(fighterStats).values(statsData);

  console.log(`Imported ${insertedFighters.length} fighters`);
  return insertedFighters;
}

// ===========================
// Export examples
// ===========================

export {
  registerFighter,
  scheduleFight,
  recordFightResult,
  createChampionship,
  registerForChampionship,
  getFighterProfile,
  getLeaderboard,
  getActiveChampionshipsList,
  bulkImportFighters,
};

