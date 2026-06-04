import { mkdir, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { createVisualThinking } from "./openrouter.mjs"
import {
  buildFinalPrompt,
  downloadImage,
  generateImage,
  mapAspectRatioToSize,
  normalizeImageUrls,
} from "./images.mjs"
import { selectFirst, uploadImageToSupabase } from "./supabase.mjs"
import { creativePlanToVisualThinking, runCreativeAgent } from "./creative-agent.mjs"
import { pipelinePlanToVisualThinking, runSequentialCreativePipeline } from "./sequential-creative-pipeline.mjs"

function redact(value) {
  if (Array.isArray(value)) return value.map(redact)
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const sensitive = /api[_-]?key|token|secret|password|authorization/i.test(key)
      return [key, sensitive ? "[REDACTED]" : redact(entry)]
    }),
  )
}

function getCreativeAgentOutputs(creativePlan) {
  if (!creativePlan || typeof creativePlan !== "object") return null

  return {
    strategist: creativePlan.strategy || null,
    concept: creativePlan.concept || null,
    artDirector: creativePlan.artDirection || null,
    promptEngineer: creativePlan.promptEngineering || null,
    singleAgentPlan: creativePlan.strategy ? null : creativePlan,
  }
}

export async function runTextToImageWorkflow(body, options = {}) {
  if (!body || typeof body !== "object") throw new Error("Request body must be an object")

  const client = body.client
    ? await selectFirst("Clients", { clientName: body.client }).catch((error) => {
        console.warn(error.message)
        return null
      })
    : null

  const market = client?.clientName
    ? await selectFirst("research_market", { client_name: client.clientName }).catch((error) => {
        console.warn(error.message)
        return null
      })
    : null

  const imageInputs = normalizeImageUrls(body)
  const downloadedImages = await Promise.all(imageInputs.map(downloadImage))
  let creativePlan = null
  let visualThinking = ""
  let prompt = ""
  const pipelineMode = process.env.TEXT_TO_IMAGE_PIPELINE_MODE || "sequential"

  if (process.env.TEXT_TO_IMAGE_USE_LEGACY_VISUAL_THINKING === "true") {
    visualThinking = await createVisualThinking(body, { client, market })
    prompt = buildFinalPrompt(visualThinking, body, downloadedImages)
  } else if (pipelineMode === "single-agent") {
    creativePlan = await runCreativeAgent(body, { client, market }, imageInputs)
    visualThinking = creativePlanToVisualThinking(creativePlan)
    prompt = buildFinalPrompt(visualThinking, body, downloadedImages)
  } else {
    creativePlan = await runSequentialCreativePipeline(body, { client, market }, imageInputs)
    visualThinking = pipelinePlanToVisualThinking(creativePlan)
    prompt = creativePlan.promptEngineering?.final_prompt || buildFinalPrompt(visualThinking, body, downloadedImages)
  }
  const size = mapAspectRatioToSize(body.aspectRatio || body.aspect_ratio || "4:5")
  const finalPrompt = prompt
  const generated = await generateImage({ prompt: finalPrompt, size, images: downloadedImages })

  const outputDir = resolve(options.outputDir || "text-to-image-code/output")
  await mkdir(outputDir, { recursive: true })

  const runId = randomUUID()
  const fileName = `${runId}.${generated.extension}`
  const filePath = resolve(outputDir, fileName)
  await writeFile(filePath, generated.buffer)

  const upload = options.skipUpload
    ? null
    : await uploadImageToSupabase(generated.buffer, {
        extension: generated.extension,
        contentType: generated.contentType,
      }).catch((error) => {
        console.warn(error.message)
        return null
      })

  let logPath = null
  if (process.env.TEXT_TO_IMAGE_GENERATION_LOGS !== "off") {
    const logDir = resolve(options.logDir || process.env.TEXT_TO_IMAGE_LOG_DIR || "text-to-image-code/logs")
    await mkdir(logDir, { recursive: true })
    logPath = resolve(logDir, `${runId}.json`)

    await writeFile(
      logPath,
      JSON.stringify(
        {
          runId,
          createdAt: new Date().toISOString(),
          pipelineMode,
          models: {
            creativePipeline:
              process.env.OPENROUTER_CREATIVE_PIPELINE_MODEL ||
              process.env.OPENROUTER_CREATIVE_AGENT_MODEL ||
              process.env.OPENROUTER_MODEL ||
              "anthropic/claude-sonnet-4.6",
            image: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          },
          request: redact(body),
          context: redact({ client, market }),
          inputImages: imageInputs,
          imageCounts: {
            total: downloadedImages.length,
            material: downloadedImages.filter((image) => image.type === "material").length,
            reference: downloadedImages.filter((image) => image.type === "reference").length,
          },
          agentOutputs: getCreativeAgentOutputs(creativePlan),
          visualThinking,
          finalPrompt,
          image: {
            localPath: filePath,
            localUrl: options.publicPathPrefix ? `${options.publicPathPrefix.replace(/\/$/, "")}/${fileName}` : null,
            publicUrl: upload?.url || null,
            contentType: generated.contentType,
            extension: generated.extension,
            size,
            revisedPrompt: generated.revisedPrompt,
          },
          visualQa: null,
          regeneratedFromVisualQa: false,
        },
        null,
        2,
      ),
    )
  }

  return {
    success: true,
    runId,
    localPath: filePath,
    localUrl: options.publicPathPrefix ? `${options.publicPathPrefix.replace(/\/$/, "")}/${fileName}` : null,
    publicUrl: upload?.url || null,
    gemini: upload?.url || null,
    imageCount: downloadedImages.length,
    materialImageCount: downloadedImages.filter((image) => image.type === "material").length,
    referenceImageCount: downloadedImages.filter((image) => image.type === "reference").length,
    inputImageUrls: imageInputs,
    size,
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    visualThinking,
    creativePlan,
    pipelineMode,
    visualQa: null,
    regeneratedFromVisualQa: false,
    finalPrompt,
    revisedPrompt: generated.revisedPrompt,
    logPath,
  }
}
