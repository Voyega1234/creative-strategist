import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { getSupabase } from "@/lib/supabase/server"
import { vertexGenerateContent } from "@/lib/google/vertex-ai"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const ANALYSIS_MODEL = "gemini-3.1-pro-preview"
const IMAGE_MODEL = "gemini-3.1-flash-image-preview"
const STORAGE_BUCKET = "ads-creative-image"
const GENERATED_IMAGE_COUNT = 4
const ANALYSIS_CACHE_PREFIX = "generated/material-to-scene-analysis-cache"
const OUTPUT_PREFIX = "generated/material-to-scene-outputs"
const ANALYSIS_CACHE_VERSION = "v1"
const ANALYSIS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30
const analysisMemoryCache = new Map<string, { description: string; createdAt: number }>()
const PHOTOSTOCK_LABELS = { feature: "photostock" }

type PhotostockOperation = "background_removal" | "material_analysis" | "scene_generation"

const PRESET_STYLES: Record<string, string> = {
  "Ad Creative":
    "Bold, eye-catching composition, high contrast, vibrant colors, dynamic lighting, suitable for marketing campaigns.",
  "E-commerce Product Shot":
    "Clean, well-lit, neutral or complementary background, sharp focus on the material, professional studio lighting.",
  "Interior & Material":
    "Architectural context, natural lighting, realistic shadows, integrated into a modern interior space, tactile feel.",
  "Social Media Content":
    "Trendy, lifestyle-oriented, aesthetic, slightly stylized, engaging composition, soft or dramatic lighting depending on mood.",
}

const PHOTOGRAPHY_STYLES: Record<string, string> = {
  auto:
    "Choose the most appropriate product photography treatment from the user's brief and references. Do not impose a fixed visual formula.",
  "clean-white":
    "Clean white product photography: seamless bright white or very light neutral set, controlled soft studio lighting, crisp product detail, restrained props, and a believable contact shadow.",
  lifestyle:
    "Lifestyle product photography: place the product in a believable real-life use context with natural supporting props, authentic scale, and an unstaged but commercially polished composition.",
  minimal:
    "Minimal product photography: use very few purposeful elements, strong negative space, restrained geometric forms, and a clear single focal point on the product.",
  "dark-moody":
    "Dark and moody product photography: low-key lighting, deep shadows, controlled highlights, rich contrast, and a premium dramatic atmosphere without losing product detail.",
  "natural-light":
    "Natural-light product photography: believable window or daylight illumination, warm-to-neutral color temperature, soft directional shadows, and an organic lived-in atmosphere.",
  "flat-lay":
    "Flat-lay product photography: top-down camera, carefully organized supporting objects, clean spacing, realistic surface contact, and strong graphic balance.",
  "hero-shot":
    "Hero-shot product photography: commanding low or three-quarter camera angle, bold scale, focused dramatic lighting, and a composition that makes the product feel iconic and powerful.",
  "texture-rich":
    "Texture-rich product photography: emphasize tactile surfaces, material contrast, fine grain, condensation or natural imperfections where appropriate, while keeping the product identity exact.",
  reflection:
    "Reflection product photography: use a physically plausible reflective surface or controlled mirrored light to add depth and premium polish without duplicating or distorting the product.",
  "pop-color":
    "Pop-color product photography: use bold saturated color blocking and one energetic accent relationship, with clean separation and strong product readability.",
}

const ASPECT_RATIO_MAP: Record<string, string> = {
  "2:3": "3:4",
  "3:2": "4:3",
  "4:5": "3:4",
  "21:9": "16:9",
}

type GeminiInlineImage = {
  data: string
  mimeType?: string
}

type FetchedImage = {
  base64: string
  mimeType: string
}

type StoredGeneratedImage = {
  data_url: string
  url?: string
  storage_path?: string
}

function getImageExtension(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg"
  if (mimeType.includes("webp")) return "webp"
  return "png"
}

function getMaterialCacheKey(base64: string, mimeType: string) {
  return createHash("sha256").update(`${ANALYSIS_CACHE_VERSION}:${mimeType}:${base64}`).digest("hex")
}

async function getStoredMaterialAnalysis(cacheKey: string) {
  const memoryEntry = analysisMemoryCache.get(cacheKey)
  if (memoryEntry && Date.now() - memoryEntry.createdAt < ANALYSIS_CACHE_TTL_MS) {
    return memoryEntry.description
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(`${ANALYSIS_CACHE_PREFIX}/${cacheKey}.json`)

    if (error || !data) return null

    const payload = JSON.parse(await data.text()) as { description?: string; createdAt?: number; version?: string }
    if (
      payload.version !== ANALYSIS_CACHE_VERSION ||
      !payload.description ||
      !payload.createdAt ||
      Date.now() - payload.createdAt > ANALYSIS_CACHE_TTL_MS
    ) {
      return null
    }

    analysisMemoryCache.set(cacheKey, { description: payload.description, createdAt: payload.createdAt })
    return payload.description
  } catch (error) {
    console.warn("[material-to-scene] Failed to read material analysis cache:", error)
    return null
  }
}

async function saveStoredMaterialAnalysis(cacheKey: string, description: string) {
  const createdAt = Date.now()
  analysisMemoryCache.set(cacheKey, { description, createdAt })

  try {
    const supabase = getSupabase()
    const payload = JSON.stringify({
      version: ANALYSIS_CACHE_VERSION,
      createdAt,
      description,
    })
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`${ANALYSIS_CACHE_PREFIX}/${cacheKey}.json`, payload, {
        contentType: "application/json",
        upsert: true,
      })

    if (error) {
      console.warn("[material-to-scene] Failed to persist material analysis cache:", error.message)
    }
  } catch (error) {
    console.warn("[material-to-scene] Failed to persist material analysis cache:", error)
  }
}

async function getOrAnalyzeMaterial(referenceImageBase64: string, mimeType: string) {
  const cacheKey = getMaterialCacheKey(referenceImageBase64, mimeType)
  const cachedDescription = await getStoredMaterialAnalysis(cacheKey)

  if (cachedDescription) {
    return { description: cachedDescription, cacheHit: true }
  }

  const description = await analyzeMaterial(referenceImageBase64, mimeType)
  await saveStoredMaterialAnalysis(cacheKey, description)
  return { description, cacheHit: false }
}

async function saveGeneratedImageToStorage(image: GeminiInlineImage, metadata: Record<string, unknown>) {
  const mimeType = image.mimeType || "image/png"
  const extension = getImageExtension(mimeType)
  const path = `${OUTPUT_PREFIX}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}.${extension}`

  try {
    const supabase = getSupabase()
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, Buffer.from(image.data, "base64"), {
      contentType: mimeType,
      metadata: Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)])),
    })

    if (error) {
      console.warn("[material-to-scene] Failed to save generated image:", error.message)
      return null
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl, storage_path: path }
  } catch (error) {
    console.warn("[material-to-scene] Failed to save generated image:", error)
    return null
  }
}

async function fetchImageAsBase64(url: string, fallbackMimeType = "image/png"): Promise<FetchedImage> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Unable to fetch image from URL (${response.status})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get("content-type") || fallbackMimeType

  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: contentType,
  }
}

function getGeminiText(payload: any) {
  const parts = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || []
  return parts
    .filter((part: any) => typeof part.text === "string")
    .map((part: any) => part.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim()
}

function getGeminiImages(payload: any): GeminiInlineImage[] {
  const parts = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || []

  return parts
    .map((part: any) => ({
      data: part?.inlineData?.data || part?.inline_data?.data || "",
      mimeType: part?.inlineData?.mimeType || part?.inline_data?.mime_type || "image/png",
    }))
    .filter((part: GeminiInlineImage) => Boolean(part.data))
}

async function callGemini(body: unknown, operation: PhotostockOperation) {
  const response = await vertexGenerateContent(IMAGE_MODEL, body, {
    labels: { ...PHOTOSTOCK_LABELS, operation },
  })

  const text = await response.text()
  let payload: any = null

  try {
    payload = text ? JSON.parse(text) : null
  } catch (error) {
    console.error("[material-to-scene] Failed to parse Gemini response:", error, text)
    throw new Error("Invalid Gemini response")
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini request failed (${response.status})`)
  }

  return payload
}

async function analyzeMaterial(referenceImageBase64: string, mimeType: string) {
  const response = await vertexGenerateContent(ANALYSIS_MODEL, {
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: referenceImageBase64,
              mimeType,
            },
          },
          {
            text:
              "Analyze this reference material or product photo. Describe its texture, color, surface properties, and overall material characteristics in detail. This description will be used to generate a new scene featuring this material.",
          },
        ],
      },
    ],
  }, {
    labels: { ...PHOTOSTOCK_LABELS, operation: "material_analysis" },
  })

  const text = await response.text()
  let payload: any = null

  try {
    payload = text ? JSON.parse(text) : null
  } catch (error) {
    console.error("[material-to-scene] Failed to parse analysis response:", error, text)
    throw new Error("Invalid Gemini analysis response")
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini analysis failed (${response.status})`)
  }

  const materialDescription = getGeminiText(payload)
  if (!materialDescription) {
    throw new Error("Gemini did not return a material description")
  }

  return materialDescription
}

function buildGenerationPrompt(
  materialDescription: string,
  preset: string,
  photographyStyle: string,
  prompt: string,
  hasSceneReferences: boolean,
) {
  return `
Create an ultra-realistic, photographic, production-ready scene image.
The image must look indistinguishable from a real photograph, shot with a high-end DSLR camera, perfect studio lighting, physically accurate shadows, and flawless texture rendering.

USER INSTRUCTION PRIORITY:
The user's creative prompt is the task brief and must be followed precisely. Do not ignore concrete edit instructions.
If the user asks to replace a specific object, surface, fabric, material, product, clothing item, furniture part, wall, floor, packaging, or prop with the provided hero material/product, do exactly that replacement.
If the user asks to keep the original background, original room, original set, original environment, or original scene, preserve that scene identity and only change the requested object/material plus any camera angle/framing requested.
If the user asks to change only camera angle, then keep the same world, same background design, same lighting mood, same styling direction, and same visual identity while adjusting perspective naturally.
If the user gives lighting, shadow, mood, color, lens, angle, scale, placement, or integration instructions, treat them as mandatory production requirements.

ABSOLUTE CRITICAL REQUIREMENT: The provided reference image is the HERO MATERIAL OR HERO PRODUCT. You MUST preserve 100% of its identity exactly as shown in the input. Do not redesign it, clean it up, simplify it, stylize it, improve it, or reinterpret it.

You MUST preserve exactly:
- texture, color, pattern, grain, finish, gloss, roughness, and surface response
- shape, silhouette, proportions, edges, corners, seams, folds, stitching, joints, and construction logic
- placement of all visible details, markings, labels, logos, prints, buttons, handles, hardware, cut lines, decorative elements, and product-specific features
- spatial relationship between all visible details on the object

If the camera angle changes, the object must still remain the exact same object. All details must transform consistently with real-world perspective. Details may appear foreshortened, partially hidden, or seen from a different angle, but they must never move, swap position, disappear without physical reason, duplicate, or be newly invented.

You are ONLY allowed to change:
- lighting
- shadows
- reflections caused by the environment
- camera framing and camera angle
- background and surrounding scene

You are NOT allowed to change:
- the object's identity
- structural design
- detail placement
- product construction
- material pattern layout
- branding or label placement
- any distinctive visual feature from the input

The material or product must remain unmistakably the exact same source item from the input image, only re-shot inside a new scene.

TEXT / AD COPY RULES:
- Do not create any advertising headline, sub-headline, CTA, offer text, price text, badge text, floating typography, captions, posters, banners, stickers, UI labels, or decorative text in the output.
- The output must be a clean photographic scene, not an ad layout with copy.
- The only text allowed is text that already exists physically on the hero material/product itself, such as product labels, logos, packaging text, SKU, model number, ingredient text, or real markings.
- Preserve existing text/logos/labels on the hero material/product exactly as part of its identity.
- Do not invent new brand names, slogans, product claims, certification marks, labels, or signage.

${
  hasSceneReferences
    ? `SCENE / BACKGROUND REFERENCE RULES:
The additional scene reference image(s) are the scene/background/source environment reference.
Use them according to the user's prompt:
- If the user says to use the original/same background, preserve the background identity, room architecture, surface layout, props, lighting mood, and styling as much as possible.
- If the user says to change only the camera angle, keep the same scene world and redesign nothing unnecessary; only reinterpret perspective/framing like a real reshoot.
- If the user asks to replace a specific object in the scene with the hero material/product, composite the hero material/product into that exact role while preserving realistic scale, perspective, occlusion, contact shadows, reflections, and light direction.
- If the user does not request preserving the exact scene, use the scene reference as guidance for environment type, architecture, surface, props density, lighting direction, camera height, lens feel, mood, color atmosphere, composition rhythm, and styling level.

Do not copy unrelated products, logos, people, text, or objects from the scene reference unless the user's prompt explicitly asks for them or they are part of a background the user asked to preserve.
Do not let the scene reference alter the hero material/product identity.
If there is any conflict between the hero material/product image and the scene reference, the hero material/product image wins.
Integrate the hero material/product naturally into the referenced scene style with believable perspective, scale, contact shadows, reflections, and lighting match.`
    : `No separate scene reference was provided. Build the environment from the user's creative prompt while keeping the hero material/product exact.`
}

Material/Product Characteristics to feature:
${materialDescription}

Use Case Style:
${PRESET_STYLES[preset] || PRESET_STYLES["Ad Creative"]}

PRODUCT PHOTOGRAPHY STYLE:
${PHOTOGRAPHY_STYLES[photographyStyle] || PHOTOGRAPHY_STYLES.auto}
Apply this as the photographic treatment only. The user's explicit scene, object, lighting, color, and composition instructions still take priority.

BRIEF INTERPRETATION RULES:
The user's brief below may be short, vague, or written casually. Your job is to interpret it like an experienced art director — understand creative intent, not just literal words.

Interpretation scope:
- Anything the user explicitly stated → follow it exactly, do not reinterpret or upgrade it.
- Anything the user did NOT mention → fill those gaps with the most contextually appropriate and commercially compelling choices, guided by the material characteristics and use case style above.

How to interpret vague language:
- Mood or feeling words (e.g. "cozy", "luxury", "fresh", "editorial") → translate into concrete visual decisions: lighting quality, color temperature, props, depth of field, composition style.
- Context or setting words (e.g. "coffee shop", "outdoor", "minimal studio") → build a believable environment that fits naturally; do not invent unrelated props or elements the user didn't imply.
- Short or one-line briefs → stay close to the literal meaning, enrich only what is visually necessary to make the scene complete.

Hard limits on interpretation:
- Do not add objects, colors, or styling that conflict with or contradict the user's brief.
- Do not "improve" the user's stated direction — if they said dark, keep it dark; if they said simple, keep it simple.
- Interpretation fills empty space, it does not override stated intent.

Creative Brief from user:
${prompt}

PHOTOREAL COMPOSITING REQUIREMENTS:
- The final image must never look edited, pasted, masked, collaged, or AI-generated.
- Match light direction, light softness, color temperature, exposure, contrast, grain/noise, depth of field, and lens perspective across the entire image.
- Create physically plausible contact shadows, cast shadows, ambient occlusion, reflections, and edge blending where the hero material/product touches or interacts with the scene.
- Match scale and perspective so the replacement object/material sits naturally in the scene.
- Preserve realistic texture detail; no over-smoothing, plastic sheen, fake CGI finish, or floating edges.
- If the prompt asks to use the same background, preserve background continuity and only alter what the user requested.

NEGATIVE CONSTRAINTS:
No AI artifacts, no plastic or over-smoothed textures, no distorted geometry, no unrealistic lighting, no cartoonish or painterly elements, no watermarks, no floating objects, no unnatural shadows, no chromatic aberration. Do not change the material texture, color, pattern, structure, detail placement, branding, or product-specific features.

The output should be clean, composition-ready, relit, reframed, and mood-matched to the prompt with absolute photorealism.
  `.trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = typeof body.action === "string" ? body.action : "generate"

    if (action === "remove_background") {
      const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64.trim() : ""
      const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : ""
      const requestedMimeType = typeof body.mime_type === "string" ? body.mime_type.trim() : "image/png"

      if (!imageBase64 && !imageUrl) {
        return NextResponse.json({ success: false, error: "image_url or image_base64 is required" }, { status: 400 })
      }

      const { base64, mimeType } = imageUrl
        ? await fetchImageAsBase64(imageUrl, requestedMimeType)
        : { base64: imageBase64, mimeType: requestedMimeType }

      const payload = await callGemini({
        contents: [
          {
            parts: [
              {
                text:
                  "Remove the background from this image. Keep only the main subject or object. Make the background completely pure white (#FFFFFF). Do not alter the main subject in any way, preserve its exact lighting, texture, and details.",
              },
              {
                inlineData: {
                  data: base64,
                  mimeType,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }, "background_removal")

      const images = getGeminiImages(payload)
      if (images.length === 0) {
        return NextResponse.json(
          { success: false, error: "Gemini did not return an image for background removal" },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        image_data_url: `data:${images[0].mimeType || "image/png"};base64,${images[0].data}`,
      })
    }

    const referenceImageBase64 = typeof body.reference_image_base64 === "string" ? body.reference_image_base64.trim() : ""
    const referenceImageUrl = typeof body.reference_image_url === "string" ? body.reference_image_url.trim() : ""
    const sceneReferenceImageUrls: string[] = Array.isArray(body.scene_reference_image_urls)
      ? body.scene_reference_image_urls.filter((url: unknown): url is string => typeof url === "string" && Boolean(url.trim()))
      : []
    const requestedMimeType = typeof body.mime_type === "string" ? body.mime_type.trim() : "image/png"
    const preset = typeof body.preset === "string" ? body.preset : "Ad Creative"
    const photographyStyle =
      typeof body.photography_style === "string" && PHOTOGRAPHY_STYLES[body.photography_style]
        ? body.photography_style
        : "auto"
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    const aspectRatioInput = typeof body.aspect_ratio === "string" ? body.aspect_ratio.trim() : "1:1"
    const imageSize = typeof body.image_size === "string" ? body.image_size.trim() : "1K"

    if (!referenceImageBase64 && !referenceImageUrl) {
      return NextResponse.json(
        { success: false, error: "reference_image_url or reference_image_base64 is required" },
        { status: 400 },
      )
    }

    if (!prompt) {
      return NextResponse.json({ success: false, error: "prompt is required" }, { status: 400 })
    }

    const { base64: referenceBase64, mimeType } = referenceImageUrl
      ? await fetchImageAsBase64(referenceImageUrl, requestedMimeType)
      : { base64: referenceImageBase64, mimeType: requestedMimeType }
    const sceneReferences = await Promise.all(
      sceneReferenceImageUrls.slice(0, 3).map((imageUrl) => fetchImageAsBase64(imageUrl.trim())),
    )

    const { description: materialDescription, cacheHit: materialAnalysisCacheHit } = await getOrAnalyzeMaterial(
      referenceBase64,
      mimeType,
    )
    const aspectRatio = ASPECT_RATIO_MAP[aspectRatioInput] || aspectRatioInput
    const generationPrompt = buildGenerationPrompt(
      materialDescription,
      preset,
      photographyStyle,
      prompt,
      sceneReferences.length > 0,
    )

    const payloads = await Promise.all(
      Array.from({ length: GENERATED_IMAGE_COUNT }).map(() =>
        callGemini({
          contents: [
            {
              parts: [
                {
                  text: generationPrompt,
                },
                {
                  text:
                    "HERO MATERIAL / HERO PRODUCT IMAGE. Preserve this exact object/material identity, texture, color, construction, logo/detail placement, and all distinctive product features.",
                },
                {
                  inlineData: {
                    data: referenceBase64,
                    mimeType,
                  },
                },
                ...sceneReferences.flatMap((sceneReference, index) => [
                  {
                    text: `SCENE / BACKGROUND REFERENCE ${index + 1}. Use only for environment, lighting, perspective, mood, and background styling. Do not copy unrelated objects or alter the hero material/product.`,
                  },
                  {
                    inlineData: {
                      data: sceneReference.base64,
                      mimeType: sceneReference.mimeType,
                    },
                  },
                ]),
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio,
              imageSize,
            },
          },
        }, "scene_generation"),
      ),
    )

    const generatedImages = payloads.flatMap((payload) => getGeminiImages(payload))
    const images = await Promise.all(
      generatedImages.map(async (image, index): Promise<StoredGeneratedImage> => {
        const dataUrl = `data:${image.mimeType || "image/png"};base64,${image.data}`
        const storedImage = await saveGeneratedImageToStorage(image, {
          source: "material-to-scene",
          model: IMAGE_MODEL,
          index: index + 1,
          aspect_ratio: aspectRatio,
          image_size: imageSize,
          preset,
          photography_style: photographyStyle,
        })

        return {
          data_url: dataUrl,
          ...(storedImage || {}),
        }
      }),
    )

    if (images.length === 0) {
      return NextResponse.json(
        { success: false, error: "Gemini did not return any generated scenes" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      images,
      material_description: materialDescription,
      material_analysis_cache_hit: materialAnalysisCacheHit,
      scene_reference_count: sceneReferences.length,
      aspect_ratio: aspectRatio,
      image_size: imageSize,
      preset,
      photography_style: photographyStyle,
      saved_output_count: images.filter((image) => Boolean(image.url)).length,
    })
  } catch (error) {
    console.error("[material-to-scene] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate material to scene images",
      },
      { status: 500 },
    )
  }
}
