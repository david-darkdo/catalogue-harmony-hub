
-- =========================================================
-- Build B — Product Management Command Center: schema upgrades
-- =========================================================

-- 1. ENUMS -------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('draft','review','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_asset_status AS ENUM ('idle','queued','processing','ready','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. product_types: add code_prefix ------------------------
ALTER TABLE public.product_types
  ADD COLUMN IF NOT EXISTS code_prefix text;

UPDATE public.product_types
   SET code_prefix = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 3))
 WHERE code_prefix IS NULL OR code_prefix = '';

ALTER TABLE public.product_types
  ALTER COLUMN code_prefix SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_types_code_prefix_key
  ON public.product_types (code_prefix);

-- 3. products: new operational columns ---------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS production_name text,
  ADD COLUMN IF NOT EXISTS finish_name text,
  ADD COLUMN IF NOT EXISTS status public.product_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS featured_homepage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_feed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_status public.ai_asset_status NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS seo_keywords text[],
  ADD COLUMN IF NOT EXISTS app_search_keywords text[],
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS canonical_slug text,
  ADD COLUMN IF NOT EXISTS installation_context_id uuid REFERENCES public.installation_contexts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS similar_product_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Backfill status from legacy is_published
UPDATE public.products
   SET status = CASE WHEN is_published THEN 'published'::public.product_status ELSE 'draft'::public.product_status END
 WHERE status = 'draft' AND is_published = true;

-- Mirror ai_status from is_ai_processing
UPDATE public.products
   SET ai_status = 'processing'::public.ai_asset_status
 WHERE is_ai_processing = true AND ai_status = 'idle';

-- Indexes for filters
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products(status);
CREATE INDEX IF NOT EXISTS products_featured_home_idx ON public.products(featured_homepage) WHERE featured_homepage;
CREATE INDEX IF NOT EXISTS products_featured_feed_idx ON public.products(featured_feed) WHERE featured_feed;
CREATE INDEX IF NOT EXISTS products_hidden_idx ON public.products(hidden);
CREATE INDEX IF NOT EXISTS products_deleted_at_idx ON public.products(deleted_at);
CREATE INDEX IF NOT EXISTS products_type_idx ON public.products(type_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products(category_id);
CREATE INDEX IF NOT EXISTS products_subcategory_idx ON public.products(subcategory_id);
CREATE INDEX IF NOT EXISTS products_family_idx ON public.products(family_id);

-- 4. AUTO product code generator ---------------------------
CREATE OR REPLACE FUNCTION public.generate_product_code(_type_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next int;
  v_code text;
BEGIN
  SELECT code_prefix INTO v_prefix FROM public.product_types WHERE id = _type_id;
  IF v_prefix IS NULL THEN v_prefix := 'GEN'; END IF;

  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(SPLIT_PART(code, '-', 3), '[^0-9]', '', 'g'), '')::int
  ), 0) + 1
    INTO v_next
    FROM public.products
   WHERE code LIKE 'EC-' || v_prefix || '-%';

  v_code := 'EC-' || v_prefix || '-' || LPAD(v_next::text, 6, '0');
  RETURN v_code;
END $$;

GRANT EXECUTE ON FUNCTION public.generate_product_code(uuid) TO authenticated, service_role;

-- Trigger: auto-fill code on insert if blank
CREATE OR REPLACE FUNCTION public.products_autocode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.code IS NULL OR btrim(NEW.code) = '') AND NEW.type_id IS NOT NULL THEN
    NEW.code := public.generate_product_code(NEW.type_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_autocode ON public.products;
CREATE TRIGGER trg_products_autocode
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_autocode();

-- 5. SIMILAR PRODUCTS recompute ----------------------------
CREATE OR REPLACE FUNCTION public.recompute_similar_products(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fam uuid;
  v_sub uuid;
  v_cat uuid;
  v_ids uuid[];
BEGIN
  SELECT family_id, subcategory_id, category_id
    INTO v_fam, v_sub, v_cat
    FROM public.products WHERE id = _product_id;

  WITH ranked AS (
    SELECT id, CASE
      WHEN family_id IS NOT NULL AND family_id = v_fam THEN 1
      WHEN subcategory_id = v_sub THEN 2
      WHEN category_id = v_cat THEN 3
      ELSE 4 END AS rnk
    FROM public.products
    WHERE id <> _product_id
      AND status = 'published'
      AND hidden = false
      AND deleted_at IS NULL
      AND (
        (family_id IS NOT NULL AND family_id = v_fam)
        OR subcategory_id = v_sub
        OR category_id = v_cat
      )
    ORDER BY rnk, created_at DESC
    LIMIT 12
  )
  SELECT array_agg(id) INTO v_ids FROM ranked;

  UPDATE public.products
     SET similar_product_ids = COALESCE(v_ids, ARRAY[]::uuid[])
   WHERE id = _product_id;
END $$;

GRANT EXECUTE ON FUNCTION public.recompute_similar_products(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.products_similar_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_similar_products(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_similar ON public.products;
CREATE TRIGGER trg_products_similar
  AFTER INSERT OR UPDATE OF family_id, subcategory_id, category_id, status, hidden, deleted_at
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_similar_trigger();

-- updated_at trigger if not already attached
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
