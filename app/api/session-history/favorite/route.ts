import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function PATCH(request: NextRequest) {
  try {
    const { sessionId, isFavorite } = (await request.json()) as { sessionId?: string; isFavorite?: boolean }
    if (!sessionId || typeof isFavorite !== "boolean") {
      return NextResponse.json({ success: false, error: "sessionId and isFavorite are required" }, { status: 400 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: session, error: fetchError } = await supabase
      .from("idea_sessions")
      .select("id, n8n_response")
      .eq("id", sessionId)
      .single()

    if (fetchError) {
      console.error("[session-history][favorite] Fetch error:", fetchError)
      return NextResponse.json({ success: false, error: "Failed to update favorite" }, { status: 500 })
    }

    const n8nResponse =
      session.n8n_response && typeof session.n8n_response === "object" ? session.n8n_response : {}
    const expiresAt = isFavorite ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from("idea_sessions")
      .update({
        n8n_response: { ...n8nResponse, _is_favorite: isFavorite },
        expires_at: expiresAt,
      })
      .eq("id", sessionId)
      .select("id, n8n_response")
      .single()

    if (error) {
      console.error("[session-history][favorite] Database error:", error)
      return NextResponse.json({ success: false, error: "Failed to update favorite" }, { status: 500 })
    }

    return NextResponse.json({ success: true, sessionId: data.id, isFavorite: data.n8n_response?._is_favorite === true })
  } catch (error) {
    console.error("[session-history][favorite] Error:", error)
    return NextResponse.json({ success: false, error: "Failed to update favorite" }, { status: 500 })
  }
}
