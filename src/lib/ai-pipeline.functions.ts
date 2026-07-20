import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAIProvider, AIProviderError } from "./ai-providers";

type JobType =
  | "understanding"
  | "seo"
  | "lifestyle"
  | "search"
  | "recommendation"
  | "quality";

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
 * Runs every pending/failed AI job for a product in dependency order,
 * writing outputs to products / product_understanding / product_assets
 * and finally rebuilding search_index + flipping processing_state.
 */
async function resolvePromptTemplate(supabase: any, product: any) {
  const { data: activeTemplates } = await supabase
    .from("ai_prompt_templates")
    .select("key, prompt_text")
    .eq("is_active", true);

  const templatesMap = (activeTemplates || []).reduce((acc: Record<string, string>, t: any) => {
    if (t.key) acc[t.key] = t.prompt_text || "";
    return acc;
  }, {});

  return {
    understanding_prompt: templatesMap.understanding || 'You are a luxury product understanding engine. Analyze the uploaded product image and details.\nProduct Details:\nName: {product_name}\nBrand: {brand}\nFinish: {finish}\nMaterial: {material}\nColor: {color}\nSize: {size}\nAdditional Directives: {family_override}\n\nOutput a strict JSON object with:\n- product_type\n- installation_area\n- indoor_outdoor\n- surface_types (array)\n- material\n- finish\n- texture\n- color\n- pattern\n- shape\n- style\n- luxury_level\n- installation_context\n- customer_intent\n- architectural_use\n- related_categories (array)\n- search_keywords (array)\n- visual_characteristics (array)\n- design_language\n- confidence (0-1)',
    seo_prompt: templatesMap.seo || 'Consuming the following Product Intelligence:\n{product_intelligence}\n\nProduct Details:\nName: {product_name}\nBrand: {brand}\n\nGenerate a strict JSON object containing:\n- generated_description\n- seo_title\n- meta_description\n- seo_keywords (array)\n- canonical_slug\n- og_title\n- og_description\n- twitter_card\n- faq (array of 5 objects containing: { q, a })\n- structured_data (JSON-LD FAQPage metadata schema)',
    lifestyle_prompt: templatesMap.lifestyle || 'You are a prompt engineer for an image generation pipeline. Create a prompt to place the product naturally inside a beautiful, realistic installation scene (e.g. luxury home interior or premium commercial environment) matching {material} {product_type} with a {finish} finish, color {color}, style {style}, setting {installation_context}. Maintain the original design, material, texture, finish, color, and geometric proportions of the product exactly.',
    search_prompt: templatesMap.search || 'Analyze the Product Intelligence:\n{product_intelligence}\n\nGenerate search terms and variations as JSON: search_aliases (array), builder_terminology (array), designer_terminology (array), contractor_terminology (array), common_misspellings (array), name_variations (array), material_terminology (array), regional_variations (array)',
    recommendation_prompt: templatesMap.recommendation || 'Analyze the Product Intelligence:\n{product_intelligence}\n\nGenerate recommendation parameters as JSON: related_product_types (array), matching_collection_styles (array), cross_sell_categories (array), complementary_materials (array), upsell_triggers (array)',
    quality_prompt: templatesMap.quality || 'Verify if the generated lifestyle image matches the original product image. Product Intelligence: {product_intelligence}\nOriginal Product Image: {original_image_url}\nGenerated Lifestyle Image: {generated_image_url}\n\nDetermine if the AI redesigned, replaced, or changed the product. Output JSON: passes_validation (boolean), confidence_score (0-100), product_preserved (boolean), failure_reasons (array)'
  };
}

async function interpolatePrompt(supabase: any, templateText: string, product: any) {
  let contextName = "luxury showroom";
  let categoryName = "premium material";
  let typeName = "product";

  const [contextRes, categoryRes, typeRes, settingsRes] = await Promise.all([
    product.installation_context_id ? supabase.from("installation_contexts").select("name").eq("id", product.installation_context_id).maybeSingle() : Promise.resolve({ data: null }),
    product.category_id ? supabase.from("categories").select("name").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
    product.type_id ? supabase.from("product_types").select("name").eq("id", product.type_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("app_settings").select("*").limit(1).maybeSingle()
  ]);

  if (contextRes.data?.name) contextName = contextRes.data.name;
  if (categoryRes.data?.name) categoryName = categoryRes.data.name;
  if (typeRes.data?.name) typeName = typeRes.data.name;

  const companyName = settingsRes.data?.company_name || "Enreach Showroom";

  return templateText
    .replace(/{product_name}/g, product.name || "")
    .replace(/{brand}/g, product.brand || "Enreach")
    .replace(/{finish}/g, product.finish || "")
    .replace(/{material}/g, product.material || "")
    .replace(/{color}/g, product.color || "")
    .replace(/{size}/g, product.size || "")
    .replace(/{category_name}/g, categoryName)
    .replace(/{product_type}/g, typeName)
    .replace(/{installation_context}/g, contextName)
    .replace(/{company_name}/g, companyName)
    .replace(/{product_code}/g, product.code || "")
    .replace(/{original_image_url}/g, product.image_url || "")
    .replace(/{generated_image_url}/g, product.generated_installed_image || "");
}

export const runProductPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; familyOverride?: string }) => {
    if (!data?.productId) throw new Error("productId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { productId, familyOverride } = data;

    // Load AI Settings
    const { data: settings } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
    const config = settings ? {
      activeProvider: settings.active_ai_provider || "openai",
      openaiLlmModel: settings.openai_llm_model || "gpt-4o-mini",
      openaiImageModel: settings.openai_image_model || "dall-e-3",
      openaiImageSize: settings.openai_image_size || "1024x1024",
      geminiLlmModel: settings.gemini_llm_model || "gemini-1.5-flash",
      geminiImageModel: settings.gemini_image_model || "imagen-3.0-generate-002",
      geminiUseVertex: settings.gemini_use_vertex ?? false
    } : undefined;

    const provider = getAIProvider(config as any);

    // Fetch product
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (pErr || !product) {
      throw new Error(pErr?.message ?? `Product ${productId} not found`);
    }

    // Hash check guard (avoid re-running identical input)
    const crypto = await import("crypto");
    const inputPayload = JSON.stringify({
      id: product.id,
      name: product.name,
      image_url: product.image_url,
      brand: product.brand,
      material: product.material,
      finish: product.finish,
      color: product.color,
      size: product.size,
      familyOverride,
      provider: provider.name
    });
    const currentHash = crypto.createHash("sha256").update(inputPayload).digest("hex");

    if (product.generation_hash === currentHash && product.processing_state === "completed") {
      return { ok: true, skipped: true, message: "No input changes detected (hash matches completed run)" };
    }

    // Set processing_state to processing
    await supabase
      .from("products")
      .update({
        processing_state: "processing",
        is_ai_processing: true,
        generation_hash: currentHash
      } as any)
      .eq("id", productId);

    const resolvedTemplates = await resolvePromptTemplate(supabase, product);

    // Define jobs order
    const jobs: { job_type: JobType }[] = [
      { job_type: "understanding" },
      { job_type: "seo" },
      { job_type: "lifestyle" },
      { job_type: "search" },
      { job_type: "recommendation" },
      { job_type: "quality" }
    ];

    let lastCompiledPrompt = "";

    try {
      for (const job of jobs) {
        try {
          const jt = job.job_type as JobType;
          const result: Record<string, unknown> = {};

          // Fetch current product understanding if any
          const { data: puData } = await supabase.from("product_understanding").select("*").eq("product_id", productId).maybeSingle();

          if (jt === "understanding") {
            const rawPrompt = resolvedTemplates.understanding_prompt;
            let prompt = await interpolatePrompt(supabase, rawPrompt, product);
            if (familyOverride) {
              prompt += `\n\nAdditional Directives: ${familyOverride}`;
            }
            lastCompiledPrompt = prompt;
            const parsed = await tryJSON<any>(
              provider,
              prompt,
              "You are a product intelligence engine. Output strict JSON."
            ) ?? {};
            await supabase.from("product_understanding" as any).upsert({
              product_id: productId,
              raw_ai_response: parsed,
              detected_material: parsed.material ?? null,
              detected_finish: parsed.finish ?? null,
              detected_color: parsed.color ?? null,
              detected_style: parsed.style ?? null,
              detected_environment: parsed.installation_context ?? null,
              detected_installation_context: parsed.installation_context ?? null,
              detected_product_type: parsed.product_type ?? null,
              detected_tags: parsed.tags ?? [],
              detected_keywords: parsed.search_keywords ?? [],
              detected_installation_area: parsed.installation_area ?? null,
              detected_indoor_outdoor: parsed.indoor_outdoor ?? null,
              detected_surface_types: parsed.surface_types ?? [],
              detected_texture: parsed.texture ?? null,
              detected_pattern: parsed.pattern ?? null,
              detected_shape: parsed.shape ?? null,
              detected_luxury_level: parsed.luxury_level ?? null,
              detected_customer_intent: parsed.customer_intent ?? null,
              detected_architectural_use: parsed.architectural_use ?? null,
              detected_related_categories: parsed.related_categories ?? [],
              detected_search_keywords: parsed.search_keywords ?? [],
              detected_visual_characteristics: parsed.visual_characteristics ?? [],
              detected_design_language: parsed.design_language ?? null,
              confidence_score: parsed.confidence ?? 0.7,
              provider: provider.name,
            }, { onConflict: "product_id" } as any);

            // Persist Product Intelligence Object as permanent AI memory on the product
            await supabase.from("products").update({
              ai_understanding: parsed,
            } as any).eq("id", productId);

            if (parsed.installation_context) {
              const { data: ic } = await supabase.from("installation_contexts")
                .select("id").eq("slug", parsed.installation_context).maybeSingle();
              if (ic?.id) await supabase.from("products").update({ installation_context_id: ic.id } as any).eq("id", productId);
            }
            Object.assign(result, parsed);
          } else if (jt === "seo") {
            const rawPrompt = resolvedTemplates.seo_prompt;
            let prompt = await interpolatePrompt(supabase, rawPrompt, product);
            // Use permanent Product Intelligence Object from product record (ai_understanding), fall back to product_understanding
            const seoIntel = (product as any).ai_understanding || puData?.raw_ai_response || puData || {};
            prompt = prompt.replace(/{product_intelligence}/g, JSON.stringify(seoIntel, null, 2));
            if (familyOverride) {
              prompt += `\n\nAdditional Directives: ${familyOverride}`;
            }
            lastCompiledPrompt = prompt;
            const seo = await tryJSON<any>(
              provider,
              prompt,
              "You are a copywriting and SEO engine. Output strict JSON."
            ) ?? {};

            const seoPayload: any = {};
            if (seo.generated_description) {
              seoPayload.generated_description = seo.generated_description;
              seoPayload.short_description = seo.generated_description; // Canonical Description Lock
            }
            if (!product.seo_title_manual) {
              seoPayload.seo_title = seo.seo_title ?? product.name;
            }
            if (!product.seo_description_manual) {
              seoPayload.seo_description = seo.seo_description ?? seo.generated_description;
            }
            if (!product.seo_keywords_manual) {
              seoPayload.seo_keywords = seo.seo_keywords ?? [];
            }
            if (seo.canonical_slug) {
              seoPayload.canonical_slug = seo.canonical_slug;
            }
            if (seo.faq) {
              seoPayload.faq = seo.faq;
            }
            if (seo.structured_data) {
              seoPayload.structured_data = seo.structured_data;
            }

            if (Object.keys(seoPayload).length > 0) {
              await supabase.from("products").update(seoPayload).eq("id", productId);
            }
            Object.assign(result, seo);
          } else if (jt === "lifestyle") {
            if (product.image_mode === "manual") {
              result.mode = "manual";
              result.skipped = true;
              result.message = "Skipped AI image generation because image mode is set to manual.";
            } else {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const rawLifestyle = resolvedTemplates.lifestyle_prompt;
              let prompt = await interpolatePrompt(supabase, rawLifestyle, product);
              
              // Resolve product intelligence from product record (set during understanding stage) or fall back to product_understanding
              const intel = (product as any).ai_understanding || puData?.raw_ai_response || puData || {};

              // Interpolate all Product Intelligence Object placeholders
              prompt = prompt
                .replace(/{product_type}/g, intel.product_type || puData?.detected_product_type || "product")
                .replace(/{installation_area}/g, intel.installation_area || puData?.detected_installation_area || "")
                .replace(/{indoor_outdoor}/g, intel.indoor_outdoor || puData?.detected_indoor_outdoor || "")
                .replace(/{material}/g, intel.material || puData?.detected_material || product.material || "premium")
                .replace(/{finish}/g, intel.finish || puData?.detected_finish || product.finish || "premium finish")
                .replace(/{texture}/g, intel.texture || puData?.detected_texture || "")
                .replace(/{color}/g, intel.color || puData?.detected_color || product.color || "")
                .replace(/{pattern}/g, intel.pattern || puData?.detected_pattern || "")
                .replace(/{shape}/g, intel.shape || puData?.detected_shape || "")
                .replace(/{style}/g, intel.style || puData?.detected_style || "modern")
                .replace(/{luxury_level}/g, intel.luxury_level || puData?.detected_luxury_level || "Premium")
                .replace(/{installation_context}/g, intel.installation_context || puData?.detected_installation_context || "luxury showroom")
                .replace(/{customer_intent}/g, intel.customer_intent || puData?.detected_customer_intent || "")
                .replace(/{architectural_use}/g, intel.architectural_use || puData?.detected_architectural_use || "")
                .replace(/{visual_characteristics}/g, Array.isArray(intel.visual_characteristics) ? intel.visual_characteristics.join(", ") : (puData?.detected_visual_characteristics || []).join(", ") || "elegant")
                .replace(/{design_language}/g, intel.design_language || puData?.detected_design_language || "");

              // Also replace {product_intelligence} for templates that use the full summary placeholder
              const details = `Material: ${intel.material || puData?.detected_material || 'premium'}, Finish: ${intel.finish || puData?.detected_finish || 'premium finish'}, Color: ${intel.color || puData?.detected_color || 'custom'}, Type: ${intel.product_type || puData?.detected_product_type || 'product'}, Style: ${intel.style || puData?.detected_style || 'modern'}, Setting: ${intel.installation_context || puData?.detected_installation_context || 'luxury showroom'}, Visuals: ${(Array.isArray(intel.visual_characteristics) ? intel.visual_characteristics : (puData?.detected_visual_characteristics || [])).join(', ') || 'elegant'}`;
              prompt = prompt.replace(/{product_intelligence}/g, details);
              if (familyOverride) {
                prompt += `\n\nAdditional Directives: ${familyOverride}`;
              }
              lastCompiledPrompt = prompt;

              const nextVersion = (product.generation_version ?? 0) + 1;
              const uploadOne = async (bytes: Buffer) => {
                const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
                const apiKey = process.env.CLOUDINARY_API_KEY;
                const apiSecret = process.env.CLOUDINARY_API_SECRET;

                if (!cloudName || !apiKey || !apiSecret) {
                  throw new Error("Missing Cloudinary environment configuration on server");
                }

                const crypto = await import("crypto");
                const timestamp = Math.round(Date.now() / 1000);
                const folder = `products/${productId}`;

                const paramString = `folder=${folder}&timestamp=${timestamp}`;
                const signature = crypto
                  .createHash("sha1")
                  .update(paramString + apiSecret)
                  .digest("hex");

                const formData = new URLSearchParams();
                formData.append("file", `data:image/png;base64,${bytes.toString("base64")}`);
                formData.append("api_key", apiKey);
                formData.append("timestamp", String(timestamp));
                formData.append("folder", folder);
                formData.append("signature", signature);

                const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                  method: "POST",
                  body: formData
                });

                if (!res.ok) {
                  const errText = await res.text();
                  throw new Error(`Cloudinary upload failed: ${errText}`);
                }

                const json = await res.json();
                return json.secure_url as string;
              };

              let publicUrl = "";
              if (product.image_url) {
                const imgRes = await fetch(product.image_url);
                if (imgRes.ok) {
                  const arrBuf = await imgRes.arrayBuffer();
                  const origBuffer = Buffer.from(arrBuf);
                  const genBuffer = await provider.generateLifestyleImage(prompt, origBuffer);
                  publicUrl = await uploadOne(genBuffer);
                } else {
                  throw new Error(`Failed to fetch original product image: ${product.image_url}`);
                }
              } else {
                throw new Error("No product original image_url found to generate lifestyle render from.");
              }

              await supabase.from("products").update({
                generated_installed_image: publicUrl,
                generation_version: nextVersion,
                last_processed_at: new Date().toISOString()
              } as any).eq("id", productId);

              await supabase.from("product_assets" as any).insert({
                product_id: productId,
                asset_type: "lifestyle_render",
                url: publicUrl,
                prompt_used: prompt,
                version: nextVersion,
                is_active: true
              } as any);

              result.generated_url = publicUrl;
              result.version = nextVersion;
            }
          } else if (jt === "search") {
            const rawPrompt = resolvedTemplates.search_prompt;
            let prompt = await interpolatePrompt(supabase, rawPrompt, product);
            prompt = prompt.replace(/{product_intelligence}/g, JSON.stringify(puData || {}, null, 2));
            if (familyOverride) {
              prompt += `\n\nAdditional Directives: ${familyOverride}`;
            }
            lastCompiledPrompt = prompt;
            const searchObj = await tryJSON<any>(
              provider,
              prompt,
              "You are a search intelligence engine. Output strict JSON."
            ) ?? {};

            const keywords: string[] = Array.from(new Set([
              ...(searchObj.search_aliases || []),
              ...(searchObj.builder_terminology || []),
              ...(searchObj.designer_terminology || []),
              ...(searchObj.contractor_terminology || []),
              ...(searchObj.common_misspellings || []),
              ...(searchObj.name_variations || []),
              ...(searchObj.material_terminology || []),
              ...(searchObj.regional_variations || [])
            ]));

            await supabase.from("products").update({
              app_keywords: keywords,
              app_search_keywords: keywords
            } as any).eq("id", productId);
            Object.assign(result, searchObj);
          } else if (jt === "recommendation") {
            const rawPrompt = resolvedTemplates.recommendation_prompt;
            let prompt = await interpolatePrompt(supabase, rawPrompt, product);
            prompt = prompt.replace(/{product_intelligence}/g, JSON.stringify(puData || {}, null, 2));
            if (familyOverride) {
              prompt += `\n\nAdditional Directives: ${familyOverride}`;
            }
            lastCompiledPrompt = prompt;
            const recObj = await tryJSON<any>(
              provider,
              prompt,
              "You are a product recommendation engine. Output strict JSON."
            ) ?? {};

            if (recObj.related_product_types?.length) {
              const { data: matchingProds } = await supabase
                .from("products")
                .select("id")
                .neq("id", productId)
                .is("deleted_at", null)
                .limit(6);

              if (matchingProds?.length) {
                await supabase.from("products").update({
                  similar_product_ids: matchingProds.map((p: any) => p.id)
                } as any).eq("id", productId);
              }
            }
            Object.assign(result, recObj);
          } else if (jt === "quality") {
            const rawPrompt = resolvedTemplates.quality_prompt;
            let prompt = await interpolatePrompt(supabase, rawPrompt, product);
            prompt = prompt.replace(/{product_intelligence}/g, JSON.stringify(puData || {}, null, 2));
            if (familyOverride) {
              prompt += `\n\nAdditional Directives: ${familyOverride}`;
            }
            lastCompiledPrompt = prompt;
            const qualityObj = await tryJSON<any>(
              provider,
              prompt,
              "You are a quality control engine. Output strict JSON."
            ) ?? {};

            Object.assign(result, qualityObj);
          }
        } catch (jobErr: any) {
          throw new Error(`Job ${job.job_type} failed: ${jobErr?.message ?? jobErr}`);
        }
      }

      // Rebuild search index
      await supabase.rpc("rebuild_search_index" as any, { _product_id: productId } as any);

      // Final success status update
      await supabase.from("products").update({
        processing_state: "completed",
        is_ai_processing: false,
        error_log: null,
        last_processed_at: new Date().toISOString()
      } as any).eq("id", productId);

      return { ok: true, productId };
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      await supabase.from("products").update({
        processing_state: "error",
        is_ai_processing: false,
        error_log: `Pipeline failed: ${errMsg}\nLast compiled prompt:\n${lastCompiledPrompt}`,
        last_processed_at: new Date().toISOString()
      } as any).eq("id", productId);

      return { ok: false, error: errMsg, lastCompiledPrompt };
    }
  });

export const getAIConfigDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: settings } = await supabase
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const config = settings ? {
      activeProvider: settings.active_ai_provider || "openai",
      openaiLlmModel: settings.openai_llm_model || "gpt-4o-mini",
      openaiImageModel: settings.openai_image_model || "dall-e-3",
      openaiImageSize: settings.openai_image_size || "1024x1024",
      geminiLlmModel: settings.gemini_llm_model || "gemini-1.5-flash",
      geminiImageModel: settings.gemini_image_model || "imagen-3.0-generate-002",
      geminiUseVertex: settings.gemini_use_vertex ?? false
    } : undefined;

    const provider = getAIProvider(config as any);
    const details = provider.getDiagnostics();

    return {
      activeProvider: details.name,
      llmModel: details.llmModel,
      imageModel: details.imageModel,
      imageSize: details.imageSize,
      useVertex: details.useVertex,
      hasOpenAIKey: !!(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
      hasGeminiKey: !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
      hasCloudinaryKey: !!(process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY),
      settingsRecord: settings || null
    };
  });

export const testLLMConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: settings } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
    const config = settings ? {
      activeProvider: settings.active_ai_provider || "openai",
      openaiLlmModel: settings.openai_llm_model || "gpt-4o-mini",
      openaiImageModel: settings.openai_image_model || "dall-e-3",
      openaiImageSize: settings.openai_image_size || "1024x1024",
      geminiLlmModel: settings.gemini_llm_model || "gemini-1.5-flash",
      geminiImageModel: settings.gemini_image_model || "imagen-3.0-generate-002",
      geminiUseVertex: settings.gemini_use_vertex ?? false
    } : undefined;

    const provider = getAIProvider(config as any);
    const started = Date.now();
    try {
      const resp = await callLLM(provider, "Respond with JSON: {\"status\": \"ok\", \"message\": \"LLM connection active\"}", "You are a health check assistant.");
      const ms = Date.now() - started;
      return { ok: true, provider: provider.name, response: resp, latencyMs: ms };
    } catch (e: any) {
      return { ok: false, provider: provider.name, error: e?.message ?? String(e) };
    }
  });

export const testImageConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: settings } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
    const config = settings ? {
      activeProvider: settings.active_ai_provider || "openai",
      openaiLlmModel: settings.openai_llm_model || "gpt-4o-mini",
      openaiImageModel: settings.openai_image_model || "dall-e-3",
      openaiImageSize: settings.openai_image_size || "1024x1024",
      geminiLlmModel: settings.gemini_llm_model || "gemini-1.5-flash",
      geminiImageModel: settings.gemini_image_model || "imagen-3.0-generate-002",
      geminiUseVertex: settings.gemini_use_vertex ?? false
    } : undefined;

    const provider = getAIProvider(config as any);
    const started = Date.now();
    try {
      // 1x1 white PNG sample
      const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORAGCYII=";
      const dummyBuffer = Buffer.from(dummyBase64, "base64");
      const imgBuffer = await provider.generateLifestyleImage("A clean modern luxury interior background", dummyBuffer);
      const ms = Date.now() - started;
      return { ok: true, provider: provider.name, imageBytes: imgBuffer.length, latencyMs: ms };
    } catch (e: any) {
      return { ok: false, provider: provider.name, error: e?.message ?? String(e) };
    }
  });

export const updateAISettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    activeProvider?: "openai" | "gemini";
    openaiLlmModel?: string;
    openaiImageModel?: string;
    openaiImageSize?: string;
    geminiLlmModel?: string;
    geminiImageModel?: string;
    geminiUseVertex?: boolean;
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const updatePayload: Record<string, any> = {};
    if (data.activeProvider) updatePayload.active_ai_provider = data.activeProvider;
    if (data.openaiLlmModel) updatePayload.openai_llm_model = data.openaiLlmModel;
    if (data.openaiImageModel) updatePayload.openai_image_model = data.openaiImageModel;
    if (data.openaiImageSize) updatePayload.openai_image_size = data.openaiImageSize;
    if (data.geminiLlmModel) updatePayload.gemini_llm_model = data.geminiLlmModel;
    if (data.geminiImageModel) updatePayload.gemini_image_model = data.geminiImageModel;
    if (typeof data.geminiUseVertex === "boolean") updatePayload.gemini_use_vertex = data.geminiUseVertex;

    const { data: existing } = await supabase.from("app_settings").select("id").limit(1).maybeSingle();
    if (existing?.id) {
      await supabase.from("app_settings").update(updatePayload).eq("id", existing.id);
    } else {
      await supabase.from("app_settings").insert(updatePayload);
    }
    return { ok: true };
  });

export const getDiscoveryHealthDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Check count of published products
    const { count: totalPublished } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .is("deleted_at", null);

    // Check count of indexed products
    const { count: totalIndexed } = await supabase
      .from("search_index" as any)
      .select("id", { count: "exact", head: true });

    // Check sample product SEO readiness
    const { data: sampleProduct } = await supabase
      .from("products")
      .select("slug, seo_title, seo_description, image_url, generated_installed_image")
      .eq("is_published", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    return {
      totalPublished: totalPublished || 0,
      totalIndexed: totalIndexed || 0,
      sampleProduct: sampleProduct || null,
    };
  });

export const rebuildAllSearchIndexes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .is("deleted_at", null);

    if (products) {
      for (const p of products) {
        await supabase.rpc("rebuild_search_index" as any, { _product_id: p.id } as any);
      }
    }
    return { ok: true, count: products?.length || 0 };
  });

/**
 * Sandbox stage runner — executes one pipeline stage against a real product
 * without persisting any results to the database.
 * Used by the AI Control Center sandbox tab.
 */
export const runSandboxStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; stageKey: string }) => {
    if (!data?.productId) throw new Error("productId required");
    if (!data?.stageKey) throw new Error("stageKey required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { productId, stageKey } = data;
    const started = Date.now();

    const { data: product, error: pErr } = await supabase
      .from("products").select("*").eq("id", productId).maybeSingle();
    if (pErr || !product) throw new Error(pErr?.message ?? "Product not found");

    const { data: settings } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
    const config = settings ? {
      activeProvider: settings.active_ai_provider || "openai",
      openaiLlmModel: settings.openai_llm_model || "gpt-4o-mini",
      openaiImageModel: settings.openai_image_model || "dall-e-3",
      openaiImageSize: settings.openai_image_size || "1024x1024",
      geminiLlmModel: settings.gemini_llm_model || "gemini-1.5-flash",
      geminiImageModel: settings.gemini_image_model || "imagen-3.0-generate-002",
      geminiUseVertex: settings.gemini_use_vertex ?? false
    } : undefined;

    const provider = getAIProvider(config as any);
    const resolvedTemplates = await resolvePromptTemplate(supabase, product);

    const { data: puData } = await supabase
      .from("product_understanding").select("*").eq("product_id", productId).maybeSingle();

    const templateMap: Record<string, string> = {
      understanding: resolvedTemplates.understanding_prompt,
      seo: resolvedTemplates.seo_prompt,
      lifestyle: resolvedTemplates.lifestyle_prompt,
      search: resolvedTemplates.search_prompt,
      recommendation: resolvedTemplates.recommendation_prompt,
      quality: resolvedTemplates.quality_prompt,
    };

    const rawPrompt = templateMap[stageKey];
    if (!rawPrompt) throw new Error(`Unknown stage key: ${stageKey}`);

    let prompt = await interpolatePrompt(supabase, rawPrompt, product);
    const intel = (product as any).ai_understanding || puData?.raw_ai_response || puData || {};

    if (stageKey !== "understanding") {
      // Interpolate all Product Intelligence Object placeholders
      prompt = prompt
        .replace(/{product_type}/g, intel.product_type || puData?.detected_product_type || "product")
        .replace(/{installation_area}/g, intel.installation_area || puData?.detected_installation_area || "")
        .replace(/{indoor_outdoor}/g, intel.indoor_outdoor || puData?.detected_indoor_outdoor || "")
        .replace(/{material}/g, intel.material || puData?.detected_material || product.material || "")
        .replace(/{finish}/g, intel.finish || puData?.detected_finish || product.finish || "")
        .replace(/{texture}/g, intel.texture || puData?.detected_texture || "")
        .replace(/{color}/g, intel.color || puData?.detected_color || product.color || "")
        .replace(/{pattern}/g, intel.pattern || puData?.detected_pattern || "")
        .replace(/{shape}/g, intel.shape || puData?.detected_shape || "")
        .replace(/{style}/g, intel.style || puData?.detected_style || "modern")
        .replace(/{luxury_level}/g, intel.luxury_level || puData?.detected_luxury_level || "Premium")
        .replace(/{installation_context}/g, intel.installation_context || puData?.detected_installation_context || "luxury showroom")
        .replace(/{customer_intent}/g, intel.customer_intent || puData?.detected_customer_intent || "")
        .replace(/{architectural_use}/g, intel.architectural_use || puData?.detected_architectural_use || "")
        .replace(/{visual_characteristics}/g, Array.isArray(intel.visual_characteristics) ? intel.visual_characteristics.join(", ") : (puData?.detected_visual_characteristics || []).join(", ") || "")
        .replace(/{design_language}/g, intel.design_language || puData?.detected_design_language || "");

      prompt = prompt.replace(/{product_intelligence}/g, JSON.stringify(intel, null, 2));
      prompt = prompt
        .replace(/{original_image_url}/g, product.image_url || "")
        .replace(/{generated_image_url}/g, (product as any).generated_installed_image || "");
    }

    // For lifestyle stage: sandbox shows compiled prompt only — no image generation to avoid costs
    const isImageStage = stageKey === "lifestyle";
    let response = "";
    if (!isImageStage) {
      response = await callLLM(
        provider,
        prompt + "\n\nReturn ONLY compact JSON.",
        "You are an AI Operating System engine. Output strict JSON."
      );
    }

    const executionMs = Date.now() - started;

    return {
      ok: true,
      compiledPrompt: prompt,
      aiResponse: response,
      executionMs,
      stageKey,
      providerName: provider.name,
      isImageStage,
      productName: product.name,
      imageUrl: product.image_url ?? null,
    };
  });
