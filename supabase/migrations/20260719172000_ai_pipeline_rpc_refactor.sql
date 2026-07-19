-- Migration: Update AI Job Types and Pipeline Enqueue Function

-- 1. Add new job types to the public.ai_job_type enum
-- Since ALTER TYPE ADD VALUE cannot run inside a transaction block, we do it safely:
ALTER TYPE public.ai_job_type ADD VALUE IF NOT EXISTS 'lifestyle';
ALTER TYPE public.ai_job_type ADD VALUE IF NOT EXISTS 'search';
ALTER TYPE public.ai_job_type ADD VALUE IF NOT EXISTS 'recommendation';
ALTER TYPE public.ai_job_type ADD VALUE IF NOT EXISTS 'quality';

-- 2. Update enqueue_ai_pipeline RPC to schedule the six universal steps
CREATE OR REPLACE FUNCTION public.enqueue_ai_pipeline(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Delete existing jobs for this product to prevent duplicate keys
  DELETE FROM public.ai_jobs WHERE product_id = _product_id;

  UPDATE public.products SET processing_state='pending', error_log=NULL, retry_count=0, last_processed_at=now()
    WHERE id = _product_id;

  INSERT INTO public.ai_jobs (product_id, job_type, job_dependency, status) VALUES
    (_product_id,'understanding',NULL,'pending'),
    (_product_id,'seo','understanding','pending'),
    (_product_id,'lifestyle','understanding','pending'),
    (_product_id,'search','understanding','pending'),
    (_product_id,'recommendation','understanding','pending'),
    (_product_id,'quality','lifestyle','pending');
END $$;
