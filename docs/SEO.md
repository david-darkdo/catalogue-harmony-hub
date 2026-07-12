# Search Engine Optimization (SEO)

## Metadata Strategy
*   Every catalog page generates specific HTML meta tags using TanStack Router's head wrappers.
*   Open Graph (OG) and Twitter card tags reference high-quality product images.

## Structured Data (JSON-LD)
*   **Product Schema**: Injected on product pages to feed Google Search with title, brand, description, and asset details.
*   **FAQPage Schema**: Injected on product pages containing generated FAQs, rendering collapsible questions in search results.
*   **BreadcrumbList Schema**: Details site hierarchy paths.

## Indexing Strategy
*   Canonical URLs are defined for every route to avoid duplicate indexing.
*   An automated script builds the sitemap dynamically based on published products.
*   Robots.txt tells crawlers which pages to index and excludes the `/admin` path.
