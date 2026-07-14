export interface AIProvider {
  name: string;
  callLLM(prompt: string, systemPrompt: string): Promise<string>;
  generateImage(prompt: string): Promise<Buffer>;
}

// 1. Google Gemini + Imagen Provider
export class GeminiProvider implements AIProvider {
  name = "gemini";

  async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is not defined");

    const keyOrigin = process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : "LOVABLE_API_KEY";
    const keyPrefix = key.slice(0, 6) + "..." + key.slice(-4);
    const keyLength = key.length;

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gemini-1.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini LLM Call Failed [Origin: ${keyOrigin}, Prefix: ${keyPrefix}, Len: ${keyLength}]: ${text.slice(0, 200)}`);
    }

    const json: any = await res.json();
    return json?.choices?.[0]?.message?.content ?? "";
  }

  async generateImage(prompt: string): Promise<Buffer> {
    const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is not defined");

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numberOfImages: 1,
        outputMimeType: "image/png",
        aspectRatio: "1:1",
        prompt: prompt,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Imagen Generation Failed: ${text.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const b64 = json?.generatedImages?.[0]?.image?.imageBytes;
    if (!b64) throw new Error("No image bytes returned from Google Imagen API");

    return Buffer.from(b64, "base64");
  }
}

// 2. Placeholder OpenAI Provider
export class OpenAIProvider implements AIProvider {
  name = "openai";
  async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    throw new Error("OpenAI Provider is not configured. Add OPENAI_API_KEY to activate.");
  }
  async generateImage(prompt: string): Promise<Buffer> {
    throw new Error("OpenAI DALL-E Provider is not configured.");
  }
}

// 3. Placeholder Anthropic Claude Provider
export class ClaudeProvider implements AIProvider {
  name = "claude";
  async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    throw new Error("Anthropic Claude Provider is not configured. Add ANTHROPIC_API_KEY to activate.");
  }
  async generateImage(prompt: string): Promise<Buffer> {
    throw new Error("Claude does not support native image generation.");
  }
}

// Registry Helper
export function getAIProvider(providerName?: string): AIProvider {
  const p = (providerName || "gemini").toLowerCase();
  if (p === "openai") return new OpenAIProvider();
  if (p === "claude") return new ClaudeProvider();
  return new GeminiProvider();
}
