import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const urls: string[] = [];
        const origin = new URL(request.url).origin;

        urls.push(`${origin}/`);
        urls.push(`${origin}/contact`);
        urls.push(`${origin}/search`);

        try {
          // 1. Fetch types
          const { data: types } = await supabase.from("product_types").select("slug");
          if (types) {
            for (const t of types) {
              urls.push(`${origin}/${t.slug}`);
            }
          }

          // 2. Fetch categories
          const { data: categories } = await supabase
            .from("categories")
            .select("slug, product_types(slug)");
          if (categories) {
            for (const c of categories) {
              const typeSlug = (c as any).product_types?.slug;
              if (typeSlug) {
                urls.push(`${origin}/${typeSlug}/${c.slug}`);
              }
            }
          }

          // 3. Fetch subcategories
          const { data: subcategories } = await supabase
            .from("subcategories")
            .select("slug, categories(slug, product_types(slug))");
          if (subcategories) {
            for (const s of subcategories) {
              const cat = (s as any).categories;
              const catSlug = cat?.slug;
              const typeSlug = cat?.product_types?.slug;
              if (typeSlug && catSlug) {
                urls.push(`${origin}/${typeSlug}/${catSlug}/${s.slug}`);
              }
            }
          }

          // 4. Fetch family groups
          const { data: families } = await supabase
            .from("family_groups")
            .select("slug, subcategory_id, category_id");
          if (families) {
            const { data: allCats } = await supabase
              .from("categories")
              .select("id, slug, product_types(slug)");
            const { data: allSubs } = await supabase
              .from("subcategories")
              .select("id, slug, categories(slug, product_types(slug))");
            const catMap = new Map(allCats?.map((c) => [c.id, c]));
            const subMap = new Map(allSubs?.map((s) => [s.id, s]));

            for (const f of families) {
              if (f.subcategory_id && subMap.has(f.subcategory_id)) {
                const sub = subMap.get(f.subcategory_id);
                const subSlug = sub?.slug;
                const catSlug = sub?.categories?.slug;
                const typeSlug = sub?.categories?.product_types?.slug;
                if (typeSlug && catSlug && subSlug) {
                  urls.push(`${origin}/${typeSlug}/${catSlug}/${subSlug}/${f.slug}`);
                }
              } else if (f.category_id && catMap.has(f.category_id)) {
                const cat = catMap.get(f.category_id);
                const catSlug = cat?.slug;
                const typeSlug = cat?.product_types?.slug;
                if (typeSlug && catSlug) {
                  urls.push(`${origin}/${typeSlug}/${catSlug}/all/${f.slug}`);
                }
              }
            }
          }

          // 5. Fetch published products
          const { data: products } = await supabase
            .from("products")
            .select("slug")
            .eq("status", "published")
            .eq("processing_state", "completed")
            .eq("hidden", false)
            .is("deleted_at", null);

          if (products) {
            for (const p of products) {
              urls.push(`${origin}/product/${p.slug}`);
            }
          }
        } catch (err) {
          console.error("Failed to generate dynamic sitemap urls:", err);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls
    .map(
      (url) => `
  <url>
    <loc>${url}</loc>
    <changefreq>daily</changefreq>
    <priority>${url.includes("/product/") ? "0.8" : "1.0"}</priority>
  </url>`
    )
    .join("")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600, s-maxage=18000",
          },
        });
      },
    },
  },
});
