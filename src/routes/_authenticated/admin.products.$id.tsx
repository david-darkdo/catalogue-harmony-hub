import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Trash2, Activity } from "lucide-react";
import { regenerateWithHashGuard } from "@/lib/pipeline";
import { ImageUploader, ImageTile, publicImageUrl, deleteStorageObject } from "@/components/ImageUploader";

type AssetRow = {
  id: string; product_id: string; asset_type: "original" | "studio" | "installed" | "gallery";
  asset_url: string; is_primary: boolean; generated_by_ai: boolean; generation_version: number;
};

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  component: EditPage,
});

const STATUSES = ["draft", "review", "published", "archived"] as const;
const AI_STATUSES = ["idle", "queued", "processing", "ready", "failed"] as const;

function EditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [contexts, setContexts] = useState<{ id: string; name: string }[]>([]);
  const [families, setFamilies] = useState<{ id: string; name: string; subcategory_id: string }[]>([]);
  const [subs, setSubs] = useState<{ id: string; name: string; category_id: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string; type_id: string }[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const loadAssets = useCallback(async () => {
    const { data } = await supabase.from("product_assets").select("*").eq("product_id", id).order("created_at");
    setAssets((data ?? []) as any);
  }, [id]);

  const load = async () => {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (error) return toast.error(error.message);
    setP(data);
    loadAssets();
  };
  useEffect(() => {
    load();
    (async () => {
      const [t, c, s, f, ic] = await Promise.all([
        supabase.from("product_types").select("id,name").order("name"),
        supabase.from("categories").select("id,name,type_id").order("name"),
        supabase.from("subcategories").select("id,name,category_id").order("name"),
        supabase.from("family_groups").select("id,name,subcategory_id").order("name"),
        supabase.from("installation_contexts").select("id,name").order("name"),
      ]);
      setTypes((t.data ?? []) as any);
      setCats((c.data ?? []) as any);
      setSubs((s.data ?? []) as any);
      setFamilies((f.data ?? []) as any);
      setContexts((ic.data ?? []) as any);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!p) return <div className="container-app py-10 text-sm text-muted-foreground">Loading…</div>;

  const set = (k: string, v: any) => setP((prev: any) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = {
      ...p,
      is_published: p.status === "published",
      price: Number(p.price) || 0,
    };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.similar_product_ids;
    const { error } = await supabase.from("products").update(payload as any).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    load();
  };

  const regenAi = async () => {
    try {
      const res = await regenerateWithHashGuard(id);
      if (res.skipped) {
        if (!confirm(res.reason + "\n\nRegenerate anyway?")) return;
        await regenerateWithHashGuard(id, { force: true });
      }
      toast.success("AI pipeline queued");
      load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const arrToStr = (v: any) => (Array.isArray(v) ? v.join(", ") : v ?? "");
  const strToArr = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="container-app py-6 max-w-5xl space-y-5">
      <Link to="/admin/products" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to library
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">{p.name}</h1>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-mono">{p.code}</span>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-primary">{p.status}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground"><Activity className="h-3 w-3" />{p.processing_state ?? "draft"} · v{p.generation_version ?? 0}</span>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">AI: {p.ai_status}</span>
        <button onClick={save} disabled={saving} className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Core info */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-display font-semibold">Core</h2>
          <F label="Name"><input value={p.name ?? ""} onChange={(e) => set("name", e.target.value)} className={inp} /></F>
          <F label="Code"><input value={p.code ?? ""} onChange={(e) => set("code", e.target.value)} className={`${inp} font-mono`} /></F>
          <F label="Production Name"><input value={p.production_name ?? ""} onChange={(e) => set("production_name", e.target.value)} className={inp} /></F>
          <F label="Finish Name"><input value={p.finish_name ?? ""} onChange={(e) => set("finish_name", e.target.value)} className={inp} /></F>
          <F label="Size (auto-normalized)"><input value={p.size ?? ""} onChange={(e) => set("size", e.target.value)} className={inp} placeholder="60×60" /></F>
          <F label="Price"><input type="number" value={p.price ?? 0} onChange={(e) => set("price", e.target.value)} className={inp} /></F>
          <F label="Short Description"><textarea value={p.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} className={`${inp} min-h-[80px]`} /></F>
        </section>

        {/* Hierarchy */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-display font-semibold">Hierarchy</h2>
          <F label="Type"><SelectBox value={p.type_id ?? ""} onChange={(v) => set("type_id", v || null)} items={types} /></F>
          <F label="Category"><SelectBox value={p.category_id ?? ""} onChange={(v) => set("category_id", v || null)} items={cats.filter((c) => !p.type_id || c.type_id === p.type_id)} /></F>
          <F label="Subcategory"><SelectBox value={p.subcategory_id ?? ""} onChange={(v) => set("subcategory_id", v || null)} items={subs.filter((s) => !p.category_id || s.category_id === p.category_id)} /></F>
          <F label="Family Group"><SelectBox value={p.family_id ?? ""} onChange={(v) => set("family_id", v || null)} items={families.filter((f) => !p.subcategory_id || f.subcategory_id === p.subcategory_id)} /></F>
        </section>

        {/* Visibility */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-display font-semibold">Status & Visibility</h2>
          <F label="Status">
            <select value={p.status} onChange={(e) => set("status", e.target.value)} className={inp}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </F>
          <div className="flex flex-wrap gap-4 pt-1">
            <Chk label="Featured Homepage" checked={!!p.featured_homepage} onChange={(v) => set("featured_homepage", v)} />
            <Chk label="Featured Feed" checked={!!p.featured_feed} onChange={(v) => set("featured_feed", v)} />
            <Chk label="Hidden" checked={!!p.hidden} onChange={(v) => set("hidden", v)} />
          </div>
        </section>

        {/* Asset Manager */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Asset Manager</h2>
            <span className="text-xs text-muted-foreground">
              Mode: <span className="font-medium">{p.image_mode ?? "manual"}</span>
            </span>
          </div>
          <AssetManager
            productId={id}
            assets={assets}
            onChange={async () => { await loadAssets(); await load(); }}
            imageMode={p.image_mode ?? "manual"}
          />
        </section>

        {/* Image Mode */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-display font-semibold">Image Mode</h2>
          <select value={p.image_mode ?? "manual"} onChange={(e) => set("image_mode", e.target.value)} className={inp}>
            <option value="manual">Manual — no AI image generation</option>
            <option value="ai">AI Generation — from one reference photo</option>
            <option value="hybrid">Hybrid — your images + AI text</option>
          </select>
          <p className="text-xs text-muted-foreground">Change and save, then Regenerate to apply.</p>
        </section>
        {/* Discovery Readiness Score Card */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Discovery Readiness
          </h2>
          {(() => {
            const { score, missing } = getReadiness(p, assets);
            return (
              <>
                <div className="flex items-center gap-3">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5">
                    <span className="text-sm font-bold font-mono text-primary">{score}%</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Needs Work" : "Incomplete"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Technical SEO & indexing check</p>
                  </div>
                </div>
                {missing.length > 0 ? (
                  <div className="space-y-1 border-t border-border/60 pt-2 text-[11px]">
                    <span className="font-semibold text-amber-600">Pending Actions:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                      {missing.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[11px] text-green-600 font-medium pt-1">
                    ✓ All discovery settings are complete and optimized!
                  </p>
                )}
              </>
            );
          })()}
        </section>


        {/* SEO & Search Management */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3 md:col-span-2">
          <h2 className="font-display font-semibold">SEO, Search & Image Assets Metadata</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <F label="SEO Title">
                <input
                  value={p.seo_title ?? ""}
                  onChange={(e) => {
                    set("seo_title", e.target.value);
                    set("seo_title_manual", true);
                  }}
                  className={inp}
                />
              </F>
              <Chk
                label="Override AI title updates"
                checked={!!p.seo_title_manual}
                onChange={(v) => set("seo_title_manual", v)}
              />
            </div>
            
            <F label="Canonical Slug">
              <input
                value={p.canonical_slug ?? p.slug ?? ""}
                onChange={(e) => set("canonical_slug", e.target.value)}
                className={inp}
              />
            </F>
            
            <div className="space-y-1 sm:col-span-2">
              <F label="SEO Description">
                <textarea
                  value={p.seo_description ?? ""}
                  onChange={(e) => {
                    set("seo_description", e.target.value);
                    set("seo_description_manual", true);
                  }}
                  className={`${inp} min-h-[60px]`}
                />
              </F>
              <Chk
                label="Override AI description updates"
                checked={!!p.seo_description_manual}
                onChange={(v) => set("seo_description_manual", v)}
              />
            </div>

            <div className="space-y-1">
              <F label="SEO Keywords (comma-separated)">
                <input
                  value={arrToStr(p.seo_keywords)}
                  onChange={(e) => {
                    set("seo_keywords", strToArr(e.target.value));
                    set("seo_keywords_manual", true);
                  }}
                  className={inp}
                />
              </F>
              <Chk
                label="Override AI keywords updates"
                checked={!!p.seo_keywords_manual}
                onChange={(v) => set("seo_keywords_manual", v)}
              />
            </div>

            <F label="App Search Keywords (internal)">
              <input
                value={arrToStr(p.app_search_keywords ?? p.app_keywords)}
                onChange={(e) => set("app_search_keywords", strToArr(e.target.value))}
                className={inp}
              />
            </F>

            <div className="border-t border-border/40 sm:col-span-2 pt-3 my-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Image SEO Settings
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Image Alt Text">
                  <input
                    value={p.alt_text ?? ""}
                    onChange={(e) => set("alt_text", e.target.value)}
                    className={inp}
                  />
                </F>
                <F label="Image Title">
                  <input
                    value={p.image_title ?? ""}
                    onChange={(e) => set("image_title", e.target.value)}
                    className={inp}
                  />
                </F>
                <F label="Image Caption">
                  <input
                    value={p.image_caption ?? ""}
                    onChange={(e) => set("image_caption", e.target.value)}
                    className={inp}
                  />
                </F>
                <F label="SEO Image Filename">
                  <input
                    value={p.image_filename ?? ""}
                    onChange={(e) => set("image_filename", e.target.value)}
                    className={inp}
                    placeholder="e.g. virony-white-polished-tile"
                  />
                </F>
              </div>
            </div>
          </div>
        </section>

        {/* AI Control Center */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Control Center</h2>
            <button onClick={regenAi} className="rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10">
              {p.ai_status === "idle" ? "Generate AI Assets" : "Regenerate AI Assets"}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Installation Context">
              <select value={p.installation_context_id ?? ""} onChange={(e) => set("installation_context_id", e.target.value || null)} className={inp}>
                <option value="">— none —</option>
                {contexts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </F>
            <F label="AI Status">
              <select value={p.ai_status} onChange={(e) => set("ai_status", e.target.value)} className={inp}>
                {AI_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </F>
            <F label="Generated Description" wide>
              <textarea value={p.generated_description ?? ""} onChange={(e) => set("generated_description", e.target.value)} className={`${inp} min-h-[80px]`} />
            </F>
          </div>
        </section>

        {/* Similar */}
        <section className="rounded-xl border border-border bg-card p-5 md:col-span-2">
          <h2 className="font-display font-semibold">Similar Products (auto)</h2>
          <p className="text-xs text-muted-foreground">Priority: Family Group → Subcategory → Category. Recomputed on save.</p>
          <p className="mt-2 text-xs font-mono break-all">{(p.similar_product_ids ?? []).join(", ") || "—"}</p>
          <button
            onClick={async () => {
              const { error } = await supabase.rpc("recompute_similar_products", { _product_id: id } as any);
              if (error) return toast.error(error.message);
              toast.success("Recomputed");
              load();
            }}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary"
          >Recompute now</button>
        </section>

        {/* Danger */}
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 md:col-span-2">
          <h2 className="font-display font-semibold text-destructive flex items-center gap-2"><Trash2 className="h-4 w-4" /> Danger Zone</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.deleted_at ? (
              <button onClick={async () => { await supabase.from("products").update({ deleted_at: null } as any).eq("id", id); toast.success("Restored"); load(); }} className="rounded-md border border-border px-3 py-1.5 text-xs">Restore</button>
            ) : (
              <button onClick={async () => { await supabase.from("products").update({ deleted_at: new Date().toISOString() } as any).eq("id", id); toast.success("Soft deleted"); load(); }} className="rounded-md border border-amber-500/40 px-3 py-1.5 text-xs text-amber-600">Soft Delete</button>
            )}
            <button
              onClick={async () => {
                if (!confirm("Permanently delete this product?")) return;
                const { error } = await supabase.from("products").delete().eq("id", id);
                if (error) return toast.error(error.message);
                toast.success("Deleted");
                navigate({ to: "/admin/products" });
              }}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            >Permanent Delete</button>
          </div>
        </section>
      </div>
    </div>
  );
}

const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function SelectBox({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: { id: string; name: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
      <option value="">— none —</option>
      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  );
}
function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function AssetManager({
  productId, assets, onChange, imageMode,
}: {
  productId: string;
  assets: AssetRow[];
  onChange: () => Promise<void> | void;
  imageMode: string;
}) {
  const insert = async (paths: string[], asset_type: AssetRow["asset_type"]) => {
    if (!paths.length) return;
    const rows = paths.map((p) => ({
      product_id: productId,
      asset_type,
      asset_url: p,
      is_primary: false,
      generated_by_ai: false,
    }));
    const { error } = await supabase.from("product_assets").insert(rows as any);
    if (error) return toast.error(error.message);
    // If nothing was primary yet, promote the first upload of the primary group.
    const originals = assets.filter((a) => a.asset_type === "original");
    if (asset_type === "original" && !originals.some((a) => a.is_primary)) {
      const { data } = await supabase.from("product_assets").select("id").eq("product_id", productId).eq("asset_type", "original").order("created_at").limit(1);
      const first = (data ?? [])[0] as any;
      if (first) {
        await supabase.from("product_assets").update({ is_primary: true } as any).eq("id", first.id);
        await supabase.from("products").update({ image_url: paths[0] } as any).eq("id", productId);
      }
    }
    await onChange();
  };

  const setPrimary = async (a: AssetRow) => {
    await supabase.from("product_assets").update({ is_primary: false } as any).eq("product_id", productId).eq("asset_type", a.asset_type);
    await supabase.from("product_assets").update({ is_primary: true } as any).eq("id", a.id);
    const patch: any = {};
    if (a.asset_type === "original") patch.image_url = a.asset_url;
    if (a.asset_type === "studio") patch.generated_studio_image = a.asset_url;
    if (a.asset_type === "installed") patch.generated_installed_image = a.asset_url;
    if (Object.keys(patch).length) await supabase.from("products").update(patch).eq("id", productId);
    toast.success(`Primary ${a.asset_type} set`);
    await onChange();
  };

  const remove = async (a: AssetRow) => {
    if (!confirm("Delete this image?")) return;
    await deleteStorageObject(a.asset_url);
    await supabase.from("product_assets").delete().eq("id", a.id);
    toast.success("Deleted");
    await onChange();
  };

  const groups: AssetRow["asset_type"][] = ["original", "studio", "installed", "gallery"];

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const list = assets.filter((a) => a.asset_type === g);
        const acceptMultiple = g === "gallery" || g === "original";
        const canUploadHere = !(imageMode === "ai" && (g === "studio" || g === "installed"));
        return (
          <div key={g} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold capitalize">{g} images</h3>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {list.length} file{list.length === 1 ? "" : "s"}
              </span>
            </div>
            {canUploadHere && (
              <ImageUploader
                productId={productId}
                multiple={acceptMultiple}
                label={`Upload ${g}`}
                compact
                onUploaded={async (paths) => { await insert(paths, g); }}
              />
            )}
            {list.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {list.map((a) => (
                  <ImageTile
                    key={a.id}
                    url={publicImageUrl(a.asset_url)!}
                    isPrimary={a.is_primary}
                    badge={a.generated_by_ai ? "AI" : undefined}
                    onSetPrimary={() => setPrimary(a)}
                    onDelete={() => remove(a)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getReadiness(p: any, assets: any[]) {
  const checks = [
    { name: "Product Name", ok: !!p.name, points: 10, msg: "Add a product name" },
    { name: "Description", ok: !!(p.short_description || p.generated_description), points: 20, msg: "Add a short description or run AI" },
    { name: "Primary Image", ok: !!(p.image_url || assets.some(a => a.is_primary)), points: 20, msg: "Upload at least one primary product image" },
    { name: "SEO Title", ok: !!p.seo_title, points: 10, msg: "Enter an SEO Title or generate with AI" },
    { name: "SEO Description", ok: !!p.seo_description, points: 10, msg: "Enter an SEO Description or generate with AI" },
    { name: "Structured Data", ok: !!(p.structured_data || p.faq), points: 10, msg: "FAQ/Structured data generated or added" },
    { name: "Canonical URL / Slug", ok: !!(p.canonical_slug || p.slug), points: 10, msg: "Define a slug or canonical slug" },
    { name: "Taxonomy & Pricing", ok: !!(p.type_id && p.category_id && Number(p.price) > 0), points: 5, msg: "Choose Type/Category & price > 0" },
    { name: "Product Code", ok: !!p.code, points: 5, msg: "Enter a unique product code" },
  ];
  const score = checks.reduce((acc, c) => acc + (c.ok ? c.points : 0), 0);
  const missing = checks.filter(c => !c.ok).map(c => c.msg);
  return { score, missing };
}


