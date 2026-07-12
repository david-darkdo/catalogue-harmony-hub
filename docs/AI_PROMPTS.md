# Dynamic Prompt Engine

## Prompt Structure
Prompts are database-driven templates stored in the `ai_prompt_templates` table. This allows prompt edits to occur without requiring code redeployments.

## Context Variables
Templates use curly-brace variable interpolation:
*   `{name}`: Product name.
*   `{brand}`: Manufacturer brand.
*   `{material}`: Identified material.
*   `{color}`: Identified color.
*   `{finish}`: Finish classification (polished, matte, brushed).
*   `{size}`: Product dimension descriptors.

## Fallback Hierarchy
1.  **Custom Prompt**: Explicit override prompt specified by the admin in the product editor.
2.  **Category Template**: Specific prompt registered for the product's category.
3.  **Type Template**: Specific prompt registered for the product's type.
4.  **System Fallback**: Global default template defined in the codebase.

## Admin Editor
*   Allows the editing of templates.
*   Supports live testing to preview AI responses against current products before committing changes.
