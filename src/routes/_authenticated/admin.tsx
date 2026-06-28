import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Search, LayoutDashboard, Briefcase, Package, Layers, Users, FolderHeart, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Stoneworks" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);

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
    { to: "/admin/hierarchy" as const, label: "Hierarchy", icon: Layers, active: pathname.startsWith("/admin/hierarchy") },
    { to: "/admin/customers" as const, label: "Customers", icon: Users, active: pathname.startsWith("/admin/customers") },
    { to: "/admin/collections" as const, label: "Collections", icon: FolderHeart, active: pathname.startsWith("/admin/collections") },
    { to: "/admin/email" as const, label: "Email", icon: Mail, active: pathname.startsWith("/admin/email") },
    { to: "/admin/business" as const, label: "Business", icon: Briefcase, active: pathname.startsWith("/admin/business") },
  ];

  return (
    <div className="min-h-[60vh]">
      <div className="sticky top-[57px] z-20 border-b border-border bg-background/95 backdrop-blur">
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
          <form onSubmit={onSearchCode} className="relative ml-auto flex min-w-[220px] flex-1 sm:max-w-xs">
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
      <Outlet />
    </div>
  );
}
