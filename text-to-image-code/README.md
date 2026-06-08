# Text-to-Image Code Workflow

Standalone Node.js version of the current n8n text-to-image workflow.

This version intentionally mirrors the n8n capability set. It does not include the later multi-agent, QA, or creative refinement experiments.

## What It Does

1. Accepts the same JSON payload shape as `/api/generate-image`.
2. Optionally fetches client and market context from Supabase.
3. Runs the same visual-thinking step through OpenRouter when `OPENROUTER_API_KEY` is available.
4. Downloads material images and reference images.
5. Builds the final OpenAI image prompt in the same structure as the n8n Code node.
6. Calls OpenAI Images API.
   - Uses `/v1/images/edits` when material/reference images are attached.
   - Uses `/v1/images/generations` when no images are attached.
7. Saves the generated image locally.
8. Optionally uploads the image to Supabase Storage.

## Requirements

- Node.js 22+
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY` if you want the visual-thinking step instead of direct-brief fallback
- Supabase env vars if you want DB context or storage upload

Copy the example env file:

```bash
cp text-to-image-code/.env.example text-to-image-code/.env
```

## Run Locally

```bash
node text-to-image-code/src/cli.mjs text-to-image-code/samples/request.json
```

The generated image is written to `text-to-image-code/output/`.

## Local Webhook Server

```bash
node text-to-image-code/src/server.mjs
```

Then POST to:

```bash
curl -X POST http://localhost:8787/generate-image \
  -H "Content-Type: application/json" \
  --data @text-to-image-code/samples/request.json
```

`GET /generate-image` returns a small usage message. `GET /health` returns `{ "ok": true }`.

## App Route Provider

`app/api/generate-image/route.ts` defaults to the code workflow:

```bash
TEXT_TO_IMAGE_PROVIDER=code
```

To compare with the old n8n webhook:

```bash
TEXT_TO_IMAGE_PROVIDER=n8n
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

- The workflow defaults to `gpt-image-2`.
- Override the image model with `OPENAI_IMAGE_MODEL`.
- Image quality defaults to `medium`.
- Output format defaults to `png`.
