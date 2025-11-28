# Establishments System - Documentation

## Overview

The **Establishments System** adds organizational structure to the Fighter Management App. Establishments (gyms, schools, academies, federations, etc.) can create and manage their own championships. Only users who are admins of an establishment can manage championships for that establishment.

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Establishments                 │
│  (Gyms, Schools, Federations, etc.)     │
└──────────────────┬──────────────────────┘
                   │
      ┌────────────┴────────────┐
      │                         │
      ▼                         ▼
┌──────────────┐       ┌──────────────────┐
│establishment_│       │    fighters      │
│   admins     │       │ (optional link)  │
│  (M:N join)  │       └──────────────────┘
└──────┬───────┘
       │
       └──────► Can create/manage
                      │
                      ▼
              ┌───────────────┐
              │ championships │
              └───────────────┘
```

---

## Database Tables

### 1. `establishments`

Organizations that can create championships.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| **Basic Info** |
| name | varchar(256) | Full name |
| short_name | varchar(100) | Short/display name |
| type | enum | gym, school, academy, federation, promotion, club, other |
| description | text | About the establishment |
| **Contact** |
| email | varchar(256) | Contact email |
| phone | varchar(50) | Phone number |
| website | text | Website URL |
| **Location** |
| address | text | Street address |
| city | varchar(100) | City |
| state | varchar(100) | State/province |
| country | varchar(100) | Country (required) |
| zip_code | varchar(20) | Postal code |
| latitude | decimal(10,8) | GPS latitude |
| longitude | decimal(11,8) | GPS longitude |
| **Branding** |
| logo_url | text | Logo image URL |
| banner_url | text | Banner image URL |
| **Status** |
| is_active | boolean | Active status |
| is_verified | boolean | Verified by platform admins |
| **Meta** |
| founded_date | timestamp | When established |
| created_at | timestamp | Record created |
| updated_at | timestamp | Last updated |

### 2. `establishment_admins`

Many-to-many relationship between users and establishments with permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| establishment_id | integer | FK → establishments |
| user_id | uuid | FK → profiles |
| role | varchar(50) | admin, manager, staff |
| **Permissions** |
| can_create_championships | boolean | Can create championships |
| can_manage_fighters | boolean | Can manage fighters |
| can_schedule_fights | boolean | Can schedule fights |
| **Status** |
| is_active | boolean | Active admin status |
| **Meta** |
| joined_at | timestamp | When added as admin |
| created_at | timestamp | Record created |
| updated_at | timestamp | Last updated |

**Cascade Rules:**
- DELETE establishment → CASCADE delete establishment_admins
- DELETE user → CASCADE delete establishment_admins

### 3. Updated `fighters` Table

Added optional link to establishment:

| Column | Type | Description |
|--------|------|-------------|
| establishment_id | integer | FK → establishments (optional) |

**Cascade Rule:**
- DELETE establishment → SET NULL on fighter.establishment_id

### 4. Updated `championships` Table

Championships now belong to establishments:

| Column | Type | Description |
|--------|------|-------------|
| establishment_id | integer | FK → establishments (required) |
| created_by_user_id | uuid | FK → profiles (who created it) |

**Cascade Rule:**
- DELETE establishment → CASCADE delete championships

---

## Relationships

```
establishments (1) → (N) establishment_admins (N) → (1) profiles
establishments (1) → (N) fighters (optional)
establishments (1) → (N) championships (required)
profiles (1) → (N) championships (as creator)
```

---

## Permissions Model

### Establishment Types
- **gym** - Traditional MMA gym
- **school** - Martial arts school
- **academy** - Training academy
- **federation** - Fight federation/organization
- **promotion** - Fight promotion company
- **club** - Fight club
- **other** - Other types

### Admin Roles within Establishment
- **admin** - Full management access
- **manager** - Can manage day-to-day operations
- **staff** - Limited access

### Granular Permissions
Each admin has specific permissions:
- `can_create_championships` - Can create championships
- `can_manage_fighters` - Can add/edit fighters
- `can_schedule_fights` - Can schedule fights

---

## Security (RLS Policies)

### Establishments

| Action | Who Can Do It |
|--------|---------------|
| **View** | Everyone (if active & verified) OR establishment admins (their own) OR platform admins (all) |
| **Create** | Any authenticated user |
| **Update** | Establishment admins |
| **Delete** | Platform admins only |

### Establishment Admins

| Action | Who Can Do It |
|--------|---------------|
| **View** | Establishment admins (same establishment) OR platform admins |
| **Add** | Establishment admins (to their establishment) |
| **Update** | Establishment admins (same establishment) |
| **Remove** | Establishment admins (same establishment) |

### Championships

| Action | Who Can Do It |
|--------|---------------|
| **View** | Everyone (if active) |
| **Create** | Establishment admins (with permission) |
| **Update** | Establishment admins (their establishment) |
| **Delete** | Establishment admins (their establishment) OR platform admins |

### Fighters

| Action | Who Can Do It |
|--------|---------------|
| **Create** | Establishment admins (with permission) OR platform admins |
| **Update** | Fighter themselves OR establishment admins OR platform admins |

---

## Automatic Behaviors

### 1. Auto-Add Creator as Admin

When someone creates an establishment, they're automatically added as the first admin:

```sql
TRIGGER on_establishment_created
  → INSERT into establishment_admins (
      establishment_id: new_establishment.id,
      user_id: creator.id,
      role: 'admin',
      all_permissions: true
    )
```

### 2. User Role Elevation

When a user is added as establishment admin:
- If their profile role is 'viewer' → upgraded to 'manager'
- Existing 'fighter', 'manager', 'admin' roles are preserved

---

## API Functions

### Establishment Management

```typescript
// Create establishment
await createEstablishment({
  name: 'Alpha MMA Gym',
  type: 'gym',
  country: 'USA',
  city: 'Las Vegas',
  // ...
});

// Get establishment details
const establishment = await getEstablishmentDetails(id);
// Returns: establishment + admins + fighters + championships

// Update establishment
await updateEstablishment(id, {
  description: 'Updated description',
  isVerified: true, // platform admin only
});

// Get all gyms
const gyms = await getEstablishmentsByType('gym');
```

### Admin Management

```typescript
// Add admin to establishment
await addEstablishmentAdmin(establishmentId, userId, 'admin', {
  canCreateChampionships: true,
  canManageFighters: true,
  canScheduleFights: false,
});

// Get user's establishments
const myEstablishments = await getUserEstablishments(userId);

// Update admin permissions
await updateEstablishmentAdminPermissions(establishmentId, userId, {
  canCreateChampionships: false,
});

// Remove admin
await removeEstablishmentAdmin(establishmentId, userId);
```

### Authorization Checks

```typescript
// Check if user is establishment admin
if (await isEstablishmentAdmin(userId, establishmentId)) {
  // Allow access
}

// Check specific permission
if (await canUserCreateChampionships(userId, establishmentId)) {
  // Allow championship creation
}

// Check if user manages any establishment
if (await isUserEstablishmentManager(userId)) {
  // Show manager UI
}
```

### Fighter-Establishment Linking

```typescript
// Link fighter to gym
await linkFighterToEstablishment(fighterId, establishmentId);

// Get all fighters at a gym
const gymFighters = await getEstablishmentFighters(establishmentId);

// Unlink fighter
await unlinkFighterFromEstablishment(fighterId);
```

---

## Use Cases

### Use Case 1: Gym Creates Championship

```typescript
// 1. User creates a gym
const gym = await createEstablishment({
  name: 'Alpha MMA',
  type: 'gym',
  country: 'USA',
});
// User automatically becomes gym admin ✅

// 2. Gym admin creates championship
const championship = await db.insert(championships).values({
  name: 'Alpha MMA Championship 2024',
  establishmentId: gym.id,
  createdByUserId: userId,
  type: 'single_elimination',
  maxParticipants: 8,
  // ...
});
// RLS allows because user is gym admin ✅
```

### Use Case 2: Add Multiple Admins

```typescript
// Main admin adds additional staff
await addEstablishmentAdmin(gymId, manager1UserId, 'manager', {
  canCreateChampionships: true,
  canManageFighters: true,
  canScheduleFights: true,
});

await addEstablishmentAdmin(gymId, staff1UserId, 'staff', {
  canCreateChampionships: false,
  canManageFighters: true,
  canScheduleFights: false,
});
```

### Use Case 3: Fighter Joins Gym

```typescript
// Fighter signs up
const fighter = await createFighterForUser(userId, {
  name: 'John Doe',
  // ...
});

// Later, fighter joins a gym
await linkFighterToEstablishment(fighter.id, gymId);
```

### Use Case 4: Platform Admin Verifies Establishment

```typescript
// Platform admin reviews and verifies
await verifyEstablishment(gymId);
// Now visible to everyone ✅
```

---

## Workflow Examples

### Creating a Championship

```
1. User creates establishment
   ↓
2. Auto-added as admin (trigger)
   ↓
3. User creates championship
   ↓
4. RLS checks:
   - User is establishment admin? ✅
   - Has can_create_championships permission? ✅
   ↓
5. Championship created ✅
```

### Managing Fighters

```
1. Establishment admin adds fighter
   ↓
2. RLS checks:
   - User is establishment admin? ✅
   - Has can_manage_fighters permission? ✅
   ↓
3. Fighter linked to establishment
   ↓
4. Fighter can participate in establishment's championships
```

---

## Migration Path

### Step 1: Run Drizzle Migration
```bash
bunx drizzle-kit migrate
```
Creates:
- `establishments` table
- `establishment_admins` table
- Adds `establishment_id` to fighters
- Adds `establishment_id` and `created_by_user_id` to championships

### Step 2: Run Supabase Setup
Execute `supabase-establishments-setup.sql` in Supabase SQL Editor:
- Enables RLS on new tables
- Creates policies
- Adds trigger (auto-add creator as admin)
- Creates helper functions
- Adds indexes

### Step 3: Migrate Existing Data (if any)
```sql
-- If you have existing championships, link them to an establishment
-- Option 1: Create a default establishment
INSERT INTO establishments (name, type, country, is_active, is_verified)
VALUES ('Default Organization', 'other', 'USA', true, true);

-- Option 2: Update existing championships
UPDATE championships 
SET establishment_id = 1  -- Use the default establishment ID
WHERE establishment_id IS NULL;
```

---

## API Route Example

```typescript
// app/api/championships/create/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { canUserCreateChampionships } from '@/app/db/establishments';
import { db } from '@/app/db';
import { championships } from '@/app/db/schema';

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await request.json();
  const { establishmentId, ...championshipData } = body;
  
  // Check if user can create championships for this establishment
  if (!await canUserCreateChampionships(session.user.id, establishmentId)) {
    return Response.json(
      { error: 'You do not have permission to create championships for this establishment' },
      { status: 403 }
    );
  }
  
  // Create championship
  const [championship] = await db.insert(championships).values({
    ...championshipData,
    establishmentId,
    createdByUserId: session.user.id,
  }).returning();
  
  return Response.json({ championship });
}
```

---

## Benefits

✅ **Multi-tenant Architecture** - Each establishment operates independently
✅ **Granular Permissions** - Fine-grained control over who can do what
✅ **Scalable** - Support unlimited establishments
✅ **Flexible** - Fighters can be independent or linked to establishments
✅ **Secure** - RLS enforces access control at database level
✅ **Auditable** - Track who created each championship
✅ **Professional** - Matches real-world fight organization structures

---

## Database Statistics

```
New Tables: 2 (establishments, establishment_admins)
Total Tables: 10 (was 8)
New Columns: 35+
New Foreign Keys: 5
New Enums: 1 (establishment_type)
New RLS Policies: 15+
New Triggers: 1 (auto-add creator as admin)
New Functions: 3 helper functions
```

---

## Next Steps

1. ✅ Schema updated with establishments
2. ✅ Migration generated
3. ✅ RLS policies created
4. ✅ Helper functions implemented
5. ⏳ Run migrations
6. ⏳ Run Supabase setup SQL
7. ⏳ Build establishment management UI
8. ⏳ Build championship creation flow
9. ⏳ Test permissions

---

## Files Reference

- **app/db/schema.ts** - Database schema with establishments
- **app/db/establishments.ts** - Helper functions (20+ functions)
- **drizzle/0002_confused_ultimates.sql** - Migration file
- **supabase-establishments-setup.sql** - RLS policies and triggers
- **app/db/types.ts** - TypeScript types

---

Your Fighter Management App now supports **multi-establishment architecture**! 🏢🥊

