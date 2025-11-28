-- =============================================
-- Supabase Setup SQL
-- Run these commands in your Supabase SQL Editor
-- AFTER running the Drizzle migrations
-- =============================================

-- =============================================
-- 1. CREATE TRIGGER FUNCTION
-- Automatically create profile when user signs up
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer',
    true
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- =============================================
-- 2. CREATE TRIGGER
-- Execute handle_new_user() on auth.users insert
-- =============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fighters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fighter_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_classes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. PROFILES POLICIES
-- =============================================

-- Everyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can insert their own profile (for manual creation)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete profiles
CREATE POLICY "Only admins can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 5. FIGHTERS POLICIES
-- =============================================

-- Everyone can view active fighters
CREATE POLICY "Active fighters are viewable by everyone"
  ON public.fighters
  FOR SELECT
  USING (is_active = true);

-- Admins and managers can view all fighters
CREATE POLICY "Staff can view all fighters"
  ON public.fighters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Admins and managers can create fighters
CREATE POLICY "Staff can create fighters"
  ON public.fighters
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Fighters can update their own profile
CREATE POLICY "Fighters can update own profile"
  ON public.fighters
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins and managers can update any fighter
CREATE POLICY "Staff can update any fighter"
  ON public.fighters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Only admins can delete fighters
CREATE POLICY "Only admins can delete fighters"
  ON public.fighters
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 6. FIGHTER STATS POLICIES
-- =============================================

-- Everyone can view fighter stats
CREATE POLICY "Fighter stats are viewable by everyone"
  ON public.fighter_stats
  FOR SELECT
  USING (true);

-- Only admins and managers can modify stats
CREATE POLICY "Only staff can modify fighter stats"
  ON public.fighter_stats
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- =============================================
-- 7. FIGHTS POLICIES
-- =============================================

-- Everyone can view completed fights
CREATE POLICY "Completed fights are viewable by everyone"
  ON public.fights
  FOR SELECT
  USING (status = 'completed');

-- Authenticated users can view scheduled fights
CREATE POLICY "Authenticated users can view scheduled fights"
  ON public.fights
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND status IN ('scheduled', 'in_progress')
  );

-- Only staff can create/update/delete fights
CREATE POLICY "Only staff can manage fights"
  ON public.fights
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- =============================================
-- 8. CHAMPIONSHIPS POLICIES
-- =============================================

-- Everyone can view active championships
CREATE POLICY "Active championships are viewable by everyone"
  ON public.championships
  FOR SELECT
  USING (status IN ('registration_open', 'in_progress', 'completed'));

-- Only staff can manage championships
CREATE POLICY "Only staff can manage championships"
  ON public.championships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- =============================================
-- 9. CHAMPIONSHIP PARTICIPANTS POLICIES
-- =============================================

-- Everyone can view participants in active championships
CREATE POLICY "Championship participants are viewable"
  ON public.championship_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.championships
      WHERE id = championship_id AND status IN ('registration_open', 'in_progress', 'completed')
    )
  );

-- Fighters can register themselves
CREATE POLICY "Fighters can register for championships"
  ON public.championship_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fighters
      WHERE id = fighter_id AND user_id = auth.uid()
    )
  );

-- Staff can manage all participants
CREATE POLICY "Staff can manage participants"
  ON public.championship_participants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- =============================================
-- 10. CHAMPIONSHIP MATCHES POLICIES
-- =============================================

-- Everyone can view championship matches
CREATE POLICY "Championship matches are viewable"
  ON public.championship_matches
  FOR SELECT
  USING (true);

-- Only staff can manage championship matches
CREATE POLICY "Only staff can manage championship matches"
  ON public.championship_matches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- =============================================
-- 11. WEIGHT CLASSES POLICIES
-- =============================================

-- Everyone can view weight classes
CREATE POLICY "Weight classes are viewable by everyone"
  ON public.weight_classes
  FOR SELECT
  USING (true);

-- Only admins can manage weight classes
CREATE POLICY "Only admins can manage weight classes"
  ON public.weight_classes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 12. HELPER FUNCTIONS
-- =============================================

-- Function to check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('admin', 'manager')
  );
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Function to get user's fighter ID
CREATE OR REPLACE FUNCTION public.get_fighter_id(user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.fighters WHERE user_id = $1 LIMIT 1;
$$;

-- =============================================
-- 13. STORAGE BUCKETS (for avatar images)
-- =============================================

-- Create storage bucket for avatars (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Enable RLS on storage
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow users to upload their own avatar
-- CREATE POLICY "Users can upload own avatar"
--   ON storage.objects
--   FOR INSERT
--   WITH CHECK (
--     bucket_id = 'avatars' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- Allow users to update their own avatar
-- CREATE POLICY "Users can update own avatar"
--   ON storage.objects
--   FOR UPDATE
--   USING (
--     bucket_id = 'avatars' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- Allow public access to avatars
-- CREATE POLICY "Avatars are publicly accessible"
--   ON storage.objects
--   FOR SELECT
--   USING (bucket_id = 'avatars');

-- =============================================
-- 14. INDEXES FOR PERFORMANCE
-- =============================================

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_fighters_user_id ON public.fighters(user_id);
CREATE INDEX IF NOT EXISTS idx_fighters_active ON public.fighters(is_active);
CREATE INDEX IF NOT EXISTS idx_fighters_weight_class ON public.fighters(weight_class_id);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Run these to verify everything is set up correctly:

-- 1. Check if trigger exists
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- 2. Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- 3. Check policies exist
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- 4. Test profile creation (sign up a test user via Supabase Auth UI)

-- =============================================
-- DONE!
-- Your Supabase integration is complete.
-- =============================================

