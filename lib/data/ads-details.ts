import { getSupabase } from "@/lib/supabase/server"
import { cachedQuery } from "@/lib/utils/server-cache"

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
  // If no ad account provided, return empty array instead of showing all ads
  if (!adAccount) {
    console.log("No ad account provided to getTopPerformingAds, returning empty array")
    return []
  }

  return getTopPerformingAdsByMetric("roas", adAccount, limit)
}

// Function to get top performing ads by CTR
export async function getTopPerformingAdsByCTR(adAccount?: string, limit: number = 10): Promise<AdDetail[]> {
  // If no ad account provided, return empty array instead of showing all ads
  if (!adAccount) {
    console.log("No ad account provided to getTopPerformingAdsByCTR, returning empty array")
    return []
  }

  return getTopPerformingAdsByMetric("ctr", adAccount, limit)
}

// Function to get ads by different metrics
export async function getTopPerformingAdsByMetric(
  metric: 'roas' | 'ctr' | 'clicks' | 'impressions' | 'reach',
  adAccount?: string,
  limit: number = 10
): Promise<AdDetail[]> {
  // If no ad account provided, return empty array instead of showing all ads
  if (!adAccount) {
    console.log("No ad account provided to getTopPerformingAdsByMetric, returning empty array")
    return []
  }

  return cachedQuery(
    `ads:${metric}:${adAccount}:${limit}`,
    async () => {
      const supabase = getSupabase()

      const { data, error } = await supabase
        .from("ads_details")
        .select("*")
        .eq("ad_account", adAccount)
        .order(metric, { ascending: false })
        .limit(limit)

      if (error) {
        console.error(`Error fetching top performing ads by ${metric}:`, error)
        return []
      }

      return (data as AdDetail[]) || []
    },
    3 * 60 * 1000,
  )
}
