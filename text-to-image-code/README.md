# Text-to-Image Code Workflow

Standalone Node.js version of the `n8n_imagegen.json` workflow.

It mirrors the workflow at a code level:

1. Accepts a JSON request payload.
2. Fetches client/category context from Supabase when available.
3. Uses OpenRouter to create the art-direction / visual-thinking prompt.
4. Downloads reference and material images.
5. Calls OpenAI Images API.
6. Saves the generated image locally and optionally uploads it to Supabase Storage.

## Requirements

- Node.js 22+
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- Supabase env vars if you want DB context or storage upload

Copy the example env file:

```bash
cp text-to-image-code/.env.example text-to-image-code/.env
```

## Run a Local Test

Edit `samples/request.json`, then run:

```bash
node text-to-image-code/src/cli.mjs text-to-image-code/samples/request.json
```

The generated image is written to `text-to-image-code/output/`.

## Start a Local Webhook Server

```bash
node text-to-image-code/src/server.mjs
```

Then POST to:

```bash
curl -X POST http://localhost:8787/generate-image \
  -H "Content-Type: application/json" \
  --data @text-to-image-code/samples/request.json
```

## Input Shape

```json
{
  "client": "Brand name",
  "prompt": "Main brief",
  "userBrief": "Style or user constraints",
  "core_concept": "Optional concept",
  "saved_ideas": [],
  "reference_image_url": "https://...",
  "reference_image_urls": ["https://..."],
  "material_image_urls": ["https://..."],
  "aspect_ratio": "4:5",
  "color_palette": ["#111111", "#ffffff"],
  "use_brand_identity": true
}
```

## Notes

- The current OpenAI docs list GPT Image models as `gpt-image-2`, `gpt-image-1`, and `gpt-image-1-mini`; this implementation defaults to `gpt-image-2`.
- The old n8n workflow used `gpt-image-2`. You can override with `OPENAI_IMAGE_MODEL=gpt-image-2` if your account has access.
- If reference/material images are present, the code uses `/v1/images/edits`.
- If no images are present, the code uses `/v1/images/generations`.
