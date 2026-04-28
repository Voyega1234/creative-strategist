import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const ANALYSIS_MODEL = "gemini-3.1-pro-preview"
const IMAGE_MODEL = "gemini-3.1-flash-image-preview"

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

async function callGemini(body: unknown) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured")
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  )

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
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured")
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    },
  )

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

function buildGenerationPrompt(materialDescription: string, preset: string, prompt: string, hasSceneReferences: boolean) {
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

Creative Prompt (camera angle, mood, lighting, color tone):
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
      })

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

    const materialDescription = await analyzeMaterial(referenceBase64, mimeType)
    const aspectRatio = ASPECT_RATIO_MAP[aspectRatioInput] || aspectRatioInput
    const generationPrompt = buildGenerationPrompt(materialDescription, preset, prompt, sceneReferences.length > 0)

    const payloads = await Promise.all(
      Array.from({ length: 4 }).map(() =>
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
        }),
      ),
    )

    const images = payloads.flatMap((payload) =>
      getGeminiImages(payload).map((image) => ({
        data_url: `data:${image.mimeType || "image/png"};base64,${image.data}`,
      })),
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
      scene_reference_count: sceneReferences.length,
      aspect_ratio: aspectRatio,
      image_size: imageSize,
      preset,
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
