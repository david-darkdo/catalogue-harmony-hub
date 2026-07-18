import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchFeedProducts, fetchTaxonomy, type FeedFilters } from "@/lib/catalog";

type FeedSearch = {
  type?: string;
  category?: string;
  subcategory?: string;
};

function validateFeedSearch(s: Record<string, unknown>): FeedSearch {
  const pick = (k: string) => {
    const v = s[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return { type: pick("type"), category: pick("category"), subcategory: pick("subcategory") };
}

const taxonomyQuery = queryOptions({
  queryKey: ["taxonomy"],
  queryFn: fetchTaxonomy,
  staleTime: 5 * 60_000,
});

const feedQuery = (f: FeedFilters) =>
  queryOptions({
    queryKey: ["feed", f],
    queryFn: () => fetchFeedProducts(f),
  });

export const Route = createFileRoute("/")({
  validateSearch: validateFeedSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(taxonomyQuery);
    context.queryClient.ensureQueryData(feedQuery(deps));
  },
  head: () => ({
    meta: [
      { title: "Discover — Stoneworks" },
      {
        name: "description",
        content: "Browse curated tiles, doors, plumbing and finishes.",
      },
    ],
  }),
  component: FeedPage,
  errorComponent: ({ error }) => {
    const rawUrl = typeof process !== "undefined" ? process.env.SUPABASE_URL : "no process";
    const rawKey = typeof process !== "undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY : "no process";
    const viteUrl = import.meta.env.VITE_SUPABASE_URL || "no viteUrl";
    return (
      <div className="p-6 text-sm text-destructive font-mono">
        <div>Error: {error.message}</div>
        <div className="mt-4 text-xs text-muted-foreground border-t border-destructive/20 pt-4">
          <div>process.env.SUPABASE_URL: {rawUrl}</div>
          <div>process.env.SUPABASE_PUBLISHABLE_KEY: {rawKey ? rawKey.substring(0, 15) + "..." : "none"}</div>
          <div>VITE_SUPABASE_URL: {viteUrl}</div>
        </div>
      </div>
    );
  },
});

function FeedPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: tax } = useSuspenseQuery(taxonomyQuery);
  const products = useQuery(feedQuery(search));

  const activeType = tax.types.find((t) => t.slug === search.type);
  const categoriesForType = activeType
    ? tax.categories.filter((c: any) => c.type_id === activeType.id)
    : [];
  const activeCategory = categoriesForType.find((c) => c.slug === search.category);
  const subcategoriesForCat = activeCategory
    ? tax.subcategories.filter((s: any) => s.category_id === activeCategory.id)
    : [];
  const activeSub = subcategoriesForCat.find((s) => s.slug === search.subcategory);

  const setType = (slug?: string) =>
    navigate({ to: "/", search: { type: slug, category: undefined, subcategory: undefined } });
  const setCategory = (slug?: string) =>
    navigate({
      to: "/",
      search: { ...search, category: slug, subcategory: undefined },
    });
  const setSub = (slug?: string) =>
    navigate({ to: "/", search: { ...search, subcategory: slug } });

  return (
    <AppShell>
      <div className="container-app pt-4">
        {/* Type row */}
        <FilterRow>
          <Pill active={!search.type} onClick={() => setType(undefined)}>
            All
          </Pill>
          {tax.types.map((t) => (
            <Pill key={t.id} active={search.type === t.slug} onClick={() => setType(t.slug)}>
              {t.name}
            </Pill>
          ))}
        </FilterRow>

        {/* Category row */}
        {activeType && (
          <FilterRow tone="muted">
            <Pill active={!search.category} onClick={() => setCategory(undefined)}>
              All
            </Pill>
            {categoriesForType.map((c) => (
              <Pill
                key={c.id}
                active={search.category === c.slug}
                onClick={() => setCategory(c.slug)}
              >
                {c.name}
              </Pill>
            ))}
          </FilterRow>
        )}

        {/* Subcategory row */}
        {activeCategory && subcategoriesForCat.length > 0 && (
          <FilterRow tone="muted">
            <Pill active={!search.subcategory} onClick={() => setSub(undefined)}>
              All Sizes
            </Pill>
            {subcategoriesForCat.map((s) => (
              <Pill
                key={s.id}
                active={search.subcategory === s.slug}
                onClick={() => setSub(s.slug)}
              >
                {s.name}
              </Pill>
            ))}
          </FilterRow>
        )}

        <div className="mt-5">
          <h1 className="font-display text-xs uppercase tracking-[0.18em] text-accent">
            {activeSub
              ? `${activeCategory?.name} · ${activeSub.name}`
              : activeCategory
                ? activeCategory.name
                : activeType
                  ? activeType.name
                  : "All Materials"}
          </h1>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
            Discover the catalogue
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))
            : (products.data ?? []).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>

        {!products.isLoading && (products.data ?? []).length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No products match these filters yet.
            </p>
            <Link
              to="/"
              search={{}}
              className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Reset filters
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FilterRow({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <div
      className={`-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 ${
        tone === "muted" ? "opacity-95" : ""
      }`}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
