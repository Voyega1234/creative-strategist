import { getSupabase } from "@/lib/supabase/server"

// Type for research market data based on the table structure
export type ResearchMarketData = {
  id: string
  client_name: string
  product_focus: string
  created_at: string
  analysis_data: {
    news?: Array<{title: string, summary: string}>
    analysis?: {
      research?: string[]
      strengths?: string[]
      weaknesses?: string[]
      shared_patterns?: string[]
      market_gaps?: string[]
      differentiation_strategies?: string[]
      summary?: string
    }
    news_insights?: {
      research?: string[]
    }
  }
}

// Function to get research market data by client name and product focus
export async function getResearchMarketData(clientName: string, productFocus: string): Promise<ResearchMarketData | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from("research_market")
    .select("*")
    .eq("client_name", clientName)
    .eq("product_focus", productFocus)
    .single()

  if (error) {
    console.error("Error fetching research market data:", error)
    return null
  }

  return data as ResearchMarketData
}

// Function to get research market data by analysis run ID (alternative method)
export async function getResearchMarketDataByRunId(analysisRunId: string): Promise<ResearchMarketData | null> {
  const supabase = getSupabase()
  
  // First get the client name and product focus from Clients
  const { data: analysisRun, error: analysisError } = await supabase
    .from("Clients")
    .select("clientName, productFocus")
    .eq("id", analysisRunId)
    .single()

  if (analysisError || !analysisRun) {
    console.error("Error fetching analysis run:", analysisError)
    return null
  }

  // Then get the research market data
  return getResearchMarketData(analysisRun.clientName, analysisRun.productFocus)
}