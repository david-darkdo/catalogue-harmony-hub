import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Search, Compass, Bookmark, User, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
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
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      if (!cancelled) setIsAdmin(Boolean(data));
    });
    return () => { cancelled = true; };
  }, [user]);

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
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
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
    </header>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/" as const, label: "Home", icon: Home, active: pathname === "/" },
    { to: "/search" as const, label: "Search", icon: Search, active: pathname.startsWith("/search") },
    { to: "/feed" as const, label: "Feed", icon: Compass, active: pathname.startsWith("/feed") },
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
