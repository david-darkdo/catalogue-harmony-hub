import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Save, RotateCcw, HelpCircle, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/prompts")({
  head: () => ({ meta: [{ title: "AI Prompt Templates — Admin" }] }),
  component: AdminPromptsPage,
});

type PromptTemplate = {
  id: string;
  installation_context_id: string;
  understanding_prompt: string;
  studio_prompt: string;
  installed_prompt: string;
  description_prompt: string;
  seo_prompt: string;
  faq_prompt: string;
  context_name?: string;
  context_slug?: string;
};

// Hardcoded defaults for restoration fallback
const DEFAULT_PROMPTS = {
  understanding_prompt: "Analyse this product for an Abuja luxury interiors showroom.\nProduct: {product_name}\nBrand: {brand}\nFinish: {finish}\nSize: {size}\nColor: {color}\nMaterial: {material}\n\nRespond with keys: material, finish, color, style, environment, installation_context (one of luxury_bathroom, luxury_kitchen, luxury_living_room, luxury_bedroom, luxury_hotel, luxury_office, luxury_exterior, luxury_showroom, luxury_commercial), product_type, keywords (string[]), tags (string[]), confidence (0-1).",
  studio_prompt: "Professional studio product photograph of {product_name} ({material}, {finish}). Isolated on soft neutral background, museum lighting, ultra-sharp, preserve exact color/finish/material/orientation. 4k.",
  installed_prompt: "Photorealistic {context} scene featuring {product_name} installed in-situ. Preserve product identity exactly. Cinematic architectural photography, natural light, luxury Nigerian interior styling.",
  description_prompt: "Write a luxury showroom description for {product_name}, a {category} in {finish} {material}. Emphasize craftsmanship, provenance, and how it elevates a {context}. 3 short paragraphs.",
  seo_prompt: "Create SEO for {product_name}. Include seo_title (<=60), seo_description (<=155), seo_keywords (string[]), og_title, og_description, canonical_slug (kebab).",
  faq_prompt: "Generate a JSON object { faq: [{q, a}, ...] } with 5 buyer FAQs for {product_name}."
};

function AdminPromptsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"prompts" | "preview">("prompts");

  // Preview Sandbox state
  const [prevName, setPrevName] = useState("Calacatta Gold Marble");
  const [prevBrand, setPrevBrand] = useState("Stoneworks Luxury");
  const [prevMaterial, setPrevMaterial] = useState("Marble");
  const [prevFinish, setPrevFinish] = useState("Polished Slab");
  const [prevSize, setPrevSize] = useState("60x120 cm");
  const [prevColor, setPrevColor] = useState("White and Gold");
  const [prevCategory, setPrevCategory] = useState("Wall & Floor Tiles");
  const [prevType, setPrevType] = useState("Surfaces");

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: contexts, error: ctxErr } = await supabase
        .from("installation_contexts")
        .select("id, name, slug")
        .order("name");

      if (ctxErr) throw ctxErr;

      const { data: prompts, error: prErr } = await supabase
        .from("ai_prompt_templates")
        .select("*");

      if (prErr) throw prErr;

      const merged: PromptTemplate[] = (contexts ?? []).map((ctx) => {
        const matchingPrompt = (prompts ?? []).find(
          (p) => p.installation_context_id === ctx.id
        );

        return {
          id: matchingPrompt?.id ?? "",
          installation_context_id: ctx.id,
          context_name: ctx.name,
          context_slug: ctx.slug,
          understanding_prompt: matchingPrompt?.understanding_prompt ?? DEFAULT_PROMPTS.understanding_prompt,
          studio_prompt: matchingPrompt?.studio_prompt ?? DEFAULT_PROMPTS.studio_prompt,
          installed_prompt: matchingPrompt?.installed_prompt ?? DEFAULT_PROMPTS.installed_prompt,
          description_prompt: matchingPrompt?.description_prompt ?? DEFAULT_PROMPTS.description_prompt,
          seo_prompt: matchingPrompt?.seo_prompt ?? DEFAULT_PROMPTS.seo_prompt,
          faq_prompt: matchingPrompt?.faq_prompt ?? DEFAULT_PROMPTS.faq_prompt,
        };
      });

      setTemplates(merged);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load prompt templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleFieldChange = (field: keyof PromptTemplate, value: string) => {
    setTemplates((prev) =>
      prev.map((t, idx) => (idx === selectedIdx ? { ...t, [field]: value } : t))
    );
  };

  const handleResetToDefault = (field: keyof typeof DEFAULT_PROMPTS) => {
    if (confirm("Are you sure you want to reset this field to default templates?")) {
      handleFieldChange(field, DEFAULT_PROMPTS[field]);
      toast.success("Reset successfully. Click Save to commit.");
    }
  };

  const handleSave = async () => {
    const current = templates[selectedIdx];
    if (!current) return;

    setSaving(true);
    try {
      const payload = {
        installation_context_id: current.installation_context_id,
        understanding_prompt: current.understanding_prompt,
        studio_prompt: current.studio_prompt,
        installed_prompt: current.installed_prompt,
        description_prompt: current.description_prompt,
        seo_prompt: current.seo_prompt,
        faq_prompt: current.faq_prompt,
      };

      if (current.id) {
        // Update
        const { error } = await supabase
          .from("ai_prompt_templates")
          .update(payload as any)
          .eq("id", current.id);
        if (error) throw error;
      } else {
        // Insert
        const { data, error } = await supabase
          .from("ai_prompt_templates")
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) {
          setTemplates((prev) =>
            prev.map((t, idx) => (idx === selectedIdx ? { ...t, id: data.id } : t))
          );
        }
      }
      toast.success(`Prompt templates saved for ${current.context_name}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save templates");
    } finally {
      setSaving(false);
    }
  };

  const currentTemplate = templates[selectedIdx];

  const interpolate = (txt: string) => {
    if (!txt) return "";
    return txt
      .replace(/{product_name}/g, prevName)
      .replace(/{brand}/g, prevBrand)
      .replace(/{finish}/g, prevFinish)
      .replace(/{material}/g, prevMaterial)
      .replace(/{color}/g, prevColor)
      .replace(/{size}/g, prevSize)
      .replace(/{context}/g, currentTemplate?.context_name ?? "luxury showroom")
      .replace(/{category}/g, prevCategory)
      .replace(/{type}/g, prevType)
      .replace(/{product_type}/g, prevType)
      .replace(/{company_name}/g, "Enreach Concepts")
      .replace(/{company_email}/g, "info@enreach.co")
      .replace(/{company_address}/g, "Abuja luxury interiors showroom")
      .replace(/{company_phone}/g, "+234...");
  };

  if (loading) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading prompts engine...</div>;
  }

  return (
    <div className="container-app py-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Prompt Templates Engine
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure dynamic instructions for each installation context. Supports placeholder tokens replacement and live sandbox validation.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Context Selector Sidebar */}
        <aside className="space-y-1">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-2">
            Installation Contexts
          </h2>
          {templates.map((t, idx) => (
            <button
              key={t.installation_context_id}
              onClick={() => setSelectedIdx(idx)}
              className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition ${
                selectedIdx === idx
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.context_name}
            </button>
          ))}
        </aside>

        {/* Editor Console */}
        <main className="space-y-4">
          {currentTemplate && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Card Header & Editor Mode Tabs */}
              <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3 gap-3">
                <div>
                  <h3 className="font-display font-semibold text-sm">
                    Editing templates for <span className="text-primary">{currentTemplate.context_name}</span>
                  </h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider mt-0.5">
                    Context ID: {currentTemplate.installation_context_id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex border border-border rounded-lg overflow-hidden bg-background p-0.5">
                    <button
                      onClick={() => setActiveTab("prompts")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
                        activeTab === "prompts"
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Sparkles className="h-3 w-3" /> Prompts
                    </button>
                    <button
                      onClick={() => setActiveTab("preview")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
                        activeTab === "preview"
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Eye className="h-3 w-3" /> Live Sandbox
                    </button>
                  </div>

                  <button
                    disabled={saving}
                    onClick={handleSave}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 shadow-sm"
                  >
                    <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {activeTab === "prompts" ? (
                /* Prompts Form Area */
                <div className="p-4 space-y-4">
                  {/* Token Helpers Banner */}
                  <div className="rounded-lg bg-muted/30 border border-border p-3 flex gap-2">
                    <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">Available Tokens Placeholder:</p>
                      <p className="text-muted-foreground leading-relaxed">
                        Insert these templates variables to auto-replace on trigger:{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{product_name}`}</code>,{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{brand}`}</code>,{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{finish}`}</code>,{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{material}`}</code>,{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{color}`}</code>,{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{size}`}</code>,{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{context}`}</code>,{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{category}`}</code>,{" "}
                        <code className="text-primary font-mono bg-background px-1 py-0.5 rounded">{`{type}`}</code>.
                      </p>
                    </div>
                  </div>

                  <PromptField
                    label="Understanding Prompt (Gemini)"
                    value={currentTemplate.understanding_prompt}
                    onChange={(val) => handleFieldChange("understanding_prompt", val)}
                    onReset={() => handleResetToDefault("understanding_prompt")}
                  />

                  <PromptField
                    label="Studio Background Image Prompt (Imagen 3)"
                    value={currentTemplate.studio_prompt}
                    onChange={(val) => handleFieldChange("studio_prompt", val)}
                    onReset={() => handleResetToDefault("studio_prompt")}
                  />

                  <PromptField
                    label="In-Situ Environment Image Prompt (Imagen 3)"
                    value={currentTemplate.installed_prompt}
                    onChange={(val) => handleFieldChange("installed_prompt", val)}
                    onReset={() => handleResetToDefault("installed_prompt")}
                  />

                  <PromptField
                    label="Showroom Description Prompt (Gemini)"
                    value={currentTemplate.description_prompt}
                    onChange={(val) => handleFieldChange("description_prompt", val)}
                    onReset={() => handleResetToDefault("description_prompt")}
                  />

                  <PromptField
                    label="SEO Engine Prompt (Gemini)"
                    value={currentTemplate.seo_prompt}
                    onChange={(val) => handleFieldChange("seo_prompt", val)}
                    onReset={() => handleResetToDefault("seo_prompt")}
                  />

                  <PromptField
                    label="FaqPage Generator Prompt (Gemini)"
                    value={currentTemplate.faq_prompt}
                    onChange={(val) => handleFieldChange("faq_prompt", val)}
                    onReset={() => handleResetToDefault("faq_prompt")}
                  />
                </div>
              ) : (
                /* Interactive Sandbox Preview Area */
                <div className="p-4 grid gap-4 lg:grid-cols-[300px_1fr]">
                  {/* Mock Sandbox Inputs */}
                  <div className="space-y-3 bg-muted/20 border border-border rounded-xl p-4">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold border-b pb-2">
                      Mock Product Variables
                    </h4>
                    <SandboxInput label="Name" value={prevName} onChange={setPrevName} />
                    <SandboxInput label="Brand" value={prevBrand} onChange={setPrevBrand} />
                    <SandboxInput label="Material" value={prevMaterial} onChange={setPrevMaterial} />
                    <SandboxInput label="Finish" value={prevFinish} onChange={setPrevFinish} />
                    <SandboxInput label="Size" value={prevSize} onChange={setPrevSize} />
                    <SandboxInput label="Color" value={prevColor} onChange={setPrevColor} />
                    <SandboxInput label="Category" value={prevCategory} onChange={setPrevCategory} />
                    <SandboxInput label="Product Type" value={prevType} onChange={setPrevType} />
                  </div>

                  {/* Sandbox Prompts Outputs */}
                  <div className="space-y-4">
                    <SandboxPreview label="Understanding Prompt Output" value={interpolate(currentTemplate.understanding_prompt)} />
                    <SandboxPreview label="Studio Image Prompt Output" value={interpolate(currentTemplate.studio_prompt)} />
                    <SandboxPreview label="In-Situ Image Prompt Output" value={interpolate(currentTemplate.installed_prompt)} />
                    <SandboxPreview label="Description Prompt Output" value={interpolate(currentTemplate.description_prompt)} />
                    <SandboxPreview label="SEO Prompt Output" value={interpolate(currentTemplate.seo_prompt)} />
                    <SandboxPreview label="FAQ Prompt Output" value={interpolate(currentTemplate.faq_prompt)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PromptField({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">{label}</label>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition font-medium"
        >
          <RotateCcw className="h-3 w-3" /> Reset default
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-sans outline-none focus:border-primary leading-relaxed resize-y"
      />
    </div>
  );
}

function SandboxInput({ label, value, onChange }: { label: string; value: string; onChange: (val: string) => void }) {
  return (
    <label className="block space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
      />
    </label>
  );
}

function SandboxPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground block">{label}</label>
      <pre className="w-full rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed whitespace-pre-wrap font-mono break-all text-foreground select-all">
        {value}
      </pre>
    </div>
  );
}
