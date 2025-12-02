import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clientId, colorPalette } = body

    if (!clientId || !Array.isArray(colorPalette)) {
      return NextResponse.json(
        { success: false, error: "clientId and colorPalette array are required" },
        { status: 400 },
      )
    }

    const supabase = getSupabase()
    const { error } = await supabase
      .from("Clients")
      .update({ color_palette: colorPalette })
      .eq("id", clientId)

    if (error) {
      console.error("[update-client-color] Failed to update palette:", error)
      return NextResponse.json(
        { success: false, error: error.message || "Failed to update color palette" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[update-client-color] Unexpected error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
