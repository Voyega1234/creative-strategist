import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const OPENAI_EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits"
const OPENAI_IMAGE_MODEL = "gpt-image-2"

type EnhanceMode = "preserve" | "reimagine"

type CritiquePayload = {
  top_strength: string
  main_issue: string
  what_works: string[]
  what_hurts_performance: string[]
  priority_fixes: string[]
  preserve_focus: string[]
  reimagine_brief: string
}

function buildPreservePrompt(critique: CritiquePayload) {
  return [
    "Edit the provided image and keep it very close to the original creative direction.",
    "This is a light-improvement pass, not a full redesign or a new composition.",
    "Preserve the same core subject, product, composition logic, framing, visual intent, and advertising message.",
    `Top strength to preserve: ${critique.top_strength}`,
    `Main issue to fix lightly: ${critique.main_issue}`,
    `What already works: ${critique.what_works.join(" | ")}`,
    `Light fixes to apply: ${critique.priority_fixes.join(" | ")}`,
    `Preserve focus: ${critique.preserve_focus.join(" | ")}`,
    "Make the result cleaner, more polished, more realistic, and more ad-ready.",
    "Preserve all existing text, typography, pricing, product names, badges, promotional labels, logo placement, and graphic overlays from the source image.",
    "If text styling needs cleanup, re-typeset it cleanly while keeping the same meaning, offer, and hierarchy.",
    "Do not make it look like a new campaign route.",
    "The result should feel like the same image, only improved slightly.",
  ].join(" ")
}

function buildReimaginePrompt(critique: CritiquePayload) {
  return [
    "Edit the provided image into a stronger new design direction while keeping it clearly based on the original source image.",
    "This is a reimagined route, not a completely unrelated new image.",
    "Keep the same core subject, product identity, category cues, essential visual information, and advertising message from the source image.",
    "Keep all important text content from the source image, including product names, prices, promotional labels, percentages, CTA-style callouts, and brand marks.",
    "You may redesign the composition, framing, lighting, scene styling, hierarchy, typography layout, and overall art direction, but it must still feel derived from the original image.",
    `Keep the strongest existing quality: ${critique.top_strength}`,
    `Avoid this core weakness: ${critique.main_issue}`,
    `What did not work before: ${critique.what_hurts_performance.join(" | ")}`,
    `Priority improvements: ${critique.priority_fixes.join(" | ")}`,
    `New direction: ${critique.reimagine_brief}`,
    "Make the image commercially clear, visually stronger, and more campaign-worthy.",
    "Typography is important. Rebuild the ad layout so the text feels intentionally designed, readable, persuasive, and integrated with the image.",
    "Do not remove or forget the source image's key product details, prices, or promotional information.",
    "The result should feel like a better advertising idea built from the same original asset, not a random style experiment.",
  ].join(" ")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : ""
    const userNotes = typeof body?.user_notes === "string" ? body.user_notes.trim() : ""
    const mode = body?.mode === "reimagine" ? "reimagine" : "preserve"
    const critique = body?.critique as CritiquePayload | undefined

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "image_url is required" }, { status: 400 })
    }

    if (!critique) {
      return NextResponse.json({ success: false, error: "critique is required" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OPENAI_API_KEY ไม่ได้ถูกตั้งค่า" }, { status: 500 })
    }

    const basePrompt = mode === "preserve" ? buildPreservePrompt(critique) : buildReimaginePrompt(critique)
    const prompt = userNotes
      ? `${basePrompt} Additional team direction to follow: ${userNotes}`
      : basePrompt
    const endpoint = OPENAI_EDITS_ENDPOINT
    const bodyPayload = {
      model: OPENAI_IMAGE_MODEL,
      images: [{ image_url: imageUrl }],
      prompt,
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    })

    const rawText = await response.text()
    let payload: any = null

    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch (parseError) {
      console.error("[enhance-generate] Failed to parse OpenAI response:", parseError, rawText)
      return NextResponse.json({ success: false, error: "Invalid OpenAI response" }, { status: 500 })
    }

    if (!response.ok) {
      console.error("[enhance-generate] OpenAI request failed:", payload)
      return NextResponse.json(
        {
          success: false,
          error: payload?.error?.message || `OpenAI image generation failed (${response.status})`,
        },
        { status: response.status },
      )
    }

    const imageBase64 = payload?.data?.[0]?.b64_json

    if (!imageBase64) {
      console.error("[enhance-generate] No image returned from OpenAI:", payload)
      return NextResponse.json({ success: false, error: "OpenAI did not return an image" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mode,
      prompt,
      mime_type: "image/png",
      image_base64: imageBase64,
      image_data_url: `data:image/png;base64,${imageBase64}`,
      model: OPENAI_IMAGE_MODEL,
    })
  } catch (error) {
    console.error("[enhance-generate] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate enhanced image",
      },
      { status: 500 },
    )
  }
}
