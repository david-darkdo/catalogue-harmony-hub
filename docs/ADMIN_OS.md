# Admin Operating System

## Dashboard Overview
The Admin OS provides control over the catalog, AI jobs, and customer interactions. It is located under the `/admin` route space.

## Core Modules
*   **PIM & Product Manager**: Interface to create, modify, publish, or hide catalog items.
*   **AI Job Monitor**: Live status dashboard displaying pending, running, completed, and failed jobs.
*   **CRM Lead View**: Monitors WhatsApp lookbook quote requests, customer entries, and notes.
*   **Hierarchy Configurator**: Panel to add and delete Types, Categories, Subcategories, and Family Groups.
*   **Prompt Settings**: Direct editor for database prompt templates.

## Security & Permissions
*   Routes are guarded by Supabase Auth checks in `auth-middleware.ts`.
*   Permissions are validated against the `user_roles` table. Only users possessing the `admin` or `super_admin` role can access the `/admin` path.
