# Changelog

## [1.0.0] - 2026-07-12
### Added
*   Complete set of architectural and business documentation inside `/docs`.
*   Direct Google AI Studio text completions integration.
*   Direct Google AI Studio Imagen 3 image rendering integration.
*   Cloudinary storage and deletion backend server actions.
*   Support for Cloudinary browser-side direct uploads.

### Fixed
*   Vercel deployment build crash fixed by adding the Nitro plugin to `vite.config.ts`.
*   Standardized Google OAuth authentication in the login router.
*   Removed Lovable telemetry packages.
