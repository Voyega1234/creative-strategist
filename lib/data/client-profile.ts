import { getSupabase } from "@/lib/supabase/server"

// Type for a single client profile, based on Clients table
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
  // Business profile fields (used by business-profile-form.tsx)
  services: string | null
  pricing: string | null
  usp: string | null // Unique Selling Proposition
  specialty: string | null
  strengths: string | null
  weaknesses: string | null
}

export async function getClientProfile(clientId: string): Promise<ClientProfile | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.from("Clients").select("*").eq("id", clientId).single()

  if (error) {
    console.error("Error fetching client profile:", error)
    return null
  }
  return data as ClientProfile
}
