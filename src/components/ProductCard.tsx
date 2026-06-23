import { Link } from "@tanstack/react-router";
import type { ProductRow } from "@/lib/catalog";
import { Bookmark } from "lucide-react";

export function ProductCard({ product }: { product: ProductRow }) {
  const img =
    product.generated_studio_image ||
    product.image_url ||
    "https://placehold.co/600x600/eee/aaa?text=No+Image";

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md">
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="block aspect-square overflow-hidden bg-muted"
      >
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="font-display text-base font-semibold leading-tight text-foreground line-clamp-1">
            {product.name}
          </h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            Code · {product.code}
          </p>
        </div>
        <p className="font-display text-lg font-semibold text-[oklch(0.55_0.1_82)]">
          ${Number(product.price).toFixed(2)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">/sqm</span>
        </p>
        <div className="mt-auto flex gap-2 pt-2">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[11px] font-medium text-foreground transition hover:border-primary hover:text-primary"
          >
            <Bookmark className="h-3.5 w-3.5" />
            Add to Collection
          </button>
          <Link
            to="/product/$slug"
            params={{ slug: product.slug }}
            className="flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
