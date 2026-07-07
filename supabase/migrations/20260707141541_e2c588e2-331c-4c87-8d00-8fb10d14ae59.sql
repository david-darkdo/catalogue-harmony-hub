GRANT EXECUTE ON FUNCTION public.rebuild_search_index(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_similar_products(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_ai_pipeline(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.retry_ai_job(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_product_code(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_products(text, integer) TO authenticated, anon, service_role;