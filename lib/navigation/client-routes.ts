type ClientRouteRecord = {
  id?: string | null
  clientName?: string | null
}

type ProductFocusRouteRecord = {
  id?: string | null
  productFocus?: string | null
}

type ClientScopedRouteOptions = {
  basePath: "/" | "/configure" | "/images"
  activeClientName: string | null
  activeClientId?: string | null
  activeClientRecord?: ClientRouteRecord | null
  activeProductFocusEntry?: ProductFocusRouteRecord | null
}

export function buildClientScopedRoute({
  basePath,
  activeClientName,
  activeClientId,
  activeClientRecord,
  activeProductFocusEntry,
}: ClientScopedRouteOptions) {
  if (!activeClientName || activeClientName === "No Client Selected") {
    return basePath
  }

  const params = new URLSearchParams()
  const effectiveClientId = activeClientId || activeProductFocusEntry?.id || activeClientRecord?.id

  if (effectiveClientId) {
    params.set("clientId", String(effectiveClientId))
  }

  params.set("clientName", activeClientName)

  if (activeProductFocusEntry?.productFocus) {
    params.set("productFocus", activeProductFocusEntry.productFocus)
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
