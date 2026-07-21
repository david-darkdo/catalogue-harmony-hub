import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Play, AlertTriangle, CheckCircle2, Clock, Archive, Sparkles } from "lucide-react";
import { publicImageUrl } from "@/components/ImageUploader";
import { useServerFn } from "@tanstack/react-start";
import { runProductPipeline } from "@/lib/ai-pipeline.functions";
import { generateStandaloneLifestyleImage } from "@/lib/lifestyle-image.functions";
import { regenerateWithHashGuard, retryProductPipeline } from "@/lib/pipeline";

export const Route = createFileRoute("/_authenticated/admin/pipeline")({
  head: () => ({ meta: [{ title: "AI Operations Dashboard — Admin" }] }),
  component: PipelinePage,
});

type Bucket = "pending" | "processing" | "completed" | "needs_review" | "error" | "archived";

function PipelinePage() {
  const runPipeline = useServerFn(runProductPipeline);
  const generateLifestyleFn = useServerFn(generateStandaloneLifestyleImage);
  const [generatingLifestyle, setGeneratingLifestyle] = useState<string | null>(null);

  const handleGenerateLifestyleOnly = async (productId: string, hasOriginalImage: boolean) => {
    if (!hasOriginalImage) {
      toast.error("Original product image is required before generating an installed image.");
      return;
    }
    setGeneratingLifestyle(productId);
    try {
      const res = await generateLifestyleFn({ data: { productId } });
      if (res.ok) {
        toast.success("Installed lifestyle image generated successfully!");
      } else {
        toast.error("Failed to generate installed image.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setGeneratingLifestyle(null);
      await loadRows(); await loadCounts();
    }
  };
  const [running, setRunning] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>("processing");
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<Bucket, number>>({
    pending: 0, processing: 0, completed: 0, needs_review: 0, error: 0, archived: 0,
  });
  const [loading, setLoading] = useState(false);

  const loadCounts = useCallback(async () => {
    const states: Bucket[] = ["pending", "processing", "completed", "needs_review", "error", "archived"];
    const next: Record<Bucket, number> = { pending: 0, processing: 0, completed: 0, needs_review: 0, error: 0, archived: 0 };
    for (const s of states) {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("processing_state", s as any);
      next[s] = count ?? 0;
    }
    setCounts(next);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,code,status,processing_state,retry_count,error_log,generation_version,last_processed_at,image_url,generation_hash")
      .eq("processing_state", bucket as any)
      .order("last_processed_at", { ascending: false, nullsFirst: false })
      .limit(100);
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows(data ?? []);
  }, [bucket]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const handleRetryProduct = async (productId: string) => {
    try {
      await retryProductPipeline(productId);
      toast.success("Pipeline re-queued to pending");
      await loadRows(); await loadCounts();
    } catch (e: any) { toast.error(e.message ?? "Retry failed"); }
  };

  const handleRunNow = async (productId: string) => {
    setRunning(productId);
    try {
      const res = await runPipeline({ data: { productId } });
      if (res.ok) {
        toast.success("Pipeline completed successfully!");
      } else {
        toast.error(`Pipeline failed: ${res.error || "See error log"}`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Run failed");
    } finally {
      setRunning(null);
      await loadRows(); await loadCounts();
    }
  };

  const handleRegenerate = async (productId: string) => {
    try {
      const res = await regenerateWithHashGuard(productId);
      if (res.skipped) {
        if (!confirm(res.reason + "\n\nRegenerate anyway?")) return;
        await regenerateWithHashGuard(productId, { force: true });
      }
      toast.success("Regeneration queued successfully");
      await loadRows(); await loadCounts();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const handleArchive = async (productId: string) => {
    if (!confirm("Archive this product? It will be hidden from the feed.")) return;
    const { error } = await supabase
      .from("products")
      .update({ processing_state: "archived", status: "archived" } as any)
      .eq("id", productId);
    if (error) return toast.error(error.message);
    toast.success("Archived");
    await loadRows(); await loadCounts();
  };

  const handleUnarchive = async (productId: string) => {
    const { error } = await supabase
      .from("products")
      .update({ processing_state: "draft", status: "draft" } as any)
      .eq("id", productId);
    if (error) return toast.error(error.message);
    toast.success("Restored to draft");
    await loadRows(); await loadCounts();
  };

  const buckets: { key: Bucket; label: string; icon: any; color: string }[] = [
    { key: "processing", label: "Processing", icon: RefreshCw, color: "text-blue-500" },
    { key: "pending", label: "Pending", icon: Clock, color: "text-amber-500" },
    { key: "completed", label: "Completed", icon: CheckCircle2, color: "text-primary" },
    { key: "error", label: "Failed", icon: AlertTriangle, color: "text-destructive" },
    { key: "archived", label: "Archived", icon: Archive, color: "text-muted-foreground" },
  ];

  return (
    <div className="container-app py-6 space-y-6 max-w-5xl">
      <div className="border-b border-border pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">AI Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor jobs, failures, and regenerate or retry processes on the Universal AI Operating System.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {buckets.map((b) => (
          <button
            key={b.key}
            onClick={() => setBucket(b.key)}
            className={`rounded-xl border p-4 text-left transition cursor-pointer select-none ${
              bucket === b.key ? "border-primary bg-primary/5 font-semibold" : "border-border bg-card hover:border-primary/40 text-muted-foreground"
            }`}
          >
            <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${b.color}`}>
              <b.icon className="h-3.5 w-3.5" /> {b.label}
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{counts[b.key]}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display font-semibold capitalize text-base">{bucket} products</h2>
          <button
            onClick={() => { void loadRows(); void loadCounts(); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary cursor-pointer transition"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading products list...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No products found in this category.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id} className="p-4 hover:bg-muted/10 transition">
                <div className="flex flex-wrap items-start gap-4">
                  {publicImageUrl(p.image_url) ? (
                    <img src={publicImageUrl(p.image_url)!} alt="" className="h-16 w-16 rounded border border-border object-cover bg-muted" />
                  ) : (
                    <div className="h-16 w-16 rounded border border-dashed border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      to="/admin/products/$id"
                      params={{ id: p.id }}
                      className="block truncate font-semibold hover:text-primary text-sm"
                    >
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-[10px]">{p.code}</span>
                      <span>·</span>
                      <span>v{p.generation_version ?? 0}</span>
                      <span>·</span>
                      <span>Retries: {p.retry_count ?? 0}</span>
                      {p.last_processed_at && (
                        <>
                          <span>·</span>
                          <span>Last active: {new Date(p.last_processed_at).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                    {p.error_log && (
                      <div className="mt-2 rounded-lg bg-destructive/5 border border-destructive/10 p-3">
                        <div className="text-[11px] font-mono text-destructive break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {typeof p.error_log === "string" ? p.error_log : JSON.stringify(p.error_log, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 sm:pt-0">
                    {(bucket === "pending" || bucket === "processing" || bucket === "error") && (
                      <button
                        disabled={running === p.id}
                        onClick={() => void handleRunNow(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        <Play className="h-3 w-3" /> {running === p.id ? "Running…" : "Run now"}
                      </button>
                    )}
                    {bucket === "error" && (
                      <button
                        onClick={() => void handleRetryProduct(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry Pipeline
                      </button>
                    )}
                    {bucket === "completed" && (
                      <button
                        onClick={() => void handleRegenerate(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" /> Regenerate
                      </button>
                    )}
                    <button
                      disabled={generatingLifestyle === p.id || !p.image_url}
                      onClick={() => void handleGenerateLifestyleOnly(p.id, !!p.image_url)}
                      title={!p.image_url ? "Original product image is required before generating an installed image." : "Generate Installed Image"}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 hover:border-primary disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="h-3 w-3" /> {generatingLifestyle === p.id ? "Generating Image…" : "Generate Installed Image"}
                    </button>
                    {bucket !== "archived" ? (
                      <button
                        onClick={() => void handleArchive(p.id)}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleUnarchive(p.id)}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                      >
                        Restore to Draft
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
