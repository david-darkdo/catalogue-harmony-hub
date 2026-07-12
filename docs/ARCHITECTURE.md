# Technical Architecture

## Overview Diagram
*   **Client**: React 19 SPA running TanStack Router.
*   **Server**: TanStack Start (SSR & server functions) running on Vite and Nitro.
*   **Database**: Supabase PostgreSQL with RLS and schema triggers.
*   **Storage**: Cloudinary CDN hosting all catalog images.
*   **AI Engine**: Google AI Studio (Gemini 2.5 Flash and Imagen 3).

## Frontend Architecture
*   **Framework**: React 19, TanStack Router (file-based routing), TanStack Query (state cache).
*   **Styling**: Tailwind CSS V4, Lucide Icons, Shadcn components.
*   **State Management**: Local storage for guest collections, TanStack caches for catalog nodes.

## Backend & API Integrations
*   **Server Actions**: TanStack Start `createServerFn` handlers executing in a secure Node environment.
*   **Supabase Client**: Standard `@supabase/supabase-js` client using publishable keys in the browser and service-role keys in server routines.
*   **Cloudinary**: REST-based signed server uploads and unsigned browser uploads.
*   **AI API**: Direct REST requests to Google AI Studio, avoiding Lovable gateway dependencies.

## Key Subsystems Interactions
*   **Client Upload**: Browser uploads files directly to Cloudinary via unsigned presets -> saves secure URL references to Supabase.
*   **AI Generator**: Imagen 3 generates image base64 bytes -> server functions sign requests to upload bytes to Cloudinary -> writes URL to product_assets.
*   **Search**: Triggers build a TSVector document index in the database on product updates, ranked on queries using pg_trgm.
