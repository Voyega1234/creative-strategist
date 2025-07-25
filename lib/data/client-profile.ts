import { getSupabase } from "@/lib/supabase/server"

// Type for a single client profile, based on AnalysisRun table
export type ClientProfile = {
  id: string
  clientName: string | null
  clientWebsite: string | null
  clientFacebookUrl: string | null
  productFocus: string | null
  additionalInfo: string | null
  userCompetitor: string | null
  createdAt: string | null // timestamp
  updatedAt: string | null // timestamp
  ad_account_id: string | null
  market: string | null // Added market field
}

export async function getClientProfile(clientId: string): Promise<ClientProfile | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.from("AnalysisRun").select("*").eq("id", clientId).single()

  if (error) {
    console.error("Error fetching client profile:", error)
    return null
  }
  return data as ClientProfile
}
