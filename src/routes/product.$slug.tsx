import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/catalog";
import { Bookmark, ArrowLeft } from "lucide-react";

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const p = await fetchProductBySlug(slug);
      if (!p) throw notFound();
      return p;
    },
  });

const relatedQuery = (familyId: string | null, excludeId: string) =>
  queryOptions({
    queryKey: ["related", familyId, excludeId],
    queryFn: () => fetchRelatedProducts(familyId, excludeId),
    enabled: !!familyId,
  });

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ context, params }) => {
    const product = await context.queryClient.ensureQueryData(productQuery(params.slug));
    context.queryClient.ensureQueryData(relatedQuery(product.family_id, product.id));
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Stoneworks` },
      { name: "description", content: "Premium building material details." },
    ],
  }),
  component: ProductPage,
  notFoundComponent: () => (
    <AppShell>
      <div className="container-app py-16 text-center">
        <h1 className="font-display text-2xl">Product not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Back to feed
        </Link>
      </div>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQuery(slug));
  const { data: related = [] } = useSuspenseQuery(
    relatedQuery(product.family_id, product.id),
  );

  const studio = product.generated_studio_image || product.image_url;
  const installed = product.generated_installed_image || product.image_url;

  return (
    <AppShell>
      <div className="container-app pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            <img
              src={studio ?? ""}
              alt={product.name}
              className="aspect-square w-full object-cover"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-muted">
            <img
              src={installed ?? ""}
              alt={`${product.name} installed`}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
            <p className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Installed reference
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-accent">
            {product.brand ?? "Stoneworks"} · Code {product.code}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="mt-2 font-display text-2xl font-semibold text-[oklch(0.55_0.1_82)]">
            ${Number(product.price).toFixed(2)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/sqm</span>
          </p>

          {product.short_description && (
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {product.short_description}
            </p>
          )}

          <dl className="mt-5 grid grid-cols-3 gap-3 text-xs">
            {[
              ["Color", product.color],
              ["Material", product.material],
              ["Finish", product.finish],
            ].map(([k, v]) =>
              v ? (
                <div
                  key={k as string}
                  className="rounded-lg border border-border bg-surface p-3"
                >
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-1 font-medium text-foreground">{v}</dd>
                </div>
              ) : null,
            )}
          </dl>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Bookmark className="h-4 w-4" />
              Add to Collection
            </button>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xs uppercase tracking-[0.18em] text-accent">
              From the same family
            </h2>
            <p className="font-display text-xl font-semibold">Related products</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
