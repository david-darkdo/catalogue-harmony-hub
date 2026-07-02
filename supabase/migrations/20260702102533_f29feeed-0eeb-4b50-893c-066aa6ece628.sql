
-- Enums
DO $$ BEGIN CREATE TYPE public.product_processing_state AS ENUM ('draft','pending','processing','completed','error','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ai_job_type AS ENUM ('understanding','search_index','seo','description','image_generation','faq_generation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ai_job_status AS ENUM ('pending','processing','success','failed','retry'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.product_asset_type AS ENUM ('original','studio','installed','gallery'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS processing_state public.product_processing_state NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_log jsonb,
  ADD COLUMN IF NOT EXISTS generation_hash text,
  ADD COLUMN IF NOT EXISTS generation_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_understanding jsonb;

CREATE INDEX IF NOT EXISTS idx_products_processing_state ON public.products(processing_state);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

-- AI jobs
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  job_type public.ai_job_type NOT NULL,
  job_dependency public.ai_job_type,
  status public.ai_job_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_log jsonb, payload jsonb, result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz, completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_jobs TO authenticated;
GRANT ALL ON public.ai_jobs TO service_role;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "Admins write jobs" ON public.ai_jobs;
CREATE POLICY "Admins read jobs" ON public.ai_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins write jobs" ON public.ai_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_ai_jobs_product ON public.ai_jobs(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON public.ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_type ON public.ai_jobs(job_type);
DROP TRIGGER IF EXISTS trg_ai_jobs_updated_at ON public.ai_jobs;
CREATE TRIGGER trg_ai_jobs_updated_at BEFORE UPDATE ON public.ai_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product assets
CREATE TABLE IF NOT EXISTS public.product_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  asset_type public.product_asset_type NOT NULL,
  asset_url text NOT NULL,
  generated_by_ai boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  generation_version integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_assets TO authenticated;
GRANT ALL ON public.product_assets TO service_role;
ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read assets of published products" ON public.product_assets;
DROP POLICY IF EXISTS "Admins manage assets" ON public.product_assets;
CREATE POLICY "Public read assets of published products" ON public.product_assets
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status='published' AND p.hidden=false AND p.deleted_at IS NULL));
CREATE POLICY "Admins manage assets" ON public.product_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_product_assets_product ON public.product_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_type ON public.product_assets(asset_type);

-- Search index
CREATE TABLE IF NOT EXISTS public.search_index (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  normalized_size text,
  search_aliases text[] NOT NULL DEFAULT '{}',
  combined_search_text text NOT NULL DEFAULT '',
  master_document jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.search_index TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_index TO authenticated;
GRANT ALL ON public.search_index TO service_role;
ALTER TABLE public.search_index ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read search_index of published" ON public.search_index;
DROP POLICY IF EXISTS "Admins manage search_index" ON public.search_index;
CREATE POLICY "Public read search_index of published" ON public.search_index
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status='published' AND p.hidden=false AND p.deleted_at IS NULL));
CREATE POLICY "Admins manage search_index" ON public.search_index FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX IF NOT EXISTS idx_search_index_vector ON public.search_index USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_search_index_aliases ON public.search_index USING GIN(search_aliases);

-- Size aliases
CREATE OR REPLACE FUNCTION public.generate_size_aliases(_size text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m text[]; w_int int; h_int int; w_mm int; h_mm int; aliases text[] := ARRAY[]::text[];
BEGIN
  IF _size IS NULL OR btrim(_size)='' THEN RETURN aliases; END IF;
  aliases := aliases || _size;
  m := regexp_match(_size, '(\d+)\s*(?:cm|mm)?\s*(?:x|×|by|X)\s*(\d+)\s*(?:cm|mm)?', 'i');
  IF m IS NULL THEN RETURN aliases; END IF;
  w_int := m[1]::int; h_int := m[2]::int;
  IF _size ~* 'mm' THEN
    w_mm := w_int; h_mm := h_int; w_int := w_int/10; h_int := h_int/10;
  ELSE
    w_mm := w_int*10; h_mm := h_int*10;
  END IF;
  aliases := aliases
    || format('%s×%s', w_int, h_int)
    || format('%sx%s', w_int, h_int)
    || format('%s by %s', w_int, h_int)
    || format('%s cm by %s cm', w_int, h_int)
    || format('%s×%s mm', w_mm, h_mm)
    || format('%sx%s mm', w_mm, h_mm);
  RETURN ARRAY(SELECT DISTINCT unnest(aliases));
END $$;

-- Hash
CREATE OR REPLACE FUNCTION public.compute_product_hash(
  _manufacturer text, _finish text, _size text, _type_id uuid, _category_id uuid
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(
    COALESCE(_manufacturer,'') || '|' || COALESCE(_finish,'') || '|' ||
    COALESCE(_size,'') || '|' || COALESCE(_type_id::text,'') || '|' || COALESCE(_category_id::text,''), 'UTF8'
  )), 'hex')
$$;

-- Rebuild search index
CREATE OR REPLACE FUNCTION public.rebuild_search_index(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; t_name text; c_name text; s_name text; f_name text; ic_name text;
  size_val text; aliases text[]; keywords text[]; master jsonb; combined text;
BEGIN
  SELECT * INTO p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT name INTO t_name FROM public.product_types WHERE id = p.type_id;
  SELECT name INTO c_name FROM public.categories WHERE id = p.category_id;
  SELECT name INTO s_name FROM public.subcategories WHERE id = p.subcategory_id;
  SELECT name INTO f_name FROM public.family_groups WHERE id = p.family_id;
  SELECT ic.name INTO ic_name FROM public.product_types pt
    LEFT JOIN public.installation_contexts ic ON ic.id = pt.installation_context_id
    WHERE pt.id = p.type_id;
  size_val := p.size;
  aliases := public.generate_size_aliases(size_val);
  keywords := ARRAY['luxury','premium','quality','high quality','imported','Nigeria','Abuja']
    || COALESCE(p.app_keywords, ARRAY[]::text[])
    || COALESCE(p.seo_keywords, ARRAY[]::text[]);
  master := jsonb_build_object(
    'title', p.name, 'manufacturer', p.brand,
    'finish', COALESCE(p.finish, p.finish_name),
    'type', t_name, 'category', c_name, 'subcategory', s_name, 'family', f_name,
    'size', size_val, 'aliases', to_jsonb(aliases),
    'installation_context', ic_name, 'keywords', to_jsonb(keywords),
    'ai_description', p.generated_description,
    'seo_title', p.seo_title, 'seo_description', p.seo_description,
    'location','Abuja, Nigeria',
    'quality_terms', to_jsonb(ARRAY['luxury','premium','quality','high quality','Italian','imported'])
  );
  combined := concat_ws(' ',
    p.name, p.code, p.brand, p.color, p.material, p.finish, p.finish_name,
    p.short_description, p.generated_description, p.seo_title, p.seo_description,
    t_name, c_name, s_name, f_name, ic_name, size_val,
    array_to_string(aliases,' '), array_to_string(keywords,' ')
  );
  INSERT INTO public.search_index (product_id, normalized_size, search_aliases, combined_search_text, master_document, search_vector, updated_at)
  VALUES (_product_id, size_val, aliases, combined, master, to_tsvector('english', combined), now())
  ON CONFLICT (product_id) DO UPDATE
    SET normalized_size=EXCLUDED.normalized_size, search_aliases=EXCLUDED.search_aliases,
        combined_search_text=EXCLUDED.combined_search_text, master_document=EXCLUDED.master_document,
        search_vector=EXCLUDED.search_vector, updated_at=now();
END $$;

-- Triggers
CREATE OR REPLACE FUNCTION public.products_hash_trigger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.generation_hash := public.compute_product_hash(
    NEW.brand, COALESCE(NEW.finish, NEW.finish_name), NEW.size, NEW.type_id, NEW.category_id
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_products_hash ON public.products;
CREATE TRIGGER trg_products_hash BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_hash_trigger();

CREATE OR REPLACE FUNCTION public.products_after_change_trigger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.rebuild_search_index(NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_products_search_sync ON public.products;
CREATE TRIGGER trg_products_search_sync AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_after_change_trigger();

-- Enqueue and retry
CREATE OR REPLACE FUNCTION public.enqueue_ai_pipeline(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET processing_state='pending', error_log=NULL, retry_count=0, last_processed_at=now()
    WHERE id = _product_id;
  INSERT INTO public.ai_jobs (product_id, job_type, job_dependency, status) VALUES
    (_product_id,'understanding',NULL,'pending'),
    (_product_id,'search_index','understanding','pending'),
    (_product_id,'description','understanding','pending'),
    (_product_id,'seo','description','pending'),
    (_product_id,'image_generation','understanding','pending'),
    (_product_id,'faq_generation','description','pending');
END $$;

CREATE OR REPLACE FUNCTION public.retry_ai_job(_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ai_jobs SET status='pending', error_log=NULL, updated_at=now() WHERE id=_job_id;
END $$;

-- Backfill
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.products LOOP
    PERFORM public.rebuild_search_index(r.id);
  END LOOP;
END $$;
UPDATE public.products SET processing_state='completed' WHERE status='published' AND processing_state='draft';
