
-- 1. installation_contexts
CREATE TABLE public.installation_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.installation_contexts TO anon, authenticated;
GRANT ALL ON public.installation_contexts TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.installation_contexts TO authenticated;
ALTER TABLE public.installation_contexts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic_public_read" ON public.installation_contexts FOR SELECT USING (true);
CREATE POLICY "ic_admin_write" ON public.installation_contexts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.installation_contexts (slug, name, description) VALUES
  ('surface', 'Surface', 'Flooring, walls, cladding and other surfaces'),
  ('door', 'Door', 'Interior and exterior doorways'),
  ('bathroom', 'Bathroom', 'Bathroom fittings and fixtures'),
  ('kitchen', 'Kitchen', 'Kitchen fittings and fixtures'),
  ('metal', 'Metal', 'Metal hardware and finishes'),
  ('utility', 'Utility', 'Utility, service and back-of-house spaces');

-- 2. ai_prompt_templates
CREATE TABLE public.ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_context_id uuid NOT NULL REFERENCES public.installation_contexts(id) ON DELETE CASCADE,
  studio_prompt text NOT NULL,
  installed_prompt text NOT NULL,
  description_prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_prompt_templates_ctx_idx ON public.ai_prompt_templates(installation_context_id);
GRANT SELECT ON public.ai_prompt_templates TO anon, authenticated;
GRANT ALL ON public.ai_prompt_templates TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.ai_prompt_templates TO authenticated;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apt_public_read" ON public.ai_prompt_templates FOR SELECT USING (true);
CREATE POLICY "apt_admin_write" ON public.ai_prompt_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.ai_prompt_templates (installation_context_id, studio_prompt, installed_prompt, description_prompt)
SELECT id,
  'Studio product photography of {product_name}, soft neutral background, premium showroom lighting, ultra-detailed material texture.',
  'Realistic interior render of {product_name} installed in a tasteful {context} setting, natural lighting, architectural photography.',
  'Write a concise, premium showroom description for {product_name}. Highlight material, finish, durability, and ideal use case.'
FROM public.installation_contexts;

-- 3. product_types.installation_context_id (backfill -> NOT NULL)
ALTER TABLE public.product_types
  ADD COLUMN installation_context_id uuid REFERENCES public.installation_contexts(id);

UPDATE public.product_types
SET installation_context_id = (SELECT id FROM public.installation_contexts WHERE slug = 'surface')
WHERE installation_context_id IS NULL;

ALTER TABLE public.product_types
  ALTER COLUMN installation_context_id SET NOT NULL;
CREATE INDEX product_types_install_ctx_idx ON public.product_types(installation_context_id);

-- 4. family_groups.custom_ai_prompt_override
ALTER TABLE public.family_groups
  ADD COLUMN custom_ai_prompt_override text;

-- 5. products: AI fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS generated_description text,
  ADD COLUMN IF NOT EXISTS is_ai_processing boolean NOT NULL DEFAULT false;

-- Update triggers for new tables
CREATE TRIGGER ic_updated BEFORE UPDATE ON public.installation_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER apt_updated BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
