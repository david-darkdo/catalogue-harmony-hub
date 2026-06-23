import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Search, LayoutGrid, Bookmark, User } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <TopBar />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search as { q?: string } });
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
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", label: "Home", icon: Home, active: pathname === "/" },
    { to: "/search", label: "Search", icon: Search, active: pathname.startsWith("/search") },
    { to: "/", label: "Feed", icon: LayoutGrid, active: false },
    { to: "/", label: "Saved", icon: Bookmark, active: false },
    { to: "/", label: "Account", icon: User, active: false },
  ] as const;
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
