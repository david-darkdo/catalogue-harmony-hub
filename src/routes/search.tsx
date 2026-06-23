import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { fetchFeedProducts } from "@/lib/catalog";
import { Search as SearchIcon } from "lucide-react";

const schema = z.object({
  q: fallback(z.string(), "").default(""),
  type: fallback(z.string().optional(), undefined),
  category: fallback(z.string().optional(), undefined),
  subcategory: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title: "Search — Stoneworks" },
      { name: "description", content: "Search across the catalogue." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const results = useQuery(
    queryOptions({
      queryKey: ["search", search],
      queryFn: () => fetchFeedProducts(search),
      enabled: search.q.trim().length > 0,
    }),
  );

  return (
    <AppShell>
      <div className="container-app pt-4">
        <h1 className="font-display text-xs uppercase tracking-[0.18em] text-accent">
          Search
        </h1>
        <p className="font-display text-2xl font-semibold tracking-tight">
          Find materials by name, code, color or finish
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            navigate({
              to: "/search",
              search: { ...search, q: String(data.get("q") || "") },
            });
          }}
          className="relative mt-4"
        >
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={search.q}
            autoFocus
            placeholder='Try "carrara", "oak", "matte"…'
            className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
          />
        </form>

        {(search.type || search.category || search.subcategory) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Limited to filters: {[search.type, search.category, search.subcategory].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {search.q.trim() === "" ? (
            <p className="col-span-full text-sm text-muted-foreground">
              Type something to start searching.
            </p>
          ) : results.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
            ))
          ) : (results.data ?? []).length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">
              No matches. Try a different word.
            </p>
          ) : (
            (results.data ?? []).map((p) => <ProductCard key={p.id} product={p} />)
          )}
        </div>
      </div>
    </AppShell>
  );
}
