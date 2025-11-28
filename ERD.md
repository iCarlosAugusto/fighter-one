# Fighter Management App - Entity Relationship Diagram

## Visual ERD (Mermaid)

```mermaid
erDiagram
    weight_classes ||--o{ fighters : "belongs to"
    weight_classes ||--o{ fights : "contested in"
    weight_classes ||--o{ championships : "division"
    
    fighters ||--|| fighter_stats : "has stats"
    fighters ||--o{ fights : "fights as fighter1"
    fighters ||--o{ fights : "fights as fighter2"
    fighters ||--o{ fights : "wins"
    fighters ||--o{ fights : "loses"
    fighters ||--o{ championship_participants : "participates"
    fighters ||--o{ championships : "wins championship"
    fighters ||--o{ championships : "runner up"
    
    fights ||--o| championship_matches : "can be part of"
    
    championships ||--o{ championship_participants : "has participants"
    championships ||--o{ championship_matches : "contains matches"
    
    championship_matches ||--o{ championship_matches : "next match"
    championship_matches }o--|| fights : "references"
    
    weight_classes {
        serial id PK
        varchar name
        decimal min_weight
        decimal max_weight
        enum gender
        text description
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    fighters {
        serial id PK
        varchar name
        varchar nickname
        varchar email UK
        varchar phone
        decimal weight
        integer height
        integer reach
        enum gender
        timestamp birth_date
        varchar nationality
        varchar country
        varchar city
        varchar state
        integer weight_class_id FK
        varchar stance
        varchar fighting_style
        boolean is_active
        boolean is_suspended
        timestamp suspended_until
        timestamp created_at
        timestamp updated_at
    }
    
    fighter_stats {
        serial id PK
        integer fighter_id FK_UK
        integer total_fights
        integer wins
        integer losses
        integer draws
        integer no_contests
        integer wins_ko
        integer wins_tko
        integer wins_submission
        integer wins_decision
        integer current_streak
        integer longest_win_streak
        integer average_fight_duration
        decimal finish_rate
        decimal ranking_points
        integer ranking_position
        integer weight_class_rank
        integer championship_wins
        integer championship_appearances
        timestamp last_fight_date
        timestamp updated_at
    }
    
    fights {
        serial id PK
        integer fighter1_id FK
        integer fighter2_id FK
        timestamp scheduled_date
        timestamp actual_date
        varchar location
        varchar venue
        integer weight_class_id FK
        integer scheduled_rounds
        integer round_duration
        enum status
        integer winner_id FK
        integer loser_id FK
        enum result
        text result_details
        integer ended_in_round
        integer fight_duration
        boolean is_main_event
        boolean is_title_fight
        text notes
        timestamp created_at
        timestamp updated_at
    }
    
    championships {
        serial id PK
        varchar name
        text description
        enum type
        integer weight_class_id FK
        integer max_participants
        integer min_participants
        timestamp registration_start_date
        timestamp registration_end_date
        timestamp start_date
        timestamp end_date
        enum status
        integer current_round
        decimal prize_pool
        decimal ranking_points_multiplier
        integer winner_id FK
        integer runner_up_id FK
        timestamp created_at
        timestamp updated_at
    }
    
    championship_participants {
        serial id PK
        integer championship_id FK
        integer fighter_id FK
        integer seed_number
        boolean is_eliminated
        integer eliminated_in_round
        integer final_placement
        timestamp registered_at
        timestamp approved_at
        timestamp created_at
        timestamp updated_at
    }
    
    championship_matches {
        serial id PK
        integer championship_id FK
        integer fight_id FK
        integer round
        integer match_number
        varchar bracket_type
        integer next_match_id FK
        timestamp created_at
        timestamp updated_at
    }
```

## Simplified Relationship Flow

```
┌─────────────────┐
│ weight_classes  │
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
         ▼                  ▼
┌─────────────┐    ┌──────────────┐
│  fighters   │    │championships │
└──────┬──────┘    └──────┬───────┘
       │                  │
       │ 1:1              │ N:M
       ▼                  │
┌──────────────┐          │
│fighter_stats │          │
└──────────────┘          │
       │                  ▼
       │           ┌─────────────────────────┐
       │           │championship_participants│
       │           └─────────────────────────┘
       │                  │
       │ N:M              │
       ▼                  ▼
    ┌────────────────────────┐
    │       fights           │
    └───────────┬────────────┘
                │
                │ 1:1 (optional)
                ▼
    ┌─────────────────────┐
    │championship_matches │
    └─────────────────────┘
```

## Key Relationships Explained

### 1. Weight Class System
- **weight_classes** is the root classification
- Fighters belong to ONE weight class
- Fights occur within weight classes
- Championships are organized by weight class

### 2. Fighter Profile
- **fighters** table stores core fighter data
- Each fighter has exactly ONE **fighter_stats** record (1:1)
- Stats are denormalized for performance (computed from fights)

### 3. Fight Records
- **fights** table is the transaction log
- Links TWO fighters (fighter1_id, fighter2_id)
- Records winner and loser (self-referential FKs)
- Can exist standalone OR as part of championship

### 4. Championship System
- **championships** defines the tournament
- **championship_participants** is join table (fighters ↔ championships)
- **championship_matches** links fights to bracket positions
- Bracket structure via self-referential `next_match_id`

### 5. Cascade Rules
```
DELETE fighter → CASCADE delete fighter_stats
DELETE fighter → CASCADE delete championship_participants
DELETE championship → CASCADE delete championship_participants
DELETE championship → CASCADE delete championship_matches
DELETE fight → CASCADE delete championship_matches
```

## Data Flow Examples

### Example 1: Fighter Registration
```
1. INSERT INTO fighters (...)
2. INSERT INTO fighter_stats (fighter_id = new_fighter.id, defaults)
3. UPDATE fighters SET weight_class_id = (find appropriate class)
```

### Example 2: Recording Fight Result
```
1. UPDATE fights SET status = 'completed', winner_id = X, loser_id = Y, result = 'ko'
2. UPDATE fighter_stats WHERE fighter_id = X (increment wins, update streak, ranking)
3. UPDATE fighter_stats WHERE fighter_id = Y (increment losses, reset streak)
4. IF championship fight:
   - UPDATE championship_participants SET is_eliminated = true WHERE fighter_id = Y
   - Progress winner to next bracket match
```

### Example 3: Creating Single Elimination Championship
```
1. INSERT INTO championships (max_participants = 8, type = 'single_elimination')
2. Fighters register → INSERT INTO championship_participants
3. When registration closes:
   - Seed fighters (1-8)
   - Create bracket structure:
     * Round 3 (Quarterfinals): 4 matches
     * Round 2 (Semifinals): 2 matches  
     * Round 1 (Finals): 1 match
4. Create championship_matches with next_match_id pointing up the bracket
5. As fights complete, winner advances via next_match_id
```

## Indexes to Add (Performance Optimization)

```sql
-- Fighter lookups
CREATE INDEX idx_fighters_weight_class ON fighters(weight_class_id);
CREATE INDEX idx_fighters_is_active ON fighters(is_active);
CREATE INDEX idx_fighters_email ON fighters(email); -- already unique

-- Fight queries
CREATE INDEX idx_fights_fighter1 ON fights(fighter1_id);
CREATE INDEX idx_fights_fighter2 ON fights(fighter2_id);
CREATE INDEX idx_fights_scheduled_date ON fights(scheduled_date);
CREATE INDEX idx_fights_status ON fights(status);
CREATE INDEX idx_fights_winner ON fights(winner_id);

-- Stats rankings
CREATE INDEX idx_fighter_stats_ranking_points ON fighter_stats(ranking_points DESC);
CREATE INDEX idx_fighter_stats_fighter ON fighter_stats(fighter_id); -- already unique

-- Championship queries
CREATE INDEX idx_championship_participants_champ ON championship_participants(championship_id);
CREATE INDEX idx_championship_participants_fighter ON championship_participants(fighter_id);
CREATE INDEX idx_championship_matches_champ ON championship_matches(championship_id);
CREATE INDEX idx_championship_matches_fight ON championship_matches(fight_id);

-- Composite indexes
CREATE INDEX idx_fights_fighters ON fights(fighter1_id, fighter2_id);
CREATE INDEX idx_fighters_active_weight ON fighters(is_active, weight_class_id);
```

## Constraints to Add

```sql
-- Business logic constraints
ALTER TABLE fights ADD CONSTRAINT chk_different_fighters 
  CHECK (fighter1_id != fighter2_id);

ALTER TABLE fights ADD CONSTRAINT chk_winner_loser_different 
  CHECK (winner_id IS NULL OR loser_id IS NULL OR winner_id != loser_id);

ALTER TABLE championships ADD CONSTRAINT chk_max_participants_power_of_2 
  CHECK (type != 'single_elimination' OR max_participants & (max_participants - 1) = 0);

ALTER TABLE weight_classes ADD CONSTRAINT chk_weight_range 
  CHECK (min_weight < max_weight);

-- Ensure winner/loser are participants
ALTER TABLE fights ADD CONSTRAINT chk_winner_is_participant 
  CHECK (winner_id IS NULL OR winner_id IN (fighter1_id, fighter2_id));

ALTER TABLE fights ADD CONSTRAINT chk_loser_is_participant 
  CHECK (loser_id IS NULL OR loser_id IN (fighter1_id, fighter2_id));
```

