"use client"

import { useCallback, useEffect, useState } from "react"
import type { ClientWithProductFocus } from "@/lib/clients/client-selection"

export function useClientsWithProductFocus() {
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(false)

  const loadClients = useCallback(async () => {
    try {
      setIsLoadingClients(true)
      console.log("[main-page] Loading clients...")

      const response = await fetch("/api/clients-with-product-focus")
      if (response.ok) {
        const clientsData = await response.json()
        console.log(
          `[main-page] Loaded ${clientsData.length} clients:`,
          clientsData.map((client: ClientWithProductFocus) => client.clientName)
        )
        setClients(clientsData)
      } else {
        console.error("[main-page] Failed to load clients:", response.status, response.statusText)
      }
    } catch (error) {
      console.error("[main-page] Error loading clients:", error)
    } finally {
      setIsLoadingClients(false)
    }
  }, [])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  return {
    clients,
    isLoadingClients,
    loadClients,
  }
}
