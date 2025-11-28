# Supabase Integration - Quick Start

## 🚀 Setup Steps

### 1. Install Dependencies
```bash
bun add @supabase/supabase-js
bun add @supabase/auth-helpers-nextjs
```

### 2. Environment Variables
Add to `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Migrations
```bash
# Run Drizzle migrations first
bunx drizzle-kit migrate

# Then run Supabase setup SQL in Supabase SQL Editor
# Copy contents from: supabase-setup.sql
```

### 4. Create Supabase Clients
```typescript
// app/lib/supabase/client.ts (client-side)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// app/lib/supabase/server.ts (server-side)
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

## 📋 Common Patterns

### Authentication

#### Sign Up
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: { full_name: 'John Doe' }
  }
});
// Profile automatically created via trigger
```

#### Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});
```

#### Get Session
```typescript
const { data: { session } } = await supabase.auth.getSession();
const userId = session?.user.id;
```

#### Sign Out
```typescript
await supabase.auth.signOut();
```

---

### Fighter Management

#### Create Fighter for Current User
```typescript
import { createFighterForUser } from '@/app/db/supabase-auth';

const userId = session.user.id;
const fighter = await createFighterForUser(userId, {
  name: 'John Doe',
  weight: '70.5',
  height: 180,
  gender: 'male',
  birthDate: new Date('1995-01-01'),
  // ...
});
```

#### Get User's Fighter Profile
```typescript
import { getFighterByUserId } from '@/app/db/supabase-auth';

const fighter = await getFighterByUserId(userId);
```

#### Check Permissions
```typescript
import { isUserAdmin, isUserFighter } from '@/app/db/supabase-auth';

if (await isUserAdmin(userId)) {
  // Admin actions
}

if (await isUserFighter(userId)) {
  // Fighter actions
}
```

---

## 🔐 Authorization Patterns

### In API Routes (App Router)
```typescript
// app/api/fighters/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Use session.user.id for queries
  const userId = session.user.id;
  
  return Response.json({ userId });
}
```

### In Server Components
```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function Page() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect('/login');
  }
  
  return <div>User: {session.user.email}</div>;
}
```

### In Client Components
```typescript
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase/client';

export default function ClientComponent() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  return user ? <div>Logged in: {user.email}</div> : <div>Not logged in</div>;
}
```

---

## 🗂️ Database Schema

### Profiles Table
```sql
profiles (
  id UUID PRIMARY KEY,              -- From auth.users
  email VARCHAR NOT NULL,
  full_name VARCHAR,
  avatar_url TEXT,
  role user_role DEFAULT 'viewer',  -- fighter | admin | manager | viewer
  phone_number VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Fighters Table (Updated)
```sql
fighters (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),  -- ✨ NEW: Link to auth user
  name VARCHAR NOT NULL,
  -- ... other fields
)
```

---

## 🔄 User Journey Examples

### Journey 1: User Signs Up as Fighter
```typescript
// 1. User signs up
const { data: authData } = await supabase.auth.signUp({
  email: 'fighter@example.com',
  password: 'securepass',
  options: { data: { full_name: 'Mike Tyson' } }
});

// 2. Profile auto-created via trigger (role: 'viewer')

// 3. User creates fighter profile
const fighter = await createFighterForUser(authData.user.id, {
  name: 'Mike "Iron" Tyson',
  nickname: 'Iron',
  weight: '100.0',
  height: 178,
  gender: 'male',
  birthDate: new Date('1966-06-30'),
});

// 4. Role automatically updated to 'fighter'
```

### Journey 2: Admin Creates Fighter (No Account)
```typescript
// Admin creates fighter without user_id
const fighter = await db.insert(fighters).values({
  name: 'Legacy Fighter',
  weight: '85.0',
  // No user_id - fighter can't log in
}).returning();

// Later, if fighter wants an account:
const { data } = await supabase.auth.signUp({ email: 'legacy@example.com' });
await linkUserToFighter(data.user.id, fighter.id);
```

### Journey 3: Check User Role in API
```typescript
// app/api/admin/fighters/route.ts
export async function POST(request: Request) {
  const session = await getSession();
  
  // Check if user is admin
  if (!await isUserAdmin(session.user.id)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Admin can create fighter
  const data = await request.json();
  const fighter = await db.insert(fighters).values(data).returning();
  
  return Response.json({ fighter });
}
```

---

## 🛡️ Row Level Security (RLS)

All tables have RLS enabled. Key policies:

| Table | Who Can Read | Who Can Write |
|-------|--------------|---------------|
| **profiles** | Everyone | Own profile + Admins |
| **fighters** | Everyone (if active) | Own profile + Staff |
| **fights** | Everyone (if completed) | Staff only |
| **championships** | Everyone (if active) | Staff only |
| **fighter_stats** | Everyone | Staff only |

---

## 📝 Role Permissions

| Role | Permissions |
|------|-------------|
| **viewer** | Read-only access to public data |
| **fighter** | Manage own fighter profile, register for championships |
| **manager** | Create fighters, schedule fights, manage championships |
| **admin** | Full access to all resources |

---

## ✅ Checklist

- [ ] Install Supabase packages
- [ ] Add environment variables
- [ ] Run Drizzle migrations
- [ ] Run `supabase-setup.sql` in Supabase
- [ ] Create Supabase client files
- [ ] Test user signup (profile auto-created?)
- [ ] Test RLS policies
- [ ] Create login/signup UI
- [ ] Create protected API routes

---

## 📚 Resources

- Full Documentation: `SUPABASE_INTEGRATION.md`
- Setup SQL: `supabase-setup.sql`
- Auth Functions: `app/db/supabase-auth.ts`
- Schema: `app/db/schema.ts`

---

## 🎯 Next Steps

1. Install Supabase packages
2. Set up authentication UI
3. Create protected routes/pages
4. Build fighter registration flow
5. Test with real users

Your authentication system is ready! 🚀

