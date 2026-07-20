-- Migration: AI Operating System V2.0 Refactor
-- unifies AI pipeline, templates, and product intelligence metadata

-- 1. Add key and prompt_text columns to public.ai_prompt_templates
ALTER TABLE public.ai_prompt_templates
  ADD COLUMN IF NOT EXISTS key text UNIQUE,
  ADD COLUMN IF NOT EXISTS prompt_text text;

-- Drop NOT NULL constraints on all legacy columns of ai_prompt_templates
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_prompt_templates'
          AND is_nullable = 'NO'
          AND column_name NOT IN ('id', 'name')
    ) LOOP
        EXECUTE format('ALTER TABLE public.ai_prompt_templates ALTER COLUMN %I DROP NOT NULL', r.column_name);
    END LOOP;
END $$;

-- Drop legacy unique index on installation_context_id if it exists
DROP INDEX IF EXISTS public.ai_prompt_templates_ctx_idx;

-- 2. Add key and prompt_text columns to public.ai_prompt_templates_history
ALTER TABLE public.ai_prompt_templates_history
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS prompt_text text;

-- 3. Delete existing legacy templates to clean up context-based routing
DELETE FROM public.ai_prompt_templates_history;
DELETE FROM public.ai_prompt_templates;

-- 4. Seed the exactly 6 universal templates
INSERT INTO public.ai_prompt_templates (
  id, name, purpose, key, prompt_text, is_active, version, priority
) VALUES
(
  'a0000000-0000-0000-0000-000000000001',
  'Product Understanding',
  'Extract structured intelligence from product details and images.',
  'understanding',
  'You are a luxury product understanding engine. Analyze the uploaded product image and details.
Product Details:
Name: {product_name}
Brand: {brand}
Finish: {finish}
Material: {material}
Color: {color}
Size: {size}
Additional Directives: {family_override}

Output a strict JSON object with:
- product_type (e.g. door, tile, slab, tap)
- installation_area (Wall, Floor, Ceiling, Furniture, or Multi)
- indoor_outdoor (Indoor, Outdoor, or both)
- surface_types (array: e.g. ["Wall", "Floor"])
- material
- finish
- texture
- color
- pattern
- shape
- style (e.g. Modern Minimalist, Classic Baroque)
- luxury_level (e.g. Ultra-Luxury, Premium, Standard)
- installation_context
- customer_intent
- architectural_use
- related_categories (array of matching category slugs)
- search_keywords (array of tags)
- visual_characteristics (array of descriptive phrases)
- design_language
- confidence (0-1)',
  true, 1, 0
),
(
  'a0000000-0000-0000-0000-000000000002',
  'SEO Generation',
  'Generate descriptions, SEO titles, metadata, and FAQ JSON content.',
  'seo',
  'Consuming the following Product Intelligence:
{product_intelligence}

Product Details:
Name: {product_name}
Brand: {brand}

Generate a strict JSON object containing:
- generated_description (A single cohesive luxury copywriting description of 2-3 paragraphs. Focus on materials, craftsmanship, and aesthetic placement. No markdown, plain text. The exact same text will be used for both page and search indexing.)
- seo_title (max 60 characters)
- meta_description (max 155 characters)
- seo_keywords (array of strings)
- canonical_slug (kebab-case)
- og_title
- og_description
- twitter_card (e.g. summary_large_image)
- faq (array of 5 objects containing: { q: "question", a: "answer" } addressing typical buyer questions for this type of material)
- structured_data (A JSON-LD object representing Question/Answer FAQ list schema matching the FAQ above)',
  true, 1, 0
),
(
  'a0000000-0000-0000-0000-000000000003',
  'Lifestyle Rendering',
  'Generate prompts for placing product images in luxury interior settings.',
  'lifestyle',
  'You are a prompt engineer for an image generation pipeline.
Create a highly descriptive image generation prompt to place the product inside a realistic, luxury context.
The product is a {material} {product_type} with a {finish} finish, color {color}, and design style {style}.
It belongs in a {installation_area} / {installation_context} setting.
Visual description of the product: {visual_characteristics}.
Design Language: {design_language}.

Guidelines:
1. Place the product naturally inside a beautiful, realistic installation scene (e.g. luxury home interior or premium commercial environment).
2. Maintain the original design, material, texture, finish, color, and geometric proportions of the product exactly.
3. Describe the surrounding environment: luxury textures, photorealistic materials, natural cinematic lighting, premium styling (e.g. high-end Abuja villa or luxury hotel).
4. Keep the output as a simple, direct prompt string suitable for DALL-E 3 or Imagen.',
  true, 1, 0
),
(
  'a0000000-0000-0000-0000-000000000004',
  'Search Intelligence',
  'Generate search synonyms, builder jargon, and designer keywords.',
  'search',
  'Analyze the Product Intelligence:
{product_intelligence}

Generate search terms and variations. Return a JSON object with:
- search_aliases (array: common alternative names)
- builder_terminology (array of terms builders would search for)
- designer_terminology (array of terms interior designers would search for)
- contractor_terminology (array of terms contractors would use)
- common_misspellings (array of common typing mistakes)
- name_variations (array of variations)
- material_terminology (array of related materials)
- regional_variations (array of regional terms)',
  true, 1, 0
),
(
  'a0000000-0000-0000-0000-000000000005',
  'Recommendation Engine',
  'Generate cross-sell suggestions and complementary products.',
  'recommendation',
  'Analyze the Product Intelligence:
{product_intelligence}

Generate recommendation parameters. Return a JSON object with:
- related_product_types (array of related type slugs)
- matching_collection_styles (array of styles/collections that match)
- cross_sell_categories (array of category slugs for cross-selling)
- complementary_materials (array of complementary colors/materials)
- upsell_triggers (array of upsell characteristics)',
  true, 1, 0
),
(
  'a0000000-0000-0000-0000-000000000006',
  'Quality Validation',
  'Verify if generated rendering matches the original product image.',
  'quality',
  'Verify if the generated installation/lifestyle image matches the original product image.
Product Intelligence: {product_intelligence}
Original Product Image: {original_image_url}
Generated Lifestyle Image: {generated_image_url}

Determine if the AI redesigned, replaced, or changed the product. Check:
- Was material changed?
- Was geometry/proportions changed?
- Was texture changed?
- Was finish changed?
- Was orientation changed?
- Was color changed?
- Was the product replaced?

Output a strict JSON object with:
- material_match (boolean)
- geometry_match (boolean)
- texture_match (boolean)
- finish_match (boolean)
- orientation_match (boolean)
- color_match (boolean)
- product_preserved (boolean)
- confidence_score (0-100 score indicating similarity between the product in both images)
- passes_validation (boolean: true if confidence_score >= 80 and product_preserved is true)
- failure_reasons (array of strings if any mismatch is found)',
  true, 1, 0
);

-- 5. Re-create the log_ai_prompt_template_history function and trigger to reflect key/prompt_text
CREATE OR REPLACE FUNCTION public.log_ai_prompt_template_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ai_prompt_templates_history (
    template_id,
    name,
    purpose,
    key,
    prompt_text,
    is_active,
    version,
    priority,
    installation_context_id,
    created_by
  ) VALUES (
    OLD.id,
    OLD.name,
    OLD.purpose,
    OLD.key,
    OLD.prompt_text,
    OLD.is_active,
    OLD.version,
    OLD.priority,
    OLD.installation_context_id,
    OLD.updated_by
  );
  
  NEW.version := OLD.version + 1;
  NEW.updated_at := timezone('utc'::text, now());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.5 Attach trigger to public.ai_prompt_templates
DROP TRIGGER IF EXISTS on_ai_prompt_template_update ON public.ai_prompt_templates;
CREATE TRIGGER on_ai_prompt_template_update
  BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ai_prompt_template_history();


-- 6. Add columns to public.product_understanding table for Product Intelligence Object fields
ALTER TABLE public.product_understanding
  ADD COLUMN IF NOT EXISTS detected_installation_area text,
  ADD COLUMN IF NOT EXISTS detected_indoor_outdoor text,
  ADD COLUMN IF NOT EXISTS detected_surface_types text[],
  ADD COLUMN IF NOT EXISTS detected_texture text,
  ADD COLUMN IF NOT EXISTS detected_pattern text,
  ADD COLUMN IF NOT EXISTS detected_shape text,
  ADD COLUMN IF NOT EXISTS detected_luxury_level text,
  ADD COLUMN IF NOT EXISTS detected_customer_intent text,
  ADD COLUMN IF NOT EXISTS detected_architectural_use text,
  ADD COLUMN IF NOT EXISTS detected_related_categories text[],
  ADD COLUMN IF NOT EXISTS detected_search_keywords text[],
  ADD COLUMN IF NOT EXISTS detected_visual_characteristics text[],
  ADD COLUMN IF NOT EXISTS detected_design_language text;

-- 7. Add quality validation and recommendation result column to product_understanding
ALTER TABLE public.product_understanding
  ADD COLUMN IF NOT EXISTS quality_validation_result jsonb,
  ADD COLUMN IF NOT EXISTS recommendation_result jsonb;

-- 8. Drop obsolete tables if they exist
DROP TABLE IF EXISTS public.automation_steps CASCADE;
DROP TABLE IF EXISTS public.automation_runs CASCADE;
DROP TABLE IF EXISTS public.automation_workflows CASCADE;
