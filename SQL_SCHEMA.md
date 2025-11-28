# Fighter Management App - SQL Schema Reference

## Complete PostgreSQL Schema (for reference)

This is the raw SQL equivalent of the Drizzle schema for those who prefer SQL or need to understand the underlying structure.

```sql
-- =====================
-- ENUMS
-- =====================

CREATE TYPE gender AS ENUM ('male', 'female', 'other');

CREATE TYPE fight_status AS ENUM (
  'scheduled',
  'in_progress', 
  'completed',
  'cancelled'
);

CREATE TYPE fight_result AS ENUM (
  'ko',
  'tko',
  'submission',
  'decision',
  'draw',
  'no_contest',
  'disqualification'
);

CREATE TYPE championship_status AS ENUM (
  'draft',
  'registration_open',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE championship_type AS ENUM (
  'single_elimination',
  'double_elimination',
  'round_robin'
);

-- =====================
-- TABLES
-- =====================

-- Weight Classes
CREATE TABLE weight_classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  min_weight DECIMAL(5,2) NOT NULL,
  max_weight DECIMAL(5,2) NOT NULL,
  gender gender NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Fighters
CREATE TABLE fighters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  nickname VARCHAR(100),
  email VARCHAR(256) UNIQUE,
  phone VARCHAR(50),
  
  -- Physical
  weight DECIMAL(5,2) NOT NULL,
  height INTEGER NOT NULL,
  reach INTEGER,
  gender gender NOT NULL,
  birth_date TIMESTAMP NOT NULL,
  
  -- Location
  nationality VARCHAR(100),
  country VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(100),
  
  -- Fighting profile
  weight_class_id INTEGER REFERENCES weight_classes(id),
  stance VARCHAR(50),
  fighting_style VARCHAR(100),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspended_until TIMESTAMP,
  
  -- Meta
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Fighter Stats
CREATE TABLE fighter_stats (
  id SERIAL PRIMARY KEY,
  fighter_id INTEGER NOT NULL UNIQUE REFERENCES fighters(id) ON DELETE CASCADE,
  
  -- Record
  total_fights INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  no_contests INTEGER NOT NULL DEFAULT 0,
  
  -- Win breakdown
  wins_ko INTEGER NOT NULL DEFAULT 0,
  wins_tko INTEGER NOT NULL DEFAULT 0,
  wins_submission INTEGER NOT NULL DEFAULT 0,
  wins_decision INTEGER NOT NULL DEFAULT 0,
  
  -- Performance
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_win_streak INTEGER NOT NULL DEFAULT 0,
  average_fight_duration INTEGER,
  finish_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Ranking
  ranking_points DECIMAL(10,2) NOT NULL DEFAULT 1000,
  ranking_position INTEGER,
  weight_class_rank INTEGER,
  
  -- Championship
  championship_wins INTEGER NOT NULL DEFAULT 0,
  championship_appearances INTEGER NOT NULL DEFAULT 0,
  
  -- Meta
  last_fight_date TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Fights
CREATE TABLE fights (
  id SERIAL PRIMARY KEY,
  
  -- Fighters
  fighter1_id INTEGER NOT NULL REFERENCES fighters(id),
  fighter2_id INTEGER NOT NULL REFERENCES fighters(id),
  
  -- Schedule
  scheduled_date TIMESTAMP NOT NULL,
  actual_date TIMESTAMP,
  location VARCHAR(256),
  venue VARCHAR(256),
  
  -- Rules
  weight_class_id INTEGER REFERENCES weight_classes(id),
  scheduled_rounds INTEGER NOT NULL DEFAULT 3,
  round_duration INTEGER NOT NULL DEFAULT 300,
  
  -- Status
  status fight_status NOT NULL DEFAULT 'scheduled',
  
  -- Results
  winner_id INTEGER REFERENCES fighters(id),
  loser_id INTEGER REFERENCES fighters(id),
  result fight_result,
  result_details TEXT,
  ended_in_round INTEGER,
  fight_duration INTEGER,
  
  -- Flags
  is_main_event BOOLEAN NOT NULL DEFAULT false,
  is_title_fight BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  
  -- Meta
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Championships
CREATE TABLE championships (
  id SERIAL PRIMARY KEY,
  
  -- Basic
  name VARCHAR(256) NOT NULL,
  description TEXT,
  type championship_type NOT NULL DEFAULT 'single_elimination',
  
  -- Config
  weight_class_id INTEGER REFERENCES weight_classes(id),
  max_participants INTEGER NOT NULL,
  min_participants INTEGER NOT NULL DEFAULT 2,
  
  -- Dates
  registration_start_date TIMESTAMP NOT NULL,
  registration_end_date TIMESTAMP NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  
  -- Status
  status championship_status NOT NULL DEFAULT 'draft',
  current_round INTEGER NOT NULL DEFAULT 0,
  
  -- Rewards
  prize_pool DECIMAL(10,2),
  ranking_points_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.5,
  
  -- Results
  winner_id INTEGER REFERENCES fighters(id),
  runner_up_id INTEGER REFERENCES fighters(id),
  
  -- Meta
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Championship Participants
CREATE TABLE championship_participants (
  id SERIAL PRIMARY KEY,
  championship_id INTEGER NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
  fighter_id INTEGER NOT NULL REFERENCES fighters(id) ON DELETE CASCADE,
  
  -- Bracket
  seed_number INTEGER,
  is_eliminated BOOLEAN NOT NULL DEFAULT false,
  eliminated_in_round INTEGER,
  final_placement INTEGER,
  
  -- Registration
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  
  -- Meta
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure unique participation
  UNIQUE(championship_id, fighter_id)
);

-- Championship Matches
CREATE TABLE championship_matches (
  id SERIAL PRIMARY KEY,
  championship_id INTEGER NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
  fight_id INTEGER NOT NULL REFERENCES fights(id) ON DELETE CASCADE,
  
  -- Bracket position
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  bracket_type VARCHAR(50) DEFAULT 'winners',
  
  -- Progression
  next_match_id INTEGER REFERENCES championship_matches(id),
  
  -- Meta
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================

-- Fighter indexes
CREATE INDEX idx_fighters_weight_class ON fighters(weight_class_id);
CREATE INDEX idx_fighters_is_active ON fighters(is_active);
CREATE INDEX idx_fighters_active_weight ON fighters(is_active, weight_class_id);

-- Fight indexes
CREATE INDEX idx_fights_fighter1 ON fights(fighter1_id);
CREATE INDEX idx_fights_fighter2 ON fights(fighter2_id);
CREATE INDEX idx_fights_fighters ON fights(fighter1_id, fighter2_id);
CREATE INDEX idx_fights_scheduled_date ON fights(scheduled_date);
CREATE INDEX idx_fights_status ON fights(status);
CREATE INDEX idx_fights_winner ON fights(winner_id);

-- Stats indexes
CREATE INDEX idx_fighter_stats_ranking ON fighter_stats(ranking_points DESC);

-- Championship indexes
CREATE INDEX idx_championship_participants_champ ON championship_participants(championship_id);
CREATE INDEX idx_championship_participants_fighter ON championship_participants(fighter_id);
CREATE INDEX idx_championship_matches_champ ON championship_matches(championship_id);
CREATE INDEX idx_championship_matches_fight ON championship_matches(fight_id);

-- =====================
-- CONSTRAINTS
-- =====================

-- Business logic constraints
ALTER TABLE fights 
  ADD CONSTRAINT chk_different_fighters 
  CHECK (fighter1_id != fighter2_id);

ALTER TABLE fights 
  ADD CONSTRAINT chk_winner_loser_different 
  CHECK (winner_id IS NULL OR loser_id IS NULL OR winner_id != loser_id);

ALTER TABLE weight_classes 
  ADD CONSTRAINT chk_weight_range 
  CHECK (min_weight < max_weight);

-- =====================
-- TRIGGERS
-- =====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fighters_updated_at 
  BEFORE UPDATE ON fighters 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fighter_stats_updated_at 
  BEFORE UPDATE ON fighter_stats 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fights_updated_at 
  BEFORE UPDATE ON fights 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_championships_updated_at 
  BEFORE UPDATE ON championships 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weight_classes_updated_at 
  BEFORE UPDATE ON weight_classes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- VIEWS
-- =====================

-- View: Fighter profiles with stats
CREATE VIEW vw_fighter_profiles AS
SELECT 
  f.id,
  f.name,
  f.nickname,
  f.email,
  f.weight,
  f.height,
  f.gender,
  f.birth_date,
  EXTRACT(YEAR FROM AGE(f.birth_date)) as age,
  wc.name as weight_class,
  f.stance,
  f.fighting_style,
  f.is_active,
  fs.wins,
  fs.losses,
  fs.draws,
  fs.total_fights,
  CASE 
    WHEN fs.total_fights > 0 THEN 
      ROUND((fs.wins::DECIMAL / fs.total_fights::DECIMAL) * 100, 2)
    ELSE 0 
  END as win_percentage,
  fs.current_streak,
  fs.ranking_points,
  fs.ranking_position,
  fs.championship_wins
FROM fighters f
LEFT JOIN fighter_stats fs ON f.id = fs.fighter_id
LEFT JOIN weight_classes wc ON f.weight_class_id = wc.id;

-- View: Upcoming fights
CREATE VIEW vw_upcoming_fights AS
SELECT 
  f.id,
  f.scheduled_date,
  f.location,
  f.venue,
  f1.name as fighter1_name,
  f2.name as fighter2_name,
  wc.name as weight_class,
  f.scheduled_rounds,
  f.is_main_event,
  f.is_title_fight
FROM fights f
JOIN fighters f1 ON f.fighter1_id = f1.id
JOIN fighters f2 ON f.fighter2_id = f2.id
LEFT JOIN weight_classes wc ON f.weight_class_id = wc.id
WHERE f.status IN ('scheduled', 'in_progress')
ORDER BY f.scheduled_date;

-- View: Fighter rankings
CREATE VIEW vw_fighter_rankings AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY fs.ranking_points DESC) as rank,
  f.id,
  f.name,
  f.nickname,
  wc.name as weight_class,
  fs.wins,
  fs.losses,
  fs.draws,
  fs.ranking_points,
  fs.current_streak
FROM fighters f
JOIN fighter_stats fs ON f.id = fs.fighter_id
LEFT JOIN weight_classes wc ON f.weight_class_id = wc.id
WHERE f.is_active = true
ORDER BY fs.ranking_points DESC;

-- =====================
-- SEED DATA
-- =====================

-- Insert weight classes
INSERT INTO weight_classes (name, min_weight, max_weight, gender, description) VALUES
-- Male
('Flyweight', 52.00, 57.00, 'male', 'Up to 125 lbs (56.7 kg)'),
('Bantamweight', 57.01, 61.20, 'male', '126-135 lbs (57.2-61.2 kg)'),
('Featherweight', 61.21, 65.80, 'male', '136-145 lbs (61.7-65.8 kg)'),
('Lightweight', 65.81, 70.30, 'male', '146-155 lbs (66.2-70.3 kg)'),
('Welterweight', 70.31, 77.10, 'male', '156-170 lbs (70.8-77.1 kg)'),
('Middleweight', 77.11, 83.90, 'male', '171-185 lbs (77.6-83.9 kg)'),
('Light Heavyweight', 83.91, 93.00, 'male', '186-205 lbs (84.4-93.0 kg)'),
('Heavyweight', 93.01, 120.00, 'male', '206-265 lbs (93.4-120.2 kg)'),
-- Female
('Strawweight', 48.00, 52.20, 'female', 'Up to 115 lbs (52.2 kg)'),
('Flyweight', 52.21, 57.00, 'female', '116-125 lbs (52.6-56.7 kg)'),
('Bantamweight', 57.01, 61.20, 'female', '126-135 lbs (57.2-61.2 kg)'),
('Featherweight', 61.21, 65.80, 'female', '136-145 lbs (61.7-65.8 kg)');

-- =====================
-- COMMENTS
-- =====================

COMMENT ON TABLE fighters IS 'Core fighter profiles and biographical information';
COMMENT ON TABLE fighter_stats IS 'Denormalized fighter statistics for performance (computed from fights)';
COMMENT ON TABLE fights IS 'Individual fight records - both standalone and championship fights';
COMMENT ON TABLE championships IS 'Tournament/bracket system for organizing fight competitions';
COMMENT ON TABLE championship_participants IS 'Many-to-many relationship between fighters and championships';
COMMENT ON TABLE championship_matches IS 'Links fights to championship bracket positions';
COMMENT ON TABLE weight_classes IS 'Weight divisions for fighter classification';

COMMENT ON COLUMN fighter_stats.ranking_points IS 'ELO-style rating system for fighter rankings';
COMMENT ON COLUMN fighter_stats.current_streak IS 'Current win/loss streak (positive = wins, negative = losses)';
COMMENT ON COLUMN championship_matches.next_match_id IS 'Self-referential FK for bracket tree structure';
COMMENT ON COLUMN championship_matches.round IS 'Round number where 1 = finals, 2 = semifinals, etc.';
```

## Notes

1. **Triggers**: Drizzle ORM handles `updated_at` automatically, but native PostgreSQL needs triggers
2. **Views**: Helpful for common queries, not created by Drizzle but useful for reporting
3. **Constraints**: Additional business logic constraints not in Drizzle schema
4. **Indexes**: Performance optimization for common query patterns

## Differences from Drizzle

The Drizzle schema is equivalent but:
- Uses TypeScript types instead of raw SQL
- Handles migrations automatically
- Provides type-safe query building
- Auto-generates this SQL from the schema definition

Both produce the same database structure!

