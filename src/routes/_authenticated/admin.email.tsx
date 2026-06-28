import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Copy, Archive, Send, Save, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/email")({
  head: () => ({ meta: [{ title: "Email Campaigns — Admin" }] }),
  component: EmailCampaignsPage,
});

const SEGMENTS = [
  { id: "all_users", label: "All users" },
  { id: "google_users", label: "Google users" },
  { id: "email_users", label: "Email users" },
  { id: "active_users", label: "Active users" },
  { id: "inactive_users", label: "Inactive users" },
  { id: "with_collections", label: "Users with collections" },
  { id: "with_inquiries", label: "Users with inquiries" },
  { id: "vip", label: "VIP customers" },
] as const;

const STATUSES = ["DRAFT", "READY", "SENDING", "SENT", "FAILED", "ARCHIVED"] as const;
type Status = (typeof STATUSES)[number];

type Campaign = {
  id: string;
  name: string;
  subject: string;
  banner_url: string | null;
  body: string;
  target_segment: string;
  status: Status;
  scheduled_at: string | null;
  created_at: string;
};

function EmailCampaignsPage() {
  const { isAdmin, loading } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("email_campaigns").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setItems((data ?? []) as Campaign[]);
  };
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const filtered = useMemo(() => filter === "ALL" ? items : items.filter((i) => i.status === filter), [items, filter]);

  const newDraft = () => setEditing({ id: "", name: "", subject: "", banner_url: "", body: "", target_segment: "all_users", status: "DRAFT", scheduled_at: null, created_at: new Date().toISOString() });

  const save = async (status?: Status) => {
    if (!editing) return;
    setBusy(true);
    const payload: any = { name: editing.name, subject: editing.subject, banner_url: editing.banner_url || null, body: editing.body, target_segment: editing.target_segment };
    if (status) payload.status = status;
    if (editing.id) {
      const { error } = await supabase.from("email_campaigns").update(payload).eq("id", editing.id);
      if (error) { setBusy(false); return toast.error(error.message); }
    } else {
      const { data: me } = await supabase.auth.getUser();
      const { data: adminProf } = await supabase.from("profiles").select("id").eq("auth_id", me.user?.id ?? "").maybeSingle();
      const { data, error } = await supabase.from("email_campaigns").insert({ ...payload, status: status ?? "DRAFT", created_by: adminProf?.id ?? null } as never).select().single();
      if (error) { setBusy(false); return toast.error(error.message); }
      setEditing(data as Campaign);
    }
    toast.success("Saved");
    setBusy(false);
    void load();
  };

  const resolveRecipients = async (segment: string) => {
    const [{ data: profs }, { data: roles }, { data: colls }, { data: inqs }] = await Promise.all([
      supabase.from("profiles").select("id,auth_id,email,vip_status"),
      supabase.from("user_roles").select("user_id,account_status"),
      supabase.from("collections").select("user_id"),
      supabase.from("whatsapp_inquiries").select("collection_id"),
    ]);
    const statusByAuth = new Map<string, string>();
    (roles ?? []).forEach((r: any) => statusByAuth.set(r.user_id, r.account_status ?? "ACTIVE"));
    const collUsers = new Set((colls ?? []).map((c: any) => c.user_id));
    const collIds = new Set((colls ?? []).map((c: any) => c.user_id));
    const inquiryUsers = new Set<string>();
    (inqs ?? []).forEach(() => {/* skip mapping */});
    // simpler: users with inquiries = users with collections that have inquiries
    const collOwner = new Map<string, string>();
    (colls as any[] ?? []).forEach((c: any) => collOwner.set(c.user_id, c.user_id));
    return (profs ?? []).filter((p: any) => {
      if (!p.email) return false;
      const st = statusByAuth.get(p.auth_id) ?? "ACTIVE";
      switch (segment) {
        case "all_users": return true;
        case "google_users": return /@gmail\./i.test(p.email);
        case "email_users": return !/@gmail\./i.test(p.email);
        case "active_users": return st === "ACTIVE";
        case "inactive_users": return st !== "ACTIVE";
        case "with_collections": return collUsers.has(p.auth_id);
        case "with_inquiries": return collUsers.has(p.auth_id) && (inqs ?? []).length > 0;
        case "vip": return !!p.vip_status;
        default: return false;
      }
      void collIds;
    });
  };

  const sendNow = async () => {
    if (!editing?.id) return toast.error("Save the draft first");
    setBusy(true);
    await supabase.from("email_campaigns").update({ status: "SENDING" }).eq("id", editing.id);
    const recipients = await resolveRecipients(editing.target_segment);
    if (recipients.length === 0) {
      await supabase.from("email_campaigns").update({ status: "FAILED" }).eq("id", editing.id);
      setBusy(false); toast.error("No recipients matched");
      return void load();
    }
    const rows = recipients.map((r: any) => ({ campaign_id: editing.id, user_id: r.id, recipient_email: r.email, status: "queued" }));
    const { error } = await supabase.from("email_campaign_logs").insert(rows as never);
    if (error) {
      await supabase.from("email_campaigns").update({ status: "FAILED" }).eq("id", editing.id);
      setBusy(false); return toast.error(error.message);
    }
    await supabase.from("email_campaigns").update({ status: "SENT" }).eq("id", editing.id);
    toast.success(`Queued ${recipients.length} recipient(s)`);
    setBusy(false);
    setEditing(null);
    void load();
  };

  const duplicate = async (c: Campaign) => {
    await supabase.from("email_campaigns").insert({ name: c.name + " (copy)", subject: c.subject, banner_url: c.banner_url, body: c.body, target_segment: c.target_segment, status: "DRAFT" } as never);
    void load();
  };
  const archive = async (c: Campaign) => {
    await supabase.from("email_campaigns").update({ status: "ARCHIVED" }).eq("id", c.id);
    void load();
  };
  const remove = async (c: Campaign) => {
    if (!confirm("Delete this campaign?")) return;
    await supabase.from("email_campaigns").delete().eq("id", c.id);
    void load();
  };

  if (loading || !isAdmin) return <div className="container-app py-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="container-app py-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold">Email Campaigns</h1>
          <button onClick={newDraft} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"><Plus className="h-3 w-3" />New</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["ALL", ...STATUSES] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s as any)} className={`rounded px-2 py-1 text-[11px] ${filter === s ? "bg-primary text-primary-foreground" : "border border-border"}`}>{s}</button>
          ))}
        </div>
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="rounded border border-border p-2 text-xs">
              <div className="flex items-center justify-between">
                <button onClick={() => setEditing(c)} className="text-left font-medium hover:underline">{c.name || "(untitled)"}</button>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{c.status}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{c.subject || "—"} · {c.target_segment} · {new Date(c.created_at).toLocaleDateString()}</div>
              <div className="mt-1 flex gap-1">
                <button onClick={() => duplicate(c)} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px]"><Copy className="h-3 w-3" />Duplicate</button>
                <button onClick={() => archive(c)} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px]"><Archive className="h-3 w-3" />Archive</button>
                <button onClick={() => remove(c)} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-destructive"><Trash2 className="h-3 w-3" />Delete</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-xs text-muted-foreground">No campaigns</div>}
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        {!editing ? (
          <div className="text-sm text-muted-foreground">Select a campaign or create a new one.</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{editing.id ? "Edit campaign" : "New campaign"}</h2>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px]">{editing.status}</span>
            </div>
            <label className="block text-xs">
              <span className="text-muted-foreground">Campaign name</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1 w-full rounded border border-border bg-card px-2 py-1" />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Subject</span>
              <input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} className="mt-1 w-full rounded border border-border bg-card px-2 py-1" />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Banner image URL</span>
              <input value={editing.banner_url ?? ""} onChange={(e) => setEditing({ ...editing, banner_url: e.target.value })} className="mt-1 w-full rounded border border-border bg-card px-2 py-1" />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Body</span>
              <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={8} className="mt-1 w-full rounded border border-border bg-card px-2 py-1" />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Target segment</span>
              <select value={editing.target_segment} onChange={(e) => setEditing({ ...editing, target_segment: e.target.value })} className="mt-1 w-full rounded border border-border bg-card px-2 py-1">
                {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button disabled={busy} onClick={() => save("DRAFT")} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs"><Save className="h-3 w-3" />Save draft</button>
              <button disabled={busy} onClick={sendNow} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground"><Send className="h-3 w-3" />Send now</button>
              <button onClick={() => setEditing(null)} className="ml-auto rounded border border-border px-3 py-1.5 text-xs">Close</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
