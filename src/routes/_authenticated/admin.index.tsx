import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, APP_SETTINGS_QUERY_KEY } from "@/lib/settings";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Search, Settings as SettingsIcon, Package, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Stoneworks" }] }),
  component: AdminPage,
});

const ROLE_OPTIONS: AppRole[] = ["customer", "admin", "super_admin"];

type UserRow = {
  auth_id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useAppSettings();
  const { user, loading: authLoading, isAdmin, isSuperAdmin } = useAuth();

  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

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
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,slug,name,code,is_published,is_ai_processing,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setProducts(data ?? []);
    })();
  }, [isAdmin]);

  const loadUsers = useMemo(
    () => async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("auth_id, email, full_name")
        .order("created_at", { ascending: false });
      if (pErr) {
        toast.error(pErr.message);
        return;
      }
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) {
        toast.error(rErr.message);
        return;
      }
      const roleMap = new Map<string, AppRole>();
      // pick highest privilege role per user
      const rank: Record<AppRole, number> = { customer: 0, admin: 1, super_admin: 2 };
      for (const r of roles as Array<{ user_id: string; role: AppRole }>) {
        const prev = roleMap.get(r.user_id);
        if (!prev || rank[r.role] > rank[prev]) roleMap.set(r.user_id, r.role);
      }
      setUsers(
        ((profiles ?? []) as Array<{ auth_id: string; email: string | null; full_name: string | null }>).map(
          (p) => ({
            auth_id: p.auth_id,
            email: p.email,
            full_name: p.full_name,
            role: roleMap.get(p.auth_id) ?? "customer",
          })
        )
      );
    },
    []
  );

  useEffect(() => {
    if (isSuperAdmin) loadUsers();
  }, [isSuperAdmin, loadUsers]);

  if (authLoading) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please sign in.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in but don't have admin access. Ask a super admin to grant your account the <code>admin</code> role.
        </p>
      </div>
    );
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
    if (!isSuperAdmin) {
      toast.error("Only super admins can edit company settings.");
      return;
    }
    setSavingSettings(true);
    const payload: Record<string, string | null> = {};
    for (const k of Object.keys(form)) payload[k] = form[k]?.trim() || null;
    const { error } = settings?.id
      ? await supabase.from("app_settings").update(payload as never).eq("id", settings.id)
      : await supabase.from("app_settings").insert(payload as never);
    setSavingSettings(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    await queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
  };

  const updateUserRole = async (target: UserRow, nextRole: AppRole) => {
    if (!isSuperAdmin) return;
    if (target.auth_id === user.id && target.role === "super_admin" && nextRole !== "super_admin") {
      if (!confirm("You are about to remove your own super admin role. Continue?")) return;
    }
    // Wipe existing rows then insert the new role (single-role model in UI)
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", target.auth_id);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase
      .from("user_roles")
      .insert({ user_id: target.auth_id, role: nextRole } as never);
    if (insErr) return toast.error(insErr.message);
    setUsers((rows) => rows.map((r) => (r.auth_id === target.auth_id ? { ...r, role: nextRole } : r)));
    toast.success(`Role updated to ${nextRole}`);
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

      <CustomerAnalyticsCards />


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

      {isSuperAdmin && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <SettingsIcon className="h-4 w-4 text-primary" /> Company Settings
          </h2>
          <p className="text-xs text-muted-foreground">
            Used across the site (Contact, Footer, Floating WhatsApp, Push to WhatsApp).
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
      )}

      {isSuperAdmin && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Users className="h-4 w-4 text-primary" /> User Management
          </h2>
          <p className="text-xs text-muted-foreground">
            Update roles directly. Hierarchy: customer &lt; admin &lt; super_admin.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Current Role</th>
                  <th className="py-2 pr-3">Update Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.auth_id}>
                    <td className="py-2 pr-3 font-medium">{u.full_name || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{u.email || "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-primary">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateUserRole(u, e.target.value as AppRole)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Package className="h-4 w-4 text-primary" /> Products
        </h2>
        <p className="text-xs text-muted-foreground">Most recent 50 products.</p>
        <ul className="mt-3 divide-y divide-border">
          {products.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <Link to="/product/$slug" params={{ slug: p.slug }} className="block truncate font-medium hover:text-primary">
                  {p.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  Code · {p.code} · {p.is_published ? "Published" : "Draft"}
                  {p.is_ai_processing ? " · AI processing…" : ""}
                </div>
              </div>
              <button
                onClick={() => toggleAiProcessing(p.id, p.is_ai_processing)}
                className="rounded-md border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10"
              >
                {p.is_ai_processing ? "Regenerate AI Assets" : "Generate AI Assets"}
              </button>
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

function CustomerAnalyticsCards() {
  const [stats, setStats] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: roles }, { data: colls }, { data: inqs }, { data: camps }] = await Promise.all([
        supabase.from("profiles").select("email,vip_status"),
        supabase.from("user_roles").select("account_status"),
        supabase.from("collections").select("id"),
        supabase.from("whatsapp_inquiries").select("id"),
        supabase.from("email_campaigns" as any).select("status"),
      ]);
      const total = profs?.length ?? 0;
      const google = (profs ?? []).filter((p: any) => p.email && /@gmail\./i.test(p.email)).length;
      const email = total - google;
      const active = (roles ?? []).filter((r: any) => (r.account_status ?? "ACTIVE") === "ACTIVE").length;
      const suspended = (roles ?? []).filter((r: any) => r.account_status === "SUSPENDED" || r.account_status === "BLOCKED").length;
      const vip = (profs ?? []).filter((p: any) => p.vip_status).length;
      const campsTotal = camps?.length ?? 0;
      const campsSent = (camps ?? []).filter((c: any) => c.status === "SENT").length;
      setStats({ total, google, email, active, suspended, vip, colls: colls?.length ?? 0, inqs: inqs?.length ?? 0, campsTotal, campsSent });
    })();
  }, []);
  const cards = [
    ["Total users", stats.total], ["Google", stats.google], ["Email", stats.email],
    ["Active", stats.active], ["Suspended", stats.suspended], ["VIP", stats.vip],
    ["Collections", stats.colls], ["WhatsApp inquiries", stats.inqs],
    ["Campaigns created", stats.campsTotal], ["Campaigns sent", stats.campsSent],
  ] as const;
  return (
    <section>
      <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Customer Analytics</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3">
            <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold">{v ?? 0}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
