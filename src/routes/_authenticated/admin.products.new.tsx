import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Sparkles, Upload, FileText, Globe } from "lucide-react";
import { enqueueAiPipeline } from "@/lib/pipeline";
import { runProductPipeline } from "@/lib/ai-pipeline.functions";
import { runProductDetailsEngine } from "@/lib/product-details.functions";
import { ImageUploader, ImageTile, publicImageUrl, deleteStorageObject } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  head: () => ({ meta: [{ title: "Create New Product — Admin" }] }),
  component: UnifiedNewProductPage,
});

type Tax = { id: string; name: string };
type Cat = Tax & { type_id: string };
type Sub = Tax & { category_id: string };
type Fam = Tax & { subcategory_id: string };

function UnifiedNewProductPage() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<(Tax & { code_prefix: string })[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [fams, setFams] = useState<Fam[]>([]);

  // Selected hierarchy IDs
  const [type_id, setType] = useState("");
  const [category_id, setCat] = useState("");
  const [subcategory_id, setSub] = useState("");
  const [family_id, setFam] = useState("");

  const [previewCode, setPreviewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAiMode, setIsAiMode] = useState(true);

  // Uploaded media paths
  const [originalPath, setOriginalPath] = useState<string | null>(null);
  const [installedPath, setInstalledPath] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    production_name: "",
    finish_name: "",
    brand: "",
    size: "",
    price: "0",
    status: "published",
    featured_homepage: false,
    featured_feed: false,
    hidden: false,
    description: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
  });

  useEffect(() => {
    (async () => {
      const [t, c, s, f] = await Promise.all([
        supabase.from("product_types").select("id,name,code_prefix").order("name"),
        supabase.from("categories").select("id,name,type_id").order("name"),
        supabase.from("subcategories").select("id,name,category_id").order("name"),
        supabase.from("family_groups").select("id,name,subcategory_id").order("name"),
      ]);
      setTypes((t.data ?? []) as any);
      setCats((c.data ?? []) as any);
      setSubs((s.data ?? []) as any);
      setFams((f.data ?? []) as any);
    })();
  }, []);

  useEffect(() => {
    if (!type_id) return setPreviewCode("");
    (async () => {
      const { data } = await supabase.rpc("generate_product_code", { _type_id: type_id } as any);
      if (typeof data === "string") {
        setPreviewCode(data);
        setForm((f) => ({ ...f, code: f.code || data }));
      }
    })();
  }, [type_id]);

  const filteredCats = useMemo(() => cats.filter((c) => c.type_id === type_id), [cats, type_id]);
  const filteredSubs = useMemo(() => subs.filter((s) => s.category_id === category_id), [subs, category_id]);
  const filteredFams = useMemo(() => fams.filter((f) => f.subcategory_id === subcategory_id), [fams, subcategory_id]);

  const create = async () => {
    if (!type_id || !category_id || !subcategory_id || !family_id) {
      toast.error("Please complete the classification hierarchy.");
      return;
    }
    if (!form.name.trim()) return toast.error("Product name is required.");
    if (!originalPath) return toast.error("Original Product Image is required.");

    setSaving(true);
    const slugBase = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    const keywordsArray = form.seo_keywords
      ? form.seo_keywords.split(",").map(k => k.trim()).filter(Boolean)
      : [];

    const payload = {
      type_id,
      category_id,
      subcategory_id,
      family_id,
      name: form.name.trim(),
      code: form.code.trim() || null,
      production_name: form.production_name.trim() || null,
      finish_name: form.finish_name.trim() || null,
      brand: form.brand.trim() || null,
      size: form.size.trim() || null,
      price: Number(form.price) || 0,
      image_url: originalPath,
      image_mode: isAiMode ? "ai" : "manual",
      status: isAiMode ? "draft" : form.status,
      processing_state: isAiMode ? "pending" : "completed",
      featured_homepage: form.featured_homepage,
      featured_feed: form.featured_feed,
      hidden: form.hidden,
      short_description: isAiMode ? null : (form.description.trim() || null),
      generated_description: isAiMode ? null : (form.description.trim() || null),
      seo_title: isAiMode ? null : (form.seo_title.trim() || null),
      seo_description: isAiMode ? null : (form.seo_description.trim() || null),
      seo_keywords: isAiMode ? null : keywordsArray,
      seo_title_manual: !isAiMode,
      seo_description_manual: !isAiMode,
      seo_keywords_manual: !isAiMode,
      slug,
      is_published: !isAiMode,
      generated_installed_image: installedPath || null,
    };

    const { data, error } = await supabase.from("products").insert(payload as any).select("id").single();
    
    if (error) { 
      setSaving(false); 
      return toast.error(error.message); 
    }

    if (data?.id) {
      // Add primary original asset
      const assets = [
        {
          product_id: data.id,
          asset_type: "original" as const,
          asset_url: originalPath,
          is_primary: true,
          generated_by_ai: false,
        }
      ];

      // Add finished installation asset if provided manually
      if (installedPath) {
        assets.push({
          product_id: data.id,
          asset_type: "installed" as any,
          asset_url: installedPath,
          is_primary: false,
          generated_by_ai: false,
        });
      }

      await supabase.from("product_assets").insert(assets as any);

      if (isAiMode) {
        try {
          runProductDetailsFn({ data: { productId: data.id } }).catch((e: any) => {
            console.error("Product Details Engine failed:", e);
          });
          toast.success("Product created & Product Details Engine started!");
        } catch (e: any) {
          console.error("Engine 1 failed:", e);
          toast.error("Product created but Product Details Engine failed.");
        }
      } else {
        toast.success("Product created & published!");
      }

      navigate({ to: "/admin/products/$id", params: { id: data.id } });
    }
    setSaving(false);
  };

  return (
    <div className="container-app py-8 max-w-5xl space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">Add New Product</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ingest products into the luxury showroom catalog. Fill specs, upload original images, and choose AI automated processing or manual entry.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Form Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Classification Section */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              Product Classification
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Product Type *
                <select
                  value={type_id}
                  onChange={(e) => { setType(e.target.value); setCat(""); setSub(""); setFam(""); }}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">Select Type...</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Category *
                <select
                  value={category_id}
                  onChange={(e) => { setCat(e.target.value); setSub(""); setFam(""); }}
                  disabled={!type_id}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">Select Category...</option>
                  {filteredCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Subcategory *
                <select
                  value={subcategory_id}
                  onChange={(e) => { setSub(e.target.value); setFam(""); }}
                  disabled={!category_id}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">Select Subcategory...</option>
                  {filteredSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Family Group *
                <select
                  value={family_id}
                  onChange={(e) => setFam(e.target.value)}
                  disabled={!subcategory_id}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">Select Family...</option>
                  {filteredFams.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Media Section */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              Product Media
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Original Product Image */}
              <div className="space-y-2">
                <span className="block text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Original Product Image (Source of Truth) *
                </span>
                {originalPath ? (
                  <div className="relative aspect-square max-w-[200px] border border-border rounded-lg overflow-hidden group">
                    <img src={publicImageUrl(originalPath)!} className="object-cover w-full h-full" alt="Original" />
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteStorageObject(originalPath);
                        setOriginalPath(null);
                      }}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 text-xs shadow-md"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <ImageUploader
                    multiple={false}
                    onUploaded={(paths) => setOriginalPath(paths[0] || null)}
                  />
                )}
              </div>

              {/* Finished Installation Image */}
              <div className="space-y-2">
                <span className="block text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Finished Installation Image (Optional)
                </span>
                {installedPath ? (
                  <div className="relative aspect-square max-w-[200px] border border-border rounded-lg overflow-hidden group">
                    <img src={publicImageUrl(installedPath)!} className="object-cover w-full h-full" alt="Installation" />
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteStorageObject(installedPath);
                        setInstalledPath(null);
                      }}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 text-xs shadow-md"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <ImageUploader
                    multiple={false}
                    onUploaded={(paths) => setInstalledPath(paths[0] || null)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Specifications Section */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              Product Specifications
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Product Code (Editable)" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder={previewCode} />
              <Field label="Manufacturer / Brand" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
              <Field label="Production Name" value={form.production_name} onChange={(v) => setForm({ ...form, production_name: v })} />
              <Field label="Finish Name" value={form.finish_name} onChange={(v) => setForm({ ...form, finish_name: v })} />
              <Field label="Display Size (e.g. 60×60, 30x60, 600×1200 mm)" value={form.size} onChange={(v) => setForm({ ...form, size: v })} placeholder="60×60 cm" />
              <Field label="Price (NGN)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            </div>
          </div>
        </div>

        {/* Right Column: AI Engine settings & Publish */}
        <div className="space-y-6">
          {/* AI Settings Box */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Operating System
            </h2>

            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium">Enable AI Mode</span>
              <button
                type="button"
                onClick={() => setIsAiMode(!isAiMode)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  isAiMode ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isAiMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {isAiMode ? (
              <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-2">
                <p className="font-medium text-primary flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Fully Automated Pipeline
                </p>
                <p>Upon clicking Create Product, the AI Operating System will run: Product Understanding, SEO, Lifestyle Rendering, Synonyms, Recommendations, and Quality Validation.</p>
                <p className="font-semibold">It will auto-publish once validation checks pass.</p>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 space-y-2">
                <p className="font-medium text-amber-600 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Manual Ingestion Mode
                </p>
                <p>AI pipelines are bypassed. You are responsible for entering copywriting descriptions, keywords, and SEO parameters manually.</p>
                <p className="font-semibold">Product publishes immediately upon creation.</p>
              </div>
            )}
          </div>

          {/* Manual Mode Fields (conditionally shown) */}
          {!isAiMode && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Manual Copywriting & SEO
              </h2>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Product Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the product material, design language, and finish details..."
                  className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>

              <Field label="SEO Title" value={form.seo_title} onChange={(v) => setForm({ ...form, seo_title: v })} placeholder="Recommended length <= 60 chars" />
              
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Meta Description</span>
                <textarea
                  value={form.seo_description}
                  onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                  placeholder="Summary for Google Search snippets..."
                  className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>

              <Field label="Meta Keywords (Comma separated)" value={form.seo_keywords} onChange={(v) => setForm({ ...form, seo_keywords: v })} placeholder="e.g. marble, travertine, floor tiles" />

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Publishing Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="draft">Draft</option>
                  <option value="review">Review</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
          )}

          {/* Visibility and Flags */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="font-display text-sm font-semibold">Visibility Settings</h2>
            <div className="space-y-2">
              <Check2 label="Featured on Homepage" checked={form.featured_homepage} onChange={(v) => setForm({ ...form, featured_homepage: v })} />
              <Check2 label="Featured on Feed" checked={form.featured_feed} onChange={(v) => setForm({ ...form, featured_feed: v })} />
              <Check2 label="Hidden (Hide from catalog)" checked={form.hidden} onChange={(v) => setForm({ ...form, hidden: v })} />
            </div>
          </div>

          {/* Create Button */}
          <button
            type="button"
            onClick={create}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold py-3 text-sm transition hover:bg-primary/95 disabled:opacity-50 shadow-md cursor-pointer"
          >
            {saving ? (
              <span>Creating Product...</span>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Create Product</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block text-sm w-full">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none text-foreground focus:border-primary"
      />
    </label>
  );
}

function Check2({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground select-none cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
      />
      {label}
    </label>
  );
}
