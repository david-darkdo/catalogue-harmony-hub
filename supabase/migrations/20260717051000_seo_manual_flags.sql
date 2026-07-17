-- Add manual SEO override flags to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS seo_title_manual BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS seo_description_manual BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS seo_keywords_manual BOOLEAN DEFAULT false;

-- Add image SEO columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_title TEXT,
ADD COLUMN IF NOT EXISTS image_caption TEXT,
ADD COLUMN IF NOT EXISTS image_filename TEXT;

-- Create redirects table
CREATE TABLE IF NOT EXISTS public.redirects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    old_path TEXT UNIQUE NOT NULL,
    new_path TEXT NOT NULL,
    status_code INTEGER DEFAULT 301,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on redirects table
ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read redirects" ON public.redirects;
DROP POLICY IF EXISTS "Allow admin write redirects" ON public.redirects;

-- Create RLS policies for redirects
CREATE POLICY "Allow public read redirects" ON public.redirects FOR SELECT USING (true);
CREATE POLICY "Allow admin write redirects" ON public.redirects FOR ALL TO authenticated USING (true);

-- Create trigger function to capture slug changes
CREATE OR REPLACE FUNCTION public.handle_product_slug_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.redirects (old_path, new_path, status_code)
    VALUES ('/product/' || OLD.slug, '/product/' || NEW.slug, 301)
    ON CONFLICT (old_path) DO UPDATE SET new_path = EXCLUDED.new_path, created_at = now();
  END IF;
  RETURN NEW;
END $$;

-- Bind slug change trigger to products table
DROP TRIGGER IF EXISTS trg_product_slug_change ON public.products;
CREATE TRIGGER trg_product_slug_change BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_product_slug_change();
