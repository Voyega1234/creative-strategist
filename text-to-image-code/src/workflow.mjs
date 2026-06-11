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

  const visualThinking = await createVisualThinking(body, { client })
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

  return {
    success: true,
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
}
