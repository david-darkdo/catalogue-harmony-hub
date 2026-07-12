# Production Deployment Guide

## Vercel Setup
1.  Import project repository in Vercel.
2.  Set **Framework Preset** to `TanStack Start`.
3.  Add required environment variables (see environment checklist).
4.  Configure **Install Command**: `npm install --legacy-peer-deps`.
5.  Configure **Build Command**: `npm run build`.
6.  Ensure **Output Directory** is set to `.output`.

## Supabase Database Setup
1.  Create a fresh Supabase database.
2.  Link local repository: `supabase link --project-ref your-ref`.
3.  Deploy migrations: `supabase db push`.

## Cloudinary Configuration
1.  Create a Cloudinary account.
2.  In settings, add an **Unsigned Upload Preset** matching `VITE_CLOUDINARY_UPLOAD_PRESET`. Set target folder to `products`.

## CI/CD Workflow
*   Commits pushed to `main` branch automatically compile and build on Vercel.
*   Failed builds alert administrators. Rollbacks can be triggered directly in Vercel by selecting previous deployments.
