import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";

type JobType =
  | "understanding"
  | "search_index"
  | "seo"
  | "description"
  | "image_generation"
  | "faq_generation";

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callLLM(prompt: string, system: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(LOVABLE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const j: any = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

async function tryJSON<T = any>(prompt: string, system: string): Promise<T | null> {
  const raw = await callLLM(prompt + "\n\nReturn ONLY compact JSON.", system);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

/**
 * Runs every pending/failed AI job for a product in dependency order,
 * writing outputs to products / product_understanding / product_assets
 * and finally rebuilding search_index + flipping processing_state.
 */
export const runProductPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string }) => {
    if (!data?.productId) throw new Error("productId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const productId = data.productId;

    const { data: product, error: pErr } = await supabase
      .from("products").select("*").eq("id", productId).maybeSingle();
    if (pErr || !product) throw new Error(pErr?.message ?? "Product not found");

    await supabase.from("products")
      .update({ processing_state: "processing", error_log: null, last_processed_at: new Date().toISOString() } as any)
      .eq("id", productId);

    const { data: jobs } = await supabase
      .from("ai_jobs" as any).select("*").eq("product_id", productId)
      .order("created_at", { ascending: true });
    const jobList = (jobs ?? []) as any[];
    if (jobList.length === 0) throw new Error("No jobs queued. Enqueue pipeline first.");

    // Helpers
    const setJob = async (id: string, patch: Record<string, unknown>) => {
      await supabase.from("ai_jobs" as any).update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    };
    const done: Record<string, boolean> = {};
    for (const j of jobList) if (j.status === "success") done[j.job_type] = true;

    const runJob = async (job: any) => {
      if (job.job_dependency && !done[job.job_dependency]) {
        await setJob(job.id, { status: "pending", error_log: { skipped: `waiting on ${job.job_dependency}` } });
        return;
      }
      const started = Date.now();
      await setJob(job.id, { status: "processing", started_at: new Date().toISOString(), attempts: (job.attempts ?? 0) + 1 });
      try {
        const jt = job.job_type as JobType;
        const result: Record<string, unknown> = {};

        if (jt === "understanding") {
          const parsed = await tryJSON<any>(
            `Analyse this product for an Abuja luxury interiors showroom.\nProduct: ${product.name}\nBrand: ${product.brand ?? ""}\nFinish: ${product.finish ?? product.finish_name ?? ""}\nSize: ${product.size ?? ""}\nColor: ${product.color ?? ""}\nMaterial: ${product.material ?? ""}\n\nRespond with keys: material, finish, color, style, environment, installation_context (one of luxury_bathroom, luxury_kitchen, luxury_living_room, luxury_bedroom, luxury_hotel, luxury_office, luxury_exterior, luxury_showroom, luxury_commercial), product_type, keywords (string[]), tags (string[]), confidence (0-1).`,
            "You are a product intelligence engine. Output strict JSON."
          ) ?? {};
          await supabase.from("product_understanding" as any).upsert({
            product_id: productId,
            raw_ai_response: parsed,
            detected_material: parsed.material ?? null,
            detected_finish: parsed.finish ?? null,
            detected_color: parsed.color ?? null,
            detected_style: parsed.style ?? null,
            detected_environment: parsed.environment ?? null,
            detected_installation_context: parsed.installation_context ?? null,
            detected_product_type: parsed.product_type ?? null,
            detected_keywords: parsed.keywords ?? [],
            detected_tags: parsed.tags ?? [],
            confidence_score: parsed.confidence ?? 0.7,
            provider: "lovable-gemini",
          }, { onConflict: "product_id" } as any);
          // link installation context if we can
          if (parsed.installation_context) {
            const { data: ic } = await supabase.from("installation_contexts")
              .select("id").eq("slug", parsed.installation_context).maybeSingle();
            if (ic?.id) await supabase.from("products").update({ installation_context_id: ic.id } as any).eq("id", productId);
          }
          Object.assign(result, parsed);
        } else if (jt === "description") {
          const text = await callLLM(
            `Write a 3-paragraph luxury showroom description for "${product.name}" (${product.brand ?? "premium"}, ${product.finish ?? ""} ${product.material ?? ""}). Emphasise craftsmanship, atmosphere, and how it elevates the space. Nigerian luxury clientele.`,
            "You are a luxury interiors copywriter. British English."
          );
          await supabase.from("products").update({ generated_description: text } as any).eq("id", productId);
          result.description = text.slice(0, 200);
        } else if (jt === "seo") {
          const seo = await tryJSON<any>(
            `Create SEO for ${product.name}. Include seo_title (<=60), seo_description (<=155), seo_keywords (string[]), og_title, og_description, canonical_slug (kebab).`,
            "You are an SEO engineer. Output strict JSON."
          ) ?? {};
          await supabase.from("products").update({
            seo_title: seo.seo_title ?? product.name,
            seo_description: seo.seo_description ?? product.short_description,
            seo_keywords: seo.seo_keywords ?? [],
          } as any).eq("id", productId);
          Object.assign(result, seo);
        } else if (jt === "faq_generation") {
          const faq = await tryJSON<any>(
            `Generate a JSON object { faq: [{q, a}, ...] } with 5 buyer FAQs for ${product.name}.`,
            "You are a product expert. Output strict JSON."
          ) ?? { faq: [] };
          const structured = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: (faq.faq ?? []).map((f: any) => ({
              "@type": "Question", name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          };
          await supabase.from("products").update({ faq: faq.faq ?? [], structured_data: structured } as any).eq("id", productId);
          result.count = (faq.faq ?? []).length;
        } else if (jt === "image_generation") {
          // MOCK provider — reuse the uploaded image as studio & installed.
          if (product.image_url) {
            await supabase.from("products").update({
              generated_studio_image: product.image_url,
              generated_installed_image: product.image_url,
            } as any).eq("id", productId);
            await supabase.from("product_assets" as any).insert([
              { product_id: productId, asset_type: "studio", asset_url: product.image_url, generated_by_ai: true, generation_version: (product.generation_version ?? 0) + 1, metadata: { provider: "mock" } },
              { product_id: productId, asset_type: "installed", asset_url: product.image_url, generated_by_ai: true, generation_version: (product.generation_version ?? 0) + 1, metadata: { provider: "mock" } },
            ]);
            result.mode = "mock";
          }
        } else if (jt === "search_index") {
          await supabase.rpc("rebuild_search_index" as any, { _product_id: productId } as any);
          result.rebuilt = true;
        }

        await setJob(job.id, {
          status: "success",
          completed_at: new Date().toISOString(),
          execution_time_ms: Date.now() - started,
          result,
          error_log: null,
        });
        done[jt] = true;
      } catch (e: any) {
        await setJob(job.id, {
          status: "failed",
          completed_at: new Date().toISOString(),
          execution_time_ms: Date.now() - started,
          error_log: { message: String(e?.message ?? e) },
          retry_count: (job.retry_count ?? 0) + 1,
        });
        throw e;
      }
    };

    // Execute in a resolution order that respects dependencies.
    const order: JobType[] = ["understanding", "description", "seo", "faq_generation", "image_generation", "search_index"];
    let anyFail = false;
    for (const t of order) {
      const j = jobList.find((x) => x.job_type === t && x.status !== "success");
      if (!j) continue;
      try { await runJob(j); } catch { anyFail = true; break; }
    }

    if (anyFail) {
      await supabase.from("products").update({
        processing_state: "error",
        error_log: { message: "One or more AI jobs failed. See ai_jobs.error_log." },
        last_processed_at: new Date().toISOString(),
      } as any).eq("id", productId);
      return { ok: false as const };
    }

    // Metadata sync — always rebuild search_index at the end + snapshot version.
    await supabase.rpc("rebuild_search_index" as any, { _product_id: productId } as any);
    const { data: fresh } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
    await supabase.from("generation_versions" as any).insert({
      product_id: productId,
      version: (fresh?.generation_version ?? 0) + 1,
      snapshot: fresh,
    });
    await supabase.from("products").update({
      processing_state: "completed",
      generation_version: (fresh?.generation_version ?? 0) + 1,
      last_processed_at: new Date().toISOString(),
      error_log: null,
      master_document: {
        name: fresh?.name, brand: fresh?.brand, finish: fresh?.finish,
        seo_title: fresh?.seo_title, seo_description: fresh?.seo_description,
        description: fresh?.generated_description, faq: fresh?.faq,
      },
    } as any).eq("id", productId);

    return { ok: true as const };
  });
