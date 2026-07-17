import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/catalog";
import { ArrowLeft } from "lucide-react";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { publicImageUrl } from "@/components/ImageUploader";

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
  loader: async ({ context, params, request }) => {
    const origin = new URL(request.url).origin;
    const product = await context.queryClient.ensureQueryData(productQuery(params.slug));
    context.queryClient.ensureQueryData(relatedQuery(product.family_id, product.id));

    // Fetch taxonomy parents
    const [typeRes, categoryRes, subcategoryRes, familyRes] = await Promise.all([
      product.type_id ? supabase.from("product_types").select("name, slug").eq("id", product.type_id).maybeSingle() : Promise.resolve({ data: null }),
      product.category_id ? supabase.from("categories").select("name, slug").eq("id", product.category_id).maybeSingle() : Promise.resolve({ data: null }),
      product.subcategory_id ? supabase.from("subcategories").select("name, slug").eq("id", product.subcategory_id).maybeSingle() : Promise.resolve({ data: null }),
      product.family_id ? supabase.from("family_groups").select("name, slug").eq("id", product.family_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    return {
      product,
      origin,
      taxonomy: {
        type: typeRes.data,
        category: categoryRes.data,
        subcategory: subcategoryRes.data,
        family: familyRes.data,
      }
    };
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    const origin = loaderData?.origin || "https://showroom.enreach.concepts";
    const title = product?.seo_title || `${product?.name || "Product"} — Enreach Concepts`;
    const desc = product?.seo_description || product?.short_description || "Premium building material details.";
    const imageUrl = product?.generated_studio_image || product?.image_url || "";
    const canonical = `${origin}/product/${product?.slug || ""}`;

    return {
      meta: [
        { title: title },
        { name: "description", content: desc },
        // Open Graph / Facebook
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: imageUrl ? publicImageUrl(imageUrl) : "" },
        { property: "og:url", content: canonical },
        // Twitter Card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: imageUrl ? publicImageUrl(imageUrl) : "" },
      ],
      links: [
        { rel: "canonical", href: canonical }
      ]
    };
  },
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
  const { product, origin, taxonomy } = Route.useLoaderData();
  const { data: related = [] } = useSuspenseQuery(
    relatedQuery(product.family_id, product.id),
  );

  const studio = publicImageUrl(product.generated_studio_image) || publicImageUrl(product.image_url);
  const installed = publicImageUrl(product.generated_installed_image) || publicImageUrl(product.image_url);

  // Build breadcrumbs paths
  const breadcrumbs = [
    { label: "Home", path: "/" }
  ];
  if (taxonomy.type) {
    breadcrumbs.push({ label: taxonomy.type.name, path: `/${taxonomy.type.slug}` });
    if (taxonomy.category) {
      breadcrumbs.push({ label: taxonomy.category.name, path: `/${taxonomy.type.slug}/${taxonomy.category.slug}` });
      if (taxonomy.subcategory) {
        breadcrumbs.push({ label: taxonomy.subcategory.name, path: `/${taxonomy.type.slug}/${taxonomy.category.slug}/${taxonomy.subcategory.slug}` });
        if (taxonomy.family) {
          breadcrumbs.push({ label: taxonomy.family.name, path: `/${taxonomy.type.slug}/${taxonomy.category.slug}/${taxonomy.subcategory.slug}/${taxonomy.family.slug}` });
        }
      }
    }
  }
  breadcrumbs.push({ label: product.name, path: `/product/${product.slug}` });

  // Schema BreadcrumbList
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((b, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": b.label,
      "item": b.path.startsWith("/") ? `${origin}${b.path}` : b.path
    }))
  };

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": [studio, installed].filter(Boolean),
    "description": product.generated_description || product.short_description || "",
    "sku": product.code,
    "mpn": product.code,
    "brand": {
      "@type": "Brand",
      "name": product.brand || "Enreach Concepts"
    },
    "offers": {
      "@type": "Offer",
      "url": `${origin}/product/${product.slug}`,
      "priceCurrency": "USD",
      "price": product.price,
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  };

  return (
    <AppShell>
      {/* Structured Data JSON-LD Injections */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {product.structured_data && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(product.structured_data) }}
        />
      )}
      <div className="container-app pt-2">
        {/* Visual Breadcrumb navigation */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          {breadcrumbs.map((b, index) => (
            <span key={index} className="flex items-center gap-1.5 shrink-0">
              {index > 0 && <span className="text-muted-foreground/40">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-foreground">{b.label}</span>
              ) : (
                <Link to={b.path} className="hover:text-primary transition">
                  {b.label}
                </Link>
              )}
            </span>
          ))}
        </nav>


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
            {product.brand ?? "Enreach Concepts"} · Code {product.code}
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
            <AddToCollectionButton
              productId={product.id}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            />
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
