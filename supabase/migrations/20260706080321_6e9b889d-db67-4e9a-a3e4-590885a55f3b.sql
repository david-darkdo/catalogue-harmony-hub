
-- Extend ai_jobs with retry/execution tracking
ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.ai_jobs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_time_ms integer,
  ADD COLUMN IF NOT EXISTS dependency_chain_id uuid;

-- Add master_document to products for search symmetry
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS master_document jsonb,
  ADD COLUMN IF NOT EXISTS faq jsonb,
  ADD COLUMN IF NOT EXISTS structured_data jsonb;

-- Product understanding
CREATE TABLE IF NOT EXISTS public.product_understanding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  raw_ai_response jsonb,
  detected_material text,
  detected_finish text,
  detected_color text,
  detected_style text,
  detected_environment text,
  detected_installation_context text,
  detected_product_type text,
  detected_keywords text[],
  detected_tags text[],
  confidence_score numeric,
  provider text NOT NULL DEFAULT 'mock',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_understanding TO authenticated;
GRANT ALL ON public.product_understanding TO service_role;
ALTER TABLE public.product_understanding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pu_admin_all" ON public.product_understanding FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "pu_public_read_published" ON public.product_understanding FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id=product_understanding.product_id
    AND p.status='published' AND p.hidden=false AND p.deleted_at IS NULL));
CREATE TRIGGER pu_updated BEFORE UPDATE ON public.product_understanding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generation versions (snapshots for rollback/compare)
CREATE TABLE IF NOT EXISTS public.generation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_versions TO authenticated;
GRANT ALL ON public.generation_versions TO service_role;
ALTER TABLE public.generation_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gv_admin_all" ON public.generation_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Seed installation contexts
INSERT INTO public.installation_contexts (slug, name, description) VALUES
  ('luxury_bathroom','Luxury Bathroom','Premium bathroom installation setting'),
  ('luxury_kitchen','Luxury Kitchen','Premium kitchen installation setting'),
  ('luxury_living_room','Luxury Living Room','High-end living room setting'),
  ('luxury_bedroom','Luxury Bedroom','High-end bedroom setting'),
  ('luxury_hotel','Luxury Hotel','Hospitality luxury setting'),
  ('luxury_office','Luxury Office','Executive workspace setting'),
  ('luxury_exterior','Luxury Exterior','Premium outdoor/facade setting'),
  ('luxury_showroom','Luxury Showroom','Studio showroom setting'),
  ('luxury_commercial','Luxury Commercial','High-end commercial retail setting')
ON CONFLICT (slug) DO NOTHING;

-- Seed default prompt templates for each context
INSERT INTO public.ai_prompt_templates (installation_context_id, studio_prompt, installed_prompt, description_prompt)
SELECT ic.id,
  'Professional studio product photograph of {product_name} ({material}, {finish}). Isolated on soft neutral background, museum lighting, ultra-sharp, preserve exact color/finish/material/orientation. 4k.',
  'Photorealistic {context} scene featuring {product_name} installed in-situ. Preserve product identity exactly. Cinematic architectural photography, natural light, luxury Nigerian interior styling.',
  'Write a luxury showroom description for {product_name}, a {category} in {finish} {material}. Emphasize craftsmanship, provenance, and how it elevates a {context}. 3 short paragraphs.'
FROM public.installation_contexts ic
WHERE NOT EXISTS (SELECT 1 FROM public.ai_prompt_templates apt WHERE apt.installation_context_id=ic.id);
