import { mkdir, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { createVisualThinkingPlan } from "./openrouter.mjs"
import {
  buildFinalPrompt,
  downloadImage,
  generateImage,
  mapAspectRatioToSize,
  normalizeImageUrls,
} from "./images.mjs"
import { selectFirst, uploadImageToSupabase } from "./supabase.mjs"

function localDateStamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(date)
}

function safeLogPayload(payload) {
  return JSON.parse(
    JSON.stringify(payload, (_key, value) => {
      if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`
      if (typeof value === "string" && value.startsWith("data:image/")) {
        return `[data-url:${value.length}]`
      }
      return value
    }),
  )
}

async function writeWorkflowLog(runId, payload, options = {}) {
  if (process.env.TEXT_TO_IMAGE_SAVE_LOGS !== "true" || options.skipLog) return null

  const now = new Date()
  const dateDir = localDateStamp(now)
  const logDir = resolve(options.logDir || `text-to-image-code/logs/${dateDir}`)
  await mkdir(logDir, { recursive: true })

  const timestamp = now.toISOString().replace(/[:.]/g, "-")
  const logPath = resolve(logDir, `${timestamp}-${runId}.json`)
  await writeFile(logPath, `${JSON.stringify(safeLogPayload(payload), null, 2)}\n`)
  return logPath
}

export async function runTextToImageWorkflow(body, options = {}) {
  if (!body || typeof body !== "object") throw new Error("Request body must be an object")
  const runId = randomUUID()

  const client = body.client
    ? await selectFirst("Clients", { clientName: body.client }).catch((error) => {
        console.warn(error.message)
        return null
      })
    : null

  const visualThinkingPlan = await createVisualThinkingPlan(body, { client, creativeSeed: runId })
  const visualThinking = visualThinkingPlan.visualThinking
  const imageInputs = normalizeImageUrls(body)
  const downloadedImages = await Promise.all(imageInputs.map(downloadImage))
  const prompt = buildFinalPrompt(visualThinking, body, downloadedImages)
  const size = mapAspectRatioToSize(body.aspectRatio || body.aspect_ratio || "4:5")
  const generated = await generateImage({ prompt, size, images: downloadedImages })

  let filePath = null
  let localUrl = null
  if (options.saveLocal) {
    const outputDir = resolve(options.outputDir || "text-to-image-code/output")
    await mkdir(outputDir, { recursive: true })

    const fileName = `${randomUUID()}.${generated.extension}`
    filePath = resolve(outputDir, fileName)
    await writeFile(filePath, generated.buffer)
    localUrl = options.publicPathPrefix ? `${options.publicPathPrefix.replace(/\/$/, "")}/${fileName}` : null
  }

  const upload = options.skipUpload
    ? null
    : await uploadImageToSupabase(generated.buffer, {
        extension: generated.extension,
        contentType: generated.contentType,
      }).catch((error) => {
        console.warn(error.message)
        return null
      })
  const dataUrl = upload?.url
    ? null
    : `data:${generated.contentType};base64,${generated.buffer.toString("base64")}`

  const result = {
    success: true,
    runId,
    localPath: filePath,
    localUrl,
    publicUrl: upload?.url || null,
    gemini: upload?.url || null,
    dataUrl,
    imageCount: downloadedImages.length,
    size,
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    visualThinking,
    finalPrompt: prompt,
    revisedPrompt: generated.revisedPrompt,
  }

  const logPath = await writeWorkflowLog(runId, {
    runId,
    createdAt: new Date().toISOString(),
    input: body,
    client,
    imageInputs,
    visualThinking,
    finalPrompt: prompt,
    imageRequest: {
      size,
      imageCount: downloadedImages.length,
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    },
    imageResult: {
      publicUrl: upload?.url || null,
      localPath: filePath,
      localUrl,
      revisedPrompt: generated.revisedPrompt,
    },
  }, options)

  return {
    ...result,
    logPath,
  }
}
