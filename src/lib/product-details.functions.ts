import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAIProvider, AIProviderError } from "./ai-providers";

async function callLLM(provider: any, prompt: string, system: string): Promise<string> {
  return provider.callLLM(prompt, system);
}

async function tryJSON<T = any>(provider: any, prompt: string, system: string): Promise<T | null> {
  const raw = await callLLM(provider, prompt + "\n\nReturn ONLY compact JSON.", system);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

/**
 * ENGINE 1: PRODUCT DETAILS ENGINE (BUILD H — UNIVERSAL AI OPERATING SYSTEM V4.0)
 * 
 * Responsible for ALL text generation (Description, Canonical Short Description, SEO Title,
 * Meta Description, SEO Keywords, Canonical Slug, Open Graph, Twitter Card, FAQ, Structured Data,
 * Search Keywords, Filter Tokens, and Recommendations).
 * 
 * Performs 100% deterministic database routing of the returned JSON payload.
 * Zero image generation. Completely isolated from Engine 2 (Lifestyle Image Engine).
 */
export const runProductDetailsEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string }) => {
    if (!data?.productId) throw new Error("productId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { productId } = data;
    const started = Date.now();

    // 1. Retrieve Product Record
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (pErr || !product) {
      throw new Error(pErr?.message ?? "Product not found");
    }

    // 2. Resolve Taxonomy Names & Settings
    let contextName = "luxury showroom";
    let categoryName = "premium material";
    let typeName = "product";
    let subcategoryName = "";
    let familyName = "";

    const [contextRes, categoryRes, typeRes, subRes, famRes, settingsRes] = await Promise.all([
      product.installation_context_id ? supabase.from("installation_contexts").select("name").eq("id", product.installation_context_id).maybeSingle() : Promise.resolve({ data: null }),
      product.category_id ? supabase.from("categories").select("name").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
      product.type_id ? supabase.from("product_types").select("name").eq("id", product.type_id).maybeSingle() : Promise.resolve({ data: null }),
      product.subcategory_id ? supabase.from("subcategories").select("name").eq("id", product.subcategory_id).maybeSingle() : Promise.resolve({ data: null }),
      product.family_id ? supabase.from("family_groups").select("name, custom_ai_prompt_override").eq("id", product.family_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("app_settings").select("*").limit(1).maybeSingle()
    ]);

    if (contextRes.data?.name) contextName = contextRes.data.name;
    if (categoryRes.data?.name) categoryName = categoryRes.data.name;
    if (typeRes.data?.name) typeName = typeRes.data.name;
    if (subRes.data?.name) subcategoryName = subRes.data.name;
    if (famRes.data?.name) familyName = famRes.data.name;

    const familyOverride = famRes.data?.custom_ai_prompt_override ?? null;

    // 3. Retrieve Universal Product Details Prompt Template
    const { data: activeTemplate } = await supabase
      .from("ai_prompt_templates")
      .select("prompt_text")
      .eq("key", "product_details")
      .eq("is_active", true)
      .maybeSingle();

    const templateText = activeTemplate?.prompt_text || `You are a master product details and luxury copywriting engine for an architectural material catalog.
Analyze the product details:
Name: {product_name}
Brand: {brand}
Production Name: {production_name}
Finish: {finish}
Material: {material}
Color: {color}
Size: {size}
Type: {type}
Category: {category}
Subcategory: {subcategory}

Output strict JSON with:
- generated_description
- short_description
- seo_title
- meta_description
- seo_keywords (array)
- canonical_slug
- og_title
- og_description
- twitter_card
- faq (array)
- structured_data
- search_keywords (array)
- related_product_types (array)
- complementary_materials (array)`;

    // 4. Interpolate Product Metadata into Prompt
    let prompt = templateText
      .replace(/{product_name}/g, product.name || "")
      .replace(/{brand}/g, product.brand ?? "premium")
      .replace(/{production_name}/g, product.production_name ?? "")
      .replace(/{finish}/g, product.finish ?? product.finish_name ?? "premium finish")
      .replace(/{material}/g, product.material ?? "premium material")
      .replace(/{color}/g, product.color ?? "")
      .replace(/{size}/g, product.size ?? "")
      .replace(/{context}/g, contextName)
      .replace(/{type}/g, typeName)
      .replace(/{category}/g, categoryName)
      .replace(/{subcategory}/g, subcategoryName)
      .replace(/{family}/g, familyName);

    if (familyOverride) {
      prompt += `\n\nAdditional Directives: ${familyOverride}`;
    }

    // 5. Retrieve Active AI Provider & Call Text LLM
    const settings = settingsRes.data;
    const config = settings ? {
      activeProvider: settings.active_ai_provider || "openai",
      openaiLlmModel: settings.openai_llm_model || "gpt-4o-mini",
      openaiImageModel: settings.openai_image_model || "dall-e-3",
      openaiImageSize: settings.openai_image_size || "1024x1024",
      geminiLlmModel: settings.gemini_llm_model || "gemini-1.5-flash",
      geminiImageModel: settings.gemini_image_model || "imagen-3.0-generate-002"
    } : undefined;

    const provider = getAIProvider(config as any);

    const json = await tryJSON<any>(
      provider,
      prompt,
      "You are a master Product Details and SEO copy generation engine. Return ONLY valid compact JSON."
    );

    if (!json) {
      throw new Error("Text AI model returned an invalid or empty JSON payload.");
    }

    // 6. Deterministic Database Routing (Mapping returned JSON keys to DB columns)
    const productPatch: Record<string, any> = {};

    // Description & Canonical Lock
    const descriptionText = json.generated_description || json.description;
    if (descriptionText) {
      productPatch.generated_description = descriptionText;
      productPatch.short_description = descriptionText; // Canonical Description Lock
    }

    // SEO Fields
    if (!product.seo_title_manual && json.seo_title) {
      productPatch.seo_title = json.seo_title;
    }
    if (!product.seo_description_manual && (json.meta_description || json.seo_description)) {
      productPatch.seo_description = json.meta_description || json.seo_description;
    }
    if (!product.seo_keywords_manual && Array.isArray(json.seo_keywords)) {
      productPatch.seo_keywords = json.seo_keywords;
    }
    if (json.canonical_slug) productPatch.canonical_slug = json.canonical_slug;
    if (json.og_title) productPatch.og_title = json.og_title;
    if (json.og_description) productPatch.og_description = json.og_description;
    if (json.twitter_card) productPatch.twitter_card = json.twitter_card;
    if (json.faq) productPatch.faq = json.faq;
    if (json.structured_data) productPatch.structured_data = json.structured_data;

    // Search Keywords & Filter Tokens
    const rawSearchKeywords = [
      ...(Array.isArray(json.search_keywords) ? json.search_keywords : []),
      ...(Array.isArray(json.builder_terminology) ? json.builder_terminology : []),
      ...(Array.isArray(json.designer_terminology) ? json.designer_terminology : []),
      ...(Array.isArray(json.contractor_terminology) ? json.contractor_terminology : []),
      ...(Array.isArray(json.misspellings) ? json.misspellings : []),
      ...(Array.isArray(json.filter_tokens) ? json.filter_tokens : []),
    ].filter(Boolean);

    if (rawSearchKeywords.length > 0) {
      const searchArray = Array.from(new Set(rawSearchKeywords));
      productPatch.app_keywords = searchArray;
      productPatch.app_search_keywords = searchArray;
    }

    // Status & State
    productPatch.processing_state = "completed";
    productPatch.is_published = true;
    productPatch.last_processed_at = new Date().toISOString();
    productPatch.error_log = null;

    // Save Product Record Updates
    await supabase.from("products").update(productPatch as any).eq("id", productId);

    // Save Product Intelligence / Understanding Backup
    await supabase.from("product_understanding" as any).upsert({
      product_id: productId,
      raw_ai_response: json,
      detected_material: json.material ?? product.material ?? null,
      detected_finish: json.finish ?? product.finish ?? null,
      detected_color: json.color ?? product.color ?? null,
      detected_keywords: productPatch.app_keywords ?? [],
      confidence_score: 0.95,
      provider: provider.name,
    }, { onConflict: "product_id" } as any);

    // Compute Similar Product Recommendations
    const { data: similarProds } = await supabase
      .from("products")
      .select("id")
      .neq("id", productId)
      .is("deleted_at", null)
      .limit(6);

    if (similarProds?.length) {
      await supabase.from("products").update({
        similar_product_ids: similarProds.map((p: any) => p.id)
      } as any).eq("id", productId);
    }

    // Rebuild Search Index for Product
    await supabase.rpc("rebuild_search_index" as any, { _product_id: productId } as any);

    const executionMs = Date.now() - started;

    // 7. Log Execution Metrics in ai_jobs
    try {
      await supabase.from("ai_jobs" as any).insert({
        product_id: productId,
        job_type: "seo",
        status: "success",
        execution_time_ms: executionMs,
        result: {
          engine: "Engine 1 (Product Details Engine)",
          provider: provider.name,
          keys_routed: Object.keys(productPatch),
        },
        completed_at: new Date().toISOString(),
      });
    } catch {}

    return {
      ok: true,
      details: json,
      executionMs,
      providerName: provider.name,
    };
  });
