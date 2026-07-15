export interface AIProvider {
  name: string;
  callLLM(prompt: string, systemPrompt: string): Promise<string>;
  generateImage(prompt: string): Promise<Buffer>;
}

// 1. Google Gemini + Imagen Provider (Native REST API Endpoint)
export class GeminiProvider implements AIProvider {
  name = "gemini";

  async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is not defined");

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini Native API LLM Call Failed: ${text.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const textOut = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOut) throw new Error("No text content returned from Gemini API");
    return textOut;
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

// 2. OpenAI Provider (GPT-4o-mini + DALL-E-3)
export class OpenAIProvider implements AIProvider {
  name = "openai";

  async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY environment variable is not defined");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI API LLM Call Failed: ${text.slice(0, 200)}`);
    }

    const json: any = await res.json();
    return json?.choices?.[0]?.message?.content ?? "";
  }

  async generateImage(prompt: string): Promise<Buffer> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY environment variable is not defined");

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI DALL-E Generation Failed: ${text.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned from OpenAI DALL-E API");

    return Buffer.from(b64, "base64");
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
  const p = (providerName || process.env.ACTIVE_AI_PROVIDER || "gemini").toLowerCase();
  if (p === "openai") return new OpenAIProvider();
  if (p === "claude") return new ClaudeProvider();
  return new GeminiProvider();
}
