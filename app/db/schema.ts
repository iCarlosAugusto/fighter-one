import { pgTable, serial, text, varchar, timestamp, integer, decimal, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ===========================
// ENUMS
// ===========================

export const fightStatusEnum = pgEnum('fight_status', ['scheduled', 'in_progress', 'completed', 'cancelled']);
export const fightResultEnum = pgEnum('fight_result', ['ko', 'tko', 'submission', 'decision', 'draw', 'no_contest', 'disqualification']);
export const championshipStatusEnum = pgEnum('championship_status', ['draft', 'registration_open', 'in_progress', 'completed', 'cancelled']);
export const championshipTypeEnum = pgEnum('championship_type', ['single_elimination', 'double_elimination', 'round_robin']);
export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);

// ===========================
// CORE TABLES
// ===========================

// Weight Classes Table
export const weightClasses = pgTable('weight_classes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  minWeight: decimal('min_weight', { precision: 5, scale: 2 }).notNull(), // in kg
  maxWeight: decimal('max_weight', { precision: 5, scale: 2 }).notNull(), // in kg
  gender: genderEnum('gender').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Fighters Table (renamed from athletes for domain clarity)
export const fighters = pgTable('fighters', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  email: varchar('email', { length: 256 }).unique(),
  phone: varchar('phone', { length: 50 }),
  
  // Physical attributes
  weight: decimal('weight', { precision: 5, scale: 2 }).notNull(), // current weight in kg
  height: integer('height').notNull(), // in cm
  reach: integer('reach'), // arm reach in cm
  gender: genderEnum('gender').notNull(),
  birthDate: timestamp('birth_date').notNull(),
  
  // Location
  nationality: varchar('nationality', { length: 100 }),
  country: varchar('country', { length: 100 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  
  // Fighting profile
  weightClassId: integer('weight_class_id').references(() => weightClasses.id),
  stance: varchar('stance', { length: 50 }), // orthodox, southpaw, switch
  fightingStyle: varchar('fighting_style', { length: 100 }), // striker, grappler, etc
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isSuspended: boolean('is_suspended').default(false).notNull(),
  suspendedUntil: timestamp('suspended_until'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Fighter Stats Table (computed/denormalized for performance)
export const fighterStats = pgTable('fighter_stats', {
  id: serial('id').primaryKey(),
  fighterId: integer('fighter_id').references(() => fighters.id, { onDelete: 'cascade' }).notNull().unique(),
  
  // Record
  totalFights: integer('total_fights').default(0).notNull(),
  wins: integer('wins').default(0).notNull(),
  losses: integer('losses').default(0).notNull(),
  draws: integer('draws').default(0).notNull(),
  noContests: integer('no_contests').default(0).notNull(),
  
  // Win breakdown
  winsKo: integer('wins_ko').default(0).notNull(),
  winsTko: integer('wins_tko').default(0).notNull(),
  winsSubmission: integer('wins_submission').default(0).notNull(),
  winsDecision: integer('wins_decision').default(0).notNull(),
  
  // Performance metrics
  currentStreak: integer('current_streak').default(0).notNull(), // positive = win streak, negative = loss streak
  longestWinStreak: integer('longest_win_streak').default(0).notNull(),
  averageFightDuration: integer('average_fight_duration'), // in seconds
  finishRate: decimal('finish_rate', { precision: 5, scale: 2 }).default('0'), // percentage
  
  // Ranking
  rankingPoints: decimal('ranking_points', { precision: 10, scale: 2 }).default('1000').notNull(), // ELO-style rating
  rankingPosition: integer('ranking_position'), // global rank
  weightClassRank: integer('weight_class_rank'), // rank within weight class
  
  // Championship history
  championshipWins: integer('championship_wins').default(0).notNull(),
  championshipAppearances: integer('championship_appearances').default(0).notNull(),
  
  // Last updated
  lastFightDate: timestamp('last_fight_date'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Fights Table
export const fights = pgTable('fights', {
  id: serial('id').primaryKey(),
  
  // Fighters
  fighter1Id: integer('fighter1_id').references(() => fighters.id).notNull(),
  fighter2Id: integer('fighter2_id').references(() => fighters.id).notNull(),
  
  // Fight details
  scheduledDate: timestamp('scheduled_date').notNull(),
  actualDate: timestamp('actual_date'),
  location: varchar('location', { length: 256 }),
  venue: varchar('venue', { length: 256 }),
  
  // Weight class & rules
  weightClassId: integer('weight_class_id').references(() => weightClasses.id),
  scheduledRounds: integer('scheduled_rounds').default(3).notNull(),
  roundDuration: integer('round_duration').default(300).notNull(), // in seconds (5 min default)
  
  // Status
  status: fightStatusEnum('status').default('scheduled').notNull(),
  
  // Results (nullable until fight is completed)
  winnerId: integer('winner_id').references(() => fighters.id),
  loserId: integer('loser_id').references(() => fighters.id),
  result: fightResultEnum('result'),
  resultDetails: text('result_details'), // e.g., "Round 2, 3:45"
  endedInRound: integer('ended_in_round'),
  fightDuration: integer('fight_duration'), // total seconds
  
  // Additional info
  isMainEvent: boolean('is_main_event').default(false).notNull(),
  isTitleFight: boolean('is_title_fight').default(false).notNull(),
  notes: text('notes'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Championships Table
export const championships = pgTable('championships', {
  id: serial('id').primaryKey(),
  
  // Basic info
  name: varchar('name', { length: 256 }).notNull(),
  description: text('description'),
  type: championshipTypeEnum('type').default('single_elimination').notNull(),
  
  // Configuration
  weightClassId: integer('weight_class_id').references(() => weightClasses.id),
  maxParticipants: integer('max_participants').notNull(), // must be power of 2 for elimination
  minParticipants: integer('min_participants').default(2).notNull(),
  
  // Dates
  registrationStartDate: timestamp('registration_start_date').notNull(),
  registrationEndDate: timestamp('registration_end_date').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  
  // Status
  status: championshipStatusEnum('status').default('draft').notNull(),
  currentRound: integer('current_round').default(0).notNull(), // 0 = not started
  
  // Prize/prestige
  prizePool: decimal('prize_pool', { precision: 10, scale: 2 }),
  rankingPointsMultiplier: decimal('ranking_points_multiplier', { precision: 3, scale: 2 }).default('1.5').notNull(),
  
  // Results
  winnerId: integer('winner_id').references(() => fighters.id),
  runnerUpId: integer('runner_up_id').references(() => fighters.id),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Championship Participants (many-to-many relationship)
export const championshipParticipants = pgTable('championship_participants', {
  id: serial('id').primaryKey(),
  
  championshipId: integer('championship_id').references(() => championships.id, { onDelete: 'cascade' }).notNull(),
  fighterId: integer('fighter_id').references(() => fighters.id, { onDelete: 'cascade' }).notNull(),
  
  // Bracket info
  seedNumber: integer('seed_number'), // seeding position
  isEliminated: boolean('is_eliminated').default(false).notNull(),
  eliminatedInRound: integer('eliminated_in_round'),
  finalPlacement: integer('final_placement'), // 1 = winner, 2 = runner-up, etc.
  
  // Registration
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
  approvedAt: timestamp('approved_at'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Championship Matches (links fights to championships)
export const championshipMatches = pgTable('championship_matches', {
  id: serial('id').primaryKey(),
  
  championshipId: integer('championship_id').references(() => championships.id, { onDelete: 'cascade' }).notNull(),
  fightId: integer('fight_id').references(() => fights.id, { onDelete: 'cascade' }).notNull(),
  
  // Bracket position
  round: integer('round').notNull(), // 1 = final, 2 = semi-final, 3 = quarter-final, etc.
  matchNumber: integer('match_number').notNull(), // position within the round
  
  // For double elimination
  bracketType: varchar('bracket_type', { length: 50 }).default('winners'), // winners, losers, grand_final
  
  // Next match progression
  nextMatchId: integer('next_match_id').references((): any => championshipMatches.id),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===========================
// RELATIONS
// ===========================

export const weightClassesRelations = relations(weightClasses, ({ many }) => ({
  fighters: many(fighters),
  fights: many(fights),
  championships: many(championships),
}));

export const fightersRelations = relations(fighters, ({ one, many }) => ({
  weightClass: one(weightClasses, {
    fields: [fighters.weightClassId],
    references: [weightClasses.id],
  }),
  stats: one(fighterStats),
  fightsAsFighter1: many(fights, { relationName: 'fighter1' }),
  fightsAsFighter2: many(fights, { relationName: 'fighter2' }),
  wins: many(fights, { relationName: 'winner' }),
  losses: many(fights, { relationName: 'loser' }),
  championshipParticipations: many(championshipParticipants),
  championshipWins: many(championships, { relationName: 'championshipWinner' }),
  championshipRunnerUps: many(championships, { relationName: 'championshipRunnerUp' }),
}));

export const fighterStatsRelations = relations(fighterStats, ({ one }) => ({
  fighter: one(fighters, {
    fields: [fighterStats.fighterId],
    references: [fighters.id],
  }),
}));

export const fightsRelations = relations(fights, ({ one }) => ({
  fighter1: one(fighters, {
    fields: [fights.fighter1Id],
    references: [fighters.id],
    relationName: 'fighter1',
  }),
  fighter2: one(fighters, {
    fields: [fights.fighter2Id],
    references: [fighters.id],
    relationName: 'fighter2',
  }),
  winner: one(fighters, {
    fields: [fights.winnerId],
    references: [fighters.id],
    relationName: 'winner',
  }),
  loser: one(fighters, {
    fields: [fights.loserId],
    references: [fighters.id],
    relationName: 'loser',
  }),
  weightClass: one(weightClasses, {
    fields: [fights.weightClassId],
    references: [weightClasses.id],
  }),
}));

export const championshipsRelations = relations(championships, ({ one, many }) => ({
  weightClass: one(weightClasses, {
    fields: [championships.weightClassId],
    references: [weightClasses.id],
  }),
  winner: one(fighters, {
    fields: [championships.winnerId],
    references: [fighters.id],
    relationName: 'championshipWinner',
  }),
  runnerUp: one(fighters, {
    fields: [championships.runnerUpId],
    references: [fighters.id],
    relationName: 'championshipRunnerUp',
  }),
  participants: many(championshipParticipants),
  matches: many(championshipMatches),
}));

export const championshipParticipantsRelations = relations(championshipParticipants, ({ one }) => ({
  championship: one(championships, {
    fields: [championshipParticipants.championshipId],
    references: [championships.id],
  }),
  fighter: one(fighters, {
    fields: [championshipParticipants.fighterId],
    references: [fighters.id],
  }),
}));

export const championshipMatchesRelations = relations(championshipMatches, ({ one }) => ({
  championship: one(championships, {
    fields: [championshipMatches.championshipId],
    references: [championships.id],
  }),
  fight: one(fights, {
    fields: [championshipMatches.fightId],
    references: [fights.id],
  }),
  nextMatch: one(championshipMatches, {
    fields: [championshipMatches.nextMatchId],
    references: [championshipMatches.id],
  }),
}));