# Architecture Decision Records & Version History

## ADR 1: Lovable Decoupling (July 2026)
*   **Decision**: Remove Lovable config wrappers and OAuth proxies.
*   **Rationale**: Ensure production independence, prevent telemetry errors, and allow deployments to standard Vercel accounts.
*   **Result**: Migration to native Supabase client libraries and standard Vite compilation plugins.

## ADR 2: Cloudinary Storage (July 2026)
*   **Decision**: Transition asset storage from Supabase Storage buckets to Cloudinary.
*   **Rationale**: Cloudinary provides high-performance media CDN delivery and real-time transformations.
*   **Result**: Integrated direct unsigned uploads on the client and signed uploads on the server.

## ADR 3: Direct Google AI Studio Integration (July 2026)
*   **Decision**: Bypass Lovable's AI proxy and call Google AI Studio endpoints directly.
*   **Rationale**: Ensure API call reliability and avoid third-party routing.
*   **Result**: Switched to direct Gemini/Imagen endpoints using local API keys.
