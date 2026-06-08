import { cachedQuery } from "@/lib/utils/server-cache"
import type { ClientWithProductFocus } from "@/lib/client-options"

export type MappingClient = {
  clientId: string
  status: string
  serviceStatus: string
}

const DEFAULT_MAPPING_CLIENTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRvN1Bg6vUI2MeCMCSAmG9jmBjTlV17sIsyRu5Nd-h2JXuZG8Gbmdr61a8lJMdto13stA_bfGiuLETe/pub?gid=147531213&single=true&output=csv"

const MAPPING_CLIENTS_CSV_URL = process.env.MAPPING_CLIENTS_CSV_URL || DEFAULT_MAPPING_CLIENTS_CSV_URL

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(value)
      value = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1
      }
      row.push(value)
      if (row.some((cell) => cell.trim())) {
        rows.push(row)
      }
      row = []
      value = ""
      continue
    }

    value += char
  }

  row.push(value)
  if (row.some((cell) => cell.trim())) {
    rows.push(row)
  }

  return rows
}

function normalizeClientKey(clientName: string) {
  return clientName.trim().toLowerCase()
}

export async function getMappingClients(): Promise<MappingClient[]> {
  return cachedQuery("mapping-clients:list", async () => {
    try {
      const response = await fetch(MAPPING_CLIENTS_CSV_URL, {
        cache: "no-store",
      })

      if (!response.ok) {
        console.error(`[mapping-clients] Failed to fetch CSV: ${response.status}`)
        return []
      }

      const csvText = await response.text()
      const rows = parseCsv(csvText)
      const [, ...dataRows] = rows

      return dataRows
        .map((row) => ({
          clientId: (row[1] || "").trim(),
          status: (row[2] || "").trim(),
          serviceStatus: (row[3] || "").trim(),
        }))
        .filter((client) => client.clientId)
    } catch (error) {
      console.error("[mapping-clients] Error loading mapping clients:", error)
      return []
    }
  }, 5 * 60 * 1000)
}

export function mergeMappingClients(
  systemClients: ClientWithProductFocus[],
  mappingClients: MappingClient[],
): ClientWithProductFocus[] {
  const systemByName = new Map<string, ClientWithProductFocus>()

  const merged: ClientWithProductFocus[] = systemClients.map((client) => {
    const normalized = normalizeClientKey(client.clientName)
    const nextClient = {
      ...client,
      existsInSystem: true,
      source: "system" as const,
    }
    systemByName.set(normalized, nextClient)
    return nextClient
  })

  for (const mappingClient of mappingClients) {
    const normalized = normalizeClientKey(mappingClient.clientId)
    const existingClient = systemByName.get(normalized)

    if (existingClient) {
      existingClient.mappingStatus = mappingClient.status
      existingClient.serviceStatus = mappingClient.serviceStatus
      continue
    }

    merged.push({
      id: `mapping:${encodeURIComponent(mappingClient.clientId)}`,
      clientName: mappingClient.clientId,
      productFocuses: [],
      existsInSystem: false,
      mappingStatus: mappingClient.status,
      serviceStatus: mappingClient.serviceStatus,
      source: "mapping",
    })
  }

  return merged.sort((a, b) => a.clientName.localeCompare(b.clientName, "th"))
}
