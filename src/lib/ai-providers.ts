export interface AIProviderConfig {
  activeProvider: string;
  openaiLlmModel: string;
  openaiImageModel: string;
  openaiImageSize: string;
  geminiLlmModel: string;
  geminiImageModel: string;
  geminiUseVertex?: boolean;
}

export interface AIProvider {
  name: string;
  callLLM(prompt: string, systemPrompt: string): Promise<string>;
  generateImage(prompt: string): Promise<Buffer>;
  generateLifestyleImage(prompt: string, originalImageBuffer?: Buffer): Promise<Buffer>;
}

export class AIProviderError extends Error {
  provider: string;
  model: string;
  url: string;
  requestHeaders: any;
  requestBody: any;
  responseBody: string;
  status: number;

  constructor(message: string, params: {
    provider: string;
    model: string;
    url: string;
    requestHeaders: any;
    requestBody: any;
    responseBody: string;
    status: number;
  }) {
    super(message);
    this.name = "AIProviderError";
    this.provider = params.provider;
    this.model = params.model;
    this.url = params.url;
    this.requestHeaders = params.requestHeaders;
    this.requestBody = params.requestBody;
    this.responseBody = params.responseBody;
    this.status = params.status;
  }
}

// 1. Google Gemini + Imagen Provider (Dual routing for AI Studio vs Vertex AI)
export class GeminiProvider implements AIProvider {
  name = "gemini";
  config?: AIProviderConfig;

  constructor(config?: AIProviderConfig) {
    this.config = config;
  }

  async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is not defined");

    const isVertex = this.config?.geminiUseVertex ?? key.startsWith("AQ");
    const model = this.config?.geminiLlmModel || process.env.GEMINI_LLM_MODEL || process.env.GEMINI_LLM_MODEL;
    
    let url = "";
    if (isVertex) {
      const projectId = process.env.GCP_PROJECT_ID || "de-enreach-gemini-api-key";
      const region = process.env.GCP_REGION || "us-central1";
      url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent?key=${key}`;
    } else {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    }

    const requestHeaders = { "Content-Type": "application/json" };
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      }
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });
    } catch (e: any) {
      throw new AIProviderError(`Network connection failed: ${e.message}`, {
        provider: this.name,
        model,
        url: url.replace(key, "HIDDEN_KEY"),
        requestHeaders,
        requestBody,
        responseBody: "",
        status: 0,
      });
    }

    const responseBody = await res.text().catch(() => "");

    if (!res.ok) {
      throw new AIProviderError(`Google Gemini REST Call Failed [isVertex: ${isVertex}]`, {
        provider: this.name,
        model,
        url: url.replace(key, "HIDDEN_KEY"),
        requestHeaders,
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    let json: any;
    try {
      json = JSON.parse(responseBody);
    } catch {
      throw new AIProviderError("Failed to parse response body as JSON", {
        provider: this.name,
        model,
        url: url.replace(key, "HIDDEN_KEY"),
        requestHeaders,
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    const textOut = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOut) {
      throw new AIProviderError("No text content returned from Gemini candidate payload", {
        provider: this.name,
        model,
        url: url.replace(key, "HIDDEN_KEY"),
        requestHeaders,
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    return textOut;
  }

  async generateLifestyleImage(prompt: string, originalImageBuffer?: Buffer): Promise<Buffer> {
    return this.generateImage(prompt);
  }

  async generateImage(prompt: string): Promise<Buffer> {
    const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is not defined");

    const isVertex = this.config?.geminiUseVertex ?? key.startsWith("AQ");
    const model = this.config?.geminiImageModel || process.env.GEMINI_IMAGE_MODEL || process.env.GEMINI_IMAGE_MODEL;

    let url = "";
    if (isVertex) {
      const projectId = process.env.GCP_PROJECT_ID || "de-enreach-gemini-api-key";
      const region = process.env.GCP_REGION || "us-central1";
      url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:predict?key=${key}`;
    } else {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${key}`;
    }

    const requestHeaders = { "Content-Type": "application/json" };
    const requestBody = isVertex 
      ? {
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1",
            outputMimeType: "image/png"
          }
        }
      : {
          numberOfImages: 1,
          outputMimeType: "image/png",
          aspectRatio: "1:1",
          prompt,
        };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });
    } catch (e: any) {
      throw new AIProviderError(`Network connection failed: ${e.message}`, {
        provider: this.name,
        model,
        url: url.replace(key, "HIDDEN_KEY"),
        requestHeaders,
        requestBody,
        responseBody: "",
        status: 0,
      });
    }

    const responseBody = await res.text().catch(() => "");

    if (!res.ok) {
      throw new AIProviderError(`Imagen generation REST call failed`, {
        provider: this.name,
        model,
        url: url.replace(key, "HIDDEN_KEY"),
        requestHeaders,
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    let json: any;
    try {
      json = JSON.parse(responseBody);
    } catch {
      throw new AIProviderError("Failed to parse image response body as JSON", {
        provider: this.name,
        model,
        url: url.replace(key, "HIDDEN_KEY"),
        requestHeaders,
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    const b64 = isVertex
      ? json?.predictions?.[0]?.bytesBase64Encoded
      : json?.generatedImages?.[0]?.image?.imageBytes;

    if (!b64) {
      throw new AIProviderError("No base64 image bytes found in the Imagen response payload", {
        provider: this.name,
        model,
        url: url.replace(key, "HIDDEN_KEY"),
        requestHeaders,
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    return Buffer.from(b64, "base64");
  }
}

// 2. OpenAI Provider (GPT-4o-mini + DALL-E-3)
export class OpenAIProvider implements AIProvider {
  name = "openai";
  config?: AIProviderConfig;

  constructor(config?: AIProviderConfig) {
    this.config = config;
  }

  async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY environment variable is not defined");

    const model = this.config?.openaiLlmModel || process.env.OPENAI_LLM_MODEL || process.env.OPENAI_LLM_MODEL;
    const url = "https://api.openai.com/v1/chat/completions";
    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    };
    const requestBody = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });
    } catch (e: any) {
      throw new AIProviderError(`Network connection failed: ${e.message}`, {
        provider: this.name,
        model,
        url,
        requestHeaders: { ...requestHeaders, Authorization: "Bearer HIDDEN_KEY" },
        requestBody,
        responseBody: "",
        status: 0,
      });
    }

    const responseBody = await res.text().catch(() => "");

    if (!res.ok) {
      throw new AIProviderError(`OpenAI API Chat Completion Call Failed`, {
        provider: this.name,
        model,
        url,
        requestHeaders: { ...requestHeaders, Authorization: "Bearer HIDDEN_KEY" },
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    let json: any;
    try {
      json = JSON.parse(responseBody);
    } catch {
      throw new AIProviderError("Failed to parse response body as JSON", {
        provider: this.name,
        model,
        url,
        requestHeaders: { ...requestHeaders, Authorization: "Bearer HIDDEN_KEY" },
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    return json?.choices?.[0]?.message?.content ?? "";
  }

  async generateLifestyleImage(prompt: string, originalImageBuffer?: Buffer): Promise<Buffer> {
    return this.generateImage(prompt);
  }

  async generateImage(prompt: string): Promise<Buffer> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY environment variable is not defined");

    const model = this.config?.openaiImageModel || process.env.OPENAI_IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL;
    const size = this.config?.openaiImageSize || process.env.OPENAI_IMAGE_SIZE || "1024x1024";
    const url = "https://api.openai.com/v1/images/generations";
    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    };
    const requestBody = {
      model,
      prompt,
      n: 1,
      size,
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });
    } catch (e: any) {
      throw new AIProviderError(`Network connection failed: ${e.message}`, {
        provider: this.name,
        model,
        url,
        requestHeaders: { ...requestHeaders, Authorization: "Bearer HIDDEN_KEY" },
        requestBody,
        responseBody: "",
        status: 0,
      });
    }

    const responseBody = await res.text().catch(() => "");

    if (!res.ok) {
      throw new AIProviderError(`OpenAI DALL-E Image Generation Failed`, {
        provider: this.name,
        model,
        url,
        requestHeaders: { ...requestHeaders, Authorization: "Bearer HIDDEN_KEY" },
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    let json: any;
    try {
      json = JSON.parse(responseBody);
    } catch {
      throw new AIProviderError("Failed to parse image response body as JSON", {
        provider: this.name,
        model,
        url,
        requestHeaders: { ...requestHeaders, Authorization: "Bearer HIDDEN_KEY" },
        requestBody,
        responseBody,
        status: res.status,
      });
    }

    const b64 = json?.data?.[0]?.b64_json;
    const imgUrl = json?.data?.[0]?.url;

    if (b64) {
      return Buffer.from(b64, "base64");
    }

    if (imgUrl) {
      try {
        const downloadRes = await fetch(imgUrl);
        if (!downloadRes.ok) {
          throw new Error(`Failed to download image from URL: ${downloadRes.statusText}`);
        }
        const ab = await downloadRes.arrayBuffer();
        return Buffer.from(ab);
      } catch (err: any) {
        throw new AIProviderError(`Failed to download generated image URL: ${err.message}`, {
          provider: this.name,
          model,
          url,
          requestHeaders: { ...requestHeaders, Authorization: "Bearer HIDDEN_KEY" },
          requestBody,
          responseBody,
          status: res.status,
        });
      }
    }

    throw new AIProviderError(`No image data (b64_json or url) returned from OpenAI image generation payload [model: ${model}]`, {
      provider: this.name,
      model,
      url,
      requestHeaders: { ...requestHeaders, Authorization: "Bearer HIDDEN_KEY" },
      requestBody,
      responseBody,
      status: res.status,
    });
  }
}

// 3. Placeholder Anthropic Claude Provider
export class ClaudeProvider implements AIProvider {
  async generateLifestyleImage(prompt: string, originalImageBuffer?: Buffer): Promise<Buffer> {
    return this.generateImage(prompt);
  }
  name = "claude";
  async callLLM(prompt: string, systemPrompt: string): Promise<string> {
    throw new Error("Anthropic Claude Provider is not configured. Add ANTHROPIC_API_KEY to activate.");
  }
  async generateImage(prompt: string): Promise<Buffer> {
    throw new Error("Claude does not support native image generation.");
  }
}

// Registry Helper
export function getAIProvider(config?: AIProviderConfig): AIProvider {
  const p = (config?.activeProvider || process.env.ACTIVE_AI_PROVIDER || "openai").toLowerCase();
  if (p === "gemini") return new GeminiProvider(config);
  if (p === "claude") return new ClaudeProvider();
  return new OpenAIProvider(config);
}
