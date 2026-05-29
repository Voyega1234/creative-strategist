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

  const visualThinking = await createVisualThinking(body, { client, market })
  const imageInputs = normalizeImageUrls(body)
  const downloadedImages = await Promise.all(imageInputs.map(downloadImage))
  const prompt = buildFinalPrompt(visualThinking, body, downloadedImages)
  const size = mapAspectRatioToSize(body.aspectRatio || body.aspect_ratio || "4:5")
  const generated = await generateImage({ prompt, size, images: downloadedImages })

  const outputDir = resolve(options.outputDir || "text-to-image-code/output")
  await mkdir(outputDir, { recursive: true })

  const fileName = `${randomUUID()}.${generated.extension}`
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

  return {
    success: true,
    localPath: filePath,
    localUrl: options.publicPathPrefix ? `${options.publicPathPrefix.replace(/\/$/, "")}/${fileName}` : null,
    publicUrl: upload?.url || null,
    gemini: upload?.url || null,
    imageCount: downloadedImages.length,
    size,
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    visualThinking,
    finalPrompt: prompt,
    revisedPrompt: generated.revisedPrompt,
  }
}
