# Supabase Authentication Integration Guide

## Overview

This Fighter Management App integrates with **Supabase Authentication** to provide user management, role-based access control, and secure linking between users and fighters.

## Architecture

```
┌─────────────────────────────────────────┐
│         Supabase Auth Layer             │
│         (auth.users - Managed)          │
└──────────────────┬──────────────────────┘
                   │ UUID
                   ▼
┌─────────────────────────────────────────┐
│      Public Schema: profiles            │
│  - User profiles & roles                │
│  - Mirrors auth.users                   │
└──────────────────┬──────────────────────┘
                   │ user_id (optional)
                   ▼
┌─────────────────────────────────────────┐
│      Public Schema: fighters            │
│  - Fighter-specific data                │
│  - Can exist without user account       │
└─────────────────────────────────────────┘
```

## Database Tables

### 1. `auth.users` (Supabase Managed)
Managed entirely by Supabase Auth. Contains:
- `id` (UUID) - Primary key
- `email` - User email
- `encrypted_password` - Password hash
- `created_at`, `updated_at`
- Other Supabase Auth fields

**You don't directly modify this table.**

### 2. `public.profiles`
Your application's user profile table:

```typescript
{
  id: UUID,              // References auth.users(id)
  email: string,         // Copied from auth.users
  full_name?: string,
  avatar_url?: string,
  role: 'fighter' | 'admin' | 'manager' | 'viewer',
  phone_number?: string,
  is_active: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

**Purpose:**
- Store application-specific user data
- Manage roles and permissions
- Can be queried from your app (unlike auth.users)

### 3. `public.fighters`
Fighter profiles with optional user link:

```typescript
{
  id: serial,
  user_id?: UUID,        // References profiles(id) - OPTIONAL
  name: string,
  // ... other fighter fields
}
```

**Key Points:**
- `user_id` is **optional** - fighters can exist without accounts
- When linked, provides authentication & ownership
- ON DELETE SET NULL - if user deleted, fighter record remains

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **viewer** | Default role | Read-only access |
| **fighter** | Active fighter | Manage own profile, view fights |
| **manager** | Gym manager | Create fighters, schedule fights |
| **admin** | System admin | Full access, manage championships |

## Setup Instructions

### Step 1: Supabase Project Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your credentials:
   - Project URL
   - Anon Key
   - Service Role Key (for server-side)

3. Update `.env`:
```bash
# Existing
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
DATABASE_PASSWORD=your_password

# Add Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 2: Run Migrations

```bash
# Generate new migration with profiles table
bunx drizzle-kit generate

# Apply migration
bunx drizzle-kit migrate
```

### Step 3: Create Supabase Trigger

Run this SQL in your Supabase SQL Editor to auto-create profiles:

```sql
-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'viewer',
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Step 4: Set Row Level Security (RLS)

Enable RLS on profiles and fighters tables:

```sql
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fighters ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Fighters: Everyone can view active fighters
CREATE POLICY "Fighters are viewable by everyone"
  ON public.fighters FOR SELECT
  USING (is_active = true);

-- Fighters: Users can update their own fighter profile
CREATE POLICY "Users can update own fighter profile"
  ON public.fighters FOR UPDATE
  USING (auth.uid() = user_id);

-- Fighters: Admins can do anything
CREATE POLICY "Admins can manage fighters"
  ON public.fighters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### Step 5: Install Supabase Client

```bash
npm install @supabase/supabase-js
# or
bun add @supabase/supabase-js
```

### Step 6: Create Supabase Client

Create `app/lib/supabase/client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

For server-side:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
```

## Common Use Cases

### 1. User Signs Up (Not a Fighter)

```typescript
// Client-side signup
import { supabase } from '@/app/lib/supabase/client';

const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      full_name: 'John Doe',
    }
  }
});

// Profile created automatically via trigger
// Role: 'viewer' by default
```

### 2. User Becomes a Fighter

```typescript
import { createFighterForUser } from '@/app/db/supabase-auth';

// After user is authenticated
const userId = session.user.id;

const fighter = await createFighterForUser(userId, {
  name: 'John "The Destroyer" Doe',
  nickname: 'The Destroyer',
  weight: '70.5',
  height: 180,
  gender: 'male',
  birthDate: new Date('1995-05-15'),
  // ... other fighter data
});

// User role automatically updated to 'fighter'
```

### 3. Check User Permissions

```typescript
import { isUserFighter, isUserAdmin } from '@/app/db/supabase-auth';

// In API route
const userId = session.user.id;

if (await isUserAdmin(userId)) {
  // Allow admin actions
}

if (await isUserFighter(userId)) {
  // Allow fighter actions
}
```

### 4. Get Authenticated User's Fighter Profile

```typescript
import { getFighterByUserId } from '@/app/db/supabase-auth';

const userId = session.user.id;
const fighter = await getFighterByUserId(userId);

if (fighter) {
  // User is a fighter
  console.log(`Fighter: ${fighter.name}`);
}
```

### 5. Admin Creates Fighter Without User Account

```typescript
import { db } from '@/app/db';
import { fighters, fighterStats } from '@/app/db/schema';

// Fighter doesn't have user_id - can't log in
const [fighter] = await db.insert(fighters).values({
  // No userId field
  name: 'Legacy Fighter',
  weight: '77.0',
  height: 175,
  // ...
}).returning();

// Initialize stats
await db.insert(fighterStats).values({
  fighterId: fighter.id,
  rankingPoints: '1000',
});
```

### 6. Link Existing Fighter to New User

```typescript
import { linkUserToFighter } from '@/app/db/supabase-auth';

// Fighter already exists (id: 123)
// User just signed up
const userId = session.user.id;

await linkUserToFighter(userId, 123);
// Fighter can now log in and manage their profile
```

## API Route Example

```typescript
// app/api/fighters/me/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getFighterByUserId } from '@/app/db/supabase-auth';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const fighter = await getFighterByUserId(session.user.id);
  
  if (!fighter) {
    return Response.json({ error: 'Not a fighter' }, { status: 404 });
  }
  
  return Response.json({ fighter });
}
```

## Middleware Protection

Create `middleware.ts`:

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  await supabase.auth.getSession();
  
  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/fighters/:path*'],
};
```

## Benefits of This Architecture

✅ **Flexible**: Fighters can exist with or without user accounts
✅ **Secure**: Supabase handles authentication, RLS protects data
✅ **Scalable**: Separate concerns (auth vs. business logic)
✅ **Auditable**: Keep fighter history even if user account deleted
✅ **Role-based**: Easy permission management
✅ **Type-safe**: Full TypeScript support

## Next Steps

1. ✅ Database schema updated
2. ✅ Supabase integration functions created
3. ⏳ Install Supabase client libraries
4. ⏳ Create Supabase triggers
5. ⏳ Set up RLS policies
6. ⏳ Build authentication UI
7. ⏳ Create protected API routes

---

For more details, see:
- `app/db/supabase-auth.ts` - Integration functions
- `app/db/schema.ts` - Database schema
- [Supabase Docs](https://supabase.com/docs)

