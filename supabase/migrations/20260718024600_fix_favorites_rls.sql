-- Create helper security definer function to bypass RLS check recursively
CREATE OR REPLACE FUNCTION public.check_user_owns_profile(profile_uuid UUID, auth_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = profile_uuid AND auth_id = auth_uuid
  );
$$;

-- Redefine favorites table policies
DROP POLICY IF EXISTS "Allow users insert their own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Allow authenticated users select favorites" ON public.favorites;
DROP POLICY IF EXISTS "Allow users delete their own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Admins read favorites" ON public.favorites;

CREATE POLICY "Allow authenticated users select favorites" ON public.favorites
  FOR SELECT TO authenticated
  USING (public.check_user_owns_profile(user_id, auth.uid()));

CREATE POLICY "Allow users insert their own favorites" ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK (public.check_user_owns_profile(user_id, auth.uid()));

CREATE POLICY "Allow users delete their own favorites" ON public.favorites
  FOR DELETE TO authenticated
  USING (public.check_user_owns_profile(user_id, auth.uid()));

CREATE POLICY "Allow admins select favorites" ON public.favorites
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
