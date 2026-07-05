import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const TABLE_NAME = "text_to_image_brand_ci_assets"

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function mapBrandCiRow(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    clientId: String(row.client_id || ""),
    title: String(row.title || "Brand CI"),
    body: String(row.body || ""),
    fileName: typeof row.file_name === "string" ? row.file_name : "",
    fileType: typeof row.file_type === "string" ? row.file_type : "",
    fileUrl: typeof row.file_url === "string" ? row.file_url : "",
    source: typeof row.source === "string" ? row.source : "manual",
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = normalizeString(searchParams.get("clientId"))

    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      items: (data || []).map((row) => mapBrandCiRow(row as Record<string, unknown>)),
    })
  } catch (error) {
    console.error("[text-to-image/brand-ci] GET failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load Brand CI" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clientId = normalizeString(body.clientId)
    const title = normalizeString(body.title) || "Brand CI"
    const text = normalizeString(body.body ?? body.text)

    if (!clientId) {
      return NextResponse.json({ success: false, error: "clientId is required" }, { status: 400 })
    }
    if (!text) {
      return NextResponse.json({ success: false, error: "Brand CI text is required" }, { status: 400 })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        client_id: clientId,
        title,
        body: text,
        file_name: normalizeString(body.fileName) || null,
        file_type: normalizeString(body.fileType) || null,
        file_url: normalizeString(body.fileUrl) || null,
        source: normalizeString(body.source) || "manual",
      })
      .select("*")
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, item: mapBrandCiRow(data as Record<string, unknown>) })
  } catch (error) {
    console.error("[text-to-image/brand-ci] POST failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save Brand CI" },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const id = normalizeString(body.id)
    const clientId = normalizeString(body.clientId)
    const title = normalizeString(body.title) || "Brand CI"
    const text = normalizeString(body.body ?? body.text)

    if (!id || !clientId) {
      return NextResponse.json({ success: false, error: "id and clientId are required" }, { status: 400 })
    }
    if (!text) {
      return NextResponse.json({ success: false, error: "Brand CI text is required" }, { status: 400 })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        title,
        body: text,
        file_name: normalizeString(body.fileName) || null,
        file_type: normalizeString(body.fileType) || null,
        file_url: normalizeString(body.fileUrl) || null,
        source: normalizeString(body.source) || "manual",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("client_id", clientId)
      .select("*")
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, item: mapBrandCiRow(data as Record<string, unknown>) })
  } catch (error) {
    console.error("[text-to-image/brand-ci] PATCH failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update Brand CI" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = normalizeString(searchParams.get("id"))
    const clientId = normalizeString(searchParams.get("clientId"))

    if (!id || !clientId) {
      return NextResponse.json({ success: false, error: "id and clientId are required" }, { status: 400 })
    }

    const supabase = getSupabase()
    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id).eq("client_id", clientId)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[text-to-image/brand-ci] DELETE failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete Brand CI" },
      { status: 500 },
    )
  }
}
