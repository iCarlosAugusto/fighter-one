/**
 * Database type definitions and helpers
 */

import type { 
  profiles,
  establishments,
  establishmentAdmins,
  fighters, 
  fighterStats, 
  fights, 
  championships, 
  championshipParticipants,
  championshipMatches,
  weightClasses 
} from './schema';

// Infer types from schema
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type Establishment = typeof establishments.$inferSelect;
export type NewEstablishment = typeof establishments.$inferInsert;

export type EstablishmentAdmin = typeof establishmentAdmins.$inferSelect;
export type NewEstablishmentAdmin = typeof establishmentAdmins.$inferInsert;

export type Fighter = typeof fighters.$inferSelect;
export type NewFighter = typeof fighters.$inferInsert;

export type FighterStats = typeof fighterStats.$inferSelect;
export type NewFighterStats = typeof fighterStats.$inferInsert;

export type Fight = typeof fights.$inferSelect;
export type NewFight = typeof fights.$inferInsert;

export type Championship = typeof championships.$inferSelect;
export type NewChampionship = typeof championships.$inferInsert;

export type ChampionshipParticipant = typeof championshipParticipants.$inferSelect;
export type NewChampionshipParticipant = typeof championshipParticipants.$inferInsert;

export type ChampionshipMatch = typeof championshipMatches.$inferSelect;
export type NewChampionshipMatch = typeof championshipMatches.$inferInsert;

export type WeightClass = typeof weightClasses.$inferSelect;
export type NewWeightClass = typeof weightClasses.$inferInsert;

// Enum types
export type UserRole = 'fighter' | 'admin' | 'manager' | 'viewer';
export type EstablishmentType = 'gym' | 'school' | 'academy' | 'federation' | 'promotion' | 'club' | 'other';
export type FightStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type FightResult = 'ko' | 'tko' | 'submission' | 'decision' | 'draw' | 'no_contest' | 'disqualification';
export type ChampionshipStatus = 'draft' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled';
export type ChampionshipType = 'single_elimination' | 'double_elimination' | 'round_robin';
export type Gender = 'male' | 'female' | 'other';

// Extended types with relations
export type ProfileWithFighter = Profile & {
  fighter: Fighter | null;
};

export type ProfileWithEstablishments = Profile & {
  establishmentAdminRoles: (EstablishmentAdmin & { establishment: Establishment })[];
};

export type EstablishmentWithAdmins = Establishment & {
  admins: (EstablishmentAdmin & { user: Profile })[];
};

export type EstablishmentWithDetails = Establishment & {
  admins: (EstablishmentAdmin & { user: Profile })[];
  fighters: Fighter[];
  championships: Championship[];
};

export type FighterWithUser = Fighter & {
  user: Profile | null;
  establishment: Establishment | null;
  stats: FighterStats | null;
  weightClass: WeightClass | null;
};

export type FighterWithStats = Fighter & {
  stats: FighterStats | null;
  weightClass: WeightClass | null;
};

export type FightWithDetails = Fight & {
  fighter1: Fighter;
  fighter2: Fighter;
  winner: Fighter | null;
  loser: Fighter | null;
  weightClass: WeightClass | null;
};

export type ChampionshipWithDetails = Championship & {
  establishment: Establishment;
  creator: Profile | null;
  weightClass: WeightClass | null;
  participants: (ChampionshipParticipant & { fighter: Fighter })[];
  matches: (ChampionshipMatch & { fight: Fight })[];
  winner: Fighter | null;
  runnerUp: Fighter | null;
};

// Ranking calculation parameters
export interface RankingConfig {
  basePoints: number; // Starting ELO rating (default: 1000)
  kFactor: number; // ELO K-factor (default: 32)
  winStreakBonus: number; // Bonus per win in streak (default: 5)
  championshipMultiplier: number; // Championship fight multiplier (default: 1.5)
  finishBonus: number; // Bonus for KO/TKO/Sub (default: 10)
}

// Default ranking configuration
export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  basePoints: 1000,
  kFactor: 32,
  winStreakBonus: 5,
  championshipMultiplier: 1.5,
  finishBonus: 10,
};

// Fighter record summary
export interface FighterRecord {
  wins: number;
  losses: number;
  draws: number;
  noContests: number;
  displayRecord: string; // e.g., "15-3-1"
  winPercentage: number;
  finishRate: number;
}

// Championship bracket node
export interface BracketNode {
  matchId: number;
  round: number;
  matchNumber: number;
  fighter1: Fighter | null;
  fighter2: Fighter | null;
  winner: Fighter | null;
  fight: Fight | null;
  nextMatchId: number | null;
}

