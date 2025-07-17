import { getSupabase } from "@/lib/supabase/server"

export async function getResearchNames() {
  const supabase = getSupabase()
  const { data, error } = await supabase.from("research_names").select("id, name")
  if (error) {
    console.error("Error fetching research names:", error)
    return []
  }
  // `data` can be undefined when running with the mock client.
  return data ?? []
}
