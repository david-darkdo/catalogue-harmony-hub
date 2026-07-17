import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Search, Compass, Bookmark, User, LogOut, Shield, Bell, X, AlertCircle, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FloatingWhatsApp } from "./FloatingWhatsApp";
import { SiteFooter } from "./SiteFooter";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <TopBar />
      <main>{children}</main>
      <FloatingWhatsApp />
      <SiteFooter />
      <BottomNav />
    </div>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search as { q?: string } });
  const { user, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="container-app flex items-center gap-3 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
            S
          </span>
          <span className="hidden font-display text-base font-semibold tracking-tight sm:inline">
            Stoneworks
          </span>
        </Link>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const q = String(data.get("q") || "").trim();
            navigate({ to: "/search", search: { q } });
          }}
          className="relative flex-1"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={search?.q ?? ""}
            placeholder="Search Building Materials…"
            className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:bg-card"
          />
        </form>
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          {user && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setMenuOpen(false);
                }}
                className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground transition hover:border-primary"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter(n => n.status === "PENDING").length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse"></span>
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
                      <div key={notif.id} className="p-2 border border-border rounded bg-background flex gap-2 relative group">
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

          {/* Account Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setMenuOpen((o) => !o);
                setShowNotifications(false);
              }}
              aria-label="Account menu"
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card hover:border-primary"
            >
              <User className="h-4 w-4" />
            </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-border bg-card shadow-lg">
              {user ? (
                <>
                  <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
                  <Link to="/collection" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm hover:bg-surface-2">My Collection</Link>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2"><Shield className="h-3.5 w-3.5" /> Admin</Link>
                  )}
                  <button onClick={signOut} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
                </>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm hover:bg-surface-2">Sign in</Link>
                  <Link to="/collection" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm hover:bg-surface-2">My Collection</Link>
                  <Link to="/account" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm hover:bg-surface-2">Contact</Link>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/home" as const, label: "Home", icon: Home, active: pathname.startsWith("/home") },
    { to: "/search" as const, label: "Search", icon: Search, active: pathname.startsWith("/search") },
    { to: "/" as const, label: "Feed", icon: Compass, active: pathname === "/" },
    { to: "/collection" as const, label: "Collection", icon: Bookmark, active: pathname.startsWith("/collection") },
    { to: "/account" as const, label: "Account", icon: User, active: pathname.startsWith("/account") },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <ul className="container-app flex items-center justify-between py-2">
        {items.map((it, i) => (
          <li key={i} className="flex-1">
            <Link
              to={it.to}
              search={it.to === "/search" ? { q: "" } : undefined}
              className={`flex flex-col items-center gap-0.5 py-1 text-[10px] uppercase tracking-wider transition ${
                it.active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
