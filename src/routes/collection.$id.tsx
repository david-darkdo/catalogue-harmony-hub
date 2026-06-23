import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsByIds } from "@/lib/collection";
import { useAppSettings, waLink } from "@/lib/settings";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/collection/$id")({
  head: () => ({ meta: [{ title: "Shared Collection — Stoneworks" }] }),
  component: SharedCollection,
});

function SharedCollection() {
  const { id } = Route.useParams();
  const { data: settings } = useAppSettings();
  const [name, setName] = useState<string>("Shared Collection");
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase.from("collections").select("name").eq("id", id).maybeSingle();
      if (c?.name) setName(c.name);
      const { data: items } = await supabase
        .from("collection_items")
        .select("product_id")
        .eq("collection_id", id);
      setProducts(await fetchProductsByIds((items ?? []).map((i) => i.product_id)));
    };
    load();
  }, [id]);

  const message = [
    `Hi! I'd like to inquire about this collection: ${name}`,
    ...products.map((p) => `• ${p.name} (Code: ${p.code})`),
    "",
    `Link: ${typeof window !== "undefined" ? window.location.href : ""}`,
  ].join("\n");

  return (
    <div className="container-app py-6">
      <h1 className="font-display text-2xl font-semibold">{name}</h1>
      <p className="text-sm text-muted-foreground">{products.length} item{products.length === 1 ? "" : "s"}</p>

      {settings?.sales_whatsapp && (
        <a
          href={waLink(settings.sales_whatsapp, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <MessageCircle className="h-4 w-4" /> Inquire on WhatsApp
        </a>
      )}

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p.id}>
            <Link to="/product/$slug" params={{ slug: p.slug }} className="block overflow-hidden rounded-lg border border-border bg-card">
              <div className="aspect-square overflow-hidden bg-muted">
                <img src={p.generated_studio_image || p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="p-2">
                <div className="line-clamp-1 text-sm font-medium">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">Code · {p.code}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
