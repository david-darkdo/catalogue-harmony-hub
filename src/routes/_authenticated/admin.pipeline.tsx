import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Play, AlertTriangle, CheckCircle2, Clock, Archive } from "lucide-react";
import { retryJob, retryProductPipeline, regenerateWithHashGuard } from "@/lib/pipeline";
import { publicImageUrl } from "@/components/ImageUploader";
import { useServerFn } from "@tanstack/react-start";
import { runProductPipeline } from "@/lib/ai-pipeline.functions";

export const Route = createFileRoute("/_authenticated/admin/pipeline")({
  head: () => ({ meta: [{ title: "Product Pipeline — Admin" }] }),
  component: PipelinePage,
});

type Bucket = "pending" | "processing" | "completed" | "error" | "archived";

function PipelinePage() {
  const runPipeline = useServerFn(runProductPipeline);
  const [running, setRunning] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>("processing");
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<Bucket, number>>({
    pending: 0, processing: 0, completed: 0, error: 0, archived: 0,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCounts = useCallback(async () => {
    const states: Bucket[] = ["pending", "processing", "completed", "error", "archived"];
    const next: Record<Bucket, number> = { pending: 0, processing: 0, completed: 0, error: 0, archived: 0 };
    for (const s of states) {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("processing_state", s);
      next[s] = count ?? 0;
    }
    setCounts(next);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,code,status,processing_state,retry_count,error_log,generation_version,last_processed_at,image_url,generation_hash")
      .eq("processing_state", bucket)
      .order("last_processed_at", { ascending: false, nullsFirst: false })
      .limit(100);
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows(data ?? []);
  }, [bucket]);

  const loadJobs = async (productId: string) => {
    const { data } = await supabase
      .from("ai_jobs" as any)
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });
    setJobs((data ?? []) as any[]);
  };

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { if (expanded) loadJobs(expanded); }, [expanded]);

  const handleRetryProduct = async (productId: string) => {
    try {
      await retryProductPipeline(productId);
      toast.success("Pipeline re-queued");
      await loadRows(); await loadCounts();
      if (expanded === productId) await loadJobs(productId);
    } catch (e: any) { toast.error(e.message ?? "Retry failed"); }
  };

  const handleRunNow = async (productId: string) => {
    setRunning(productId);
    try {
      const res = await runPipeline({ data: { productId } });
      if (res.ok) toast.success("Pipeline completed"); else toast.error("Pipeline failed — see jobs");
    } catch (e: any) {
      toast.error(e.message ?? "Run failed");
    } finally {
      setRunning(null);
      await loadRows(); await loadCounts();
      if (expanded === productId) await loadJobs(productId);
    }
  };


  const handleRegenerate = async (productId: string) => {
    try {
      const res = await regenerateWithHashGuard(productId);
      if (res.skipped) {
        if (!confirm(res.reason + "\n\nRegenerate anyway?")) return;
        await regenerateWithHashGuard(productId, { force: true });
      }
      toast.success("Regeneration queued");
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

  const handleRetryJob = async (jobId: string, productId: string) => {
    try {
      await retryJob(jobId);
      toast.success("Job re-queued");
      await loadJobs(productId);
    } catch (e: any) { toast.error(e.message ?? "Retry failed"); }
  };

  const buckets: { key: Bucket; label: string; icon: any; color: string }[] = [
    { key: "processing", label: "Processing", icon: RefreshCw, color: "text-blue-500" },
    { key: "pending", label: "Pending", icon: Clock, color: "text-amber-500" },
    { key: "completed", label: "Completed", icon: CheckCircle2, color: "text-primary" },
    { key: "error", label: "Failed", icon: AlertTriangle, color: "text-destructive" },
    { key: "archived", label: "Archived", icon: Archive, color: "text-muted-foreground" },
  ];

  return (
    <div className="container-app py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Product Pipeline Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live view of the AI processing state machine. Retry, regenerate, archive.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {buckets.map((b) => (
          <button
            key={b.key}
            onClick={() => setBucket(b.key)}
            className={`rounded-xl border p-4 text-left transition ${
              bucket === b.key ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${b.color}`}>
              <b.icon className="h-3.5 w-3.5" /> {b.label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{counts[b.key]}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display font-semibold capitalize">{bucket} products</h2>
          <button
            onClick={() => { loadRows(); loadCounts(); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:border-primary"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No products in this bucket.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  {publicImageUrl(p.image_url) ? (
                    <img src={publicImageUrl(p.image_url)!} alt="" className="h-14 w-14 rounded border border-border object-cover" />

                  ) : (
                    <div className="h-14 w-14 rounded border border-dashed border-border" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/admin/products/$id"
                      params={{ id: p.id }}
                      className="block truncate font-medium hover:text-primary"
                    >
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{p.code}</span> · v{p.generation_version} · retries: {p.retry_count}
                      {p.last_processed_at && ` · last ${new Date(p.last_processed_at).toLocaleString()}`}
                    </div>
                    {p.error_log && (
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-destructive/10 p-2 text-[11px] text-destructive">
                        {typeof p.error_log === "string" ? p.error_log : JSON.stringify(p.error_log, null, 2)}
                      </pre>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary"
                    >
                      {expanded === p.id ? "Hide jobs" : "View jobs"}
                    </button>
                    {(bucket === "pending" || bucket === "processing" || bucket === "error") && (
                      <button
                        disabled={running === p.id}
                        onClick={() => handleRunNow(p.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        <Play className="h-3 w-3" /> {running === p.id ? "Running…" : "Run now"}
                      </button>
                    )}
                    {bucket === "error" && (
                      <button
                        onClick={() => handleRetryProduct(p.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                      >
                        <Play className="h-3 w-3" /> Retry
                      </button>
                    )}
                    {bucket === "completed" && (
                      <button
                        onClick={() => handleRegenerate(p.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                      >
                        <RefreshCw className="h-3 w-3" /> Regenerate
                      </button>
                    )}
                    {bucket !== "archived" ? (
                      <button
                        onClick={() => handleArchive(p.id)}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnarchive(p.id)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>

                {expanded === p.id && (
                  <div className="mt-3 rounded-lg border border-border bg-background p-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      AI Jobs ({jobs.length})
                    </h3>
                    {jobs.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No jobs yet. <button onClick={() => handleRetryProduct(p.id)} className="text-primary hover:underline">Enqueue pipeline</button>
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="text-left text-muted-foreground">
                          <tr>
                            <th className="py-1 pr-2">Step</th>
                            <th className="py-1 pr-2">Depends On</th>
                            <th className="py-1 pr-2">Status</th>
                            <th className="py-1 pr-2">Attempts</th>
                            <th className="py-1 pr-2">Updated</th>
                            <th className="py-1 pr-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {jobs.map((j) => (
                            <React.Fragment key={j.id}>
                              <tr>
                                <td className="py-1.5 pr-2 font-mono">{j.job_type}</td>
                                <td className="py-1.5 pr-2 text-muted-foreground">{j.job_dependency ?? "—"}</td>
                                <td className="py-1.5 pr-2">
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                                    j.status === "success" ? "bg-primary/10 text-primary" :
                                    j.status === "failed" ? "bg-destructive/10 text-destructive" :
                                    j.status === "processing" ? "bg-blue-500/10 text-blue-500" :
                                    "bg-muted text-muted-foreground"
                                  }`}>{j.status}</span>
                                </td>
                                <td className="py-1.5 pr-2">{j.attempts}</td>
                                <td className="py-1.5 pr-2 text-muted-foreground">
                                  {new Date(j.updated_at).toLocaleTimeString()}
                                </td>
                                <td className="py-1.5 pr-2">
                                  {(j.status === "failed" || j.status === "pending") && (
                                    <button
                                      onClick={() => handleRetryJob(j.id, p.id)}
                                      className="text-primary hover:underline"
                                    >
                                      Retry
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {j.status === "failed" && j.error_log && (
                                <tr>
                                  <td colSpan={6} className="py-2 pl-4 pr-2 bg-destructive/5 rounded-md border border-destructive/10">
                                    <div className="space-y-1.5 text-[11px] text-destructive-foreground/80">
                                      <div className="text-destructive font-semibold">
                                        Error: {typeof j.error_log === "string" ? j.error_log : j.error_log.message || JSON.stringify(j.error_log)}
                                      </div>
                                      {j.error_log.provider && (
                                        <div className="text-muted-foreground">
                                          <strong>AI Provider:</strong> <span className="uppercase font-bold">{j.error_log.provider}</span> ({j.error_log.model})
                                        </div>
                                      )}
                                      {j.error_log.cloudinary_url && (
                                        <div className="text-muted-foreground">
                                          <strong>Cloudinary Image:</strong>{" "}
                                          <a href={j.error_log.cloudinary_url} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">
                                            {j.error_log.cloudinary_url}
                                          </a>
                                        </div>
                                      )}
                                      {j.error_log.prompt && (
                                        <details className="mt-1 cursor-pointer">
                                          <summary className="font-semibold text-primary hover:underline">Show Final Compiled Prompt Sent</summary>
                                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-background border border-border p-2 text-[10px] text-muted-foreground whitespace-pre-wrap font-mono">
                                            {j.error_log.prompt}
                                          </pre>
                                        </details>
                                      )}
                                      {j.error_log.stack && (
                                        <details className="cursor-pointer mt-1">
                                          <summary className="font-semibold text-muted-foreground hover:text-foreground hover:underline">Show Stack Trace</summary>
                                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-background border border-border p-2 text-[10px] text-muted-foreground whitespace-pre-wrap font-mono">
                                            {j.error_log.stack}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
