import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Crown, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/customers/$id")({
  head: () => ({ meta: [{ title: "Customer — Admin" }] }),
  component: CustomerDetail,
});

const ROLES: AppRole[] = ["customer", "admin", "super_admin"];
const NOTE_TYPES = ["GENERAL", "SALES", "SUPPORT", "VIP", "FOLLOW_UP"] as const;

function CustomerDetail() {
  const { id } = useParams({ from: "/_authenticated/admin/customers/$id" });
  const { isAdmin, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [roleRow, setRoleRow] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<(typeof NOTE_TYPES)[number]>("GENERAL");
  const [tagInput, setTagInput] = useState("");

  const load = async () => {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile(p);
    if (!p) return;
    const [{ data: r }, { data: c }, { data: n }] = await Promise.all([
      supabase.from("user_roles").select("*").eq("user_id", p.auth_id).maybeSingle(),
      supabase.from("collections").select("id,name,inquiry_status,whatsapp_sent,created_at").eq("user_id", p.auth_id).order("created_at", { ascending: false }),
      supabase.from("customer_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    ]);
    setRoleRow(r);
    setCollections(c ?? []);
    setNotes(n ?? []);
    const ids = (c ?? []).map((x: any) => x.id);
    if (ids.length) {
      const { data: iq } = await supabase.from("whatsapp_inquiries").select("*").in("collection_id", ids).order("created_at", { ascending: false });
      setInquiries(iq ?? []);
    } else setInquiries([]);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, id]);

  const setRole = async (role: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", profile.auth_id);
    const { error } = await supabase.from("user_roles").insert({ user_id: profile.auth_id, role, account_status: roleRow?.account_status ?? "ACTIVE" } as never);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    void load();
  };
  const setStatus = async (account_status: "ACTIVE" | "SUSPENDED" | "BLOCKED") => {
    const { error } = await supabase.from("user_roles").update({ account_status }).eq("user_id", profile.auth_id);
    if (error) return toast.error(error.message);
    toast.success(`Account ${account_status}`);
    void load();
  };
  const toggleVip = async () => {
    const { error } = await supabase.from("profiles").update({ vip_status: !profile.vip_status }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };
  const addTag = async () => {
    const t = tagInput.trim(); if (!t) return;
    const next = Array.from(new Set([...(profile.tags ?? []), t]));
    await supabase.from("profiles").update({ tags: next }).eq("id", id);
    setTagInput(""); void load();
  };
  const removeTag = async (t: string) => {
    const next = (profile.tags ?? []).filter((x: string) => x !== t);
    await supabase.from("profiles").update({ tags: next }).eq("id", id);
    void load();
  };
  const addNote = async () => {
    if (!newNote.trim()) return;
    const { data: me } = await supabase.auth.getUser();
    const { data: adminProf } = await supabase.from("profiles").select("id").eq("auth_id", me.user?.id ?? "").maybeSingle();
    const { error } = await supabase.from("customer_notes").insert({ customer_id: id, admin_id: adminProf?.id ?? null, note: newNote.trim(), note_type: noteType } as never);
    if (error) return toast.error(error.message);
    setNewNote(""); void load();
  };
  const delNote = async (nid: string) => {
    await supabase.from("customer_notes").delete().eq("id", nid);
    void load();
  };

  if (loading || !isAdmin) return <div className="container-app py-8 text-sm text-muted-foreground">Loading…</div>;
  if (!profile) return <div className="container-app py-8 text-sm text-muted-foreground">Not found</div>;

  return (
    <div className="container-app py-6 space-y-6">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />Back to customers</Link>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-border p-4 md:col-span-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-[11px] text-muted-foreground">Name</div><div>{profile.full_name || "—"}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Email</div><div>{profile.email}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Provider</div><div>{profile.email && /@gmail\./i.test(profile.email) ? "google" : "email"}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Joined</div><div>{new Date(profile.created_at).toLocaleString()}</div></div>
            <div>
              <div className="text-[11px] text-muted-foreground">Role</div>
              <select value={roleRow?.role ?? "customer"} onChange={(e) => setRole(e.target.value as AppRole)} className="mt-1 rounded border border-border bg-card px-2 py-1 text-xs">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Status</div>
              <div className="mt-1 flex gap-1">
                {(["ACTIVE", "SUSPENDED", "BLOCKED"] as const).map((s) => (
                  <button key={s} onClick={() => setStatus(s)} className={`rounded px-2 py-1 text-[11px] ${roleRow?.account_status === s ? "bg-primary text-primary-foreground" : "border border-border"}`}>{s}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={toggleVip} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${profile.vip_status ? "bg-primary/15 text-primary" : "border border-border"}`}>
              <Crown className="h-3 w-3" />{profile.vip_status ? "VIP" : "Mark VIP"}
            </button>
            {profile.email && <a href={`mailto:${profile.email}`} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Send email</a>}
          </div>
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tags</h2>
          <div className="mt-2 flex flex-wrap gap-1">
            {(profile.tags ?? []).map((t: string) => (
              <span key={t} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px]">{t}<button onClick={() => removeTag(t)} className="text-muted-foreground hover:text-destructive">×</button></span>
            ))}
            {(profile.tags ?? []).length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
          </div>
          <div className="mt-2 flex gap-1">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add tag" className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs" />
            <button onClick={addTag} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Add</button>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium">Collections ({collections.length})</div>
            <div className="space-y-1 text-xs">
              {collections.map((c) => (
                <Link key={c.id} to="/collection/$id" params={{ id: c.id }} className="flex items-center justify-between rounded border border-border p-2 hover:bg-muted">
                  <span>{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.inquiry_status ?? "—"}{c.whatsapp_sent ? " · sent" : ""}</span>
                </Link>
              ))}
              {collections.length === 0 && <div className="text-muted-foreground">None</div>}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium">WhatsApp inquiries ({inquiries.length})</div>
            <div className="space-y-1 text-xs">
              {inquiries.map((i) => (
                <div key={i.id} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between"><span>{i.customer_name || i.customer_phone || "—"}</span><span className="text-[10px] text-muted-foreground">{i.inquiry_status}</span></div>
                  <div className="text-[10px] text-muted-foreground">{new Date(i.created_at).toLocaleString()}</div>
                </div>
              ))}
              {inquiries.length === 0 && <div className="text-muted-foreground">None</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">CRM — Internal Notes</h2>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <select value={noteType} onChange={(e) => setNoteType(e.target.value as any)} className="rounded border border-border bg-card px-2 py-1 text-xs">
            {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note…" className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs" />
          <button onClick={addNote} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground">Add note</button>
        </div>
        <div className="mt-3 space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded border border-border p-2 text-xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{n.note_type} · {new Date(n.created_at).toLocaleString()}</span>
                <button onClick={() => delNote(n.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
              <div className="mt-1 whitespace-pre-wrap">{n.note}</div>
            </div>
          ))}
          {notes.length === 0 && <div className="text-xs text-muted-foreground">No notes yet</div>}
        </div>
      </section>
    </div>
  );
}
