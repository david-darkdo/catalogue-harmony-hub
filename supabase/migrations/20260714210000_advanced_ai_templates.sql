-- Migration: Advanced AI Prompt Templates Routing and Version History

-- 1. Extend the main ai_prompt_templates table
ALTER TABLE public.ai_prompt_templates
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_type_id uuid REFERENCES public.product_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_override text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Populate default names/purposes for existing entries
UPDATE public.ai_prompt_templates
SET 
  name = COALESCE(name, 'Default Context Template'),
  purpose = COALESCE(purpose, 'Standard ingestion and assets rendering prompts.');

-- 2. Create the version history table
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.ai_prompt_templates(id) ON DELETE CASCADE,
  installation_context_id uuid,
  name text,
  purpose text,
  understanding_prompt text,
  studio_prompt text,
  installed_prompt text,
  description_prompt text,
  seo_prompt text,
  faq_prompt text,
  is_active boolean,
  version integer,
  priority integer,
  product_type_id uuid,
  category_id uuid,
  subcategory_id uuid,
  brand_override text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  created_by uuid
);

-- Enable RLS on history table
ALTER TABLE public.ai_prompt_templates_history ENABLE ROW LEVEL SECURITY;

-- Enable public select, admin all for history table
CREATE POLICY "Public read prompt templates history" ON public.ai_prompt_templates_history
  FOR SELECT USING (true);

CREATE POLICY "Admins manage prompt templates history" ON public.ai_prompt_templates_history
  FOR ALL USING (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role in ('admin', 'super_admin')
    )
  );

-- 3. Create history trigger function
CREATE OR REPLACE FUNCTION public.log_ai_prompt_template_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert old state into history
  INSERT INTO public.ai_prompt_templates_history (
    template_id,
    installation_context_id,
    name,
    purpose,
    understanding_prompt,
    studio_prompt,
    installed_prompt,
    description_prompt,
    seo_prompt,
    faq_prompt,
    is_active,
    version,
    priority,
    product_type_id,
    category_id,
    subcategory_id,
    brand_override,
    created_by
  ) VALUES (
    OLD.id,
    OLD.installation_context_id,
    OLD.name,
    OLD.purpose,
    OLD.understanding_prompt,
    OLD.studio_prompt,
    OLD.installed_prompt,
    OLD.description_prompt,
    OLD.seo_prompt,
    OLD.faq_prompt,
    OLD.is_active,
    OLD.version,
    OLD.priority,
    OLD.product_type_id,
    OLD.category_id,
    OLD.subcategory_id,
    OLD.brand_override,
    OLD.updated_by
  );
  
  -- Automatically increment version on the new record
  NEW.version := OLD.version + 1;
  NEW.updated_at := timezone('utc'::text, now());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind history trigger to ai_prompt_templates
DROP TRIGGER IF EXISTS trigger_log_ai_prompt_template_history ON public.ai_prompt_templates;
CREATE TRIGGER trigger_log_ai_prompt_template_history
  BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ai_prompt_template_history();
