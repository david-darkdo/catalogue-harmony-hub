import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Save, RotateCcw, History, ToggleLeft, ToggleRight } from "lucide-react";

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
};

function AdminAiTemplatesPage() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string>("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"editor" | "sandbox" | "history">("editor");

  // Version History State
  const [historyLogs, setHistoryLogs] = useState<VersionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sandbox State
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [sandboxResult, setSandboxResult] = useState<string>("");
  const [testing, setTesting] = useState(false);

  // Super Admin Check
  const isSuperAdmin = userRole === "super_admin";

  const fetchUserRole = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (data?.role) {
      setUserRole(data.role);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await fetchUserRole();

      // Load products for Sandbox testing
      const [prodRes, promptsRes] = await Promise.all([
        supabase.from("products").select("id, name, brand, finish, material, color, size, type_id, category_id, subcategory_id").limit(20),
        supabase.from("ai_prompt_templates").select("*").order("key")
      ]);

      setProducts(prodRes.data ?? []);
      if (prodRes.data?.[0]?.id) {
        setSelectedProductId(prodRes.data[0].id);
      }

      const merged: PromptTemplate[] = (promptsRes.data ?? []).map((p: any) => ({
        id: p.id,
        key: p.key || "",
        name: p.name || p.key || "Unnamed Template",
        purpose: p.purpose || "",
        prompt_text: p.prompt_text || "",
        is_active: p.is_active ?? true,
        version: p.version ?? 1,
        updated_at: p.updated_at,
      }));

      setTemplates(merged);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load database templates");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (templateId: string) => {
    if (!templateId) {
      setHistoryLogs([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompt_templates_history" as any)
        .select("*")
        .eq("template_id", templateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setHistoryLogs(data ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load version history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const currentTemplate = templates[selectedIdx];

  useEffect(() => {
    if (currentTemplate?.id && activeTab === "history") {
      void loadHistory(currentTemplate.id);
    }
  }, [selectedIdx, activeTab, currentTemplate?.id]);

  const handleFieldChange = (field: keyof PromptTemplate, value: any) => {
    setTemplates((prev) =>
      prev.map((t, idx) => (idx === selectedIdx ? { ...t, [field]: value } : t))
    );
  };

  const handleSave = async () => {
    if (!isSuperAdmin) {
      return toast.error("Access Denied: Only Super Admins can save prompt templates.");
    }
    const current = templates[selectedIdx];
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

      toast.success(`Prompt templates saved for ${current.name}`);
      void loadData(); // Reload to refresh version counters and history
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save templates");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (version: VersionHistory) => {
    if (!isSuperAdmin) return toast.error("Only Super Admins can restore templates.");
    if (!confirm(`Are you sure you want to restore template to version v${version.version}?`)) return;

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
      toast.success(`Successfully restored template to version ${version.version}`);
      void loadData();
      setActiveTab("editor");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to restore version");
    } finally {
      setSaving(false);
    }
  };

  const runSandboxTest = async () => {
    if (!selectedProductId || !currentTemplate) return;
    setTesting(true);
    setSandboxResult("");
    try {
      const { data: p } = await supabase.from("products").select("*").eq("id", selectedProductId).single();
      const { data: type } = p.type_id ? await supabase.from("product_types").select("name").eq("id", p.type_id).maybeSingle() : { data: null };
      const { data: cat } = p.category_id ? await supabase.from("categories").select("name").eq("id", p.category_id).maybeSingle() : { data: null };
      const { data: sub } = p.subcategory_id ? await supabase.from("subcategories").select("name").eq("id", p.subcategory_id).maybeSingle() : { data: null };

      const interpolate = (txt: string) => {
        if (!txt) return "";
        return txt
          .replace(/{product_name}/g, p.name || "")
          .replace(/{brand}/g, p.brand ?? "premium")
          .replace(/{finish}/g, p.finish ?? p.finish_name ?? "")
          .replace(/{material}/g, p.material ?? "")
          .replace(/{color}/g, p.color ?? "")
          .replace(/{size}/g, p.size ?? "")
          .replace(/{context}/g, "luxury showroom")
          .replace(/{category}/g, cat?.name ?? "")
          .replace(/{type}/g, type?.name ?? "")
          .replace(/{subcategory}/g, sub?.name ?? "")
          .replace(/{product_type}/g, type?.name ?? "")
          .replace(/{product_intelligence}/g, "{\n  \"product_type\": \"tile\",\n  \"material\": \"Marble\",\n  \"finish\": \"Polished\",\n  \"color\": \"White\",\n  \"luxury_level\": \"Ultra-Luxury\"\n}")
          .replace(/{original_image_url}/g, p.image_url || "")
          .replace(/{generated_image_url}/g, p.generated_installed_image || "")
          .replace(/{company_name}/g, "Enreach Concepts");
      };

      setSandboxResult(interpolate(currentTemplate.prompt_text));
      toast.success("Sandbox interpolation completed.");
    } catch (e: any) {
      toast.error(e.message ?? "Error running sandbox");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading AI template models...</div>;
  }

  return (
    <div className="container-app py-6 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Control Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure prompt templates for the exactly six universal stages of the AI Operating System.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isSuperAdmin && (
            <span className="text-xs border border-amber-500/20 bg-amber-500/10 text-amber-600 rounded px-2.5 py-1 font-medium">
              Read-Only Admin View
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isSuperAdmin}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Universal Template List */}
        <aside className="space-y-1">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
            Universal Templates
          </h2>
          {templates.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedIdx(idx);
                setSandboxResult("");
              }}
              className={`w-full text-left rounded-lg px-3 py-2.5 text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                selectedIdx === idx
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "border border-transparent hover:bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{t.name}</span>
              <span className={`text-[10px] rounded px-1.5 py-0.5 ${selectedIdx === idx ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                v{t.version}
              </span>
            </button>
          ))}
        </aside>

        {/* Main Content Area */}
        <div className="space-y-6 bg-card border border-border rounded-xl p-6 shadow-sm">
          {/* Tabs header */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("editor")}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === "editor"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Prompt Editor
            </button>
            <button
              onClick={() => setActiveTab("sandbox")}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === "sandbox"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Sandbox Test
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === "history"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Version History ({historyLogs.length})
            </button>
          </div>

          {currentTemplate && activeTab === "editor" && (
            <div className="space-y-6">
              {/* Properties Grid */}
              <div className="grid gap-4 sm:grid-cols-2 bg-muted/30 border border-border rounded-xl p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Template Name</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={currentTemplate.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    className="w-full text-xs bg-background border border-border rounded p-2 focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Template Purpose</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={currentTemplate.purpose}
                    onChange={(e) => handleFieldChange("purpose", e.target.value)}
                    className="w-full text-xs bg-background border border-border rounded p-2 focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1.5 flex items-center justify-between sm:col-span-2 pt-2">
                  <span className="text-xs font-medium text-muted-foreground">Template Active Status</span>
                  <button
                    disabled={!isSuperAdmin}
                    onClick={() => handleFieldChange("is_active", !currentTemplate.is_active)}
                    className={`inline-flex items-center text-xs font-bold gap-1 transition cursor-pointer ${currentTemplate.is_active ? 'text-emerald-600' : 'text-red-500'}`}
                  >
                    {currentTemplate.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    {currentTemplate.is_active ? "Active" : "Disabled"}
                  </button>
                </div>
              </div>

              {/* Editor Field */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">Template Prompt</h3>
                <p className="text-xs text-muted-foreground">Configure the prompt directives sent to the LLM during this pipeline stage.</p>
                <textarea
                  disabled={!isSuperAdmin}
                  rows={15}
                  value={currentTemplate.prompt_text}
                  onChange={(e) => handleFieldChange("prompt_text", e.target.value)}
                  className="w-full text-xs font-mono bg-background border border-border rounded-lg p-3 outline-none focus:border-primary mt-2"
                />
              </div>
            </div>
          )}

          {currentTemplate && activeTab === "sandbox" && (
            <div className="space-y-6">
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-muted-foreground">Select Test Product</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setSandboxResult("");
                      }}
                      className="w-full text-xs bg-background border border-border rounded p-2 outline-none focus:border-primary"
                    >
                      <option value="">Choose a product...</option>
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>{prod.name} ({prod.brand || 'No Brand'})</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={runSandboxTest}
                    disabled={testing || !selectedProductId}
                    className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
                  >
                    {testing ? "Testing..." : "Interpolate & Preview"}
                  </button>
                </div>

                <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
                  <strong>Available Sandbox Variables:</strong> <code>{`{product_name}, {brand}, {finish}, {material}, {color}, {size}, {context}, {category}, {type}, {subcategory}, {product_intelligence}, {original_image_url}, {generated_image_url}, {company_name}`}</code>
                </div>
              </div>

              {sandboxResult && (
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
                    <span className="text-xs font-semibold">Compiled Prompt Preview</span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">Interpolated</span>
                  </div>
                  <pre className="text-xs font-mono bg-background text-muted-foreground border border-border rounded p-3 overflow-auto max-h-[300px] whitespace-pre-wrap">
                    {sandboxResult}
                  </pre>
                </div>
              )}
            </div>
          )}

          {currentTemplate && activeTab === "history" && (
            <div className="space-y-4">
              {historyLoading ? (
                <div className="text-xs text-muted-foreground py-4">Fetching revisions...</div>
              ) : historyLogs.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 border border-dashed border-border rounded-xl text-center">
                  No edit logs found for this template yet. Save changes to create versions!
                </div>
              ) : (
                <div className="space-y-4">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center border-b border-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-bold">Version v{log.version}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => handleRestore(log)}
                          disabled={saving || !isSuperAdmin}
                          className="text-[10px] text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded px-2.5 py-1 font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore Version
                        </button>
                      </div>

                      <pre className="text-[10px] font-mono whitespace-pre-wrap bg-background text-muted-foreground rounded p-3 max-h-48 overflow-y-auto">
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
  );
}
