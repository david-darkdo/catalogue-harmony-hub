import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Mail, Eye, Shield, Ban, Check, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({ meta: [{ title: "Customers — Admin" }] }),
  component: CustomersPage,
});

type Row = {
  profile_id: string;
  auth_id: string;
  email: string | null;
  full_name: string | null;
  vip_status: boolean;
  created_at: string;
  role: AppRole;
  account_status: "ACTIVE" | "SUSPENDED" | "BLOCKED";
  provider: string;
  collections_count: number;
  inquiries_count: number;
  last_activity: string | null;
};

const ROLES: AppRole[] = ["customer", "admin", "super_admin"];
const STATUSES = ["ACTIVE", "SUSPENDED", "BLOCKED"] as const;

function CustomersPage() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [fRole, setFRole] = useState<string>("all");
  const [fProv, setFProv] = useState<string>("all");
  const [fVip, setFVip] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fHasColl, setFHasColl] = useState<string>("all");
  const [fHasInq, setFHasInq] = useState<string>("all");

  const load = async () => {
    setBusy(true);
    const [{ data: profs }, { data: roles }, { data: colls }, { data: inqs }] = await Promise.all([
      supabase.from("profiles").select("id,auth_id,email,full_name,vip_status,created_at"),
      supabase.from("user_roles").select("user_id,role,account_status"),
      supabase.from("collections").select("id,user_id,updated_at,created_at"),
      supabase.from("whatsapp_inquiries").select("id,collection_id,created_at"),
    ]);

    const roleByAuth = new Map<string, { role: AppRole; account_status: any }>();
    (roles ?? []).forEach((r: any) => roleByAuth.set(r.user_id, { role: r.role, account_status: r.account_status ?? "ACTIVE" }));

    const collByUser = new Map<string, { count: number; last: string | null; ids: Set<string> }>();
    (colls ?? []).forEach((c: any) => {
      const e = collByUser.get(c.user_id) ?? { count: 0, last: null, ids: new Set() };
      e.count++;
      e.ids.add(c.id);
      const t = c.updated_at ?? c.created_at;
      if (!e.last || (t && t > e.last)) e.last = t;
      collByUser.set(c.user_id, e);
    });

    const inqByColl = new Map<string, number>();
    (inqs ?? []).forEach((i: any) => inqByColl.set(i.collection_id, (inqByColl.get(i.collection_id) ?? 0) + 1));

    const out: Row[] = (profs ?? []).map((p: any) => {
      const r = roleByAuth.get(p.auth_id) ?? { role: "customer" as AppRole, account_status: "ACTIVE" as const };
      const ce = collByUser.get(p.auth_id);
      let inqCount = 0;
      ce?.ids.forEach((cid) => (inqCount += inqByColl.get(cid) ?? 0));
      return {
        profile_id: p.id,
        auth_id: p.auth_id,
        email: p.email,
        full_name: p.full_name,
        vip_status: !!p.vip_status,
        created_at: p.created_at,
        role: r.role,
        account_status: r.account_status,
        provider: (p.email && /@gmail\./i.test(p.email)) ? "google" : "email",
        collections_count: ce?.count ?? 0,
        inquiries_count: inqCount,
        last_activity: ce?.last ?? null,
      };
    });
    setRows(out);
    setBusy(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (q && !`${r.email ?? ""} ${r.full_name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (fRole !== "all" && r.role !== fRole) return false;
    if (fProv !== "all" && r.provider !== fProv) return false;
    if (fVip !== "all" && r.vip_status !== (fVip === "vip")) return false;
    if (fStatus !== "all" && r.account_status !== fStatus) return false;
    if (fHasColl === "yes" && r.collections_count === 0) return false;
    if (fHasColl === "no" && r.collections_count > 0) return false;
    if (fHasInq === "yes" && r.inquiries_count === 0) return false;
    if (fHasInq === "no" && r.inquiries_count > 0) return false;
    return true;
  }), [rows, q, fRole, fProv, fVip, fStatus, fHasColl, fHasInq]);

  const updateRole = async (auth_id: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").upsert({ user_id: auth_id, role } as never, { onConflict: "user_id,role" } as never);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    void load();
  };

  const updateStatus = async (auth_id: string, account_status: Row["account_status"]) => {
    const { error } = await supabase.from("user_roles").update({ account_status }).eq("user_id", auth_id);
    if (error) return toast.error(error.message);
    toast.success(`Account ${account_status}`);
    void load();
  };

  const toggleVip = async (profile_id: string, next: boolean) => {
    const { error } = await supabase.from("profiles").update({ vip_status: next }).eq("id", profile_id);
    if (error) return toast.error(error.message);
    void load();
  };

  if (loading || !isAdmin) return <div className="container-app py-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="container-app py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Customer Management</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name/email" className="col-span-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs" />
        <select value={fRole} onChange={(e) => setFRole(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <option value="all">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={fProv} onChange={(e) => setFProv(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <option value="all">Any provider</option>
          <option value="google">Google</option>
          <option value="email">Email</option>
        </select>
        <select value={fVip} onChange={(e) => setFVip(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <option value="all">VIP any</option>
          <option value="vip">VIP only</option>
          <option value="reg">Non‑VIP</option>
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <option value="all">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fHasColl} onChange={(e) => setFHasColl(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <option value="all">Collections any</option>
          <option value="yes">Has collections</option>
          <option value="no">None</option>
        </select>
        <select value={fHasInq} onChange={(e) => setFHasInq(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
          <option value="all">Inquiries any</option>
          <option value="yes">Has inquiries</option>
          <option value="no">None</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Customer</th>
              <th className="p-2">Provider</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2">VIP</th>
              <th className="p-2">Collections</th>
              <th className="p-2">Inquiries</th>
              <th className="p-2">Last activity</th>
              <th className="p-2">Joined</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No customers</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.profile_id} className="border-t border-border align-top">
                <td className="p-2">
                  <div className="font-medium">{r.full_name || "—"}</div>
                  <div className="text-muted-foreground">{r.email}</div>
                </td>
                <td className="p-2">{r.provider}</td>
                <td className="p-2">
                  <select value={r.role} onChange={(e) => updateRole(r.auth_id, e.target.value as AppRole)} className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px]">
                    {ROLES.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${r.account_status === "ACTIVE" ? "bg-primary/15 text-primary" : r.account_status === "SUSPENDED" ? "bg-yellow-500/15 text-yellow-600" : "bg-destructive/15 text-destructive"}`}>{r.account_status}</span>
                </td>
                <td className="p-2">
                  <button onClick={() => toggleVip(r.profile_id, !r.vip_status)} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${r.vip_status ? "bg-primary/15 text-primary" : "border border-border text-muted-foreground"}`}>
                    <Crown className="h-3 w-3" />{r.vip_status ? "VIP" : "—"}
                  </button>
                </td>
                <td className="p-2">{r.collections_count}</td>
                <td className="p-2">{r.inquiries_count}</td>
                <td className="p-2">{r.last_activity ? new Date(r.last_activity).toLocaleDateString() : "—"}</td>
                <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    <Link to="/admin/customers/$id" params={{ id: r.profile_id }} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-muted"><Eye className="h-3 w-3" />Profile</Link>
                    {r.account_status !== "ACTIVE" && (
                      <button onClick={() => updateStatus(r.auth_id, "ACTIVE")} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-muted"><Check className="h-3 w-3" />Activate</button>
                    )}
                    {r.account_status !== "SUSPENDED" && (
                      <button onClick={() => updateStatus(r.auth_id, "SUSPENDED")} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-muted"><Shield className="h-3 w-3" />Suspend</button>
                    )}
                    {r.account_status !== "BLOCKED" && (
                      <button onClick={() => updateStatus(r.auth_id, "BLOCKED")} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-destructive hover:bg-destructive/10"><Ban className="h-3 w-3" />Block</button>
                    )}
                    {r.email && (
                      <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-muted"><Mail className="h-3 w-3" />Email</a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
