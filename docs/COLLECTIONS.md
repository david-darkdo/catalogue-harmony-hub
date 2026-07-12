# Collections & Lookbook System

## Architecture
*   **Unauthenticated Users**: Saved selections are stored in the client browser's local storage.
*   **Authenticated Users**: Selections are saved to the database (`collections` and `collection_items` tables).

## Session Merging
*   When a guest user logs in, a trigger function merges local storage lookbook selections into their database account.

## Sharing & Brochure Exports
*   Users can generate shareable lookbook URLs.
*   Lookbooks can be exported to PDFs, listing items, specifications, and codes.
*   Includes a direct button to send lookbook links to sales consultants via WhatsApp.
