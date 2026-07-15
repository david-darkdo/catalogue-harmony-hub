import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAIProvider, AIProviderError } from "./ai-providers";

type JobType =
  | "understanding"
  | "search_index"
  | "seo"
  | "description"
  | "image_generation"
  | "faq_generation";

async function callLLM(prompt: string, system: string): Promise<string> {
  const provider = getAIProvider();
  return provider.callLLM(prompt, system);
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
async function resolvePromptTemplate(supabase: any, product: any) {
  let contextId = product.installation_context_id;
  
  if (!contextId && product.type_id) {
    const { data: pt } = await supabase
      .from("product_types")
      .select("installation_context_id")
      .eq("id", product.type_id)
      .maybeSingle();
    if (pt?.installation_context_id) {
      contextId = pt.installation_context_id;
    }
  }
  
  // Query all active templates from database
  const { data: activeTemplates } = await supabase
    .from("ai_prompt_templates")
    .select("*")
    .eq("is_active", true);
  
  let template: any = null;
  
  if (activeTemplates && activeTemplates.length > 0) {
    // Scoring routing engine
    const scored = activeTemplates.map((t: any) => {
      let score = 0;
      let disqualified = false;
      
      // Brand Override Check
      if (t.brand_override) {
        if (product.brand && t.brand_override.toLowerCase() === product.brand.toLowerCase()) {
          score += 100;
        } else {
          disqualified = true; // mismatch disqualifies
        }
      }
      
      // Subcategory Match
      if (t.subcategory_id) {
        if (product.subcategory_id && t.subcategory_id === product.subcategory_id) {
          score += 50;
        } else {
          disqualified = true;
        }
      }
      
      // Category Match
      if (t.category_id) {
        if (product.category_id && t.category_id === product.category_id) {
          score += 30;
        } else {
          disqualified = true;
        }
      }
      
      // Product Type Match
      if (t.product_type_id) {
        if (product.type_id && t.product_type_id === product.type_id) {
          score += 15;
        } else {
          disqualified = true;
        }
      }
      
      // Context Match
      if (t.installation_context_id) {
        if (contextId && t.installation_context_id === contextId) {
          score += 10;
        } else {
          disqualified = true;
        }
      }
      
      return { template: t, score, disqualified };
    });
    
    // Filter and Sort by Score (desc), Priority (desc), Version (desc)
    const valid = scored
      .filter((s: any) => !s.disqualified)
      .sort((a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        const prioB = b.template.priority || 0;
        const prioA = a.template.priority || 0;
        if (prioB !== prioA) return prioB - prioA;
        const verB = b.template.version || 1;
        const verA = a.template.version || 1;
        return verB - verA;
      });
      
    if (valid.length > 0) {
      template = valid[0].template;
    }
  }
  
  if (!template) {
    const { data } = await supabase
      .from("ai_prompt_templates")
      .select("*")
      .limit(1)
      .maybeSingle();
    template = data;
  }
  
  return {
    understanding_prompt: template?.understanding_prompt ?? 'Analyse this product for an Abuja luxury interiors showroom.\nProduct: {product_name}\nBrand: {brand}\nFinish: {finish}\nSize: {size}\nColor: {color}\nMaterial: {material}\n\nRespond with keys: material, finish, color, style, environment, installation_context (one of luxury_bathroom, luxury_kitchen, luxury_living_room, luxury_bedroom, luxury_hotel, luxury_office, luxury_exterior, luxury_showroom, luxury_commercial), product_type, keywords (string[]), tags (string[]), confidence (0-1).',
    description_prompt: template?.description_prompt ?? 'Write a luxury showroom description for {product_name}, a {category} in {finish} {material}. Emphasize craftsmanship, provenance, and how it elevates a {context}. 3 short paragraphs.',
    seo_prompt: template?.seo_prompt ?? 'Create SEO for {product_name}. Include seo_title (<=60), seo_description (<=155), seo_keywords (string[]), og_title, og_description, canonical_slug (kebab).',
    faq_prompt: template?.faq_prompt ?? 'Generate a JSON object { faq: [{q, a}, ...] } with 5 buyer FAQs for {product_name}.',
    studio_prompt: template?.studio_prompt ?? 'Professional studio product photograph of {product_name} ({material}, {finish}). Isolated on soft neutral background, museum lighting, ultra-sharp, preserve exact color/finish/material/orientation. 4k.',
    installed_prompt: template?.installed_prompt ?? 'Photorealistic {context} scene featuring {product_name} installed in-situ. Preserve product identity exactly. Cinematic architectural photography, natural light, luxury Nigerian interior styling.',
    installation_context_id: template?.installation_context_id ?? contextId ?? null
  };
}

async function interpolatePrompt(supabase: any, templateText: string, product: any, contextId?: string | null) {
  let contextName = "luxury showroom";
  let categoryName = "premium material";
  let typeName = "product";

  const [contextRes, categoryRes, typeRes, settingsRes] = await Promise.all([
    contextId ? supabase.from("installation_contexts").select("name").eq("id", contextId).maybeSingle() : Promise.resolve({ data: null }),
    product.category_id ? supabase.from("categories").select("name").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
    product.type_id ? supabase.from("product_types").select("name").eq("id", product.type_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("app_settings").select("*").limit(1).maybeSingle()
  ]);

  if (contextRes.data?.name) contextName = contextRes.data.name;
  if (categoryRes.data?.name) categoryName = categoryRes.data.name;
  if (typeRes.data?.name) typeName = typeRes.data.name;

  const settings = settingsRes.data;

  // Handle detected attributes fallback from product_understanding
  let material = product.material;
  let finish = product.finish ?? product.finish_name;
  let color = product.color;
  let size = product.size;

  if (!material || !finish || !color) {
    const { data: pu } = await supabase.from("product_understanding").select("*").eq("product_id", product.id).maybeSingle();
    if (pu) {
      material = material || pu.detected_material || "";
      finish = finish || pu.detected_finish || "";
      color = color || pu.detected_color || "";
    }
  }

  return templateText
    .replace(/{product_name}/g, product.name || "")
    .replace(/{brand}/g, product.brand ?? "premium")
    .replace(/{finish}/g, finish ?? "premium finish")
    .replace(/{material}/g, material ?? "")
    .replace(/{color}/g, color ?? "")
    .replace(/{size}/g, size ?? "")
    .replace(/{context}/g, contextName)
    .replace(/{category}/g, categoryName)
    .replace(/{type}/g, typeName)
    .replace(/{product_type}/g, typeName)
    .replace(/{company_name}/g, "Enreach Concepts")
    .replace(/{company_email}/g, settings?.company_email ?? "")
    .replace(/{company_address}/g, settings?.company_address ?? "")
    .replace(/{company_phone}/g, settings?.sales_whatsapp ?? settings?.support_whatsapp ?? "");
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

    // Validate active provider environment config
    const activeProvider = (process.env.ACTIVE_AI_PROVIDER || "openai").toLowerCase();
    if (activeProvider === "openai") {
      if (!process.env.OPENAI_API_KEY) {
        const errMsg = "Configuration Error: OpenAI is the active provider, but OPENAI_API_KEY environment variable is missing.";
        await supabase.from("products").update({
          processing_state: "error",
          error_log: { message: errMsg }
        } as any).eq("id", productId);
        return { ok: false, error: errMsg };
      }
    } else if (activeProvider === "gemini") {
      if (!(process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY)) {
        const errMsg = "Configuration Error: Gemini is the active provider, but GEMINI_API_KEY environment variable is missing.";
        await supabase.from("products").update({
          processing_state: "error",
          error_log: { message: errMsg }
        } as any).eq("id", productId);
        return { ok: false, error: errMsg };
      }
    } else if (activeProvider === "claude") {
      if (!process.env.ANTHROPIC_API_KEY) {
        const errMsg = "Configuration Error: Claude is the active provider, but ANTHROPIC_API_KEY environment variable is missing.";
        await supabase.from("products").update({
          processing_state: "error",
          error_log: { message: errMsg }
        } as any).eq("id", productId);
        return { ok: false, error: errMsg };
      }
    } else {
      const errMsg = `Configuration Error: Unsupported active AI provider '${activeProvider}'.`;
      await supabase.from("products").update({
        processing_state: "error",
        error_log: { message: errMsg }
      } as any).eq("id", productId);
      return { ok: false, error: errMsg };
    }

    await supabase.from("products")
      .update({ processing_state: "processing", error_log: null, last_processed_at: new Date().toISOString() } as any)
      .eq("id", productId);

    const { data: jobs } = await supabase
      .from("ai_jobs" as any).select("*").eq("product_id", productId)
      .order("created_at", { ascending: true });
    const jobList = (jobs ?? []) as any[];
    if (jobList.length === 0) throw new Error("No jobs queued. Enqueue pipeline first.");

    // Resolve templates and overrides
    const resolvedTemplates = await resolvePromptTemplate(supabase, product);
    let familyOverride: string | null = null;
    if (product.family_id) {
      const { data: fg } = await supabase
        .from("family_groups")
        .select("custom_ai_prompt_override")
        .eq("id", product.family_id)
        .maybeSingle();
      if (fg?.custom_ai_prompt_override) {
        familyOverride = fg.custom_ai_prompt_override;
      }
    }

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
      let lastCompiledPrompt = "";
      try {
        const jt = job.job_type as JobType;
        const result: Record<string, unknown> = {};

        if (jt === "understanding") {
          const rawPrompt = resolvedTemplates.understanding_prompt;
          let prompt = await interpolatePrompt(supabase, rawPrompt, product, resolvedTemplates.installation_context_id);
          if (familyOverride) {
            prompt += `\n\nAdditional Directives: ${familyOverride}`;
          }
          lastCompiledPrompt = prompt;
          const parsed = await tryJSON<any>(
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
          const rawPrompt = resolvedTemplates.description_prompt;
          let prompt = await interpolatePrompt(supabase, rawPrompt, product, resolvedTemplates.installation_context_id);
          if (familyOverride) {
            prompt += `\n\nAdditional Directives: ${familyOverride}`;
          }
          lastCompiledPrompt = prompt;
          const text = await callLLM(
            prompt,
            "You are a luxury interiors copywriter. British English."
          );
          await supabase.from("products").update({ generated_description: text } as any).eq("id", productId);
          result.description = text.slice(0, 200);
        } else if (jt === "seo") {
          const rawPrompt = resolvedTemplates.seo_prompt;
          let prompt = await interpolatePrompt(supabase, rawPrompt, product, resolvedTemplates.installation_context_id);
          if (familyOverride) {
            prompt += `\n\nAdditional Directives: ${familyOverride}`;
          }
          lastCompiledPrompt = prompt;
          const seo = await tryJSON<any>(
            prompt,
            "You are an SEO engineer. Output strict JSON."
          ) ?? {};
          await supabase.from("products").update({
            seo_title: seo.seo_title ?? product.name,
            seo_description: seo.seo_description ?? product.short_description,
            seo_keywords: seo.seo_keywords ?? [],
          } as any).eq("id", productId);
          Object.assign(result, seo);
        } else if (jt === "faq_generation") {
          const rawPrompt = resolvedTemplates.faq_prompt;
          let prompt = await interpolatePrompt(supabase, rawPrompt, product, resolvedTemplates.installation_context_id);
          if (familyOverride) {
            prompt += `\n\nAdditional Directives: ${familyOverride}`;
          }
          lastCompiledPrompt = prompt;
          const faq = await tryJSON<any>(
            prompt,
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
          // Real AI image generation via direct Google Imagen 3.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: pu } = await supabase.from("product_understanding" as any)
            .select("*").eq("product_id", productId).maybeSingle();
          const und: any = pu ?? {};
          const ctxSlug = und.detected_installation_context ?? "luxury_showroom";
          const ctxLabel = String(ctxSlug).replace(/^luxury_/, "").replace(/_/g, " ");

          const rawStudio = resolvedTemplates.studio_prompt;
          const rawInstalled = resolvedTemplates.installed_prompt;
          let studioPrompt = await interpolatePrompt(supabase, rawStudio, product, resolvedTemplates.installation_context_id);
          let installedPrompt = await interpolatePrompt(supabase, rawInstalled, product, resolvedTemplates.installation_context_id);

          if (familyOverride) {
            studioPrompt += `\n\nAdditional Directives: ${familyOverride}`;
            installedPrompt += `\n\nAdditional Directives: ${familyOverride}`;
          }
          lastCompiledPrompt = `Studio: ${studioPrompt}\n\nInstalled: ${installedPrompt}`;

          const provider = getAIProvider();
          const nextVersion = (product.generation_version ?? 0) + 1;
          const uploadOne = async (label: "studio" | "installed", bytes: Buffer) => {
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
              body: formData,
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error(`Cloudinary server-side upload failed: ${text}`);
            }

            const data = await res.json();
            return data.secure_url;
          };

          const [studioBuf, installedBuf] = await Promise.all([
            provider.generateImage(studioPrompt),
            provider.generateImage(installedPrompt),
          ]);
          const [studioUrl, installedUrl] = await Promise.all([
            uploadOne("studio", studioBuf),
            uploadOne("installed", installedBuf),
          ]);

          // Demote any previously primary generated assets.
          await supabaseAdmin.from("product_assets")
            .update({ is_primary: false })
            .eq("product_id", productId)
            .eq("generated_by_ai", true);

          await supabaseAdmin.from("product_assets").insert([
            {
              product_id: productId, asset_type: "studio", asset_url: studioUrl,
              generated_by_ai: true, is_primary: true,
              generation_version: nextVersion,
              metadata: { provider: provider.name, model: provider.name === "openai" ? "dall-e-3" : "imagen-3.0-generate-002", prompt: studioPrompt },
            },
            {
              product_id: productId, asset_type: "installed", asset_url: installedUrl,
              generated_by_ai: true, is_primary: false,
              generation_version: nextVersion,
              metadata: { provider: provider.name, model: provider.name === "openai" ? "dall-e-3" : "imagen-3.0-generate-002", prompt: installedPrompt },
            },
          ]);

          await supabase.from("products").update({
            generated_studio_image: studioUrl,
            generated_installed_image: installedUrl,
          } as any).eq("id", productId);

          result.mode = "imagen";
          result.studio = studioUrl;
          result.installed = installedUrl;
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
        const errorLog: any = {
          message: String(e?.message ?? e),
          stack: String(e?.stack ?? ""),
          provider: e?.provider || process.env.ACTIVE_AI_PROVIDER || "gemini",
          model: e?.model || ((process.env.ACTIVE_AI_PROVIDER === "openai") ? "gpt-4o-mini" : "gemini-1.5-flash"),
          prompt: lastCompiledPrompt,
          cloudinary_url: product.image_url,
        };

        if (e instanceof AIProviderError || e?.name === "AIProviderError") {
          errorLog.endpoint_url = e.url;
          errorLog.request_headers = e.requestHeaders;
          errorLog.request_body = e.requestBody;
          errorLog.response_body = e.responseBody;
          errorLog.status = e.status;
        }

        await setJob(job.id, {
          status: "failed",
          completed_at: new Date().toISOString(),
          execution_time_ms: Date.now() - started,
          error_log: errorLog,
          retry_count: (job.retry_count ?? 0) + 1,
        });
        throw e;
      }
    };

    // Execute in a resolution order that respects dependencies.
    const order: JobType[] = ["understanding", "description", "seo", "faq_generation", "image_generation", "search_index"];
    let anyCriticalFail = false;
    for (const t of order) {
      const j = jobList.find((x) => x.job_type === t && x.status !== "success");
      if (!j) continue;
      try {
        await runJob(j);
      } catch (err) {
        if (t === "image_generation") {
          console.warn("Non-blocking pipeline step 'image_generation' failed. Proceeding with remaining steps.");
        } else {
          anyCriticalFail = true;
          break;
        }
      }
    }

    if (anyCriticalFail) {
      await supabase.from("products").update({
        processing_state: "error",
        error_log: { message: "One or more critical AI jobs failed. See ai_jobs.error_log." },
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

export const testLLMConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt: string; systemPrompt: string }) => data)
  .handler(async ({ data }) => {
    try {
      const provider = getAIProvider();
      const result = await provider.callLLM(data.prompt, data.systemPrompt);
      return { ok: true, text: result };
    } catch (e: any) {
      return {
        ok: false,
        error: e.message || String(e),
        details: e instanceof AIProviderError || e?.name === "AIProviderError" ? {
          url: e.url,
          requestHeaders: e.requestHeaders,
          requestBody: e.requestBody,
          responseBody: e.responseBody,
          status: e.status
        } : null
      };
    }
  });

export const testImageConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt: string }) => data)
  .handler(async ({ data }) => {
    try {
      const provider = getAIProvider();
      const buf = await provider.generateImage(data.prompt);
      const b64 = buf.toString("base64");
      return { ok: true, b64 };
    } catch (e: any) {
      return {
        ok: false,
        error: e.message || String(e),
        details: e instanceof AIProviderError || e?.name === "AIProviderError" ? {
          url: e.url,
          requestHeaders: e.requestHeaders,
          requestBody: e.requestBody,
          responseBody: e.responseBody,
          status: e.status
        } : null
      };
    }
  });

export const getAIConfigDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const activeProvider = (process.env.ACTIVE_AI_PROVIDER || "openai").toLowerCase();
    
    const geminiKey = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY || "";
    const openAiKey = process.env.OPENAI_API_KEY || "";
    const anthropicKey = process.env.ANTHROPIC_API_KEY || "";

    const maskKey = (key: string) => {
      if (!key) return "MISSING";
      return `${key.slice(0, 6)}...${key.slice(-4)} (Length: ${key.length})`;
    };

    return {
      activeProvider,
      openai: {
        apiKeyStatus: maskKey(openAiKey),
        llmModel: process.env.OPENAI_LLM_MODEL || "gpt-4o-mini",
        imageModel: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
        imageSize: process.env.OPENAI_IMAGE_SIZE || "1024x1024",
      },
      gemini: {
        apiKeyStatus: maskKey(geminiKey),
        llmModel: process.env.GEMINI_LLM_MODEL || "gemini-1.5-flash",
        imageModel: process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-002",
        isVertex: geminiKey.startsWith("AQ"),
        projectId: process.env.GCP_PROJECT_ID || "de-enreach-gemini-api-key",
        region: process.env.GCP_REGION || "us-central1",
      },
      claude: {
        apiKeyStatus: maskKey(anthropicKey),
        llmModel: process.env.ANTHROPIC_LLM_MODEL || "claude-3-opus",
      }
    };
  });
