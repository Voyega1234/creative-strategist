import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getIdeaKey(idea: any) {
  return String(idea?.copywriting?.headline || idea?.concept_idea || idea?.title || "").trim()
}

export async function PATCH(request: Request) {
  try {
    const { sessionId, ideaKey, contentType } = await request.json()
    if (!sessionId || !ideaKey || !contentType) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: session, error: fetchError } = await supabase
      .from("idea_sessions")
      .select("n8n_response")
      .eq("id", sessionId)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ success: false, error: fetchError?.message || "Session not found" }, { status: 404 })
    }

    const response = session.n8n_response && typeof session.n8n_response === "object"
      ? session.n8n_response
      : {}
    const ideas = Array.isArray(response.ideas) ? response.ideas : []
    let updated = false
    const nextIdeas = ideas.map((idea: any) => {
      if (getIdeaKey(idea) !== String(ideaKey).trim()) return idea
      updated = true
      return { ...idea, content_type: contentType }
    })

    if (!updated) {
      return NextResponse.json({ success: false, error: "Idea not found in session" }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from("idea_sessions")
      .update({ n8n_response: { ...response, ideas: nextIdeas } })
      .eq("id", sessionId)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Could not save content type" },
      { status: 500 },
    )
  }
}
