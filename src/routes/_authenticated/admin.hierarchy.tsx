import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Archive, ArchiveRestore, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hierarchy")({
  component: HierarchyPage,
});

type TableName = "product_types" | "categories" | "subcategories" | "family_groups";
async function reorder(table: TableName, rows: { id: string; sort_order?: number | null }[], id: string, dir: -1 | 1) {
  const sorted = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const idx = sorted.findIndex((r) => r.id === id);
  const swapIdx = idx + dir;
  if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
  const a = sorted[idx];
  const b = sorted[swapIdx];
  const aOrder = a.sort_order ?? idx;
  const bOrder = b.sort_order ?? swapIdx;
  await supabase.from(table).update({ sort_order: bOrder } as any).eq("id", a.id);
  await supabase.from(table).update({ sort_order: aOrder } as any).eq("id", b.id);
}


type Row = { id: string; name: string; slug?: string; type_id?: string; category_id?: string; subcategory_id?: string; code_prefix?: string; installation_context_id?: string; is_archived?: boolean; sort_order?: number | null };
type Ctx = { id: string; name: string };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function HierarchyPage() {
  const [types, setTypes] = useState<Row[]>([]);
  const [cats, setCats] = useState<Row[]>([]);
  const [subs, setSubs] = useState<Row[]>([]);
  const [fams, setFams] = useState<Row[]>([]);
  const [contexts, setContexts] = useState<Ctx[]>([]);

  const load = async () => {
    const [t, c, s, f, ic] = await Promise.all([
      supabase.from("product_types").select("id,name,slug,code_prefix,installation_context_id,is_archived,sort_order").order("sort_order").order("name"),
      supabase.from("categories").select("id,name,slug,type_id,is_archived,sort_order").order("sort_order").order("name"),
      supabase.from("subcategories").select("id,name,slug,category_id,is_archived,sort_order").order("sort_order").order("name"),
      supabase.from("family_groups").select("id,name,slug,subcategory_id,is_archived,sort_order").order("sort_order").order("name"),
      supabase.from("installation_contexts").select("id,name").order("name"),
    ]);
    setTypes((t.data ?? []) as any);
    setCats((c.data ?? []) as any);
    setSubs((s.data ?? []) as any);
    setFams((f.data ?? []) as any);
    setContexts((ic.data ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="container-app py-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Hierarchy Management</h1>
        <p className="text-sm text-muted-foreground">Product Types › Categories › Subcategories › Family Groups</p>
      </div>

      <Section
        tableName="product_types"
        onReorder={async (r, dir) => { await reorder("product_types", types, r.id, dir); load(); }}
        title="Product Types"
        rows={types}
        extras={contexts}
        onCreate={async (name) => {
          const code_prefix = name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
          const installation_context_id = contexts[0]?.id;
          if (!installation_context_id) return toast.error("Create an installation context first.");
          const { error } = await supabase.from("product_types").insert({ name, slug: slugify(name), code_prefix, installation_context_id } as any);
          if (error) toast.error(error.message); else { toast.success("Created"); load(); }
        }}
        onUpdate={async (r) => {
          const { error } = await supabase.from("product_types").update({ name: r.name, slug: r.slug, code_prefix: r.code_prefix, installation_context_id: r.installation_context_id } as any).eq("id", r.id);
          if (error) toast.error(error.message); else { toast.success("Saved"); load(); }
        }}
        onDelete={async (id) => { const { error } = await supabase.from("product_types").delete().eq("id", id); if (error) toast.error(error.message); else { toast.success("Deleted"); load(); } }}
        onArchive={async (r) => { const { error } = await supabase.from("product_types").update({ is_archived: !r.is_archived } as any).eq("id", r.id); if (error) toast.error(error.message); else { toast.success(r.is_archived ? "Restored" : "Archived"); load(); } }}
        renderExtra={(r, set) => (
          <>
            <input value={r.code_prefix ?? ""} onChange={(e) => set({ ...r, code_prefix: e.target.value.toUpperCase() })} placeholder="PREFIX" className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono uppercase" />
            <select value={r.installation_context_id ?? ""} onChange={(e) => set({ ...r, installation_context_id: e.target.value })} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
              {contexts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}
      />

      <Section
        tableName="categories"
        onReorder={async (r, dir) => { await reorder("categories", cats.filter(c => c.type_id === r.type_id), r.id, dir); load(); }}
        title="Categories"
        rows={cats}
        parentLabel="Type"
        parents={types}
        parentKey="type_id"
        onCreate={async (name, parent_id) => {
          if (!parent_id) return toast.error("Select a type");
          const { error } = await supabase.from("categories").insert({ name, slug: slugify(name), type_id: parent_id } as any);
          if (error) toast.error(error.message); else { toast.success("Created"); load(); }
        }}
        onUpdate={async (r) => { const { error } = await supabase.from("categories").update({ name: r.name, slug: r.slug, type_id: r.type_id } as any).eq("id", r.id); if (error) toast.error(error.message); else { toast.success("Saved"); load(); } }}
        onDelete={async (id) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) toast.error(error.message); else { toast.success("Deleted"); load(); } }}
        onArchive={async (r) => { const { error } = await supabase.from("categories").update({ is_archived: !r.is_archived } as any).eq("id", r.id); if (error) toast.error(error.message); else { toast.success(r.is_archived ? "Restored" : "Archived"); load(); } }}
      />

      <Section
        tableName="subcategories"
        onReorder={async (r, dir) => { await reorder("subcategories", subs.filter(s => s.category_id === r.category_id), r.id, dir); load(); }}
        title="Subcategories"
        rows={subs}
        parentLabel="Category"
        parents={cats}
        parentKey="category_id"
        onCreate={async (name, parent_id) => {
          if (!parent_id) return toast.error("Select a category");
          const { error } = await supabase.from("subcategories").insert({ name, slug: slugify(name), category_id: parent_id } as any);
          if (error) toast.error(error.message); else { toast.success("Created"); load(); }
        }}
        onUpdate={async (r) => { const { error } = await supabase.from("subcategories").update({ name: r.name, slug: r.slug, category_id: r.category_id } as any).eq("id", r.id); if (error) toast.error(error.message); else { toast.success("Saved"); load(); } }}
        onDelete={async (id) => { const { error } = await supabase.from("subcategories").delete().eq("id", id); if (error) toast.error(error.message); else { toast.success("Deleted"); load(); } }}
        onArchive={async (r) => { const { error } = await supabase.from("subcategories").update({ is_archived: !r.is_archived } as any).eq("id", r.id); if (error) toast.error(error.message); else { toast.success(r.is_archived ? "Restored" : "Archived"); load(); } }}
      />

      <Section
        tableName="family_groups"
        onReorder={async (r, dir) => { await reorder("family_groups", fams.filter(f => f.subcategory_id === r.subcategory_id), r.id, dir); load(); }}
        title="Family Groups"
        rows={fams}
        parentLabel="Subcategory"
        parents={subs}
        parentKey="subcategory_id"
        onCreate={async (name, parent_id) => {
          if (!parent_id) return toast.error("Select a subcategory");
          const { error } = await supabase.from("family_groups").insert({ name, slug: slugify(name), subcategory_id: parent_id } as any);
          if (error) toast.error(error.message); else { toast.success("Created"); load(); }
        }}
        onUpdate={async (r) => { const { error } = await supabase.from("family_groups").update({ name: r.name, slug: r.slug, subcategory_id: r.subcategory_id } as any).eq("id", r.id); if (error) toast.error(error.message); else { toast.success("Saved"); load(); } }}
        onDelete={async (id) => { const { error } = await supabase.from("family_groups").delete().eq("id", id); if (error) toast.error(error.message); else { toast.success("Deleted"); load(); } }}
        onArchive={async (r) => { const { error } = await supabase.from("family_groups").update({ is_archived: !r.is_archived } as any).eq("id", r.id); if (error) toast.error(error.message); else { toast.success(r.is_archived ? "Restored" : "Archived"); load(); } }}
      />
    </div>
  );
}

function Section({
  title, rows, parents, parentKey, parentLabel, onCreate, onUpdate, onDelete, onArchive, renderExtra, extras,
}: {
  title: string;
  rows: Row[];
  parents?: Row[];
  parentKey?: string;
  parentLabel?: string;
  onCreate: (name: string, parent_id?: string) => Promise<unknown>;
  onUpdate: (r: Row) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onArchive?: (r: Row) => Promise<unknown>;
  renderExtra?: (r: Row, set: (r: Row) => void) => React.ReactNode;
  extras?: any;
}) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [edit, setEdit] = useState<Record<string, Row>>({});
  const [showArchived, setShowArchived] = useState(false);
  void extras;

  const startEdit = (r: Row) => setEdit({ ...edit, [r.id]: { ...r } });
  const cancel = (id: string) => { const e = { ...edit }; delete e[id]; setEdit(e); };
  const visible = rows.filter((r) => showArchived || !r.is_archived);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {parents && (
          <select value={parent} onChange={(e) => setParent(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
            <option value="">— {parentLabel} —</option>
            {parents.filter((p) => !p.is_archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${title.slice(0, -1).toLowerCase()} name`} className="flex-1 min-w-[180px] rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary" />
        <button
          onClick={async () => { if (!name.trim()) return; await onCreate(name.trim(), parent || undefined); setName(""); }}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <ul className="mt-3 divide-y divide-border text-sm">
        {visible.map((r) => {
          const e = edit[r.id];
          if (e) {
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <input value={e.name} onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, name: ev.target.value } })} className="flex-1 min-w-[160px] rounded-md border border-border bg-background px-2 py-1 text-sm" />
                <input value={e.slug ?? ""} onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, slug: ev.target.value } })} placeholder="slug" className="w-32 rounded-md border border-border bg-background px-2 py-1 text-xs" />
                {parents && parentKey && (
                  <select value={(e as any)[parentKey] ?? ""} onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, [parentKey]: ev.target.value } as any })} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                    {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                {renderExtra?.(e, (next) => setEdit({ ...edit, [r.id]: next }))}
                <button onClick={async () => { await onUpdate(e); cancel(r.id); }} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">Save</button>
                <button onClick={() => cancel(r.id)} className="rounded-md border border-border px-2 py-1 text-xs">Cancel</button>
              </li>
            );
          }
          return (
            <li key={r.id} className={`flex flex-wrap items-center gap-2 py-2 ${r.is_archived ? "opacity-60" : ""}`}>
              <span className="flex-1 font-medium">{r.name}</span>
              {r.is_archived && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-600">Archived</span>}
              {r.slug && <span className="text-xs text-muted-foreground font-mono">{r.slug}</span>}
              {r.code_prefix && <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono">{r.code_prefix}</span>}
              <button onClick={() => startEdit(r)} className="rounded-md border border-border px-2 py-1 text-xs" title="Edit"><Pencil className="h-3 w-3" /></button>
              {onArchive && (
                <button
                  onClick={async () => { await onArchive(r); }}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                  title={r.is_archived ? "Restore" : "Archive"}
                >
                  {r.is_archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                </button>
              )}
              <button
                onClick={async () => { if (confirm(`Permanently delete "${r.name}"? Products keeping this reference will be un-linked.`)) await onDelete(r.id); }}
                className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                title="Delete"
              ><Trash2 className="h-3 w-3" /></button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="py-3 text-xs text-muted-foreground">None yet.</li>}
      </ul>
    </section>
  );
}
