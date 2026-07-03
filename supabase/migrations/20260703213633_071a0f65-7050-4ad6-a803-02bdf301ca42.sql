
-- Product image_mode
DO $$ BEGIN
  CREATE TYPE public.product_image_mode AS ENUM ('manual','ai','hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_mode public.product_image_mode NOT NULL DEFAULT 'manual';

-- Archive flags on hierarchy tables (soft delete)
ALTER TABLE public.product_types    ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.categories       ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.subcategories    ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.family_groups    ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.installation_contexts ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Sort order
ALTER TABLE public.product_types    ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
ALTER TABLE public.categories       ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
ALTER TABLE public.subcategories    ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
ALTER TABLE public.family_groups    ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- Storage RLS: admins can manage product-images; authenticated can read.
DROP POLICY IF EXISTS "product_images_admin_all" ON storage.objects;
CREATE POLICY "product_images_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)))
  WITH CHECK (bucket_id = 'product-images' AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "product_images_authenticated_read" ON storage.objects;
CREATE POLICY "product_images_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_anon_read" ON storage.objects;
CREATE POLICY "product_images_anon_read" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'product-images');

-- Public search RPC over search_index
CREATE OR REPLACE FUNCTION public.search_products(_q text, _limit int DEFAULT 60)
RETURNS TABLE (product_id uuid, rank real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT si.product_id,
         ts_rank(si.search_vector, plainto_tsquery('english', _q)) AS rank
  FROM public.search_index si
  JOIN public.products p ON p.id = si.product_id
  WHERE p.processing_state = 'completed'
    AND p.status = 'published'
    AND p.hidden = false
    AND p.deleted_at IS NULL
    AND (
      si.search_vector @@ plainto_tsquery('english', _q)
      OR si.combined_search_text ILIKE '%' || _q || '%'
      OR EXISTS (SELECT 1 FROM unnest(si.search_aliases) a WHERE a ILIKE '%' || _q || '%')
    )
  ORDER BY rank DESC NULLS LAST, p.created_at DESC
  LIMIT COALESCE(_limit, 60);
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, int) TO anon, authenticated;
