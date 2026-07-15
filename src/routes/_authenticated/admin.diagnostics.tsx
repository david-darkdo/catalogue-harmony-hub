import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAIConfigDetails, testLLMConnection, testImageConnection } from "@/lib/ai-pipeline.functions";
import { toast } from "sonner";
import { Activity, Sparkles, AlertCircle, CheckCircle, RefreshCw, Server, Shield, Send, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/diagnostics")({
  head: () => ({ meta: [{ title: "AI Diagnostics — Admin" }] }),
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  const getConfig = useServerFn(getAIConfigDetails);
  const runTextTest = useServerFn(testLLMConnection);
  const runImageTest = useServerFn(testImageConnection);

  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

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
    } catch (e: any) {
      toast.error(e.message || "Failed to load AI configuration");
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleTextTest = async () => {
    setTextLoading(true);
    setTextResult(null);
    setTextError(null);
    try {
      const res = await runTextTest({ data: { prompt: userPrompt, systemPrompt } });
      if (res.ok) {
        setTextResult(res.text!);
        toast.success("Text generation successful!");
      } else {
        setTextError(res);
        toast.error("Text generation connection failed");
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
      } else {
        setImageError(res);
        toast.error("Image generation connection failed");
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

  const activeColor = "border-primary bg-primary/5 text-primary";
  const inactiveColor = "border-border bg-card text-muted-foreground";

  return (
    <div className="container-app py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">AI Provider Diagnostics</h1>
        <p className="text-sm text-muted-foreground">
          Forensic connection checks, key restriction validations, and non-blocking model tests.
        </p>
      </div>

      {/* 1. Global AI Configurations Info */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Active Provider Card */}
        <div className="rounded-xl border p-5 bg-card space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <Server className="h-4 w-4 text-primary" />
            <span>Active Router Provider</span>
          </div>
          <div>
            <span className="text-2xl font-bold uppercase tracking-wider text-primary">
              {config?.activeProvider}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Current active provider selected dynamically via the environment variable <code>ACTIVE_AI_PROVIDER</code>.
          </p>
        </div>

        {/* OpenAI Card */}
        <div className={`rounded-xl border p-5 transition ${config?.activeProvider === "openai" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
          <div className="flex items-center justify-between font-semibold mb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>OpenAI Adapter</span>
            </div>
            {config?.activeProvider === "openai" && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase font-bold text-primary">Active</span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div><strong>API Key Status:</strong> <code className="text-muted-foreground">{config?.openai?.apiKeyStatus}</code></div>
            <div><strong>LLM Model:</strong> <code className="text-muted-foreground">{config?.openai?.llmModel}</code></div>
            <div><strong>Image Model:</strong> <code className="text-muted-foreground">{config?.openai?.imageModel}</code> ({config?.openai?.imageSize})</div>
          </div>
        </div>

        {/* Gemini Card */}
        <div className={`rounded-xl border p-5 transition ${config?.activeProvider === "gemini" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
          <div className="flex items-center justify-between font-semibold mb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              <span>Google Gemini Adapter</span>
            </div>
            {config?.activeProvider === "gemini" && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase font-bold text-primary">Active</span>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div><strong>API Key Status:</strong> <code className="text-muted-foreground">{config?.gemini?.apiKeyStatus}</code></div>
            <div><strong>Endpoint Type:</strong> <span className="font-bold text-muted-foreground">{config?.gemini?.isVertex ? `Vertex AI (Starts with AQ)` : `AI Studio (Developer Key)`}</span></div>
            {config?.gemini?.isVertex && (
              <>
                <div><strong>GCP Project ID:</strong> <code className="text-muted-foreground">{config?.gemini?.projectId}</code></div>
                <div><strong>GCP Region:</strong> <code className="text-muted-foreground">{config?.gemini?.region}</code></div>
              </>
            )}
            <div><strong>LLM Model:</strong> <code className="text-muted-foreground">{config?.gemini?.llmModel}</code></div>
            <div><strong>Image Model:</strong> <code className="text-muted-foreground">{config?.gemini?.imageModel}</code></div>
          </div>
        </div>
      </div>

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
