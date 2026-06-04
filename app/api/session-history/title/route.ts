import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function PATCH(request: NextRequest) {
  try {
    const { sessionId, title } = (await request.json()) as { sessionId?: string; title?: string }
    const normalizedTitle = typeof title === "string" ? title.trim().slice(0, 100) : ""

    if (!sessionId || !normalizedTitle) {
      return NextResponse.json({ success: false, error: "sessionId and title are required" }, { status: 400 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: session, error: fetchError } = await supabase
      .from("idea_sessions")
      .select("id, n8n_response")
      .eq("id", sessionId)
      .single()

    if (fetchError) {
      console.error("[session-history][title] Fetch error:", fetchError)
      return NextResponse.json({ success: false, error: "Failed to rename session" }, { status: 500 })
    }

    const n8nResponse =
      session.n8n_response && typeof session.n8n_response === "object" ? session.n8n_response : {}
    const { error } = await supabase
      .from("idea_sessions")
      .update({ n8n_response: { ...n8nResponse, _session_title: normalizedTitle } })
      .eq("id", sessionId)

    if (error) {
      console.error("[session-history][title] Database error:", error)
      return NextResponse.json({ success: false, error: "Failed to rename session" }, { status: 500 })
    }

    return NextResponse.json({ success: true, sessionId, title: normalizedTitle })
  } catch (error) {
    console.error("[session-history][title] Error:", error)
    return NextResponse.json({ success: false, error: "Failed to rename session" }, { status: 500 })
  }
}
