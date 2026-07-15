import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAIConfigDetails, testLLMConnection, testImageConnection, updateAISettings } from "@/lib/ai-pipeline.functions";
import { toast } from "sonner";
import { Activity, Sparkles, AlertCircle, CheckCircle, RefreshCw, Server, Shield, Send, Image as ImageIcon, Check, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/diagnostics")({
  head: () => ({ meta: [{ title: "AI Diagnostics — Admin" }] }),
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  const getConfig = useServerFn(getAIConfigDetails);
  const saveConfig = useServerFn(updateAISettings);
  const runTextTest = useServerFn(testLLMConnection);
  const runImageTest = useServerFn(testImageConnection);

  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Selector form states
  const [activeProvider, setActiveProvider] = useState("openai");
  
  // OpenAI details
  const [openaiLlmModel, setOpenaiLlmModel] = useState("gpt-4o-mini");
  const [openaiImageModel, setOpenaiImageModel] = useState("dall-e-3");
  const [openaiImageSize, setOpenaiImageSize] = useState("1024x1024");
  
  // Gemini details
  const [geminiLlmModel, setGeminiLlmModel] = useState("gemini-1.5-flash");
  const [geminiImageModel, setGeminiImageModel] = useState("imagen-3.0-generate-002");
  const [geminiUseVertex, setGeminiUseVertex] = useState(false);

  // Text test states
  const [systemPrompt, setSystemPrompt] = useState("You are a luxury interiors brand assistant. Output British English.");
  const [userPrompt, setUserPrompt] = useState("Suggest 3 elegant synonyms for Calacatta Gold marble.");
  const [textLoading, setTextLoading] = useState(false);
  const [textResult, setTextResult] = useState<string | null>(null);
  const [textError, setTextError] = useState<any>(null);

  // Image test states
  const [imagePrompt, setImagePrompt] = useState("Close-up photo of luxury marble tiles laid on bathroom wall, high resolution, warm lighting");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [imageError, setImageError] = useState<any>(null);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await getConfig();
      setConfig(res);
      
      // Seed state
      setActiveProvider(res.activeProvider);
      setOpenaiLlmModel(res.openai.llmModel);
      setOpenaiImageModel(res.openai.imageModel);
      setOpenaiImageSize(res.openai.imageSize);
      setGeminiLlmModel(res.gemini.llmModel);
      setGeminiImageModel(res.gemini.imageModel);
      setGeminiUseVertex(res.gemini.geminiUseVertex ?? false);
    } catch (e: any) {
      toast.error(e.message || "Failed to load AI configuration");
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveConfig({
        data: {
          activeProvider,
          openaiLlmModel,
          openaiImageModel,
          openaiImageSize,
          geminiLlmModel,
          geminiImageModel,
          geminiUseVertex
        }
      });
      toast.success("AI Configuration settings saved successfully!");
      // Reload fresh configuration state
      const fresh = await getConfig();
      setConfig(fresh);
    } catch (e: any) {
      toast.error(e.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTextTest = async () => {
    setTextLoading(true);
    setTextResult(null);
    setTextError(null);
    try {
      const res = await runTextTest({ data: { prompt: userPrompt, systemPrompt } });
      if (res.ok) {
        setTextResult(res.text!);
        toast.success("Text generation successful!");
        // Refresh connection details to show success call status
        const fresh = await getConfig();
        setConfig(fresh);
      } else {
        setTextError(res);
        toast.error("Text generation connection failed");
        const fresh = await getConfig();
        setConfig(fresh);
      }
    } catch (e: any) {
      setTextError({ ok: false, error: e.message || String(e) });
      toast.error("Connection failed");
    } finally {
      setTextLoading(false);
    }
  };

  const handleImageTest = async () => {
    setImageLoading(true);
    setImageResult(null);
    setImageError(null);
    try {
      const res = await runImageTest({ data: { prompt: imagePrompt } });
      if (res.ok) {
        setImageResult(`data:image/png;base64,${res.b64}`);
        toast.success("Image generation successful!");
        const fresh = await getConfig();
        setConfig(fresh);
      } else {
        setImageError(res);
        toast.error("Image generation connection failed");
        const fresh = await getConfig();
        setConfig(fresh);
      }
    } catch (e: any) {
      setImageError({ ok: false, error: e.message || String(e) });
      toast.error("Connection failed");
    } finally {
      setImageLoading(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="container-app py-10 text-center text-sm text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
        Loading AI Provider settings…
      </div>
    );
  }

  // Calculate Provider Connection Status
  const getProviderStatus = () => {
    const isSuccess = config?.lastProviderCallSuccess;
    const hasError = !!config?.lastProviderError;
    
    // Check if key exists for active selection
    const activeKeyStatus = activeProvider === "openai" ? config?.openai?.apiKeyStatus : config?.gemini?.apiKeyStatus;
    if (!activeKeyStatus || activeKeyStatus === "MISSING") {
      return { label: "Configuration Error", color: "text-amber-500 border-amber-500/20 bg-amber-500/5", desc: "API key is missing in environment variables." };
    }
    
    if (isSuccess === true) {
      return { label: "Connected", color: "text-emerald-500 border-emerald-500/20 bg-emerald-500/5", desc: "Last executed provider call succeeded." };
    }
    if (hasError) {
      return { label: "Configuration Error", color: "text-red-500 border-red-500/20 bg-red-500/5", desc: config.lastProviderError };
    }
    return { label: "Connected", color: "text-emerald-500 border-emerald-500/20 bg-emerald-500/5", desc: "Ready to test connection." };
  };

  const statusInfo = getProviderStatus();

  return (
    <div className="container-app py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">AI Operating System Diagnostics</h1>
        <p className="text-sm text-muted-foreground">
          Forensic connection checks, dynamic routing selections, and model overrides.
        </p>
      </div>

      {/* 1. AI PROVIDER SELECTION SECTION */}
      <form onSubmit={handleSaveSettings} className="rounded-xl border border-border bg-card p-5 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Server className="h-4.5 w-4.5 text-primary" />
            <h2 className="font-display font-semibold">AI Provider Selection</h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusInfo.color}`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusInfo.label === "Connected" ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.label === "Connected" ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              </span>
              <span>{statusInfo.label}</span>
            </div>
            
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {savingSettings ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Configuration
            </button>
          </div>
        </div>

        {/* Dynamic selector inputs */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Active provider picker */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground">Active AI Provider Router</label>
            <select
              value={activeProvider}
              onChange={(e) => setActiveProvider(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary font-medium"
            >
              <option value="openai">OpenAI (Primary Production)</option>
              <option value="gemini">Google Gemini (Optional Secondary)</option>
              <option value="claude">Anthropic Claude (Future)</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Changing this updates prompt routing for all pipeline stages: Understanding, Description, SEO, FAQ, and Images.
            </p>
          </div>

          {/* OpenAI configuration overrides */}
          <div className={`rounded-lg border p-4 space-y-3 transition ${activeProvider === "openai" ? "border-primary bg-primary/5" : "border-border bg-card/40 opacity-70"}`}>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <Shield className="h-3.5 w-3.5" /> OpenAI Parameters
            </div>
            
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Text Generation Model</label>
                <input
                  type="text"
                  value={openaiLlmModel}
                  onChange={(e) => setOpenaiLlmModel(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Image Generation Model</label>
                <input
                  type="text"
                  value={openaiImageModel}
                  onChange={(e) => setOpenaiImageModel(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Image Resolution size</label>
                <select
                  value={openaiImageSize}
                  onChange={(e) => setOpenaiImageSize(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                >
                  <option value="1024x1024">1024x1024 (dall-e-3 standard)</option>
                  <option value="512x512">512x512 (dall-e-2 standard)</option>
                  <option value="256x256">256x256 (dall-e-2 small)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Gemini configuration overrides */}
          <div className={`rounded-lg border p-4 space-y-3 transition ${activeProvider === "gemini" ? "border-primary bg-primary/5" : "border-border bg-card/40 opacity-70"}`}>
            <div className="flex items-center gap-1 text-xs font-bold text-blue-600">
              <Shield className="h-3.5 w-3.5" /> Google Gemini Parameters
            </div>
            
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Gemini API Endpoint Type</label>
                <select
                  value={geminiUseVertex ? "vertex" : "studio"}
                  onChange={(e) => setGeminiUseVertex(e.target.value === "vertex")}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary font-medium"
                >
                  <option value="studio">Google AI Studio (Developer API)</option>
                  <option value="vertex">Google Cloud Vertex AI (Enterprise API)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Text Generation Model</label>
                <input
                  type="text"
                  value={geminiLlmModel}
                  onChange={(e) => setGeminiLlmModel(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Image Generation Model</label>
                <input
                  type="text"
                  value={geminiImageModel}
                  onChange={(e) => setGeminiImageModel(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                />
              </div>
              <div className="text-[10px] text-muted-foreground leading-snug">
                Supports developer key endpoint (AI Studio) or enterprise service account endpoint (Vertex AI).
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic log reporting panel */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1.5 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <strong>Active API Key Present:</strong>{" "}
              <code className="text-muted-foreground font-mono">
                {activeProvider === "openai" ? config?.openai?.apiKeyStatus : config?.gemini?.apiKeyStatus}
              </code>
            </div>
            <div>
              <strong>Text Model Selected:</strong>{" "}
              <code className="text-muted-foreground font-mono">
                {activeProvider === "openai" ? openaiLlmModel : geminiLlmModel}
              </code>
            </div>
            <div>
              <strong>Image Model Selected:</strong>{" "}
              <code className="text-muted-foreground font-mono">
                {activeProvider === "openai" ? openaiImageModel : geminiImageModel}
              </code>
            </div>
            <div>
              <strong>GCP project ID / region:</strong>{" "}
              <code className="text-muted-foreground font-mono">
                {config?.gemini?.isVertex ? `${config?.gemini?.projectId} (${config?.gemini?.region})` : "N/A (AI Studio mode)"}
              </code>
            </div>
          </div>

          <div className="border-t border-border mt-3 pt-3 text-[11px] text-muted-foreground break-words space-y-1">
            <div><strong>Active Status Message:</strong> {statusInfo.desc}</div>
            {config?.lastProviderError && (
              <div className="rounded border border-red-500/10 bg-red-500/5 p-2 font-mono text-[10px] text-red-600 mt-2 whitespace-pre-wrap max-h-32 overflow-auto">
                {config.lastProviderError}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* 2. Diagnostics Execution Area */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* TEXT COMPLETIONS DIAGNOSTIC CARD */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Test Text Generation (LLM)</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-muted-foreground">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-[11px] min-h-[50px] outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium text-muted-foreground">User Test Prompt</label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-[11px] min-h-[60px] outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleTextTest}
              disabled={textLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/95 disabled:opacity-50"
            >
              {textLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {textLoading ? "Generating text…" : "Run Text Generation Test"}
            </button>
          </div>

          {textResult && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                <CheckCircle className="h-3.5 w-3.5" /> Output Succeeded
              </div>
              <p className="text-xs whitespace-pre-wrap mt-2">{textResult}</p>
            </div>
          )}

          {textError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-destructive font-bold">
                <AlertCircle className="h-3.5 w-3.5" /> Text Test Connection Failed
              </div>
              <div className="text-[11px] text-destructive break-all whitespace-pre-wrap font-mono font-semibold">
                {textError.error}
              </div>
              {textError.details && (
                <div className="space-y-1 text-[10px] text-muted-foreground border-t border-destructive/10 pt-2">
                  <div><strong>Target Endpoint URL:</strong> <code>{textError.details.url}</code></div>
                  <div><strong>HTTP Status Code:</strong> <code>{textError.details.status}</code></div>
                  {textError.details.responseBody && (
                    <details className="cursor-pointer mt-1">
                      <summary className="font-semibold text-destructive hover:underline">Show Response Payload</summary>
                      <pre className="mt-1 max-h-32 overflow-auto bg-background p-2 rounded text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                        {textError.details.responseBody}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* IMAGE GENERATION DIAGNOSTIC CARD */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Test Image Generation</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-muted-foreground">Image Prompt Description</label>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-[11px] min-h-[125px] outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleImageTest}
              disabled={imageLoading}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/95 disabled:opacity-50"
            >
              {imageLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {imageLoading ? "Generating image (approx 10s)…" : "Run Image Generation Test"}
            </button>
          </div>

          {imageResult && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-primary font-bold mb-2">
                <CheckCircle className="h-3.5 w-3.5" /> Output Succeeded
              </div>
              <img src={imageResult} alt="Generated Test Result" className="max-w-[250px] mx-auto rounded border border-border aspect-square object-cover" />
            </div>
          )}

          {imageError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-destructive font-bold">
                <AlertCircle className="h-3.5 w-3.5" /> Image Test Connection Failed
              </div>
              <div className="text-[11px] text-destructive break-all whitespace-pre-wrap font-mono font-semibold">
                {imageError.error}
              </div>
              {imageError.details && (
                <div className="space-y-1 text-[10px] text-muted-foreground border-t border-destructive/10 pt-2">
                  <div><strong>Target Endpoint URL:</strong> <code>{imageError.details.url}</code></div>
                  <div><strong>HTTP Status Code:</strong> <code>{imageError.details.status}</code></div>
                  {imageError.details.responseBody && (
                    <details className="cursor-pointer mt-1">
                      <summary className="font-semibold text-destructive hover:underline">Show Response Payload</summary>
                      <pre className="mt-1 max-h-32 overflow-auto bg-background p-2 rounded text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                        {imageError.details.responseBody}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
