import { getSupabase } from "@/lib/supabase/server"
// import { cachedQuery } from "@/lib/utils/server-cache"

// Type for client list, based on AnalysisRun table
export type ClientListItem = {
  id: string
  clientName: string
}

export async function getClients(): Promise<ClientListItem[]> {
  // Temporarily disabled caching
  const supabase = getSupabase()
  const { data, error } = await supabase.from("AnalysisRun").select("id, clientName").order("clientName")
  
  if (error) {
    console.error("Error fetching clients:", error)
    return []
  }

  // Group by clientName and return unique clients
  const uniqueClients = data?.reduce((acc: ClientListItem[], curr) => {
    const exists = acc.find(client => client.clientName === curr.clientName)
    if (!exists) {
      acc.push({ id: curr.id, clientName: curr.clientName })
    }
    return acc
  }, [])

  return uniqueClients || []
}

// Type for client with product focuses
export type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

// Get clients with their product focuses
export async function getClientsWithProductFocus(): Promise<ClientWithProductFocus[]> {
  // Temporarily disabled caching
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("AnalysisRun")
    .select("id, clientName, productFocus")
    .order("clientName")

  if (error) {
    console.error("Error fetching clients with product focus:", error)
    return []
  }

  // Group by clientName and collect product focuses
  const clientsMap = new Map<string, ClientWithProductFocus>()
  
  data?.forEach(row => {
    const clientName = row.clientName
    if (!clientsMap.has(clientName)) {
      clientsMap.set(clientName, {
        id: row.id, // This will be the first ID, used for client selection
        clientName,
        productFocuses: []
      })
    }
    
    const client = clientsMap.get(clientName)!
    // Only add if productFocus is not already in the list
    if (!client.productFocuses.some(pf => pf.productFocus === row.productFocus)) {
      client.productFocuses.push({
        id: row.id, // Each product focus keeps its unique AnalysisRun ID
        productFocus: row.productFocus
      })
    }
  })

  return Array.from(clientsMap.values())
}
