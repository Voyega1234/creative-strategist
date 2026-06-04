# Text-to-Image Code Workflow

Standalone Node.js version of the `n8n_imagegen.json` workflow, upgraded with a creative-agency planning agent.

It mirrors and upgrades the workflow at a code level:

1. Accepts a JSON request payload.
2. Fetches client/category context from Supabase when available.
3. Runs a two-agent creative pipeline: Art Director -> Prompt Engineer.
4. Uses the Prompt Engineer output as the production-ready image prompt.
5. Downloads reference and material images.
6. Calls OpenAI Images API.
7. Saves the generated image locally and optionally uploads it to Supabase Storage.
8. Writes a JSON generation log with the request, agent outputs, final prompt, and image metadata.

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

- The implementation defaults to `gpt-image-2`.
- You can override with `OPENAI_IMAGE_MODEL=...` if you want to test another image model.
- If reference/material images are present, the code uses `/v1/images/edits`.
- If no images are present, the code uses `/v1/images/generations`.

## Creative Pipeline

The default workflow is now a two-agent pipeline:

1. **Art Director** creates the single best advertising concept direction from the full brief, copy, brand context, reference/style input, and constraints.
2. **Prompt Engineer** refines that direction into one production-ready `gpt-image-2` prompt.
3. **gpt-image-2** generates the image.

Controls:

```bash
TEXT_TO_IMAGE_PIPELINE_MODE=sequential
OPENROUTER_CREATIVE_PIPELINE_MODEL=anthropic/claude-sonnet-4.6
TEXT_TO_IMAGE_USE_LEGACY_VISUAL_THINKING=false
```

Set `TEXT_TO_IMAGE_PIPELINE_MODE=single-agent` to use the older combined planner.
If `OPENROUTER_API_KEY` is missing, the workflow still runs with deterministic fallback outputs, but the best quality requires the two LLM steps.

## Generation Logs

Each successful run writes a JSON log to `text-to-image-code/logs/<runId>.json` by default. The log includes:

- request payload with sensitive key-like fields redacted
- Supabase client/market context used by the workflow
- Art Director and Prompt Engineer outputs
- final prompt sent to `gpt-image-2`
- generated image path, URL, model, size, and revised prompt

Controls:

```bash
TEXT_TO_IMAGE_GENERATION_LOGS=on
TEXT_TO_IMAGE_LOG_DIR=text-to-image-code/logs
```

Set `TEXT_TO_IMAGE_GENERATION_LOGS=off` to disable local log files.

## Gemini Visual QA Critic

This module is currently kept in the codebase but disabled from the main workflow. It can ask Gemini to judge whether the result feels human-designed, AI-assisted, or raw AI output, then append critique to the prompt and regenerate once.

Controls:

```bash
GEMINI_API_KEY=...
TEXT_TO_IMAGE_VISUAL_QA=off
TEXT_TO_IMAGE_VISUAL_QA_MODEL=gemini-3.5-flash
TEXT_TO_IMAGE_VISUAL_QA_THRESHOLD=7.5
TEXT_TO_IMAGE_VISUAL_QA_REGENERATE=false
```

The current `workflow.mjs` does not call this module. Re-enable the workflow integration before setting these flags back to `on`.
