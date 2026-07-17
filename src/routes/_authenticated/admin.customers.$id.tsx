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

  // Customer Intelligence state
  const [scores, setScores] = useState<any>(null);
  const [interests, setInterests] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  const load = async () => {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile(p);
    if (!p) return;
    const [
      { data: r },
      { data: c },
      { data: n },
      { data: sc },
      { data: ints },
      { data: devs },
      { data: prefs },
      { data: acts }
    ] = await Promise.all([
      supabase.from("user_roles").select("*").eq("user_id", p.auth_id).maybeSingle(),
      supabase.from("collections").select("id,name,inquiry_status,whatsapp_sent,created_at").eq("user_id", p.auth_id).order("created_at", { ascending: false }),
      supabase.from("customer_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("customer_scores").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("customer_interests").select("*").eq("user_id", id).order("score", { ascending: false }),
      supabase.from("communication_devices").select("*").eq("user_id", id),
      supabase.from("communication_preferences").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("customer_activity").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20)
    ]);
    setRoleRow(r);
    setCollections(c ?? []);
    setNotes(n ?? []);
    setScores(sc);
    setInterests(ints ?? []);
    setDevices(devs ?? []);
    setPreferences(prefs);
    setActivities(acts ?? []);

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

  const updatePreferences = async (updates: any) => {
    const { error } = await supabase
      .from("communication_preferences")
      .upsert({ user_id: id, ...preferences, ...updates });
    if (error) return toast.error(error.message);
    toast.success("Consent preferences updated");
    void load();
  };

  const togglePerEventChannel = async (eventKey: string, channelKey: string) => {
    const current = preferences?.per_event_channels || {};
    const eventConfig = current[eventKey] || {};
    const nextConfig = {
      ...current,
      [eventKey]: {
        ...eventConfig,
        [channelKey]: !eventConfig[channelKey]
      }
    };
    await updatePreferences({ per_event_channels: nextConfig });
  };

  if (loading || !isAdmin) return <div className="container-app py-8 text-sm text-muted-foreground">Loading…</div>;
  if (!profile) return <div className="container-app py-8 text-sm text-muted-foreground">Not found</div>;

  // Render variables helper
  const health = scores?.health_score ?? 100;
  const healthColor = health >= 75 ? "text-green-500" : health >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <div className="container-app py-6 space-y-6">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />Back to customers</Link>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Account Info */}
        <section className="rounded-lg border border-border p-5 md:col-span-2 bg-card">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account Information</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><div className="text-[11px] text-muted-foreground">Name</div><div className="font-medium text-foreground">{profile.full_name || "—"}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Email</div><div className="font-medium text-foreground">{profile.email}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Provider</div><div className="font-medium capitalize text-foreground">{profile.email && /@gmail\./i.test(profile.email) ? "google" : "email"}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Joined</div><div className="font-medium text-foreground">{new Date(profile.created_at).toLocaleString()}</div></div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Role</div>
              <select value={roleRow?.role ?? "customer"} onChange={(e) => setRole(e.target.value as AppRole)} className="rounded border border-border bg-background px-2.5 py-1 text-xs outline-none focus:border-primary">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Status</div>
              <div className="flex gap-1">
                {(["ACTIVE", "SUSPENDED", "BLOCKED"] as const).map((s) => (
                  <button key={s} onClick={() => setStatus(s)} className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${roleRow?.account_status === s ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>{s}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 pt-4 border-t border-border">
            <button onClick={toggleVip} className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition ${profile.vip_status ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "border border-border hover:bg-muted"}`}>
              <Crown className="h-3.5 w-3.5" />{profile.vip_status ? "VIP CUSTOMER" : "MARK AS VIP"}
            </button>
            {profile.email && <a href={`mailto:${profile.email}`} className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition">Send Email</a>}
          </div>
        </section>

        {/* Customer Intelligence Scorecard */}
        <section className="rounded-lg border border-border p-5 bg-card flex flex-col justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Retention Intelligence</h2>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Engagement Health</span>
              <span className={`text-lg font-semibold ${healthColor}`}>{health}%</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Lifecycle Segment</span>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{scores?.segment || "NEW"}</span>
            </div>

            <div className="mt-3">
              <span className="text-[11px] text-muted-foreground block mb-1">System Auto Tags</span>
              <div className="flex flex-wrap gap-1">
                {(scores?.auto_tags || []).map((t: string) => (
                  <span key={t} className="rounded bg-muted-foreground/10 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{t}</span>
                ))}
                {(!scores?.auto_tags || scores.auto_tags.length === 0) && <span className="text-xs text-muted-foreground italic">None computed</span>}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-4">
            <span className="text-[11px] text-muted-foreground block mb-1">Manual Tags</span>
            <div className="flex flex-wrap gap-1 mb-2">
              {(profile.tags ?? []).map((t: string) => (
                <span key={t} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px]">{t}<button onClick={() => removeTag(t)} className="text-muted-foreground hover:text-destructive">×</button></span>
              ))}
              {(profile.tags ?? []).length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
            </div>
            <div className="flex gap-1">
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add custom tag" className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
              <button onClick={addTag} className="rounded bg-primary px-2.5 py-1 text-xs text-primary-foreground font-medium">Add</button>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Interests & Activity Timeline */}
        <div className="md:col-span-2 space-y-6">
          {/* Top Categories Interests */}
          <section className="rounded-lg border border-border p-5 bg-card">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Category Interests Score</h2>
            <div className="space-y-3">
              {interests.map((int) => (
                <div key={int.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground">{int.category}</span>
                    <span className="text-muted-foreground">Score: {int.score}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, Number(int.score) * 10)}%` }}></div>
                  </div>
                </div>
              ))}
              {interests.length === 0 && (
                <div className="text-xs text-muted-foreground italic text-center py-4">No categories viewed or favorited yet</div>
              )}
            </div>
          </section>

          {/* Activity Timeline */}
          <section className="rounded-lg border border-border p-5 bg-card">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Timeline (Recent Events)</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {activities.map((act) => (
                <div key={act.id} className="flex gap-3 text-xs items-start border-l-2 border-primary/20 pl-3.5 py-1 relative ml-1">
                  <div className="absolute left-[-5px] top-2 w-2.5 h-2.5 rounded-full bg-primary"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize text-foreground">{act.activity_type.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(act.created_at).toLocaleString()}</span>
                    </div>
                    <pre className="mt-1 text-[10px] font-mono bg-muted p-1.5 rounded overflow-x-auto text-muted-foreground">{JSON.stringify(act.metadata, null, 2)}</pre>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="text-xs text-muted-foreground italic text-center py-4">No events logged yet</div>
              )}
            </div>
          </section>
        </div>

        {/* Channels & Devices / Preferences */}
        <div className="space-y-6">
          {/* Preferences */}
          <section className="rounded-lg border border-border p-5 bg-card">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Communication Consents</h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.receive_marketing ?? true}
                  onChange={(e) => updatePreferences({ receive_marketing: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                Receive Marketing Campaigns
              </label>

              <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences?.receive_transactional ?? true}
                  onChange={(e) => updatePreferences({ receive_transactional: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                Receive Transactional System Notifications
              </label>

              <div className="pt-4 border-t border-border mt-4">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2.5">Granular Event Notifications</h3>
                {["product_updates", "recommendations", "price_drops", "collection_reminders"].map((eventKey) => {
                  const perEvent = preferences?.per_event_channels || {};
                  const eventVal = perEvent[eventKey] || { email: true, push: true };
                  return (
                    <div key={eventKey} className="py-2 border-b border-border/50 text-xs">
                      <div className="font-medium text-foreground capitalize mb-1">{eventKey.replace(/_/g, " ")}</div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                          <input
                            type="checkbox"
                            checked={eventVal.email ?? false}
                            onChange={() => togglePerEventChannel(eventKey, "email")}
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          Email
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                          <input
                            type="checkbox"
                            checked={eventVal.push ?? false}
                            onChange={() => togglePerEventChannel(eventKey, "push")}
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          Push Notif
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Registered Devices */}
          <section className="rounded-lg border border-border p-5 bg-card">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Push Devices PWA ({devices.length})</h2>
            <div className="space-y-2">
              {devices.map((dev) => (
                <div key={dev.id} className="rounded border border-border p-2.5 text-xs bg-background">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground capitalize">{dev.browser || "Browser"} · {dev.device_type}</span>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${dev.is_active ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>{dev.is_active ? "ACTIVE" : "INACTIVE"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">{dev.token}</div>
                  <div className="text-[9px] text-muted-foreground mt-1">OS: {dev.os_version || "Unknown"} · Registered: {new Date(dev.created_at).toLocaleDateString()}</div>
                </div>
              ))}
              {devices.length === 0 && (
                <div className="text-xs text-muted-foreground italic text-center py-2">No active PWA devices registered</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Engagement Cards (Collections and Inquiries) */}
      <section className="rounded-lg border border-border p-5 bg-card">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Core Showroom Engagement</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold text-foreground">Saved Collections ({collections.length})</div>
            <div className="space-y-1.5 text-xs">
              {collections.map((c) => (
                <Link key={c.id} to="/collection/$id" params={{ id: c.id }} className="flex items-center justify-between rounded border border-border p-2.5 hover:bg-muted transition">
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.inquiry_status ?? "Draft"}{c.whatsapp_sent ? " · WhatsApp sent" : ""}</span>
                </Link>
              ))}
              {collections.length === 0 && <div className="text-muted-foreground italic">No collections created yet</div>}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-foreground">WhatsApp Inquiries ({inquiries.length})</div>
            <div className="space-y-1.5 text-xs">
              {inquiries.map((i) => (
                <div key={i.id} className="rounded border border-border p-2.5 bg-background">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{i.customer_name || i.customer_phone || "—"}</span>
                    <span className="text-[10px] text-muted-foreground capitalize font-semibold">{i.inquiry_status}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(i.created_at).toLocaleString()}</div>
                </div>
              ))}
              {inquiries.length === 0 && <div className="text-muted-foreground italic">No WhatsApp inquiries received</div>}
            </div>
          </div>
        </div>
      </section>

      {/* Internal notes (CRM) */}
      <section className="rounded-lg border border-border p-5 bg-card">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">CRM — Internal Staff Notes</h2>
        <div className="flex flex-col gap-2 md:flex-row mb-4">
          <select value={noteType} onChange={(e) => setNoteType(e.target.value as any)} className="rounded border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary">
            {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add internal staff notes for this user..." className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary" />
          <button onClick={addNote} className="rounded bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition">Add Note</button>
        </div>
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded border border-border p-3 text-xs bg-background">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border pb-1.5 mb-1.5">
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{n.note_type}</span>
                <div className="flex items-center gap-2">
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  <button onClick={() => delNote(n.id)} className="text-muted-foreground hover:text-destructive transition"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="whitespace-pre-wrap text-foreground font-medium">{n.note}</div>
            </div>
          ))}
          {notes.length === 0 && <div className="text-xs text-muted-foreground italic py-2">No notes posted yet</div>}
        </div>
      </section>
    </div>
  );
}
