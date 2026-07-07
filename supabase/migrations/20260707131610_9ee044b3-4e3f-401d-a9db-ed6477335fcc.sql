
-- 1. Remove overly-permissive public SELECT policies on collections + items
DROP POLICY IF EXISTS "Collections readable by anyone with id" ON public.collections;
DROP POLICY IF EXISTS "Collection items readable by anyone" ON public.collection_items;

-- 2. Tighten whatsapp_inquiries INSERT: authenticated only + must own collection (or admin)
DROP POLICY IF EXISTS "Anyone can create whatsapp inquiries" ON public.whatsapp_inquiries;
CREATE POLICY "Users create inquiries on own collections"
  ON public.whatsapp_inquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.collections c
            WHERE c.id = whatsapp_inquiries.collection_id
              AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- 3. Remove broad public bucket listing policies (public bucket URLs still work via CDN)
DROP POLICY IF EXISTS "product_images_anon_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_authenticated_read" ON storage.objects;

-- 4. Fix mutable search_path on utility functions
ALTER FUNCTION public.compute_product_hash(text, text, text, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.generate_size_aliases(text) SET search_path = public;

-- 5. Lock down SECURITY DEFINER functions not meant for direct client use.
--    Keep client-callable ones (has_role, get_my_roles, search_products) executable.
REVOKE ALL ON FUNCTION public.enqueue_ai_pipeline(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_ai_job(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_search_index(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_similar_products(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_product_code(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains access for server-side use
GRANT EXECUTE ON FUNCTION public.enqueue_ai_pipeline(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_ai_job(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_search_index(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_similar_products(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_product_code(uuid) TO service_role;
