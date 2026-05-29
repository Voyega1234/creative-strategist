export type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

export type ResolvedClientInfo = {
  clientName: string
  productFocus: string | null
  clientId: string | null
  adAccount: string | null
}

export const EMPTY_CLIENT_INFO: ResolvedClientInfo = {
  clientName: "No Client Selected",
  productFocus: null,
  clientId: null,
  adAccount: null,
}

export function resolveClientInfoFromParams({
  clients,
  urlClientId,
  urlClientName,
  urlProductFocus,
}: {
  clients: ClientWithProductFocus[]
  urlClientId: string | null
  urlClientName: string | null
  urlProductFocus: string | null
}): ResolvedClientInfo {
  let resolvedInfo: ResolvedClientInfo = { ...EMPTY_CLIENT_INFO }

  if (urlClientId) {
    const clientByMainId = clients.find((client) => client.id === urlClientId)
    if (clientByMainId) {
      return {
        clientName: clientByMainId.clientName,
        productFocus: urlProductFocus || clientByMainId.productFocuses[0]?.productFocus || null,
        clientId: urlClientId,
        adAccount: null,
      }
    }

    for (const client of clients) {
      const productFocus = client.productFocuses.find((pf) => pf.id === urlClientId)
      if (productFocus) {
        resolvedInfo = {
          clientName: client.clientName,
          productFocus: productFocus.productFocus,
          clientId: urlClientId,
          adAccount: null,
        }
        break
      }
    }

    return resolvedInfo
  }

  if (urlClientName) {
    const clientByName = clients.find((client) => client.clientName === urlClientName)
    if (clientByName) {
      const productFocus = urlProductFocus
        ? clientByName.productFocuses.find((pf) => pf.productFocus === urlProductFocus)
        : clientByName.productFocuses[0]

      return {
        clientName: clientByName.clientName,
        productFocus: productFocus?.productFocus || null,
        clientId: productFocus?.id || clientByName.id,
        adAccount: null,
      }
    }
  }

  return resolvedInfo
}

export function findActiveClientRecord(
  clients: ClientWithProductFocus[],
  activeClientName: string | null
) {
  if (!activeClientName || activeClientName === "No Client Selected") {
    return null
  }
  return clients.find((client) => client.clientName === activeClientName) || null
}

export function findActiveProductFocusEntry(
  activeClientRecord: ClientWithProductFocus | null,
  activeProductFocus: string | null
) {
  if (!activeClientRecord) {
    return null
  }
  if (activeProductFocus) {
    const matched = activeClientRecord.productFocuses.find(
      (pf) => pf.productFocus === activeProductFocus
    )
    if (matched) {
      return matched
    }
  }
  return activeClientRecord.productFocuses[0] || null
}

export function filterClientsBySearch(
  clients: ClientWithProductFocus[],
  normalizedClientSearch: string
) {
  if (!normalizedClientSearch) {
    return clients
  }
  return clients.filter((client) =>
    client.clientName.toLowerCase().includes(normalizedClientSearch)
  )
}

export function orderClientsByActiveName(
  clients: ClientWithProductFocus[],
  activeClientName: string
) {
  const activeClient = clients.find((client) => client.clientName === activeClientName)
  const otherClients = clients.filter((client) => client.clientName !== activeClientName)
  return activeClient ? [activeClient, ...otherClients] : clients
}
