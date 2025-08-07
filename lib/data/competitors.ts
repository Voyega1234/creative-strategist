import { getSupabase } from "@/lib/supabase/server"
import { findMatchingCompanyName } from "@/lib/utils/name-matching"
import { normalizeToArray } from "@/lib/utils" // Import normalizeToArray
// import { cachedQuery } from "@/lib/utils/server-cache"

// Type for Competitor, based on your Competitor table schema
export type Competitor = {
  id: string
  analysisRunId: string | null
  name: string | null
  website: string | null
  facebookUrl: string | null
  services: string | null // Changed to string
  serviceCatego: string | null
  features: string | null
  pricing: string | null // Changed to string
  strengths: string | null // Changed to string
  weaknesses: string | null // Changed to string
  specialty: string | null
  targetAudience: string | null
  brandTone: string | null
  positivePercep: string | null
  negativePercep: string | null
  adThemes: string | null // Add missing field
  usp: string | null // Add missing USP field for business profile form
}

export async function getCompetitors(
  analysisRunId: string,
  serviceFilter: string | null = null,
  page = 1, // Add page parameter
  pageSize = 5, // Add pageSize parameter
): Promise<{ data: Competitor[]; count: number }> {
  // Temporarily disabled caching
  const supabase = getSupabase()
  console.log("Fetching competitors for analysisRunId:", analysisRunId, "with serviceFilter:", serviceFilter)

  // Optimized: Get client name first
  const analysisRunResult = await supabase
    .from("Clients")
    .select("clientName")
    .eq("id", analysisRunId)
    .maybeSingle()

  const clientName = analysisRunResult.data?.clientName

  // Build optimized query with all filters
  let query = supabase
    .from("Competitor")
    .select("*")
    .eq("analysisRunId", analysisRunId)

  // Filter out the client from competitors list if client name exists
  if (clientName) {
    query = query.not("name", "ilike", `%${clientName}%`)
  }

  // Apply service filter if specified
  if (serviceFilter && serviceFilter !== "All Competitors") {
    query = query.contains("services", [serviceFilter])
  }

  // Apply pagination
  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  query = query.range(start, end).order("name") // Add ordering for consistent results

  const { data, error } = await query

  if (error) {
    console.error("Error fetching competitors:", JSON.stringify(error, null, 2))
    return { data: [], count: 0 }
  }

  console.log("Competitors data from Supabase:", data?.length || 0, "items")
  
  // For count, use a more efficient approach - count after filters
  let countQuery = supabase
    .from("Competitor")
    .select("*", { count: "exact", head: true })
    .eq("analysisRunId", analysisRunId)
  
  if (clientName) {
    countQuery = countQuery.not("name", "ilike", `%${clientName}%`)
  }
  
  if (serviceFilter && serviceFilter !== "All Competitors") {
    countQuery = countQuery.contains("services", [serviceFilter])
  }

  const { count } = await countQuery
  
  return { data: data as Competitor[], count: count || 0 }
}

export async function getUniqueServices(analysisRunId: string): Promise<string[]> {
  // Temporarily disabled caching
  const supabase = getSupabase()
  const { data, error } = await supabase.from("Competitor").select("services").eq("analysisRunId", analysisRunId)

  if (error) {
    console.error("Error fetching unique services:", JSON.stringify(error, null, 2))
    return []
  }

  const allServices = data ? data.flatMap((item) => normalizeToArray(item.services)) : []

  // Filter out empty strings and return unique services
  const uniqueServices = Array.from(new Set(allServices.filter(Boolean)))
  return uniqueServices
}

// New function to get client business profile from competitor data
export async function getClientBusinessProfile(analysisRunId: string): Promise<Competitor | null> {
  const supabase = getSupabase()
  
  // First, get the client name
  const { data: analysisRun } = await supabase
    .from("Clients")
    .select("clientName")
    .eq("id", analysisRunId)
    .maybeSingle()

  if (!analysisRun?.clientName) {
    return null
  }

  const clientName = analysisRun.clientName;

  // Step 1: Try current logic first (fast, no API cost)
  console.log(`[getClientBusinessProfile] Looking for client: "${clientName}" in analysis ${analysisRunId}`)
  const { data, error } = await supabase
    .from("Competitor")
    .select("*")
    .eq("analysisRunId", analysisRunId)
    .ilike("name", `%${clientName}%`)
    .maybeSingle()

  if (error) {
    console.error("Error fetching client business profile:", JSON.stringify(error, null, 2))
    return null
  }

  // If found with current logic, return immediately
  if (data) {
    console.log(`[getClientBusinessProfile] Found exact match for "${clientName}": ${data.name}`)
    return data as Competitor
  }

  // Step 2: Fallback to Gemini 2.0 Flash only when no match found
  console.log(`[getClientBusinessProfile] No exact match found for "${clientName}", trying Gemini fallback...`)
  
  try {
    // Get all competitor names for this analysis
    const { data: allCompetitors, error: competitorsError } = await supabase
      .from("Competitor")
      .select("name")
      .eq("analysisRunId", analysisRunId)

    if (competitorsError || !allCompetitors || allCompetitors.length === 0) {
      console.log(`[getClientBusinessProfile] No competitors found for analysis ${analysisRunId}`)
      return null
    }

    const competitorNames = allCompetitors.map(c => c.name).filter(Boolean) as string[]
    console.log(`[getClientBusinessProfile] Found ${competitorNames.length} competitors for smart matching`)

    // Use Gemini to find best match
    const matchResult = await findMatchingCompanyName(clientName, competitorNames)
    
    if (matchResult.matchedName) {
      console.log(`[getClientBusinessProfile] Gemini matched "${clientName}" -> "${matchResult.matchedName}"`)
      
      // Query with the exact matched name
      const { data: matchedData, error: matchedError } = await supabase
        .from("Competitor")
        .select("*")
        .eq("analysisRunId", analysisRunId)
        .eq("name", matchResult.matchedName)
        .maybeSingle()

      if (matchedError) {
        console.error("Error fetching matched competitor:", matchedError)
        return null
      }

      return matchedData as Competitor
    } else {
      console.log(`[getClientBusinessProfile] Gemini could not find a match for "${clientName}"`)
      return null
    }

  } catch (error) {
    console.error('[getClientBusinessProfile] Gemini fallback failed:', error)
    // Return null instead of throwing, so the app continues to work
    return null
  }
}
