import "server-only"
import sharp from "sharp"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_IMAGE_MODEL = "openai/gpt-image-2.5-flare"

type GeminiPart = {
  text?: string
  inlineData?: { data?: string; mimeType?: string }
  inline_data?: { data?: string; mime_type?: string }
  fileData?: { fileUri?: string; mimeType?: string }
  file_data?: { file_uri?: string; mime_type?: string }
}

type GeminiContent = {
  role?: string
  parts?: GeminiPart[]
}

type GeminiGenerationConfig = {
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stopSequences?: string[]
  responseMimeType?: string
  response_mime_type?: string
  responseSchema?: Record<string, unknown>
  responseModalities?: string[]
  imageConfig?: {
    aspectRatio?: string
    imageSize?: string
  }
}

type GeminiRequest = {
  contents?: GeminiContent[]
  systemInstruction?: GeminiContent
  system_instruction?: GeminiContent
  generationConfig?: GeminiGenerationConfig
  generation_config?: GeminiGenerationConfig
  tools?: Array<Record<string, unknown>>
}

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured")
  return apiKey
}

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_APP_NAME || "Creative Compass",
  }
}

function normalizeTextModel(model: string): string {
  if (model.includes("/")) return model

  const aliases: Record<string, string> = {
    "gemini-2.0-flash-exp": "google/gemini-2.0-flash-001",
  }

  return aliases[model] || `google/${model}`
}

function getInlineData(part: GeminiPart) {
  if (part.inlineData?.data) {
    return {
      data: part.inlineData.data,
      mimeType: part.inlineData.mimeType || "application/octet-stream",
    }
  }
  if (part.inline_data?.data) {
    return {
      data: part.inline_data.data,
      mimeType: part.inline_data.mime_type || "application/octet-stream",
    }
  }
  return null
}

function getFileData(part: GeminiPart) {
  if (part.fileData?.fileUri) {
    return {
      url: part.fileData.fileUri,
      mimeType: part.fileData.mimeType || "application/octet-stream",
    }
  }
  if (part.file_data?.file_uri) {
    return {
      url: part.file_data.file_uri,
      mimeType: part.file_data.mime_type || "application/octet-stream",
    }
  }
  return null
}

function partToChatContent(part: GeminiPart): Record<string, unknown> | null {
  if (typeof part.text === "string") return { type: "text", text: part.text }

  const inline = getInlineData(part)
  if (inline) {
    const url = `data:${inline.mimeType};base64,${inline.data}`
    if (inline.mimeType === "application/pdf") {
      return { type: "file", file: { filename: "document.pdf", file_data: url } }
    }
    return { type: "image_url", image_url: { url } }
  }

  const file = getFileData(part)
  if (file) {
    if (file.mimeType === "application/pdf") {
      return { type: "file", file: { filename: "document.pdf", file_data: file.url } }
    }
    return { type: "image_url", image_url: { url: file.url } }
  }

  return null
}

function contentsToMessages(body: GeminiRequest) {
  const messages: Array<Record<string, unknown>> = []
  const systemInstruction = body.systemInstruction || body.system_instruction
  const systemText = systemInstruction?.parts
    ?.map((part) => part.text)
    .filter((value): value is string => typeof value === "string")
    .join("\n")

  if (systemText) messages.push({ role: "system", content: systemText })

  for (const content of body.contents || []) {
    const parts = (content.parts || []).map(partToChatContent).filter(Boolean)
    const role = content.role === "model" ? "assistant" : content.role === "system" ? "system" : "user"
    messages.push({ role, content: parts })
  }

  return messages
}

function containsWebSearch(body: GeminiRequest): boolean {
  return Boolean(
    body.tools?.some((tool) => "googleSearch" in tool || "google_search" in tool || tool.type === "openrouter:web_search"),
  )
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return ""
      const value = part as Record<string, unknown>
      return typeof value.text === "string" ? value.text : ""
    })
    .filter(Boolean)
    .join("\n")
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function toGeminiTextPayload(rawPayload: unknown) {
  const payload = asRecord(rawPayload)
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const choice = asRecord(choices[0])
  const message = asRecord(choice.message)
  const text = extractMessageText(message.content)
  const annotations = Array.isArray(message.annotations) ? message.annotations : []
  const groundingChunks = annotations
    .map((annotation) => asRecord(asRecord(annotation).url_citation))
    .filter((citation) => typeof citation.url === "string")
    .map((citation) => ({
      web: {
        uri: citation.url,
        title: typeof citation.title === "string" ? citation.title : citation.url,
      },
    }))

  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text }] },
        finishReason: choice.finish_reason,
        groundingMetadata: groundingChunks.length > 0 ? { groundingChunks } : undefined,
      },
    ],
    usageMetadata: payload.usage,
    modelVersion: payload.model,
    id: payload.id,
  }
}

function toGeminiImagePayload(rawPayload: unknown) {
  const payload = asRecord(rawPayload)
  const data = Array.isArray(payload.data) ? payload.data : []
  const parts = data.flatMap((rawImage) => {
    const image = asRecord(rawImage)
    if (typeof image.b64_json !== "string") return []
    const mimeType =
      typeof image.media_type === "string"
        ? image.media_type
        : typeof payload.output_format === "string"
          ? `image/${payload.output_format}`
          : "image/png"
    return [{ inlineData: { data: image.b64_json, mimeType } }]
  })

  return {
    candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }],
    usageMetadata: payload.usage,
    modelVersion: payload.model,
    id: payload.id,
  }
}

async function adaptSuccessfulResponse(response: Response, adapter: (payload: unknown) => unknown): Promise<Response> {
  if (!response.ok) return response
  const payload = await response.json()
  return Response.json(adapter(payload), { status: response.status })
}

export async function openRouterGenerateImage({
  prompt,
  inputReferences = [],
  resolution,
  aspectRatio,
  size,
  signal,
}: {
  prompt: string
  inputReferences?: string[]
  resolution?: string
  aspectRatio?: string
  size?: string
  signal?: AbortSignal
}): Promise<Response> {
  const model = process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL
  // Retired 4:5 requests now produce 4:3 output, without cropping back.
  if (aspectRatio?.trim() === "4:5") aspectRatio = "4:3"
  // Preserve the existing 5:4 fallback for Flare.
  const fallbackRatios: Record<string, string> = { "5:4": "4:3" }
  const nativeRatio = model === "openai/gpt-image-2.5-flare" && aspectRatio
    ? fallbackRatios[aspectRatio] || aspectRatio
    : aspectRatio
  const needsCrop = Boolean(aspectRatio && nativeRatio !== aspectRatio)
  const requestBody: Record<string, unknown> = {
    model,
    prompt: needsCrop
      ? `${prompt}\n\nThe final image will be center-cropped to ${aspectRatio}. Keep all text, logos, products and essential content inside the central 90% of the canvas; leave only expendable background at the edges.`
      : prompt,
    n: 1,
  }

  if (resolution) requestBody.resolution = resolution
  if (nativeRatio) requestBody.aspect_ratio = nativeRatio
  if (size) requestBody.size = size
  if (inputReferences.length > 0) {
    requestBody.input_references = inputReferences.slice(0, 14).map((url) => ({
      type: "image_url",
      image_url: { url },
    }))
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/images`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(requestBody),
    signal,
  })
  if (!response.ok || !needsCrop) return response

  const payload = await response.json()
  const [ratioWidth, ratioHeight] = aspectRatio!.split(":").map(Number)
  for (const image of payload.data || []) {
    if (typeof image.b64_json !== "string") continue
    const input = Buffer.from(image.b64_json, "base64")
    const { width, height } = await sharp(input).metadata()
    if (!width || !height) throw new Error("Cannot determine generated image dimensions")
    const scale = Math.floor(Math.min(width / ratioWidth, height / ratioHeight))
    const cropWidth = scale * ratioWidth
    const cropHeight = scale * ratioHeight
    const cropped = await sharp(input).extract({
      left: Math.floor((width - cropWidth) / 2),
      top: Math.floor((height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    }).png().toBuffer()
    image.b64_json = cropped.toString("base64")
    image.media_type = "image/png"
  }
  payload.output_format = "png"
  return Response.json(payload, { status: response.status })
}

async function generateCompatibleImage(body: GeminiRequest, signal?: AbortSignal): Promise<Response> {
  const generationConfig = body.generationConfig || body.generation_config || {}
  const allParts = (body.contents || []).flatMap((content) => content.parts || [])
  const prompt = allParts
    .map((part) => part.text)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n\n")
  const inputReferences = allParts.flatMap((part) => {
    const inline = getInlineData(part)
    if (inline) {
      return [{ type: "image_url", image_url: { url: `data:${inline.mimeType};base64,${inline.data}` } }]
    }
    const file = getFileData(part)
    return file ? [{ type: "image_url", image_url: { url: file.url } }] : []
  })

  const response = await openRouterGenerateImage({
    prompt: prompt || "Create the requested image using the supplied reference images.",
    inputReferences: inputReferences.map((reference) => reference.image_url.url),
    resolution: generationConfig.imageConfig?.imageSize,
    aspectRatio: generationConfig.imageConfig?.aspectRatio,
    signal,
  })

  return adaptSuccessfulResponse(response, toGeminiImagePayload)
}

export async function openRouterGenerateContent(
  model: string,
  rawBody: unknown,
  init?: { signal?: AbortSignal; labels?: Record<string, string> },
): Promise<Response> {
  const body = (rawBody && typeof rawBody === "object" ? rawBody : {}) as GeminiRequest
  const generationConfig = body.generationConfig || body.generation_config || {}
  const wantsImage = generationConfig.responseModalities?.includes("IMAGE")

  if (wantsImage) return generateCompatibleImage(body, init?.signal)

  const requestBody: Record<string, unknown> = {
    model: normalizeTextModel(model),
    messages: contentsToMessages(body),
  }

  if (typeof generationConfig.temperature === "number") requestBody.temperature = generationConfig.temperature
  if (typeof generationConfig.topP === "number") requestBody.top_p = generationConfig.topP
  if (typeof generationConfig.maxOutputTokens === "number") requestBody.max_tokens = generationConfig.maxOutputTokens
  if (generationConfig.stopSequences?.length) requestBody.stop = generationConfig.stopSequences

  if ((generationConfig.responseMimeType || generationConfig.response_mime_type) === "application/json") {
    requestBody.response_format = generationConfig.responseSchema
      ? {
          type: "json_schema",
          json_schema: { name: "response", strict: true, schema: generationConfig.responseSchema },
        }
      : { type: "json_object" }
  }

  if (containsWebSearch(body)) requestBody.tools = [{ type: "openrouter:web_search" }]

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(requestBody),
    signal: init?.signal,
  })

  return adaptSuccessfulResponse(response, toGeminiTextPayload)
}

export const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL
