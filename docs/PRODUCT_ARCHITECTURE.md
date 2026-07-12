# Product Architecture (PIM)

## Taxonomy Structure
The product information manager uses a 5-tier taxonomy:
1.  **Product Type**: Root categorization (e.g., Tiles, Doors, Sanitaryware).
2.  **Category**: Second-level taxonomy (e.g., Ceramic Tiles, Flush Doors).
3.  **Subcategory**: Third-level taxonomy (e.g., Large Format).
4.  **Family Group**: Branding and collections (e.g., Carrara Series).
5.  **Product**: The individual physical catalog item.

## Product Code System
*   Unique codes are assigned to products on ingestion (e.g., `TL-CER-0024`).
*   Codes are generated using the `generate_product_code` database function.

## Media Asset Workflow
*   **Original Photos**: Uploaded by admins to represent the physical item.
*   **AI Studio Renderings**: Rendered by Imagen 3 against neutral studio backdrops.
*   **AI Context Renderings**: Rendered by Imagen 3 showing products installed in situated luxury layouts.
