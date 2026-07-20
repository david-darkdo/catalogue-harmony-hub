import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { runSandboxStage } from "@/lib/ai-pipeline.functions";
import {
  Sparkles,
  Save,
  RotateCcw,
  History,
  ToggleLeft,
  ToggleRight,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Eye,
  Zap,
  Brain,
  Search,
  Star,
  ShieldCheck,
  Image as ImageIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ai-templates")({
  head: () => ({ meta: [{ title: "AI Control Center — Admin" }] }),
  component: AdminAiTemplatesPage,
});

type PromptTemplate = {
  id: string;
  key: string;
  name: string;
  purpose: string;
  prompt_text: string;
  is_active: boolean;
  version: number;
  updated_at?: string;
};

type VersionHistory = {
  id: string;
  template_id: string;
  name: string;
  prompt_text: string;
  is_active: boolean;
  version: number;
  created_at: string;
  created_by?: string;
};

type SandboxResult = {
  compiledPrompt: string;
  aiResponse: string;
  executionMs: number;
  stageKey: string;
  providerName: string;
  isImageStage: boolean;
  productName: string;
  imageUrl: string | null;
  validationResult?: any;
};

const STAGE_ICONS: Record<string, React.ElementType> = {
  understanding: Brain,
  seo: Search,
  lifestyle: ImageIcon,
  search: Zap,
  recommendation: Star,
  quality: ShieldCheck,
};

const STAGE_ORDER = ["understanding", "seo", "lifestyle", "search", "recommendation", "quality"];

const STAGE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  understanding: {
    label: "Product Understanding",
    description: "Master brain — analyses the original product image and creates the Product Intelligence Object.",
    color: "text-violet-600 bg-violet-500/10 border-violet-500/20",
  },
  seo: {
    label: "SEO Generation",
    description: "Consumes Product Intelligence to generate canonical descriptions, titles, metadata and FAQ.",
    color: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  },
  lifestyle: {
    label: "Lifestyle Rendering",
    description: "Generates an image placement prompt to render the product in a luxury interior scene.",
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
  search: {
    label: "Search Intelligence",
    description: "Generates search aliases, builder terminology, misspellings and regional variations.",
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  },
  recommendation: {
    label: "Recommendation Engine",
    description: "Generates cross-sell suggestions, complementary materials and upsell triggers.",
    color: "text-orange-600 bg-orange-500/10 border-orange-500/20",
  },
  quality: {
    label: "Quality Validation",
    description: "Verifies the generated lifestyle image preserves the original product's identity.",
    color: "text-rose-600 bg-rose-500/10 border-rose-500/20",
  },
};

function AdminAiTemplatesPage() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string>("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("understanding");
  const [activeTab, setActiveTab] = useState<"editor" | "sandbox" | "history">("editor");
  const [historyLogs, setHistoryLogs] = useState<VersionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sandbox state
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);
  const [sandboxError, setSandboxError] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const sandboxFn = useServerFn(runSandboxStage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSuperAdmin = userRole === "super_admin" || userRole === "admin";

  const fetchUserRole = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (data?.role) setUserRole(data.role);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await fetchUserRole();
      const [prodRes, promptsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, brand, image_url, processing_state")
          .not("image_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("ai_prompt_templates").select("*").order("key"),
      ]);

      const allProds = prodRes.data ?? [];
      setProducts(allProds);
      if (allProds[0]?.id) setSelectedProductId(allProds[0].id);

      // Map to canonical STAGE_ORDER
      const rawMap: Record<string, any> = {};
      (promptsRes.data ?? []).forEach((p: any) => {
        if (p.key) rawMap[p.key] = p;
      });

      const merged: PromptTemplate[] = STAGE_ORDER.map((key) => {
        const p = rawMap[key];
        return {
          id: p?.id ?? key,
          key,
          name: p?.name ?? STAGE_LABELS[key]?.label ?? key,
          purpose: p?.purpose ?? STAGE_LABELS[key]?.description ?? "",
          prompt_text: p?.prompt_text ?? "",
          is_active: p?.is_active ?? true,
          version: p?.version ?? 1,
          updated_at: p?.updated_at,
        };
      });

      setTemplates(merged);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load AI Control Center");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (templateId: string) => {
    if (!templateId || templateId === selectedKey) {
      setHistoryLogs([]);
    }
    const tmpl = templates.find((t) => t.key === selectedKey);
    if (!tmpl?.id || tmpl.id === tmpl.key) {
      setHistoryLogs([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompt_templates_history" as any)
        .select("*")
        .eq("template_id", tmpl.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setHistoryLogs((data as any[]) ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load version history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const currentTemplate = templates.find((t) => t.key === selectedKey);

  useEffect(() => {
    if (activeTab === "history" && currentTemplate?.id) {
      void loadHistory(currentTemplate.id);
    }
  }, [selectedKey, activeTab, currentTemplate?.id]);

  const handleFieldChange = (field: keyof PromptTemplate, value: any) => {
    setTemplates((prev) =>
      prev.map((t) => (t.key === selectedKey ? { ...t, [field]: value } : t))
    );
  };

  const handleSave = async () => {
    if (!isSuperAdmin) return toast.error("Access Denied: Only admins can save prompt templates.");
    const current = templates.find((t) => t.key === selectedKey);
    if (!current) return;

    setSaving(true);
    try {
      const payload = {
        name: current.name,
        purpose: current.purpose,
        prompt_text: current.prompt_text,
        is_active: current.is_active,
        updated_by: user?.id,
      };

      const { error } = await supabase
        .from("ai_prompt_templates")
        .update(payload as any)
        .eq("id", current.id);
      if (error) throw error;

      toast.success(`✓ ${current.name} saved — version incremented`);
      void loadData();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (version: VersionHistory) => {
    if (!isSuperAdmin) return toast.error("Only admins can restore templates.");
    if (!confirm(`Restore template to version v${version.version}? This will become the active prompt.`)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("ai_prompt_templates")
        .update({
          name: version.name,
          prompt_text: version.prompt_text,
          is_active: version.is_active,
          updated_by: user?.id,
        } as any)
        .eq("id", version.template_id);

      if (error) throw error;
      toast.success(`✓ Restored to version v${version.version}`);
      void loadData();
      setActiveTab("editor");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to restore version");
    } finally {
      setSaving(false);
    }
  };

  const runSandbox = async () => {
    if (!selectedProductId || !currentTemplate) return;
    setTesting(true);
    setSandboxResult(null);
    setSandboxError("");
    try {
      const res = await sandboxFn({
        data: { productId: selectedProductId, stageKey: currentTemplate.key },
      });
      if (res.ok) {
        const result = res as any;
        // Try to parse validation result if quality stage
        let validationResult: any = null;
        if (currentTemplate.key === "quality" && result.aiResponse) {
          try {
            const m = result.aiResponse.match(/\{[\s\S]*\}/);
            if (m) validationResult = JSON.parse(m[0]);
          } catch {}
        }
        setSandboxResult({ ...result, validationResult });
      } else {
        setSandboxError((res as any).error ?? "Sandbox execution failed");
      }
    } catch (e: any) {
      setSandboxError(e.message ?? "Unexpected error running sandbox");
    } finally {
      setTesting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  if (loading) {
    return (
      <div className="container-app py-10 flex items-center gap-3 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
        Loading AI Operating System...
      </div>
    );
  }

  return (
    <div className="container-app py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Control Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Universal AI Operating System — six stages, one intelligence pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isSuperAdmin && (
            <span className="text-xs border border-amber-500/20 bg-amber-500/10 text-amber-600 rounded px-2.5 py-1 font-medium">
              Read-Only View
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isSuperAdmin || !currentTemplate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Stage Selector Sidebar */}
        <aside className="space-y-1">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-3">
            Pipeline Stages
          </h2>
          {STAGE_ORDER.map((key, idx) => {
            const tmpl = templates.find((t) => t.key === key);
            const StageIcon = STAGE_ICONS[key] ?? Brain;
            const isSelected = selectedKey === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedKey(key);
                  setSandboxResult(null);
                  setSandboxError("");
                }}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-xs font-medium transition flex items-center gap-2.5 cursor-pointer group ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "border border-transparent hover:bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold border ${
                  isSelected ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30" : "bg-muted border-border text-muted-foreground"
                }`}>
                  {idx + 1}
                </span>
                <StageIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{STAGE_LABELS[key]?.label ?? key}</span>
                <span className={`ml-auto text-[10px] rounded px-1 py-0.5 flex-shrink-0 ${
                  isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  v{tmpl?.version ?? 1}
                </span>
              </button>
            );
          })}

          {/* Pipeline Execution Order Info */}
          <div className="mt-4 px-2 pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Execution order is fixed. Each stage consumes the Product Intelligence Object created by stage 1.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <div className="space-y-0 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {/* Stage Header */}
          {currentTemplate && (
            <div className={`flex items-start gap-3 px-6 py-4 border-b border-border`}>
              {(() => {
                const StageIcon = STAGE_ICONS[currentTemplate.key] ?? Brain;
                const meta = STAGE_LABELS[currentTemplate.key];
                return (
                  <>
                    <div className={`p-2 rounded-lg border ${meta?.color ?? "text-primary bg-primary/10 border-primary/20"}`}>
                      <StageIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold">{currentTemplate.name}</h2>
                        <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono">
                          v{currentTemplate.version}
                        </span>
                        <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${
                          currentTemplate.is_active
                            ? "text-emerald-700 bg-emerald-500/10 border border-emerald-500/20"
                            : "text-red-600 bg-red-500/10 border border-red-500/20"
                        }`}>
                          {currentTemplate.is_active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{currentTemplate.purpose}</p>
                      {currentTemplate.updated_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Last updated: {new Date(currentTemplate.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Tab Bar */}
          <div className="flex border-b border-border px-2">
            {(["editor", "sandbox", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2.5 pt-3 px-4 text-xs font-semibold border-b-2 transition cursor-pointer capitalize ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "history" ? `Version History (${historyLogs.length})` : tab === "sandbox" ? "Sandbox Test" : "Prompt Editor"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ─────────────── PROMPT EDITOR ─────────────── */}
            {currentTemplate && activeTab === "editor" && (
              <div className="space-y-5">
                {/* Active toggle */}
                <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-4 py-3">
                  <div>
                    <p className="text-xs font-medium">Template Active Status</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Inactive templates are skipped by the pipeline.
                    </p>
                  </div>
                  <button
                    disabled={!isSuperAdmin}
                    onClick={() => handleFieldChange("is_active", !currentTemplate.is_active)}
                    className={`inline-flex items-center text-xs font-bold gap-1 transition cursor-pointer ${
                      currentTemplate.is_active ? "text-emerald-600" : "text-red-500"
                    } disabled:opacity-60`}
                  >
                    {currentTemplate.is_active ? (
                      <ToggleRight className="h-5 w-5" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                    {currentTemplate.is_active ? "Active" : "Disabled"}
                  </button>
                </div>

                {/* Prompt text editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Prompt Directives</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {currentTemplate.prompt_text.length} chars
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This is the live prompt sent to the AI model during pipeline execution. Every save creates a new version.
                  </p>
                  <textarea
                    ref={textareaRef}
                    disabled={!isSuperAdmin}
                    rows={20}
                    value={currentTemplate.prompt_text}
                    onChange={(e) => handleFieldChange("prompt_text", e.target.value)}
                    placeholder={isSuperAdmin ? "Enter your prompt here. Use placeholders like {product_name}, {brand}, {product_intelligence}..." : "Contact a super admin to edit this prompt."}
                    className="w-full text-xs font-mono bg-background border border-border rounded-lg p-4 outline-none focus:border-primary resize-y leading-relaxed disabled:opacity-70"
                  />
                </div>

                {/* Available variables hint */}
                <div className="bg-muted/30 border border-border rounded-lg p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Available Placeholders</p>
                  <div className="flex flex-wrap gap-1">
                    {[
                      "{product_name}", "{brand}", "{finish}", "{material}", "{color}", "{size}",
                      "{product_intelligence}", "{product_type}", "{installation_area}", "{installation_context}",
                      "{style}", "{luxury_level}", "{visual_characteristics}", "{design_language}",
                      "{original_image_url}", "{generated_image_url}", "{company_name}",
                    ].map((v) => (
                      <code key={v} className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground font-mono">
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────── SANDBOX ─────────────── */}
            {currentTemplate && activeTab === "sandbox" && (
              <div className="space-y-5">
                {/* Product Selector */}
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" /> Sandbox Configuration
                  </h3>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Select Product</label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => {
                          setSelectedProductId(e.target.value);
                          setSandboxResult(null);
                          setSandboxError("");
                        }}
                        className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                      >
                        <option value="">Choose a product...</option>
                        {products.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} {prod.brand ? `(${prod.brand})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Stage to Test</label>
                      <div className="px-3 py-2 text-xs border border-border rounded-lg bg-background text-foreground font-medium">
                        {STAGE_LABELS[currentTemplate.key]?.label ?? currentTemplate.key}
                      </div>
                    </div>
                  </div>

                  {/* Selected Product Preview */}
                  {selectedProduct && (
                    <div className="flex items-center gap-3 border border-border rounded-lg p-3 bg-background">
                      {selectedProduct.image_url ? (
                        <img
                          src={selectedProduct.image_url}
                          alt={selectedProduct.name}
                          className="h-12 w-12 object-cover rounded border border-border flex-shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-muted rounded border border-border flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold">{selectedProduct.name}</p>
                        <p className="text-[11px] text-muted-foreground">{selectedProduct.brand || "No brand"}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                          Pipeline state: {selectedProduct.processing_state ?? "unknown"}
                        </p>
                      </div>
                    </div>
                  )}

                  {currentTemplate.key === "lifestyle" && (
                    <div className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-start gap-2">
                      <ImageIcon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>Sandbox for Lifestyle stage shows the compiled image generation prompt only. No image is generated to avoid costs.</span>
                    </div>
                  )}

                  <button
                    onClick={runSandbox}
                    disabled={testing || !selectedProductId}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 cursor-pointer transition"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {testing ? "Running AI Stage..." : `Run ${STAGE_LABELS[currentTemplate.key]?.label ?? "Stage"}`}
                  </button>
                </div>

                {/* Error display */}
                {sandboxError && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex gap-3">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-red-600">Sandbox Execution Failed</p>
                      <p className="text-xs text-red-500/80 mt-1">{sandboxError}</p>
                    </div>
                  </div>
                )}

                {/* Sandbox Results */}
                {sandboxResult && (
                  <div className="space-y-4">
                    {/* Metrics bar */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                        <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="text-xs font-bold">{sandboxResult.executionMs.toLocaleString()}ms</p>
                        <p className="text-[10px] text-muted-foreground">Execution Time</p>
                      </div>
                      <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                        <Sparkles className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="text-xs font-bold capitalize">{sandboxResult.providerName}</p>
                        <p className="text-[10px] text-muted-foreground">AI Provider</p>
                      </div>
                      <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                        <p className="text-xs font-bold">Completed</p>
                        <p className="text-[10px] text-muted-foreground">Status</p>
                      </div>
                    </div>

                    {/* Quality validation result */}
                    {sandboxResult.stageKey === "quality" && sandboxResult.validationResult && (
                      <div className={`rounded-xl border p-4 ${
                        sandboxResult.validationResult.passes_validation
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-red-500/5 border-red-500/20"
                      }`}>
                        <div className="flex items-center gap-2 mb-3">
                          {sandboxResult.validationResult.passes_validation ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <p className="text-xs font-bold">
                            {sandboxResult.validationResult.passes_validation ? "Validation Passed" : "Validation Failed"}
                          </p>
                          <span className="ml-auto text-xs font-mono">
                            Score: {sandboxResult.validationResult.confidence_score ?? "N/A"}/100
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          {["material_match", "geometry_match", "texture_match", "finish_match", "orientation_match", "color_match"].map((k) => (
                            <div key={k} className="flex items-center gap-1">
                              {sandboxResult.validationResult?.[k] ? (
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-400" />
                              )}
                              <span className="capitalize">{k.replace(/_/g, " ")}</span>
                            </div>
                          ))}
                        </div>
                        {sandboxResult.validationResult.failure_reasons?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-red-500/20">
                            <p className="text-[10px] font-semibold text-red-600 mb-1">Failure Reasons:</p>
                            {sandboxResult.validationResult.failure_reasons.map((r: string, i: number) => (
                              <p key={i} className="text-[10px] text-red-500">• {r}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Compiled Prompt */}
                    <div className="bg-muted/30 border border-border rounded-xl p-4">
                      <div className="flex justify-between items-center border-b border-border pb-2 mb-3">
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          {sandboxResult.isImageStage ? "Compiled Image Prompt" : "Compiled Prompt Sent to AI"}
                        </span>
                        <span className="text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                          {sandboxResult.compiledPrompt.length} chars
                        </span>
                      </div>
                      <pre className="text-xs font-mono bg-background text-muted-foreground border border-border rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed">
                        {sandboxResult.compiledPrompt}
                      </pre>
                    </div>

                    {/* AI Response */}
                    {!sandboxResult.isImageStage && sandboxResult.aiResponse && (
                      <div className="bg-muted/30 border border-border rounded-xl p-4">
                        <div className="flex justify-between items-center border-b border-border pb-2 mb-3">
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            AI Response
                          </span>
                          <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded font-mono">
                            JSON Output
                          </span>
                        </div>
                        <pre className="text-xs font-mono bg-background text-foreground border border-border rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                          {(() => {
                            try {
                              const m = sandboxResult.aiResponse.match(/\{[\s\S]*\}/);
                              if (m) return JSON.stringify(JSON.parse(m[0]), null, 2);
                            } catch {}
                            return sandboxResult.aiResponse;
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─────────────── VERSION HISTORY ─────────────── */}
            {currentTemplate && activeTab === "history" && (
              <div className="space-y-4">
                {historyLoading ? (
                  <div className="text-xs text-muted-foreground py-8 flex items-center gap-2">
                    <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                    Loading version history...
                  </div>
                ) : historyLogs.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-12 border border-dashed border-border rounded-xl text-center space-y-2">
                    <History className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="font-medium">No version history yet</p>
                    <p className="text-[11px]">Save changes to the prompt to create your first version.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {historyLogs.length} version{historyLogs.length !== 1 ? "s" : ""} found for this template.
                    </p>
                    {historyLogs.map((log, idx) => (
                      <div key={log.id} className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold">Version v{log.version}</span>
                                {idx === 0 && (
                                  <span className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded px-1.5 py-0.5">Previous</span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(log.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRestore(log)}
                            disabled={saving || !isSuperAdmin}
                            className="text-[10px] text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded px-2.5 py-1 font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" /> Restore
                          </button>
                        </div>

                        <pre className="text-[10px] font-mono whitespace-pre-wrap bg-background text-muted-foreground rounded-lg border border-border p-3 max-h-36 overflow-y-auto leading-relaxed">
                          {log.prompt_text}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
