# Search Engine Architecture

## Database Integration
The search engine is built directly into PostgreSQL using Supabase:
*   The search documents are cached in the `search_index` table to ensure quick queries.
*   Updates to products or AI understanding tags trigger automatic index updates.

## Normalization & Aliases
*   The `generate_size_aliases` database function normalizes dimension searches. A query for "600x600" will match items described as "60x60 cm" or "600x600 mm".
*   Common typos and spelling variations are mapped to keywords.

## Match Ranking
*   Uses `ts_rank_cd` to sort results.
*   Matches in titles and brands receive higher weights than matches in description copies.
*   Provides structured filtering for categories and subcategories.
