import { supabase } from "@/integrations/supabase/client";

export type JobType =
  | "understanding"
  | "search_index"
  | "seo"
  | "description"
  | "image_generation"
  | "faq_generation";

export type JobStatus = "pending" | "processing" | "success" | "failed" | "retry";
export type ProcessingState = "draft" | "pending" | "processing" | "completed" | "error" | "archived";

/** Kick off the full 6-step AI pipeline for a product. */
export async function enqueueAiPipeline(productId: string) {
  const { error } = await supabase.rpc("enqueue_ai_pipeline" as any, { _product_id: productId } as any);
  if (error) throw error;
}

/** Retry a single failed job. */
export async function retryJob(jobId: string) {
  const { error } = await supabase.rpc("retry_ai_job" as any, { _job_id: jobId } as any);
  if (error) throw error;
}

/** Retry the entire pipeline for a product (re-enqueue). */
export async function retryProductPipeline(productId: string) {
  // Clear old jobs then re-enqueue
  await supabase.from("ai_jobs" as any).delete().eq("product_id", productId);
  await enqueueAiPipeline(productId);
}

/**
 * Regenerate: guards against wasted credits by comparing the current
 * generation_hash to the stored one on the product row.
 */
export async function regenerateWithHashGuard(productId: string, opts?: { force?: boolean }) {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, generation_hash, generation_version")
    .eq("id", productId)
    .maybeSingle();
  if (error || !product) throw error ?? new Error("Product not found");

  // Compute current hash server-side by touching the row (trigger recomputes).
  // Simplest: fetch again after trigger — but we've just read it, so it's fresh.
  if (!opts?.force) {
    // Look up last successful job's product snapshot if we stored one; for MVP
    // we compare against a "last_generated_hash" stored in error_log jsonb.
    const { data: last } = await supabase
      .from("ai_jobs" as any)
      .select("payload, created_at")
      .eq("product_id", productId)
      .eq("job_type", "understanding")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const previousHash = (last as any)?.payload?.hash;
    if (previousHash && previousHash === product.generation_hash) {
      return { skipped: true as const, reason: "No changes detected. Regeneration may waste credits." };
    }
  }

  // Bump version and enqueue.
  await supabase
    .from("products")
    .update({ generation_version: (product.generation_version ?? 0) + 1 } as any)
    .eq("id", productId);
  await retryProductPipeline(productId);
  return { skipped: false as const };
}
