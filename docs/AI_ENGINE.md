# AI Pipeline Engine

## Gemini & Imagen 3 Integration
*   **Text completions**: Requests route directly to `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` using the OpenAI client contract. This model analyzes specification sheets to extract catalog attributes and draft luxury descriptions.
*   **Image generations**: Requests route directly to the Imagen 3 endpoint `imagen-3.0-generate-002:generateImages`. This model processes descriptions to render high-resolution 1:1 aspect ratio PNG mockups.

## Pipeline Job States
1.  **understanding**: LLM categorizes finishes, colors, materials, and features.
2.  **description**: Drafts descriptive copy tailored for the luxury Nigerian construction market.
3.  **seo**: Writes titles, keywords, description tags, and slug fields.
4.  **faq_generation**: Compiles 5 common client questions and answers.
5.  **image_generation**: Triggers Imagen 3, converts output base64 data to PNG buffers, and uploads them to Cloudinary.
6.  **search_index**: Regenerates the search vector database entries.

## Error Recovery
*   Failed tasks set product state to `failed`.
*   Error messages are written directly to `error_log` inside the jobs record.
*   Admins can re-trigger failed tasks using the Admin OS dashboard.
