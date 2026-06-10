import { getSupabase } from "@/lib/supabase/server"
import { cachedQuery } from "@/lib/utils/server-cache"
import type { ClientWithProductFocus } from "@/lib/client-options"
import { getMappingClients, mergeMappingClients } from "@/lib/data/mapping-clients"

// Type for client list, based on Clients table
export type ClientListItem = {
  id: string
  clientName: string
}

function sanitizeColorValue(value: string) {
  return value.replace(/[^0-9a-fA-F]/g, "").substring(0, 6).toUpperCase()
}

function parseColorPalette(paletteValue: unknown): string[] {
  if (!paletteValue) return []
  if (Array.isArray(paletteValue)) {
    return paletteValue.map((value) => sanitizeColorValue(String(value))).filter(Boolean)
  }
  if (typeof paletteValue === "string") {
    try {
      const parsed = JSON.parse(paletteValue)
      if (Array.isArray(parsed)) {
        return parsed.map((value) => sanitizeColorValue(String(value))).filter(Boolean)
      }
    } catch {
      return paletteValue
        .split(",")
        .map((value) => sanitizeColorValue(value))
        .filter(Boolean)
    }
  }
  return []
}

export async function getClients(): Promise<ClientListItem[]> {
  return cachedQuery("clients:list", async () => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("Clients")
      .select("id, clientName")
      .not("clientName", "is", null)
      .order("clientName")

    if (error) {
      console.error("Error fetching clients:", error)
      return []
    }

    // Group by clientName and return unique clients
    const uniqueClients = data?.reduce((acc: ClientListItem[], curr) => {
      const exists = acc.find((client) => client.clientName === curr.clientName)
      if (!exists) {
        acc.push({ id: curr.id, clientName: curr.clientName })
      }
      return acc
    }, [])

    return uniqueClients || []
  }, 60 * 1000)
}

// Get clients with their product focuses
export async function getClientsWithProductFocus(): Promise<ClientWithProductFocus[]> {
  return cachedQuery("clients:with-product-focus", async () => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from("Clients")
      .select("id, clientName, productFocus, color_palette")
      .not("clientName", "is", null)
      .not("productFocus", "is", null)
      .order("clientName")
      .order("productFocus")

    if (error) {
      console.error("Error fetching clients with product focus:", error)
      return []
    }

    // Group by clientName and collect product focuses
    const clientsMap = new Map<string, ClientWithProductFocus>()

    data?.forEach((row) => {
      const clientName = row.clientName
      const rowColorPalette = parseColorPalette(row.color_palette)
      if (!clientsMap.has(clientName)) {
        clientsMap.set(clientName, {
          id: row.id, // This will be the first ID, used for client selection
          clientName,
          productFocuses: [],
          colorPalette: rowColorPalette,
        })
      }

      const client = clientsMap.get(clientName)!
      if (client.colorPalette?.length === 0 && rowColorPalette.length > 0) {
        client.colorPalette = rowColorPalette
      }
      // Only add if productFocus is not already in the list
      if (!client.productFocuses.some((pf) => pf.productFocus === row.productFocus)) {
        client.productFocuses.push({
          id: row.id, // Each product focus keeps its unique Clients ID
          productFocus: row.productFocus,
          colorPalette: rowColorPalette,
        })
      }
    })

    const systemClients = Array.from(clientsMap.values())
    const mappingClients = await getMappingClients()

    return mergeMappingClients(systemClients, mappingClients)
  }, 60 * 1000)
}
