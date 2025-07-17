import { getSupabase } from "@/lib/supabase/server"

// Type for ads details based on the table structure
export type AdDetail = {
  id: string
  name: string
  objective: string
  thumbnail_url: string
  launch_date: string
  clicks: number
  impressions: number
  reach: number
  spend: number
  ctr: number
  roas: number
  cpc: number
  message: string
  platform: string
  creative_pillars: string
  ad_account: string
  frequency: number
  funnel_segment: string
  audience_age_min: number
  audience_age_max: number
  audience_countries: string
  audience_interests: string
  audience_custom_audiences: string
  audience_excluded_custom_audiences: string
  is_advantage_audience_enabled: boolean
  audience_segment: string
  audience_segment_id: string
  image_description: string
  ad_set: string
  ad_set_id: string
}

// Function to get top performing ads by ROAS
export async function getTopPerformingAds(adAccount?: string, limit: number = 10): Promise<AdDetail[]> {
  const supabase = getSupabase()
  
  let query = supabase
    .from("ads_details")
    .select("*")
    .order("roas", { ascending: false })
    .limit(limit)

  // Filter by ad account if provided
  if (adAccount) {
    query = query.eq("ad_account", adAccount)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching top performing ads:", error)
    return []
  }

  return data as AdDetail[]
}

// Function to get top performing ads by CTR
export async function getTopPerformingAdsByCTR(adAccount?: string, limit: number = 10): Promise<AdDetail[]> {
  const supabase = getSupabase()
  
  let query = supabase
    .from("ads_details")
    .select("*")
    .order("ctr", { ascending: false })
    .limit(limit)

  // Filter by ad account if provided
  if (adAccount) {
    query = query.eq("ad_account", adAccount)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching top performing ads by CTR:", error)
    return []
  }

  return data as AdDetail[]
}

// Function to get ads by different metrics
export async function getTopPerformingAdsByMetric(
  metric: 'roas' | 'ctr' | 'clicks' | 'impressions' | 'reach',
  adAccount?: string,
  limit: number = 10
): Promise<AdDetail[]> {
  const supabase = getSupabase()
  
  let query = supabase
    .from("ads_details")
    .select("*")
    .order(metric, { ascending: false })
    .limit(limit)

  // Filter by ad account if provided
  if (adAccount) {
    query = query.eq("ad_account", adAccount)
  }

  const { data, error } = await query

  if (error) {
    console.error(`Error fetching top performing ads by ${metric}:`, error)
    return []
  }

  return data as AdDetail[]
}