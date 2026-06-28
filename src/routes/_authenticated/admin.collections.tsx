import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ExternalLink, MessageCircle, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/collections")({
  head: () => ({ meta: [{ title: "Collections CRM — Admin" }] }),
  component: CollectionsCrmPage,
});

const STAGES = ["NEW", "CONTACTED", "NEGOTIATING", "QUOTED", "CLOSED", "LOST"] as const;
type Stage = (typeof STAGES)[number];

type Row = {
  id: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_profile_id: string | null;
  products_count: number;
  created_at: string;
  whatsapp_sent: boolean;
  inquiry_status: Stage;
  assigned_admin_id: string | null;
  internal_notes: string | null;
  inquiry_id: string | null;
};

function CollectionsCrmPage() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; full_name: string | null; email: string | null; auth_id: string }>>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setBusy(true);
    const [{ data: colls }, { data: items }, { data: profs }, { data: inqs }, { data: roleRows }] = await Promise.all([
      supabase.from("collections").select("id,user_id,inquiry_status,whatsapp_sent,internal_notes,created_at").order("created_at", { ascending: false }),
      supabase.from("collection_items").select("collection_id"),
      supabase.from("profiles").select("id,auth_id,full_name,email"),
      supabase.from("whatsapp_inquiries").select("id,collection_id,assigned_admin_id,inquiry_status"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const profByAuth = new Map((profs ?? []).map((p: any) => [p.auth_id, p]));
    const itemCount = new Map<string, number>();
    (items ?? []).forEach((i: any) => itemCount.set(i.collection_id, (itemCount.get(i.collection_id) ?? 0) + 1));
    const inqByColl = new Map<string, any>();
    (inqs ?? []).forEach((i: any) => inqByColl.set(i.collection_id, i));

    const adminIds = new Set((roleRows ?? []).filter((r: any) => r.role === "admin" || r.role === "super_admin").map((r: any) => r.user_id));
    const adminList = (profs ?? []).filter((p: any) => adminIds.has(p.auth_id));
    setAdmins(adminList as any);

    const out: Row[] = (colls ?? []).map((c: any) => {
      const p = profByAuth.get(c.user_id) as any;
      const inq = inqByColl.get(c.id);
      return {
        id: c.id,
        user_id: c.user_id,
        customer_name: p?.full_name ?? null,
        customer_email: p?.email ?? null,
        customer_profile_id: p?.id ?? null,
        products_count: itemCount.get(c.id) ?? 0,
        created_at: c.created_at,
        whatsapp_sent: !!c.whatsapp_sent,
        inquiry_status: (inq?.inquiry_status ?? c.inquiry_status ?? "NEW") as Stage,
        assigned_admin_id: inq?.assigned_admin_id ?? null,
        internal_notes: c.internal_notes ?? null,
        inquiry_id: inq?.id ?? null,
      };
    });
    setRows(out);
    setBusy(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.inquiry_status === filter), [rows, filter]);
  const byStage = useMemo(() => {
    const m: Record<Stage, Row[]> = { NEW: [], CONTACTED: [], NEGOTIATING: [], QUOTED: [], CLOSED: [], LOST: [] };
    rows.forEach((r) => m[r.inquiry_status]?.push(r));
    return m;
  }, [rows]);

  const setStage = async (row: Row, stage: Stage) => {
    const { error } = await supabase.from("collections").update({ inquiry_status: stage }).eq("id", row.id);
    if (error) return toast.error(error.message);
    if (row.inquiry_id) await supabase.from("whatsapp_inquiries").update({ inquiry_status: stage }).eq("id", row.inquiry_id);
    void load();
  };
  const assign = async (row: Row, admin_id: string) => {
    if (!row.inquiry_id) return toast.error("No inquiry yet for this collection");
    const { error } = await supabase.from("whatsapp_inquiries").update({ assigned_admin_id: admin_id || null }).eq("id", row.inquiry_id);
    if (error) return toast.error(error.message);
    void load();
  };
  const saveNotes = async (row: Row, notes: string) => {
    await supabase.from("collections").update({ internal_notes: notes }).eq("id", row.id);
  };

  if (loading || !isAdmin) return <div className="container-app py-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="container-app py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold">Collection CRM</h1>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setFilter("all")} className={`rounded px-2 py-1 text-[11px] ${filter === "all" ? "bg-primary text-primary-foreground" : "border border-border"}`}>All ({rows.length})</button>
          {STAGES.map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded px-2 py-1 text-[11px] ${filter === s ? "bg-primary text-primary-foreground" : "border border-border"}`}>{s} ({byStage[s].length})</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-6">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded-lg border border-border bg-card/40 p-2">
            <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">{stage} · {byStage[stage].length}</div>
            <div className="space-y-2">
              {byStage[stage].map((r) => (
                <div key={r.id} className="rounded-md border border-border bg-background p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.customer_name || r.customer_email || "—"}</span>
                    <span className="text-[10px] text-muted-foreground">{r.products_count}p</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} {r.whatsapp_sent && "· WA"}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <select value={r.inquiry_status} onChange={(e) => setStage(r, e.target.value as Stage)} className="rounded border border-border bg-card px-1 py-0.5 text-[10px]">
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={r.assigned_admin_id ?? ""} onChange={(e) => assign(r, e.target.value)} className="rounded border border-border bg-card px-1 py-0.5 text-[10px]">
                      <option value="">Unassigned</option>
                      {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                    </select>
                  </div>
                  <textarea defaultValue={r.internal_notes ?? ""} onBlur={(e) => saveNotes(r, e.target.value)} placeholder="Notes…" className="mt-2 w-full rounded border border-border bg-card p-1 text-[11px]" rows={2} />
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {r.customer_profile_id && <Link to="/admin/customers/$id" params={{ id: r.customer_profile_id }} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5"><UserIcon className="h-3 w-3" />Customer</Link>}
                    <Link to="/collection/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5"><ExternalLink className="h-3 w-3" />Open</Link>
                    {r.inquiry_id && <Link to="/admin/business" className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5"><MessageCircle className="h-3 w-3" />Inquiry</Link>}
                  </div>
                </div>
              ))}
              {byStage[stage].length === 0 && !busy && <div className="text-[11px] text-muted-foreground">—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
