import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, APP_SETTINGS_QUERY_KEY } from "@/lib/settings";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Settings as SettingsIcon, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Company Settings — Stoneworks" }] }),
  component: SettingsPage,
});

const FIELDS: [string, string, string?][] = [
  ["support_whatsapp", "Support WhatsApp", "Used for the floating WhatsApp button"],
  ["sales_whatsapp", "Sales WhatsApp", "Used for Push to WhatsApp from collections"],
  ["company_email", "Company Email"],
  ["company_address", "Company Address"],
  ["map_url", "Map URL"],
  ["facebook_url", "Facebook URL"],
  ["instagram_url", "Instagram URL"],
  ["tiktok_url", "TikTok URL"],
];

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useAppSettings();
  const { loading: authLoading, isSuperAdmin } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const next: Record<string, string> = {};
    for (const [k] of FIELDS) next[k] = (settings as any)[k] ?? "";
    setForm(next);
  }, [settings]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, string | null> = {};
    for (const [k] of FIELDS) payload[k] = form[k]?.trim() || null;
    // Upsert: update existing row, else insert a new one.
    const { error } = settings?.id
      ? await supabase.from("app_settings").update(payload as any).eq("id", settings.id)
      : await supabase.from("app_settings").insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settings saved");
    // Global cache invalidation → floating buttons & contact sections re-render immediately.
    await queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
  };

  if (authLoading) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="container-app py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <h1 className="font-display text-lg font-semibold">Super Admin only</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Company settings can only be edited by a super admin.
          </p>
          <Link to="/account" className="mt-4 inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary">
            Back to account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-semibold">Company Settings</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        These values power the floating WhatsApp button, Push to WhatsApp, and the home contact section.
      </p>

      <form onSubmit={save} className="mt-6 grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([key, label, hint]) => (
          <label key={key} className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <input
              value={form[key] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
          </label>
        ))}
        <div className="sm:col-span-2">
          <button
            disabled={saving}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
