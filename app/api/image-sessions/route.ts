import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const FEATURE_TYPES = ["seo-banner", "product-scene"] as const
type FeatureType = (typeof FEATURE_TYPES)[number]

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("Supabase is not configured")
  }

  return createClient(url, key)
}

function isFeatureType(value: unknown): value is FeatureType {
  return typeof value === "string" && FEATURE_TYPES.includes(value as FeatureType)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const featureType = searchParams.get("featureType")
    const clientName = searchParams.get("clientName")
    const productFocus = searchParams.get("productFocus")
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 12, 1), 30)

    if (!isFeatureType(featureType)) {
      return NextResponse.json({ success: false, error: "Invalid feature type" }, { status: 400 })
    }

    let query = getSupabase()
      .from("idea_sessions")
      .select("id, client_name, product_focus, user_input, model_used, ideas_count, created_at, n8n_response")
      .eq("selected_template", `image:${featureType}`)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (clientName) query = query.eq("client_name", clientName)
    if (productFocus) query = query.eq("product_focus", productFocus)

    const { data, error } = await query

    if (error) {
      console.error("[image-sessions] Fetch failed:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const sessions = (data || []).map((session) => ({
      id: session.id,
      clientName: session.client_name,
      productFocus: session.product_focus,
      prompt: session.user_input || "",
      model: session.model_used || "",
      outputCount: session.ideas_count || 0,
      createdAt: session.created_at,
      title: session.n8n_response?.title || "",
      outputUrls: Array.isArray(session.n8n_response?.output_urls) ? session.n8n_response.output_urls : [],
      inputUrls: Array.isArray(session.n8n_response?.input_urls) ? session.n8n_response.input_urls : [],
      metadata:
        session.n8n_response?.metadata && typeof session.n8n_response.metadata === "object"
          ? session.n8n_response.metadata
          : {},
    }))

    return NextResponse.json({ success: true, sessions })
  } catch (error) {
    console.error("[image-sessions] Unexpected fetch error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch image sessions" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      featureType,
      clientName,
      productFocus,
      title,
      prompt,
      model,
      outputUrls,
      inputUrls,
      metadata,
    } = body

    if (!isFeatureType(featureType) || !Array.isArray(outputUrls) || outputUrls.length === 0) {
      return NextResponse.json({ success: false, error: "Feature type and output URLs are required" }, { status: 400 })
    }

    const sessionId = crypto.randomUUID()
    const normalizedClientName =
      typeof clientName === "string" && clientName.trim() ? clientName.trim() : "Unassigned"
    const normalizedProductFocus =
      typeof productFocus === "string" && productFocus.trim() ? productFocus.trim() : featureType

    const { data, error } = await getSupabase()
      .from("idea_sessions")
      .insert({
        client_name: normalizedClientName,
        product_focus: normalizedProductFocus,
        user_input: typeof prompt === "string" ? prompt : null,
        selected_template: `image:${featureType}`,
        model_used: typeof model === "string" && model ? model : "image-generation",
        session_id: sessionId,
        ideas_count: outputUrls.length,
        n8n_response: {
          _session_type: "image_generation",
          feature_type: featureType,
          title: typeof title === "string" ? title : "",
          output_urls: outputUrls.filter((url): url is string => typeof url === "string" && Boolean(url)),
          input_urls: Array.isArray(inputUrls)
            ? inputUrls.filter((url): url is string => typeof url === "string" && Boolean(url))
            : [],
          metadata: metadata && typeof metadata === "object" ? metadata : {},
        },
      })
      .select("id, created_at")
      .single()

    if (error) {
      console.error("[image-sessions] Save failed:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, sessionId: data.id, createdAt: data.created_at })
  } catch (error) {
    console.error("[image-sessions] Unexpected save error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save image session" },
      { status: 500 },
    )
  }
}
