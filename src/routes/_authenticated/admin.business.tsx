import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  X,
  MessageCircle,
  Users,
  Briefcase,
  CheckCircle2,
  XCircle,
  Inbox,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/business")({
  head: () => ({ meta: [{ title: "Business Operations — Admin" }] }),
  component: BusinessOpsPage,
});

const STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "QUOTED", "CLOSED", "LOST"] as const;
type Status = (typeof STATUSES)[number];

type Inquiry = {
  id: string;
  collection_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  whatsapp_number: string | null;
  inquiry_status: Status;
  internal_notes: string | null;
  assigned_admin_id: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type CollectionRow = {
  id: string;
  user_id: string;
  name: string;
  inquiry_status: Status;
  internal_notes: string | null;
  whatsapp_sent: boolean;
  created_at: string;
  updated_at: string | null;
  closed_at: string | null;
  item_count: number;
  user_email: string | null;
  user_name: string | null;
};

function BusinessOpsPage() {
  const { isAdmin, loading } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, { email: string | null; full_name: string | null }>>({});
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    const [{ data: inq }, { data: cols }, { data: items }, { data: profs }] = await Promise.all([
      supabase
        .from("whatsapp_inquiries")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("collections")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("collection_items").select("collection_id"),
      supabase.from("profiles").select("auth_id, email, full_name"),
    ]);

    const counts = new Map<string, number>();
    for (const r of (items ?? []) as Array<{ collection_id: string }>) {
      counts.set(r.collection_id, (counts.get(r.collection_id) ?? 0) + 1);
    }
    const pmap: Record<string, { email: string | null; full_name: string | null }> = {};
    for (const p of (profs ?? []) as Array<{ auth_id: string; email: string | null; full_name: string | null }>) {
      pmap[p.auth_id] = { email: p.email, full_name: p.full_name };
    }
    setProfilesById(pmap);

    setInquiries((inq ?? []) as Inquiry[]);
    setCollections(
      ((cols ?? []) as Array<Omit<CollectionRow, "item_count" | "user_email" | "user_name">>).map((c) => ({
        ...c,
        item_count: counts.get(c.id) ?? 0,
        user_email: pmap[c.user_id]?.email ?? null,
        user_name: pmap[c.user_id]?.full_name ?? null,
      }))
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin, loadAll]);

  const metrics = useMemo(() => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return {
      totalInquiries: inquiries.length,
      negotiating: inquiries.filter((i) => i.inquiry_status === "NEGOTIATING").length,
      quoted: inquiries.filter((i) => i.inquiry_status === "QUOTED").length,
      closed: inquiries.filter((i) => i.inquiry_status === "CLOSED").length,
      collections: collections.length,
      monthly: inquiries.filter((i) => new Date(i.created_at) >= monthAgo).length,
    };
  }, [inquiries, collections]);

  const updateInquiryStatus = async (id: string, status: Status) => {
    const { error } = await supabase
      .from("whatsapp_inquiries")
      .update({ inquiry_status: status } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    setInquiries((rows) =>
      rows.map((r) => (r.id === id ? { ...r, inquiry_status: status, last_contacted_at: new Date().toISOString() } : r))
    );
    if (selected?.id === id) {
      setSelected((s) => (s ? { ...s, inquiry_status: status, last_contacted_at: new Date().toISOString() } : s));
    }
    toast.success(`Status → ${status}`);
  };

  const updateInquiryNotes = async (id: string, notes: string) => {
    const { error } = await supabase
      .from("whatsapp_inquiries")
      .update({ internal_notes: notes } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    setInquiries((rows) => rows.map((r) => (r.id === id ? { ...r, internal_notes: notes } : r)));
    toast.success("Notes saved");
  };

  const updateCollectionStatus = async (id: string, status: Status) => {
    const patch: Record<string, unknown> = { inquiry_status: status };
    if (status === "CLOSED") patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from("collections").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    setCollections((rows) => rows.map((r) => (r.id === id ? { ...r, inquiry_status: status } : r)));
    toast.success(`Collection → ${status}`);
  };

  const updateCollectionNotes = async (id: string, notes: string) => {
    const { error } = await supabase
      .from("collections")
      .update({ internal_notes: notes } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    setCollections((rows) => rows.map((r) => (r.id === id ? { ...r, internal_notes: notes } : r)));
    toast.success("Notes saved");
  };

  if (loading || !loaded) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading business operations…</div>;
  }
  if (!isAdmin) {
    return <div className="container-app py-10 text-sm">Access denied.</div>;
  }

  return (
    <div className="container-app space-y-8 py-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Business Operations</h1>
        <p className="text-sm text-muted-foreground">Sales pipeline, inquiries, and project collections.</p>
      </div>

      {/* Metrics */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric icon={Inbox} label="Total Inquiries" value={metrics.totalInquiries} />
        <Metric icon={MessageCircle} label="Negotiating" value={metrics.negotiating} />
        <Metric icon={Briefcase} label="Quoted" value={metrics.quoted} />
        <Metric icon={CheckCircle2} label="Closed" value={metrics.closed} />
        <Metric icon={Users} label="Collections" value={metrics.collections} />
        <Metric icon={Calendar} label="Monthly" value={metrics.monthly} />
      </section>

      {/* Kanban */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Inquiry Pipeline</h2>
        <div className="mt-3 grid auto-rows-fr gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-6">
          {STATUSES.map((s) => {
            const cards = inquiries.filter((i) => i.inquiry_status === s);
            return (
              <div key={s} className="min-w-[200px] rounded-lg border border-border bg-surface p-2">
                <div className="mb-2 flex items-center justify-between px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>{s}</span>
                  <span className="rounded-full bg-primary/10 px-1.5 text-primary">{cards.length}</span>
                </div>
                <ul className="space-y-2">
                  {cards.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelected(c)}
                        className="block w-full rounded-md border border-border bg-card p-2 text-left text-xs hover:border-primary"
                      >
                        <div className="truncate font-medium">{c.customer_name || "Anonymous"}</div>
                        <div className="truncate text-muted-foreground">{c.customer_email || "—"}</div>
                        <div className="mt-1 truncate text-[10px] text-muted-foreground">
                          Col · {c.collection_id.slice(0, 8)}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{new Date(c.created_at).toLocaleDateString()}</span>
                          <span className="truncate">
                            {c.assigned_admin_id ? profilesById[c.assigned_admin_id]?.full_name ?? "assigned" : "unassigned"}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                  {cards.length === 0 && (
                    <li className="rounded-md border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">
                      empty
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Collections Manager */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Collection Manager</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Collection</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Items</th>
                <th className="py-2 pr-3">WA Sent</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Updated</th>
                <th className="py-2 pr-3">Notes</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {collections.map((c) => {
                const inq = inquiries.find((i) => i.collection_id === c.id);
                return (
                  <tr key={c.id}>
                    <td className="py-2 pr-3 font-mono">{c.id.slice(0, 8)}</td>
                    <td className="py-2 pr-3">{c.user_name || c.user_email || "—"}</td>
                    <td className="py-2 pr-3">{c.item_count}</td>
                    <td className="py-2 pr-3">{c.whatsapp_sent ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={c.inquiry_status}
                        onChange={(e) => updateCollectionStatus(c.id, e.target.value as Status)}
                        className="rounded border border-border bg-background px-1 py-0.5 text-[11px]"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <NotesCell value={c.internal_notes ?? ""} onSave={(v) => updateCollectionNotes(c.id, v)} />
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <a
                          href={`/collection/${c.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-surface-2"
                        >
                          View
                        </a>
                        {inq && (
                          <button
                            onClick={() => setSelected(inq)}
                            className="rounded border border-primary/40 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10"
                          >
                            Open Inquiry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {collections.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-muted-foreground">No collections yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <InquiryDrawer
          inquiry={selected}
          onClose={() => setSelected(null)}
          onStatus={(s) => updateInquiryStatus(selected.id, s)}
          onNotes={(n) => updateInquiryNotes(selected.id, n)}
          profile={profilesById[selected.assigned_admin_id ?? ""] ?? null}
        />
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Inbox; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}

function NotesCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="flex items-center gap-1">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Notes…"
        className="w-32 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
      />
      {v !== value && (
        <button onClick={() => onSave(v)} className="rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
          Save
        </button>
      )}
    </div>
  );
}

function InquiryDrawer({
  inquiry,
  onClose,
  onStatus,
  onNotes,
  profile,
}: {
  inquiry: Inquiry;
  onClose: () => void;
  onStatus: (s: Status) => void;
  onNotes: (n: string) => void;
  profile: { email: string | null; full_name: string | null } | null;
}) {
  const [notes, setNotes] = useState(inquiry.internal_notes ?? "");
  const [collection, setCollection] = useState<{ id: string; created_at: string } | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; code: string; image_url: string | null }>>([]);

  useEffect(() => setNotes(inquiry.internal_notes ?? ""), [inquiry.id, inquiry.internal_notes]);

  useEffect(() => {
    (async () => {
      const { data: col } = await supabase
        .from("collections")
        .select("id, created_at")
        .eq("id", inquiry.collection_id)
        .maybeSingle();
      setCollection(col ?? null);
      const { data: items } = await supabase
        .from("collection_items")
        .select("product_id")
        .eq("collection_id", inquiry.collection_id);
      const ids = (items ?? []).map((i: { product_id: string }) => i.product_id);
      if (!ids.length) return setProducts([]);
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,code,image_url")
        .in("id", ids);
      setProducts((prods ?? []) as Array<{ id: string; name: string; code: string; image_url: string | null }>);
    })();
  }, [inquiry.collection_id]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <h3 className="font-display text-lg font-semibold">Inquiry Details</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 p-4 text-sm">
          <Section title="Customer Information">
            <Row label="Name" value={inquiry.customer_name} />
            <Row label="Email" value={inquiry.customer_email} />
            <Row label="Phone" value={inquiry.customer_phone} />
            <Row label="WhatsApp" value={inquiry.whatsapp_number} />
          </Section>

          <Section title="Collection Information">
            <Row label="Collection ID" value={inquiry.collection_id} mono />
            <Row label="Total Products" value={String(products.length)} />
            <Row
              label="Created"
              value={collection?.created_at ? new Date(collection.created_at).toLocaleString() : "—"}
            />
          </Section>

          <Section title="Collection Preview">
            {products.length === 0 ? (
              <p className="text-xs text-muted-foreground">No products in this collection.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2">
                {products.map((p) => (
                  <li key={p.id} className="overflow-hidden rounded-md border border-border bg-card">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="h-16 w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-16 w-full bg-muted" />
                    )}
                    <div className="p-1 text-[10px]">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="truncate text-muted-foreground">{p.code}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Inquiry Status">
            <div className="flex items-center gap-2">
              <select
                value={inquiry.inquiry_status}
                onChange={(e) => onStatus(e.target.value as Status)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {inquiry.last_contacted_at && (
                <span className="text-[11px] text-muted-foreground">
                  last · {new Date(inquiry.last_contacted_at).toLocaleString()}
                </span>
              )}
            </div>
            {profile && (
              <p className="mt-2 text-xs text-muted-foreground">Assigned · {profile.full_name || profile.email}</p>
            )}
          </Section>

          <Section title="Internal Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="Internal team notes…"
            />
            <button
              disabled={notes === (inquiry.internal_notes ?? "")}
              onClick={() => onNotes(notes)}
              className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Save notes
            </button>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={`flex-1 break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}
