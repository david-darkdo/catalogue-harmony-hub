import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sitemap/xml")({
  loader: async () => {
    const urls: string[] = [
      "https://showroom.enreach.concepts/",
      "https://showroom.enreach.concepts/contact",
      "https://showroom.enreach.concepts/search",
    ];

    try {
      // 1. Fetch published products
      const { data: products } = await supabase
        .from("products")
        .select("slug, updated_at")
        .eq("status", "published");

      if (products) {
        for (const p of products) {
          urls.push(`https://showroom.enreach.concepts/product/${p.slug}`);
        }
      }

      // 2. Fetch categories
      const { data: categories } = await supabase
        .from("categories")
        .select("slug");

      if (categories) {
        for (const c of categories) {
          urls.push(`https://showroom.enreach.concepts/search?category=${c.slug}`);
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
  component: () => null,
});
