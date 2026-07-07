
DROP POLICY IF EXISTS "Anyone can log views" ON public.product_views;
CREATE POLICY "Log own product views"
  ON public.product_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

REVOKE ALL ON FUNCTION public.get_my_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated, service_role;
