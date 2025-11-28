# Fighter Management App - Database Schema Documentation

## Overview
PostgreSQL database using Drizzle ORM for a comprehensive Fighter Management System with championship tracking, fight records, and dynamic ranking.

## Entity Relationship Diagram (ERD) Summary

```
weight_classes
    ↓ (1:N)
fighters ←→ fighter_stats (1:1)
    ↓ (N:N via fights)
fights
    ↓ (1:N)
championship_matches
    ↓ (N:1)
championships ←→ championship_participants (N:N)
```

---

## Tables

### 1. **weight_classes**
Defines weight divisions for fighters.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PK | Unique identifier |
| name | varchar(100) | NOT NULL | Weight class name (e.g., "Lightweight") |
| min_weight | decimal(5,2) | NOT NULL | Minimum weight in kg |
| max_weight | decimal(5,2) | NOT NULL | Maximum weight in kg |
| gender | enum | NOT NULL | male, female, other |
| description | text | | Additional details |
| is_active | boolean | DEFAULT true | If class is currently active |
| created_at | timestamp | DEFAULT now() | Record creation |
| updated_at | timestamp | DEFAULT now() | Last update |

**Indexes**: None (small reference table)

---

### 2. **fighters**
Core fighter profiles and information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PK | Unique identifier |
| name | varchar(256) | NOT NULL | Full legal name |
| nickname | varchar(100) | | Fighter nickname |
| email | varchar(256) | UNIQUE | Contact email |
| phone | varchar(50) | | Phone number |
| **Physical** |
| weight | decimal(5,2) | NOT NULL | Current weight (kg) |
| height | integer | NOT NULL | Height in cm |
| reach | integer | | Arm reach in cm |
| gender | enum | NOT NULL | Gender |
| birth_date | timestamp | NOT NULL | Date of birth |
| **Location** |
| nationality | varchar(100) | | Fighter nationality |
| country | varchar(100) | | Current country |
| city | varchar(100) | | City |
| state | varchar(100) | | State/province |
| **Fighting Profile** |
| weight_class_id | integer | FK → weight_classes | Current weight class |
| stance | varchar(50) | | orthodox, southpaw, switch |
| fighting_style | varchar(100) | | striker, grappler, etc. |
| **Status** |
| is_active | boolean | DEFAULT true | Active roster status |
| is_suspended | boolean | DEFAULT false | Suspension flag |
| suspended_until | timestamp | | Suspension end date |
| **Meta** |
| created_at | timestamp | DEFAULT now() | |
| updated_at | timestamp | DEFAULT now() | |

**Indexes**: 
- email (unique)
- weight_class_id (foreign key)

---

### 3. **fighter_stats**
Computed statistics and rankings for each fighter (denormalized for performance).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PK | |
| fighter_id | integer | FK → fighters, UNIQUE | One-to-one with fighter |
| **Record** |
| total_fights | integer | DEFAULT 0 | Total number of fights |
| wins | integer | DEFAULT 0 | Total wins |
| losses | integer | DEFAULT 0 | Total losses |
| draws | integer | DEFAULT 0 | Draws |
| no_contests | integer | DEFAULT 0 | No contests |
| **Win Breakdown** |
| wins_ko | integer | DEFAULT 0 | Knockouts |
| wins_tko | integer | DEFAULT 0 | Technical knockouts |
| wins_submission | integer | DEFAULT 0 | Submissions |
| wins_decision | integer | DEFAULT 0 | Decision wins |
| **Performance** |
| current_streak | integer | DEFAULT 0 | (+) win streak / (-) loss streak |
| longest_win_streak | integer | DEFAULT 0 | Best streak |
| average_fight_duration | integer | | Avg seconds per fight |
| finish_rate | decimal(5,2) | DEFAULT 0 | % of non-decision wins |
| **Ranking** |
| ranking_points | decimal(10,2) | DEFAULT 1000 | ELO-style rating |
| ranking_position | integer | | Global rank |
| weight_class_rank | integer | | Rank within weight class |
| **Championship** |
| championship_wins | integer | DEFAULT 0 | Titles won |
| championship_appearances | integer | DEFAULT 0 | Title fights |
| **Meta** |
| last_fight_date | timestamp | | Date of last fight |
| updated_at | timestamp | DEFAULT now() | |

**Business Logic**:
- Updated automatically after each fight completion
- Ranking points calculated using modified ELO system
- Current streak: positive for wins, negative for losses

---

### 4. **fights**
Individual fight records (both standalone and championship fights).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PK | |
| **Fighters** |
| fighter1_id | integer | FK → fighters, NOT NULL | First fighter |
| fighter2_id | integer | FK → fighters, NOT NULL | Second fighter |
| **Schedule** |
| scheduled_date | timestamp | NOT NULL | Planned date |
| actual_date | timestamp | | Actual fight date |
| location | varchar(256) | | City/country |
| venue | varchar(256) | | Specific venue |
| **Rules** |
| weight_class_id | integer | FK → weight_classes | Weight class |
| scheduled_rounds | integer | DEFAULT 3 | Number of rounds |
| round_duration | integer | DEFAULT 300 | Seconds per round |
| **Status** |
| status | enum | DEFAULT 'scheduled' | scheduled, in_progress, completed, cancelled |
| **Results** (null until completed) |
| winner_id | integer | FK → fighters | Winning fighter |
| loser_id | integer | FK → fighters | Losing fighter |
| result | enum | | ko, tko, submission, decision, draw, no_contest, disqualification |
| result_details | text | | e.g., "Round 2, 3:45" |
| ended_in_round | integer | | Which round fight ended |
| fight_duration | integer | | Total seconds |
| **Additional** |
| is_main_event | boolean | DEFAULT false | Headliner status |
| is_title_fight | boolean | DEFAULT false | Title fight flag |
| notes | text | | Additional notes |
| **Meta** |
| created_at | timestamp | DEFAULT now() | |
| updated_at | timestamp | DEFAULT now() | |

**Indexes**: 
- fighter1_id, fighter2_id (foreign keys)
- winner_id, loser_id (foreign keys)
- scheduled_date

---

### 5. **championships**
Tournament/bracket competitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PK | |
| **Basic Info** |
| name | varchar(256) | NOT NULL | Championship name |
| description | text | | Details |
| type | enum | DEFAULT 'single_elimination' | single_elimination, double_elimination, round_robin |
| **Config** |
| weight_class_id | integer | FK → weight_classes | Weight division |
| max_participants | integer | NOT NULL | Max fighters (power of 2) |
| min_participants | integer | DEFAULT 2 | Minimum to start |
| **Dates** |
| registration_start_date | timestamp | NOT NULL | Registration opens |
| registration_end_date | timestamp | NOT NULL | Registration closes |
| start_date | timestamp | NOT NULL | Tournament start |
| end_date | timestamp | | Completion date |
| **Status** |
| status | enum | DEFAULT 'draft' | draft, registration_open, in_progress, completed, cancelled |
| current_round | integer | DEFAULT 0 | Active round (0 = not started) |
| **Rewards** |
| prize_pool | decimal(10,2) | | Total prize money |
| ranking_points_multiplier | decimal(3,2) | DEFAULT 1.5 | Bonus for championship fights |
| **Results** |
| winner_id | integer | FK → fighters | Champion |
| runner_up_id | integer | FK → fighters | Second place |
| **Meta** |
| created_at | timestamp | DEFAULT now() | |
| updated_at | timestamp | DEFAULT now() | |

---

### 6. **championship_participants**
Many-to-many relationship: fighters ↔ championships.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PK | |
| championship_id | integer | FK → championships, NOT NULL | Championship |
| fighter_id | integer | FK → fighters, NOT NULL | Fighter |
| **Bracket** |
| seed_number | integer | | Seeding position |
| is_eliminated | boolean | DEFAULT false | Elimination status |
| eliminated_in_round | integer | | Round eliminated |
| final_placement | integer | | Final ranking (1=winner) |
| **Registration** |
| registered_at | timestamp | DEFAULT now() | Registration time |
| approved_at | timestamp | | Admin approval |
| **Meta** |
| created_at | timestamp | DEFAULT now() | |
| updated_at | timestamp | DEFAULT now() | |

**Constraints**:
- Unique (championship_id, fighter_id)

---

### 7. **championship_matches**
Links fights to championship brackets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | serial | PK | |
| championship_id | integer | FK → championships, NOT NULL | Championship |
| fight_id | integer | FK → fights, NOT NULL | Associated fight |
| **Bracket Position** |
| round | integer | NOT NULL | Round number (1=finals, 2=semis, etc.) |
| match_number | integer | NOT NULL | Position in round |
| bracket_type | varchar(50) | DEFAULT 'winners' | winners, losers, grand_final (for double elim) |
| **Progression** |
| next_match_id | integer | FK → championship_matches | Next match for winner |
| **Meta** |
| created_at | timestamp | DEFAULT now() | |
| updated_at | timestamp | DEFAULT now() | |

**Business Logic**:
- Round 1 = Finals
- Round 2 = Semi-finals
- Round N = 2^(N-1) matches
- winner advances to next_match_id

---

## Key Relationships

1. **Fighter ↔ Weight Class** (Many-to-One)
   - Each fighter belongs to one weight class
   - Weight class contains many fighters

2. **Fighter ↔ Fighter Stats** (One-to-One)
   - Each fighter has exactly one stats record
   - Stats denormalized for query performance

3. **Fighter ↔ Fights** (Many-to-Many via fights table)
   - Fighter can be fighter1 or fighter2
   - Fighter can be winner or loser
   - Self-referential many-to-many

4. **Fight ↔ Championship Match** (One-to-One)
   - Championship fights link to fights table
   - Standalone fights have no championship_match

5. **Championship ↔ Fighters** (Many-to-Many via championship_participants)
   - Track registration and bracket position

6. **Championship ↔ Matches** (One-to-Many)
   - Championship contains multiple matches
   - Matches form bracket tree structure

---

## Enums

```typescript
fightStatusEnum: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
fightResultEnum: 'ko' | 'tko' | 'submission' | 'decision' | 'draw' | 'no_contest' | 'disqualification'
championshipStatusEnum: 'draft' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled'
championshipTypeEnum: 'single_elimination' | 'double_elimination' | 'round_robin'
genderEnum: 'male' | 'female' | 'other'
```

---

## Cascade Rules

- **fighter_stats**: CASCADE on fighter delete
- **championship_participants**: CASCADE on championship or fighter delete
- **championship_matches**: CASCADE on championship or fight delete

---

## Performance Considerations

1. **Denormalized Stats**: `fighter_stats` table computed after each fight
2. **Indexes**: Add indexes on frequently queried foreign keys
3. **Ranking Updates**: Batch update rankings nightly or after major events
4. **Bracket Queries**: Self-referential next_match_id enables efficient tree traversal

---

## Migration Commands

```bash
# Generate migration
bunx drizzle-kit generate

# Apply migration
bunx drizzle-kit migrate

# Seed database
tsx app/db/seed.ts
```

---

## Next Steps

1. ✅ Database schema designed
2. ✅ Migrations generated
3. 🔄 Seed weight classes
4. ⏳ Build REST API endpoints
5. ⏳ Implement ranking algorithm
6. ⏳ Build championship bracket logic

