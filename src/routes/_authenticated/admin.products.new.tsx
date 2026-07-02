import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { enqueueAiPipeline } from "@/lib/pipeline";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  component: WizardPage,
});

type Tax = { id: string; name: string };
type Cat = Tax & { type_id: string };
type Sub = Tax & { category_id: string };
type Fam = Tax & { subcategory_id: string };

function WizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [types, setTypes] = useState<(Tax & { code_prefix: string })[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [fams, setFams] = useState<Fam[]>([]);

  const [type_id, setType] = useState("");
  const [category_id, setCat] = useState("");
  const [subcategory_id, setSub] = useState("");
  const [family_id, setFam] = useState("");

  const [previewCode, setPreviewCode] = useState("");

  const [form, setForm] = useState({
    name: "",
    code: "",
    production_name: "",
    finish_name: "",
    size: "",
    price: "0",
    image_url: "",
    status: "draft",
    featured_homepage: false,
    featured_feed: false,
    hidden: false,
    short_description: "",
  });
  const [saving, setSaving] = useState(false);

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

  const canNext =
    (step === 1 && !!type_id) ||
    (step === 2 && !!category_id) ||
    (step === 3 && !!subcategory_id) ||
    (step === 4 && !!family_id) ||
    step === 5;

  const create = async () => {
    if (!type_id || !category_id || !subcategory_id || !family_id) {
      toast.error("Complete the hierarchy first.");
      return;
    }
    if (!form.name.trim()) return toast.error("Product name is required");
    setSaving(true);
    const slugBase = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
      type_id,
      category_id,
      subcategory_id,
      family_id,
      name: form.name.trim(),
      code: form.code.trim() || null,
      production_name: form.production_name.trim() || null,
      finish_name: form.finish_name.trim() || null,
      size: form.size.trim() || null,
      price: Number(form.price) || 0,
      image_url: form.image_url.trim() || null,
      status: form.status as any,
      processing_state: "pending" as any,
      featured_homepage: form.featured_homepage,
      featured_feed: form.featured_feed,
      hidden: form.hidden,
      short_description: form.short_description.trim() || null,
      slug,
      is_published: form.status === "published",
    };
    const { data, error } = await supabase.from("products").insert(payload as any).select("id").single();
    if (error) { setSaving(false); return toast.error(error.message); }
    if (data?.id) {
      try { await enqueueAiPipeline(data.id); } catch (e: any) { toast.error("Pipeline queue failed: " + e.message); }
    }
    setSaving(false);
    toast.success("Product created & AI pipeline queued");
    if (data?.id) navigate({ to: "/admin/products/$id", params: { id: data.id } });
  };

  return (
    <div className="container-app py-6 max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">New Product</h1>
        <p className="text-sm text-muted-foreground">Step {step} of 5</p>
      </div>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {step === 1 && (
          <Picker label="Select Product Type" items={types} value={type_id} onChange={(v) => { setType(v); setCat(""); setSub(""); setFam(""); }} />
        )}
        {step === 2 && (
          <Picker label="Select Category" items={filteredCats} value={category_id} onChange={(v) => { setCat(v); setSub(""); setFam(""); }} empty="No categories under this type — create one in Hierarchy." />
        )}
        {step === 3 && (
          <Picker label="Select Subcategory" items={filteredSubs} value={subcategory_id} onChange={(v) => { setSub(v); setFam(""); }} empty="No subcategories — create one in Hierarchy." />
        )}
        {step === 4 && (
          <Picker label="Select Family Group" items={filteredFams} value={family_id} onChange={setFam} empty="No families — create one in Hierarchy." />
        )}
        {step === 5 && (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Product Information</h2>
            <p className="text-xs text-muted-foreground">Auto-generated code: <span className="font-mono">{previewCode || "—"}</span></p>
            <Field label="Product Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Product Code (editable)" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder={previewCode} />
            <Field label="Production Name" value={form.production_name} onChange={(v) => setForm({ ...form, production_name: v })} />
            <Field label="Finish Name" value={form.finish_name} onChange={(v) => setForm({ ...form, finish_name: v })} />
            <Field label="Size (e.g. 60×60, 30x60, 600×1200 mm)" value={form.size} onChange={(v) => setForm({ ...form, size: v })} placeholder="60×60" />
            <Field label="Price" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <Field label="Image URL" value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} placeholder="https://…" />
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Status</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {["draft", "review", "published", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-4 pt-2">
              <Check2 label="Featured on Homepage" checked={form.featured_homepage} onChange={(v) => setForm({ ...form, featured_homepage: v })} />
              <Check2 label="Featured on Feed" checked={form.featured_feed} onChange={(v) => setForm({ ...form, featured_feed: v })} />
              <Check2 label="Hidden" checked={form.hidden} onChange={(v) => setForm({ ...form, hidden: v })} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < 5 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={create}
            disabled={saving || !family_id}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {saving ? "Creating…" : "Create Product"}
          </button>
        )}
      </div>
    </div>
  );
}

function Picker({ label, items, value, onChange, empty }: {
  label: string; items: { id: string; name: string }[]; value: string; onChange: (v: string) => void; empty?: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="font-display text-lg font-semibold">{label}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty ?? "No options available."}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                value === it.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary"
              }`}
            >
              {it.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Check2({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
