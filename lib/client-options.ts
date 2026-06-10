export type ClientProductFocus = {
  id: string
  productFocus: string
  colorPalette?: string[]
}

export type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: ClientProductFocus[]
  colorPalette?: string[]
  existsInSystem?: boolean
  mappingStatus?: string
  serviceStatus?: string
  source?: "system" | "mapping"
}

export function clientExistsInSystem(client: {
  id: string
  productFocuses: Array<unknown>
  existsInSystem?: boolean
}) {
  return client.existsInSystem !== false && client.productFocuses.length > 0 && !client.id.startsWith("mapping:")
}

export function buildMissingClientOnboardingUrl(clientName: string) {
  const params = new URLSearchParams()
  params.set("clientName", clientName)
  params.set("fromMapping", "1")
  return `/new-client?${params.toString()}`
}
