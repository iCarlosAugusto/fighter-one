-- =============================================
-- Establishments RLS Policies
-- Additional policies for establishments and establishment_admins
-- Run AFTER the main supabase-setup.sql
-- =============================================

-- =============================================
-- ENABLE RLS ON NEW TABLES
-- =============================================

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_admins ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ESTABLISHMENTS POLICIES
-- =============================================

-- Everyone can view active, verified establishments
CREATE POLICY "Active establishments are viewable by everyone"
  ON public.establishments
  FOR SELECT
  USING (is_active = true AND is_verified = true);

-- Establishment admins can view their own establishments (even if not verified)
CREATE POLICY "Establishment admins can view their establishments"
  ON public.establishments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.establishment_admins
      WHERE establishment_id = establishments.id 
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- Platform admins can view all establishments
CREATE POLICY "Platform admins can view all establishments"
  ON public.establishments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can create establishments
CREATE POLICY "Authenticated users can create establishments"
  ON public.establishments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Establishment admins can update their establishments
CREATE POLICY "Establishment admins can update their establishments"
  ON public.establishments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.establishment_admins
      WHERE establishment_id = establishments.id 
        AND user_id = auth.uid()
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishment_admins
      WHERE establishment_id = establishments.id 
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- Only platform admins can delete establishments
CREATE POLICY "Only platform admins can delete establishments"
  ON public.establishments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only platform admins can verify establishments
-- (This is enforced through is_verified column update restrictions)

-- =============================================
-- ESTABLISHMENT ADMINS POLICIES
-- =============================================

-- Establishment admins can view other admins in their establishments
CREATE POLICY "Establishment admins can view other admins"
  ON public.establishment_admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.establishment_admins ea
      WHERE ea.establishment_id = establishment_admins.establishment_id
        AND ea.user_id = auth.uid()
        AND ea.is_active = true
    )
  );

-- Platform admins can view all establishment admins
CREATE POLICY "Platform admins can view all establishment admins"
  ON public.establishment_admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Establishment admins can add new admins to their establishments
CREATE POLICY "Establishment admins can add new admins"
  ON public.establishment_admins
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishment_admins ea
      WHERE ea.establishment_id = establishment_admins.establishment_id
        AND ea.user_id = auth.uid()
        AND ea.is_active = true
    )
  );

-- Establishment admins can update permissions of other admins
CREATE POLICY "Establishment admins can update admin permissions"
  ON public.establishment_admins
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.establishment_admins ea
      WHERE ea.establishment_id = establishment_admins.establishment_id
        AND ea.user_id = auth.uid()
        AND ea.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishment_admins ea
      WHERE ea.establishment_id = establishment_admins.establishment_id
        AND ea.user_id = auth.uid()
        AND ea.is_active = true
    )
  );

-- Establishment admins can remove other admins
CREATE POLICY "Establishment admins can remove admins"
  ON public.establishment_admins
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.establishment_admins ea
      WHERE ea.establishment_id = establishment_admins.establishment_id
        AND ea.user_id = auth.uid()
        AND ea.is_active = true
    )
  );

-- =============================================
-- UPDATE EXISTING POLICIES
-- =============================================

-- DROP old championship policies
DROP POLICY IF EXISTS "Only staff can manage championships" ON public.championships;

-- NEW: Championships policies with establishment ownership

-- Everyone can view active championships
CREATE POLICY "Active championships are viewable by everyone"
  ON public.championships
  FOR SELECT
  USING (status IN ('registration_open', 'in_progress', 'completed'));

-- Establishment admins can create championships for their establishments
CREATE POLICY "Establishment admins can create championships"
  ON public.championships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishment_admins
      WHERE establishment_id = championships.establishment_id
        AND user_id = auth.uid()
        AND is_active = true
        AND can_create_championships = true
    )
  );

-- Establishment admins can update their championships
CREATE POLICY "Establishment admins can update their championships"
  ON public.championships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.establishment_admins
      WHERE establishment_id = championships.establishment_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishment_admins
      WHERE establishment_id = championships.establishment_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- Establishment admins can delete their championships
CREATE POLICY "Establishment admins can delete their championships"
  ON public.championships
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.establishment_admins
      WHERE establishment_id = championships.establishment_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- Platform admins can manage all championships
CREATE POLICY "Platform admins can manage all championships"
  ON public.championships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- UPDATE FIGHTERS POLICIES
-- =============================================

-- Drop old fighter creation policy
DROP POLICY IF EXISTS "Staff can create fighters" ON public.fighters;

-- NEW: Establishment admins can create fighters for their establishments
CREATE POLICY "Establishment admins can create fighters"
  ON public.fighters
  FOR INSERT
  WITH CHECK (
    establishment_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.establishment_admins
      WHERE establishment_id = fighters.establishment_id
        AND user_id = auth.uid()
        AND is_active = true
        AND can_manage_fighters = true
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to check if user is establishment admin
CREATE OR REPLACE FUNCTION public.is_establishment_admin(user_id UUID, establishment_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishment_admins
    WHERE user_id = $1 
      AND establishment_id = $2 
      AND is_active = true
  );
$$;

-- Function to check if user can create championships for establishment
CREATE OR REPLACE FUNCTION public.can_create_championships(user_id UUID, establishment_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishment_admins
    WHERE user_id = $1 
      AND establishment_id = $2 
      AND is_active = true
      AND can_create_championships = true
  );
$$;

-- Function to get user's establishments
CREATE OR REPLACE FUNCTION public.get_user_establishments(user_id UUID)
RETURNS TABLE (
  establishment_id INTEGER,
  establishment_name VARCHAR,
  admin_role VARCHAR,
  can_create_championships BOOLEAN,
  can_manage_fighters BOOLEAN,
  can_schedule_fights BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.id,
    e.name,
    ea.role,
    ea.can_create_championships,
    ea.can_manage_fighters,
    ea.can_schedule_fights
  FROM public.establishment_admins ea
  JOIN public.establishments e ON ea.establishment_id = e.id
  WHERE ea.user_id = $1 AND ea.is_active = true
  ORDER BY e.name;
$$;

-- Trigger to auto-add creator as establishment admin
CREATE OR REPLACE FUNCTION public.handle_new_establishment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add the creator as the first admin of the establishment
  INSERT INTO public.establishment_admins (
    establishment_id,
    user_id,
    role,
    can_create_championships,
    can_manage_fighters,
    can_schedule_fights,
    is_active
  ) VALUES (
    NEW.id,
    auth.uid(),
    'admin',
    true,
    true,
    true,
    true
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_establishment_created ON public.establishments;

CREATE TRIGGER on_establishment_created
  AFTER INSERT ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_establishment();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_establishments_type ON public.establishments(type);
CREATE INDEX IF NOT EXISTS idx_establishments_country ON public.establishments(country);
CREATE INDEX IF NOT EXISTS idx_establishments_active ON public.establishments(is_active);
CREATE INDEX IF NOT EXISTS idx_establishments_verified ON public.establishments(is_verified);

CREATE INDEX IF NOT EXISTS idx_establishment_admins_establishment ON public.establishment_admins(establishment_id);
CREATE INDEX IF NOT EXISTS idx_establishment_admins_user ON public.establishment_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_establishment_admins_active ON public.establishment_admins(is_active);

CREATE INDEX IF NOT EXISTS idx_fighters_establishment ON public.fighters(establishment_id);
CREATE INDEX IF NOT EXISTS idx_championships_establishment ON public.championships(establishment_id);
CREATE INDEX IF NOT EXISTS idx_championships_created_by ON public.championships(created_by_user_id);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check if establishments table has RLS
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'establishments';

-- Check establishment policies
-- SELECT policyname FROM pg_policies WHERE tablename = 'establishments';

-- Check if trigger exists
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_establishment_created';

-- =============================================
-- DONE!
-- Establishment-based championship management is ready.
-- =============================================

