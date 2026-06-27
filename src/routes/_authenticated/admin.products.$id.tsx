import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";

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

  const load = async () => {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (error) return toast.error(error.message);
    setP(data);
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
    const { error } = await supabase
      .from("products")
      .update({ ai_status: "queued", is_ai_processing: true } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("AI regeneration queued");
    // Build payload that would be sent to the AI engine
    const ctx = contexts.find((c) => c.id === p.installation_context_id)?.name ?? "default";
    console.log("[AI workflow payload]", {
      product_id: id,
      product_type: types.find((t) => t.id === p.type_id)?.name,
      category: cats.find((c) => c.id === p.category_id)?.name,
      subcategory: subs.find((s) => s.id === p.subcategory_id)?.name,
      family_group: families.find((f) => f.id === p.family_id)?.name,
      product_name: p.name,
      production_name: p.production_name,
      finish_name: p.finish_name,
      price: p.price,
      installation_context: ctx,
      uploaded_image: p.image_url,
    });
    load();
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

        {/* Images */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-display font-semibold">Image Manager</h2>
          <ImageField label="Original Uploaded Image" value={p.image_url} onChange={(v) => set("image_url", v)} />
          <ImageField label="Generated Studio Image" value={p.generated_studio_image} onChange={(v) => set("generated_studio_image", v)} />
          <ImageField label="Generated Installed Image" value={p.generated_installed_image} onChange={(v) => set("generated_installed_image", v)} />
        </section>

        {/* SEO */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-3 md:col-span-2">
          <h2 className="font-display font-semibold">SEO & Search</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="SEO Title"><input value={p.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} className={inp} /></F>
            <F label="Canonical Slug"><input value={p.canonical_slug ?? p.slug ?? ""} onChange={(e) => set("canonical_slug", e.target.value)} className={inp} /></F>
            <F label="SEO Description" wide><textarea value={p.seo_description ?? ""} onChange={(e) => set("seo_description", e.target.value)} className={`${inp} min-h-[60px]`} /></F>
            <F label="SEO Keywords (comma-separated)"><input value={arrToStr(p.seo_keywords)} onChange={(e) => set("seo_keywords", strToArr(e.target.value))} className={inp} /></F>
            <F label="App Search Keywords (internal)"><input value={arrToStr(p.app_search_keywords ?? p.app_keywords)} onChange={(e) => set("app_search_keywords", strToArr(e.target.value))} className={inp} /></F>
            <F label="Alt Text"><input value={p.alt_text ?? ""} onChange={(e) => set("alt_text", e.target.value)} className={inp} /></F>
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
function ImageField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-start gap-3">
        {value ? (
          <img src={value} alt="" className="h-20 w-20 rounded border border-border object-cover" />
        ) : (
          <div className="h-20 w-20 rounded border border-dashed border-border" />
        )}
        <div className="flex-1 space-y-2">
          <input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="https://…"
            className={inp}
          />
          {value && (
            <button onClick={() => onChange(null)} className="text-xs text-destructive hover:underline">Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
