# Project Current Status

## Completed & Verified Modules
*   **Infrastructure Migration**: Decoupled from Lovable wrappers. Vite compiles standard client and server (Nitro SSR) environments, producing `.output` and `.vercel/output` structures.
*   **Database Schema**: Successfully pushed all 18 SQL migrations to the new Supabase project (`hcvusncrtueuclvfdhkd`). Verified the presence of all 22 tables, 15 triggers, 18 functions/RPCs, and 59 RLS policies.
*   **Storage Model**: Replaced Supabase Storage bucket with Cloudinary. Direct client uploads use unsigned presets, and server-side uploads run with signed parameters. Initialized `product-images` storage bucket in Supabase for backward compatibility.
*   **Super Admin Access**: Assigned `daviddarkdo@gmail.com` the `super_admin` role in `public.user_roles` to allow immediate access to the Admin Command Center.
*   **Google OAuth Redirects**: Patched the Site URL to `https://catalogue-harmony-hub.vercel.app` and added allow-list redirects for local development and Vercel.

## Partially Completed Modules
*   **AI Queue Runner**: Pipeline jobs are tracked in the database, but execution is triggered client-side (manually in `admin.pipeline.tsx` or on product creation). If the admin closes their tab, the queue stalls.
*   **Prompt Sandbox**: Prompt Editor and visual variables sandbox are functional, but prompts are not yet fully database-driven for client-side outputs.
*   **Collections Lookbook**: Selections save locally for guests and sync to accounts on auth. Shareable Lookbook links and pre-filled WhatsApp inquiry forms are active.

## Missing Modules (Identified)
*   **Email Campaign Delivery Worker**: The email campaign editor exists and writes to `email_campaign_logs`, but the actual background worker to trigger Resend emails for campaigns is not yet implemented.
*   **Analytics Page**: No dedicated analytics tab exists, although basic counts are displayed on the main admin index dashboard.

## Known Blockers & Technical Debt
*   **Google Auth Credentials**: The Google Auth Provider is disabled in the Supabase Dashboard. This requires manual input of the Google OAuth Client ID and Secret by the project owner.
*   **Stalled Jobs**: Stalled jobs must be manually set to pending using the database `retry_ai_job` RPC or the "Run now" button in the pipeline interface.
