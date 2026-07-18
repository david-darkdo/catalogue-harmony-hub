import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  loader: async ({ request }) => {
    const origin = new URL(request.url).origin;
    
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /account
Disallow: /account/*
Disallow: /favorites
Disallow: /favorites/*

Sitemap: ${origin}/sitemap.xml
Host: ${origin}
`;

    return new Response(robotsTxt, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=3600, s-maxage=18000",
      },
    });
  },
  component: () => null,
});
