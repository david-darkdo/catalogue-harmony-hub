import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Save, RotateCcw, HelpCircle, Eye, History, ToggleLeft, ToggleRight, ArrowUpRight, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ai-templates")({
  head: () => ({ meta: [{ title: "AI Templates Engine — Admin" }] }),
  component: AdminAiTemplatesPage,
});

type PromptTemplate = {
  id: string;
  installation_context_id: string;
  name: string;
  purpose: string;
  understanding_prompt: string;
  studio_prompt: string;
  installed_prompt: string;
  description_prompt: string;
  seo_prompt: string;
  faq_prompt: string;
  is_active: boolean;
  version: number;
  priority: number;
  product_type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  brand_override: string | null;
  updated_at?: string;
  context_name?: string;
  context_slug?: string;
};

type VersionHistory = {
  id: string;
  template_id: string;
  name: string;
  understanding_prompt: string;
  studio_prompt: string;
  installed_prompt: string;
  description_prompt: string;
  seo_prompt: string;
  faq_prompt: string;
  is_active: boolean;
  version: number;
  priority: number;
  brand_override: string | null;
  created_at: string;
};

const DEFAULT_PROMPTS = {
  understanding_prompt: "Analyse this product for an Abuja luxury interiors showroom.\nProduct: {product_name}\nBrand: {brand}\nFinish: {finish}\nSize: {size}\nColor: {color}\nMaterial: {material}\n\nRespond with keys: material, finish, color, style, environment, installation_context (one of luxury_bathroom, luxury_kitchen, luxury_living_room, luxury_bedroom, luxury_hotel, luxury_office, luxury_exterior, luxury_showroom, luxury_commercial), product_type, keywords (string[]), tags (string[]), confidence (0-1).",
  studio_prompt: "Professional studio product photograph of {product_name} ({material}, {finish}). Isolated on soft neutral background, museum lighting, ultra-sharp, preserve exact color/finish/material/orientation. 4k.",
  installed_prompt: "Photorealistic {context} scene featuring {product_name} installed in-situ. Preserve product identity exactly. Cinematic architectural photography, natural light, luxury Nigerian interior styling.",
  description_prompt: "Write a luxury showroom description for {product_name}, a {category} in {finish} {material}. Emphasize craftsmanship, provenance, and how it elevates a {context}. 3 short paragraphs.",
  seo_prompt: "Create SEO for {product_name}. Include seo_title (<=60), seo_description (<=155), seo_keywords (string[]), og_title, og_description, canonical_slug (kebab).",
  faq_prompt: "Generate a JSON object { faq: [{q, a}, ...] } with 5 buyer FAQs for {product_name}."
};

function AdminAiTemplatesPage() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string>("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"editor" | "sandbox" | "history">("editor");

  // Selection Lookups
  const [contexts, setContexts] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);

  // Version History State
  const [historyLogs, setHistoryLogs] = useState<VersionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sandbox State
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [sandboxResult, setSandboxResult] = useState<any>(null);
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

      // Load taxonomies
      const [ctxRes, typeRes, catRes, subRes, prodRes] = await Promise.all([
        supabase.from("installation_contexts").select("id, name, slug").order("name"),
        supabase.from("product_types").select("id, name").order("name"),
        supabase.from("categories").select("id, name").order("name"),
        supabase.from("subcategories").select("id, name").order("name"),
        supabase.from("products").select("id, name, brand, finish, material, color, size, type_id, category_id, subcategory_id").limit(20)
      ]);

      setContexts(ctxRes.data ?? []);
      setTypes(typeRes.data ?? []);
      setCategories(catRes.data ?? []);
      setSubcategories(subRes.data ?? []);
      setProducts(prodRes.data ?? []);
      if (prodRes.data?.[0]?.id) {
        setSelectedProductId(prodRes.data[0].id);
      }

      // Load templates
      const { data: prompts, error: prErr } = await supabase
        .from("ai_prompt_templates")
        .select("*");
      if (prErr) throw prErr;

      const merged: PromptTemplate[] = (ctxRes.data ?? []).map((ctx) => {
        const matchingPrompt = (prompts ?? []).find(
          (p) => p.installation_context_id === ctx.id
        );

        return {
          id: matchingPrompt?.id ?? "",
          installation_context_id: ctx.id,
          context_name: ctx.name,
          context_slug: ctx.slug,
          name: matchingPrompt?.name ?? `${ctx.name} Default Prompt`,
          purpose: matchingPrompt?.purpose ?? `AI prompt strategy for ${ctx.name} layouts.`,
          understanding_prompt: matchingPrompt?.understanding_prompt ?? DEFAULT_PROMPTS.understanding_prompt,
          studio_prompt: matchingPrompt?.studio_prompt ?? DEFAULT_PROMPTS.studio_prompt,
          installed_prompt: matchingPrompt?.installed_prompt ?? DEFAULT_PROMPTS.installed_prompt,
          description_prompt: matchingPrompt?.description_prompt ?? DEFAULT_PROMPTS.description_prompt,
          seo_prompt: matchingPrompt?.seo_prompt ?? DEFAULT_PROMPTS.seo_prompt,
          faq_prompt: matchingPrompt?.faq_prompt ?? DEFAULT_PROMPTS.faq_prompt,
          is_active: matchingPrompt?.is_active ?? true,
          version: matchingPrompt?.version ?? 1,
          priority: matchingPrompt?.priority ?? 0,
          product_type_id: matchingPrompt?.product_type_id ?? null,
          category_id: matchingPrompt?.category_id ?? null,
          subcategory_id: matchingPrompt?.subcategory_id ?? null,
          brand_override: matchingPrompt?.brand_override ?? null,
          updated_at: matchingPrompt?.updated_at,
        };
      });

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
        installation_context_id: current.installation_context_id,
        name: current.name,
        purpose: current.purpose,
        understanding_prompt: current.understanding_prompt,
        studio_prompt: current.studio_prompt,
        installed_prompt: current.installed_prompt,
        description_prompt: current.description_prompt,
        seo_prompt: current.seo_prompt,
        faq_prompt: current.faq_prompt,
        is_active: current.is_active,
        priority: current.priority,
        product_type_id: current.product_type_id || null,
        category_id: current.category_id || null,
        subcategory_id: current.subcategory_id || null,
        brand_override: current.brand_override || null,
        updated_by: user?.id,
      };

      if (current.id) {
        const { error } = await supabase
          .from("ai_prompt_templates")
          .update(payload as any)
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("ai_prompt_templates")
          .insert({ ...payload, created_by: user?.id } as any)
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) {
          handleFieldChange("id", data.id);
        }
      }

      toast.success(`Prompt templates saved for ${current.context_name}`);
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
          understanding_prompt: version.understanding_prompt,
          studio_prompt: version.studio_prompt,
          installed_prompt: version.installed_prompt,
          description_prompt: version.description_prompt,
          seo_prompt: version.seo_prompt,
          faq_prompt: version.faq_prompt,
          is_active: version.is_active,
          priority: version.priority,
          brand_override: version.brand_override,
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
    setSandboxResult(null);
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
          .replace(/{finish}/g, p.finish ?? "")
          .replace(/{material}/g, p.material ?? "")
          .replace(/{color}/g, p.color ?? "")
          .replace(/{size}/g, p.size ?? "")
          .replace(/{context}/g, currentTemplate.context_name ?? "")
          .replace(/{category}/g, cat?.name ?? "")
          .replace(/{type}/g, type?.name ?? "")
          .replace(/{subcategory}/g, sub?.name ?? "")
          .replace(/{product_type}/g, type?.name ?? "")
          .replace(/{company_name}/g, "Enreach Concepts");
      };

      setSandboxResult({
        understanding: interpolate(currentTemplate.understanding_prompt),
        description: interpolate(currentTemplate.description_prompt),
        seo: interpolate(currentTemplate.seo_prompt),
        faq: interpolate(currentTemplate.faq_prompt),
        studio: interpolate(currentTemplate.studio_prompt),
        installed: interpolate(currentTemplate.installed_prompt),
      });
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
            <Sparkles className="h-5 w-5 text-primary" /> AI Templates System
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure dynamic, context-aware prompt templates. System auto-routes triggers based on installation context, type, and categories.
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
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Context Selector List */}
        <aside className="space-y-1">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
            Context Selectors
          </h2>
          {templates.map((t, idx) => (
            <button
              key={t.installation_context_id}
              onClick={() => {
                setSelectedIdx(idx);
                setSandboxResult(null);
              }}
              className={`w-full text-left rounded-lg px-3 py-2.5 text-xs font-medium transition flex items-center justify-between ${
                selectedIdx === idx
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "border border-transparent hover:bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{t.context_name}</span>
              <span className={`text-[10px] rounded px-1.5 py-0.5 ${selectedIdx === idx ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                v{t.version}
              </span>
            </button>
          ))}
        </aside>

        {/* Main Content Area */}
        <div className="space-y-6">
          {/* Tabs header */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("editor")}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition ${
                activeTab === "editor"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Prompt Editor
            </button>
            <button
              onClick={() => setActiveTab("sandbox")}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition ${
                activeTab === "sandbox"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Sandbox Test
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition ${
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 bg-card border border-border rounded-xl p-4">
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
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Brand Override</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    placeholder="e.g. Virony"
                    value={currentTemplate.brand_override || ""}
                    onChange={(e) => handleFieldChange("brand_override", e.target.value || null)}
                    className="w-full text-xs bg-background border border-border rounded p-2 focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Product Type Match</label>
                  <select
                    disabled={!isSuperAdmin}
                    value={currentTemplate.product_type_id || ""}
                    onChange={(e) => handleFieldChange("product_type_id", e.target.value || null)}
                    className="w-full text-xs bg-background border border-border rounded p-2 focus:border-primary outline-none"
                  >
                    <option value="">Any Product Type</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category Match</label>
                  <select
                    disabled={!isSuperAdmin}
                    value={currentTemplate.category_id || ""}
                    onChange={(e) => handleFieldChange("category_id", e.target.value || null)}
                    className="w-full text-xs bg-background border border-border rounded p-2 focus:border-primary outline-none"
                  >
                    <option value="">Any Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <label className="font-medium text-muted-foreground">Routing Score / Priority</label>
                    <span className="text-[10px] text-primary font-mono font-bold">Base Score</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      disabled={!isSuperAdmin}
                      value={currentTemplate.priority}
                      onChange={(e) => handleFieldChange("priority", parseInt(e.target.value) || 0)}
                      className="w-20 bg-background border border-border rounded p-2 text-center outline-none focus:border-primary"
                    />
                    <div className="flex-1 flex items-center justify-end gap-1.5 px-3 bg-muted rounded border border-border text-[11px] text-muted-foreground">
                      <span>Status:</span>
                      <button
                        disabled={!isSuperAdmin}
                        onClick={() => handleFieldChange("is_active", !currentTemplate.is_active)}
                        className={`inline-flex items-center text-xs font-bold gap-1 transition ${currentTemplate.is_active ? 'text-emerald-600' : 'text-red-500'}`}
                      >
                        {currentTemplate.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {currentTemplate.is_active ? "Active" : "Disabled"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editor Fields */}
              <div className="space-y-5">
                {[
                  { key: "understanding_prompt", label: "1. Product Understanding Prompt", purpose: "Extracts material, color, and finish attributes from uploaded items." },
                  { key: "description_prompt", label: "2. Copywriting Prompt", purpose: "Generates long, short and marketing showroom descriptions." },
                  { key: "seo_prompt", label: "3. SEO Meta Generator Prompt", purpose: "Creates search engine title, descriptions, and tags." },
                  { key: "faq_prompt", label: "4. Buyer FAQs Prompt", purpose: "Constructs 5 key technical questions and buyer answers." },
                  { key: "studio_prompt", label: "5. Studio catalogue Prompt", purpose: "Configures Google Imagen prompt parameters for clean renders." },
                  { key: "installed_prompt", label: "6. Lifestyle Renders Prompt", purpose: "Generates photorealistic in-situ mockups." },
                ].map((field) => (
                  <div key={field.key} className="space-y-1.5 bg-card border border-border rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">{field.label}</h4>
                        <p className="text-[10px] text-muted-foreground">{field.purpose}</p>
                      </div>
                      <button
                        onClick={() => handleFieldChange(field.key as any, DEFAULT_PROMPTS[field.key as keyof typeof DEFAULT_PROMPTS])}
                        className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" /> Reset to Default
                      </button>
                    </div>
                    <textarea
                      disabled={!isSuperAdmin}
                      rows={5}
                      value={(currentTemplate as any)[field.key]}
                      onChange={(e) => handleFieldChange(field.key as any, e.target.value)}
                      className="w-full text-xs font-mono bg-background border border-border rounded p-2.5 outline-none focus:border-primary mt-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTemplate && activeTab === "sandbox" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-muted-foreground">Select Test Product</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setSandboxResult(null);
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
                    className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {testing ? "Testing..." : "Interpolate & Preview"}
                  </button>
                </div>

                <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
                  <strong>Available Sandbox Variables:</strong> <code>{`{product_name}, {brand}, {finish}, {material}, {color}, {size}, {context}, {category}, {type}, {subcategory}, {company_name}`}</code>
                </div>
              </div>

              {sandboxResult && (
                <div className="space-y-5">
                  {[
                    { key: "understanding", title: "Product Understanding Ingestion Prompt" },
                    { key: "description", title: "Showroom Description Prompt" },
                    { key: "seo", title: "SEO Title & Meta Tags Prompt" },
                    { key: "faq", title: "FAQ Structured JSON Prompt" },
                    { key: "studio", title: "Studio Imagen Prompt" },
                    { key: "installed", title: "Lifestyle In-Situ Render Prompt" },
                  ].map((s) => (
                    <div key={s.key} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
                        <span className="text-xs font-semibold">{s.title}</span>
                        <span className="text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">Compiled</span>
                      </div>
                      <pre className="text-xs font-mono bg-background text-muted-foreground border border-border rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                        {sandboxResult[s.key]}
                      </pre>
                    </div>
                  ))}
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
                    <div key={log.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                      <div className="flex justify-between items-center border-b border-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-bold">Version v{log.version}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => handleRestore(log)}
                          disabled={saving || !isSuperAdmin}
                          className="text-[10px] text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded px-2.5 py-1 font-semibold flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore Version
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 text-[11px] text-muted-foreground">
                        <div><strong>Name:</strong> {log.name}</div>
                        <div><strong>Brand Override:</strong> {log.brand_override || "None"}</div>
                        <div><strong>Priority / Active:</strong> {log.priority} / {log.is_active ? "Active" : "Disabled"}</div>
                      </div>

                      {/* Code Collapsible Summary */}
                      <details className="text-xs">
                        <summary className="cursor-pointer text-[10px] text-primary font-semibold hover:underline">Show prompt diff details</summary>
                        <div className="mt-2 space-y-2 border-t border-border pt-2 max-h-48 overflow-y-auto">
                          <div className="text-[10px] font-mono whitespace-pre-wrap"><strong className="text-foreground">Understanding:</strong> {log.understanding_prompt}</div>
                          <div className="text-[10px] font-mono whitespace-pre-wrap"><strong className="text-foreground">Description:</strong> {log.description_prompt}</div>
                          <div className="text-[10px] font-mono whitespace-pre-wrap"><strong className="text-foreground">SEO:</strong> {log.seo_prompt}</div>
                          <div className="text-[10px] font-mono whitespace-pre-wrap"><strong className="text-foreground">FAQ:</strong> {log.faq_prompt}</div>
                        </div>
                      </details>
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
