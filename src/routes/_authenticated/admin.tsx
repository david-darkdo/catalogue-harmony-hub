import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/lib/settings";
import { toast } from "sonner";
import { Search, Settings as SettingsIcon, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Stoneworks" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { data: settings, refetch } = useAppSettings();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);

  // Settings form state
  const [form, setForm] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Products list
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const check = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      setIsAdmin(Boolean(data));
    };
    check();
  }, []);

  useEffect(() => {
    if (!settings) return;
    setForm({
      support_whatsapp: settings.support_whatsapp ?? "",
      sales_whatsapp: settings.sales_whatsapp ?? "",
      company_email: settings.company_email ?? "",
      company_address: settings.company_address ?? "",
      map_url: settings.map_url ?? "",
      facebook_url: settings.facebook_url ?? "",
      instagram_url: settings.instagram_url ?? "",
      tiktok_url: settings.tiktok_url ?? "",
    });
  }, [settings]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("products")
        .select("id,slug,name,code,is_published,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setProducts(data ?? []);
    };
    if (isAdmin) load();
  }, [isAdmin]);

  if (isAdmin === false) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in but don't have admin access. Ask the owner to grant your account the <code>admin</code> role.
        </p>
      </div>
    );
  }

  if (isAdmin === null) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  const searchByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("products")
      .select("slug")
      .ilike("code", code.trim())
      .maybeSingle();
    setSearching(false);
    if (data?.slug) navigate({ to: "/product/$slug", params: { slug: data.slug } });
    else toast.error(`No product with code "${code}"`);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const payload: Record<string, string | null> = {};
    for (const k of Object.keys(form)) payload[k] = form[k]?.trim() || null;
    const { error } = settings?.id
      ? await supabase.from("app_settings").update(payload as never).eq("id", settings.id)
      : await supabase.from("app_settings").insert(payload as never);
    setSavingSettings(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settings saved");
    refetch();
  };

  const toggleAiProcessing = async (id: string, current: boolean) => {
    const next = !current;
    const { error } = await supabase
      .from("products")
      .update({ is_ai_processing: next } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, is_ai_processing: next } : p)));
    toast.success(next ? "AI generation queued (stub)" : "AI flag cleared");
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setProducts((p) => p.filter((x) => x.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="container-app py-6 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Manage products, contact info & inquiries.</p>
      </div>

      {/* Product code search */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Search className="h-4 w-4 text-primary" /> Product Code Search
        </h2>
        <p className="text-xs text-muted-foreground">Open a product instantly by its code.</p>
        <form onSubmit={searchByCode} className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. TIL-CAR-001"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button disabled={searching} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {searching ? "…" : "Open"}
          </button>
        </form>
      </section>

      {/* Settings */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <SettingsIcon className="h-4 w-4 text-primary" /> Company Settings
        </h2>
        <p className="text-xs text-muted-foreground">
          Used across the site (Contact page, Footer, Floating WhatsApp, Push to WhatsApp).
        </p>
        <form onSubmit={saveSettings} className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["support_whatsapp", "Support WhatsApp"],
            ["sales_whatsapp", "Sales WhatsApp"],
            ["company_email", "Company Email"],
            ["company_address", "Company Address"],
            ["map_url", "Map URL"],
            ["facebook_url", "Facebook URL"],
            ["instagram_url", "Instagram URL"],
            ["tiktok_url", "TikTok URL"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
              <input
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <button disabled={savingSettings} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {savingSettings ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      </section>

      {/* Products list */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Package className="h-4 w-4 text-primary" /> Products
        </h2>
        <p className="text-xs text-muted-foreground">Most recent 50 products.</p>
        <ul className="mt-3 divide-y divide-border">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <Link to="/product/$slug" params={{ slug: p.slug }} className="block truncate font-medium hover:text-primary">
                  {p.name}
                </Link>
                <div className="text-xs text-muted-foreground">Code · {p.code} · {p.is_published ? "Published" : "Draft"}</div>
              </div>
              <button onClick={() => deleteProduct(p.id)} className="rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
