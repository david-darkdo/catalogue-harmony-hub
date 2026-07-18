import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Search, LayoutDashboard, Briefcase, Package, Layers, Users, FolderHeart, Mail, Activity, Sparkles, Wrench, Bell, X, AlertCircle, Trash2 } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Stoneworks" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { loading, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadNotifications = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("communication_queue")
      .select("*")
      .eq("user_id", user.id)
      .eq("channel_type", "push")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setNotifications(data);
    }
  };

  useEffect(() => {
    if (user?.id && showNotifications) {
      void loadNotifications();
    }
  }, [user?.id, showNotifications]);

  const clearNotification = async (id: string) => {
    await supabase.from("communication_queue").delete().eq("id", id);
    void loadNotifications();
  };

  const onSearchCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSearching(true);
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .ilike("code", code.trim())
      .maybeSingle();
    setSearching(false);
    if (error) return toast.error(error.message);
    if (data?.id) {
      navigate({ to: "/admin/products/$id", params: { id: data.id } });
      setCode("");
    } else {
      toast.error(`No product with code "${code}"`);
    }
  };

  if (loading) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have admin access. Ask a super admin to grant you the <code>admin</code> role.
        </p>
      </div>
    );
  }

  const tabs = [
    { to: "/admin" as const, label: "Operations", icon: LayoutDashboard, active: pathname === "/admin" },
    { to: "/admin/products" as const, label: "Products", icon: Package, active: pathname.startsWith("/admin/products") },
    { to: "/admin/pipeline" as const, label: "Pipeline", icon: Activity, active: pathname.startsWith("/admin/pipeline") },
    { to: "/admin/hierarchy" as const, label: "Hierarchy", icon: Layers, active: pathname.startsWith("/admin/hierarchy") },
    { to: "/admin/ai-templates" as const, label: "AI Templates", icon: Sparkles, active: pathname.startsWith("/admin/ai-templates") },
    { to: "/admin/diagnostics" as const, label: "Diagnostics", icon: Wrench, active: pathname.startsWith("/admin/diagnostics") },
    { to: "/admin/customers" as const, label: "Customers", icon: Users, active: pathname.startsWith("/admin/customers") },
    { to: "/admin/collections" as const, label: "Collections", icon: FolderHeart, active: pathname.startsWith("/admin/collections") },
    { to: "/admin/email" as const, label: "Communication Center", icon: Mail, active: pathname.startsWith("/admin/email") },
    { to: "/admin/business" as const, label: "Business", icon: Briefcase, active: pathname.startsWith("/admin/business") },
  ];

  return (
    <div className="min-h-[60vh]">
      <div className="border-b border-border bg-background">
        <div className="container-app flex flex-wrap items-center gap-3 py-3">
          <div className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  t.active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </Link>
            ))}
          </div>
          <div className="relative ml-auto flex items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition shrink-0">
              <span>Storefront Feed</span>
            </Link>
            {/* Admin Notifications Bell */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-foreground transition hover:border-primary"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {notifications.filter(n => n.status === "PENDING").length > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-lg border border-border bg-card shadow-xl p-4 text-xs space-y-3 z-50">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-semibold text-foreground">In-App Notifications</span>
                      <button onClick={() => setShowNotifications(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="p-2 border border-border rounded bg-background flex gap-2 relative group text-left">
                          <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground truncate">{notif.subject || "Alert"}</div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{notif.body}</p>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); clearNotification(notif.id); }}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {notifications.length === 0 && (
                        <div className="text-muted-foreground italic text-center py-4">No notifications yet.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <form onSubmit={onSearchCode} className="relative flex min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter Product Code"
              className="w-full rounded-md border border-border bg-card py-1.5 pl-8 pr-20 text-xs outline-none focus:border-primary"
            />
            <button
              disabled={searching}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {searching ? "…" : "Open"}
            </button>
          </form>
        </div>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
