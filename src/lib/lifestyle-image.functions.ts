import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAIProvider, AIProviderError } from "./ai-providers";

/**
 * Standalone Independent Lifestyle Image Generation Module (BUILD G)
 * 
 * Generates an installed/lifestyle product image from the original manufacturer product image
 * and the Universal Lifestyle Prompt template configured in the AI Control Center.
 * 
 * Strictly isolated: Does NOT invoke Product Understanding, SEO, Search, Recommendation, or Quality Validation.
 * Updates ONLY products.generated_installed_image and inserts a record into product_assets.
 */
export const generateStandaloneLifestyleImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string }) => {
    if (!data?.productId) throw new Error("productId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { productId } = data;
    const started = Date.now();

    // 1. Retrieve Original Product Record
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, brand, finish, material, color, size, image_url, generation_version, family_id, image_mode")
      .eq("id", productId)
      .maybeSingle();

    if (pErr || !product) {
      throw new Error(pErr?.message ?? "Product not found");
    }

    // Guard 1: Require Original Product Image
    if (!product.image_url || typeof product.image_url !== "string" || product.image_url.trim() === "") {
      throw new Error("Original product image is required before generating an installed image.");
    }

    // 2. Retrieve Universal Lifestyle Prompt Template from AI Control Center
    const { data: template } = await supabase
      .from("ai_prompt_templates")
      .select("prompt_text, is_active")
      .eq("key", "lifestyle")
      .eq("is_active", true)
      .maybeSingle();

    const rawTemplateText = template?.prompt_text;
    // Guard 2: Require Active Lifestyle Template
    if (!rawTemplateText || rawTemplateText.trim() === "") {
      throw new Error("Lifestyle template is missing. Please configure it in the AI Control Center.");
    }

    // Check optional Family Group override
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

    // 3. Compile Lifestyle Prompt (interpolating basic product metadata)
    let prompt = rawTemplateText
      .replace(/{product_name}/g, product.name || "")
      .replace(/{brand}/g, product.brand ?? "premium")
      .replace(/{finish}/g, product.finish ?? "premium finish")
      .replace(/{material}/g, product.material ?? "premium material")
      .replace(/{color}/g, product.color ?? "")
      .replace(/{size}/g, product.size ?? "");

    if (familyOverride) {
      prompt += `\n\nAdditional Directives: ${familyOverride}`;
    }

    // 4. Retrieve Active Provider Configuration
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

    // 5. Fetch Original Manufacturer Product Image Buffer
    let origBuffer: Buffer | undefined;
    try {
      const imgRes = await fetch(product.image_url);
      if (imgRes.ok) {
        const arrBuf = await imgRes.arrayBuffer();
        origBuffer = Buffer.from(arrBuf);
      }
    } catch (fetchErr) {
      console.warn("Could not fetch raw original image buffer, proceeding with prompt generation:", fetchErr);
    }

    // 6. Call Image Generation API
    let installedBuf: Buffer;
    try {
      if (typeof provider.generateLifestyleImage === "function") {
        installedBuf = await provider.generateLifestyleImage(prompt, origBuffer);
      } else {
        installedBuf = await provider.generateImage(prompt);
      }
    } catch (genErr: any) {
      // Log failure in ai_jobs lightweight execution log
      try {
        await supabase.from("ai_jobs" as any).insert({
          product_id: productId,
          job_type: "lifestyle",
          status: "failed",
          execution_time_ms: Date.now() - started,
          error_log: {
            message: genErr.message || String(genErr),
            provider: provider.name,
            prompt,
          }
        });
      } catch {}
      throw new Error(`Lifestyle image generation failed: ${genErr.message || String(genErr)}`);
    }

    // 7. Upload Generated Image to Cloudinary
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Missing Cloudinary environment configuration on server.");
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
    formData.append("file", `data:image/png;base64,${installedBuf.toString("base64")}`);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("folder", folder);
    formData.append("signature", signature);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Cloudinary server-side upload failed: ${text}`);
    }

    const uploadData = await uploadRes.json();
    const installedUrl = uploadData.secure_url;

    // 8. Single-Column Database Update & Asset Insertion
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nextVersion = (product.generation_version ?? 0) + 1;

    // Demote existing primary AI assets
    await supabaseAdmin.from("product_assets")
      .update({ is_primary: false })
      .eq("product_id", productId)
      .eq("generated_by_ai", true);

    // Insert new installed product asset
    await supabaseAdmin.from("product_assets").insert([
      {
        product_id: productId,
        asset_type: "installed",
        asset_url: installedUrl,
        generated_by_ai: true,
        is_primary: false,
        generation_version: nextVersion,
        metadata: { provider: provider.name, prompt, standalone_module: true },
      },
    ]);

    // Update ONLY generated_installed_image column on products table
    await supabase.from("products").update({
      generated_installed_image: installedUrl,
      generation_version: nextVersion,
      last_processed_at: new Date().toISOString(),
    } as any).eq("id", productId);

    const executionMs = Date.now() - started;

    // 9. Lightweight Execution Log
    try {
      await supabase.from("ai_jobs" as any).insert({
        product_id: productId,
        job_type: "lifestyle",
        status: "success",
        execution_time_ms: executionMs,
        result: {
          installed_image_url: installedUrl,
          provider: provider.name,
          standalone_module: true,
        },
        completed_at: new Date().toISOString(),
      });
    } catch {}

    return {
      ok: true,
      imageUrl: installedUrl,
      executionMs,
      providerName: provider.name,
    };
  });
