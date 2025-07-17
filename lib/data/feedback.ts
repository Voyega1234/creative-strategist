import { getSupabase } from "@/lib/supabase/server"

// Type for feedback based on the idea_feedback table structure
export type FeedbackDetail = {
  id: string
  idea_id: string
  run_id: string
  vote: 'good' | 'bad'
  comment: string
  client_name: string
  created_at: string
  product_focus: string
  idea_title: string
  idea_description: string
  concept_ideas: string
}

// Function to get feedback data with optional filtering
export async function getFeedback(
  clientName?: string,
  productFocus?: string,
  voteFilter?: 'good' | 'bad' | 'all'
): Promise<FeedbackDetail[]> {
  const supabase = getSupabase()
  
  let query = supabase
    .from("idea_feedback")
    .select("*")
    .order("created_at", { ascending: false })

  // Filter by client name if provided
  if (clientName) {
    query = query.eq("client_name", clientName)
  }

  // Filter by product focus if provided
  if (productFocus) {
    query = query.eq("product_focus", productFocus)
  }

  // Filter by vote if provided
  if (voteFilter && voteFilter !== 'all') {
    query = query.eq("vote", voteFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching feedback:", error)
    return []
  }

  return data as FeedbackDetail[]
}

// Function to update feedback
export async function updateFeedback(
  id: string,
  updates: Partial<Pick<FeedbackDetail, 'vote' | 'comment'>>
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from("idea_feedback")
    .update(updates)
    .eq("id", id)

  if (error) {
    console.error("Error updating feedback:", error)
    return false
  }

  return true
}

// Function to delete feedback
export async function deleteFeedback(id: string): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from("idea_feedback")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Error deleting feedback:", error)
    return false
  }

  return true
}
