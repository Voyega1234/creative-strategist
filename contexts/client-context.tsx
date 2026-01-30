'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type ClientContextType = {
  activeClientId: string | null
  activeProductFocus: string | null
  activeClientName: string | null
  setActiveClientId: (clientId: string) => void
  setActiveProductFocus: (productFocus: string) => void
  setActiveClientName: (clientName: string) => void
}

const ClientContext = createContext<ClientContextType | undefined>(undefined)

export function ClientProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [activeProductFocus, setActiveProductFocus] = useState<string | null>(null)
  const [activeClientName, setActiveClientName] = useState<string | null>(null)

  // Load from URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const clientId = params.get('clientId')
      const productFocus = params.get('productFocus')
      const clientName = params.get('clientName')
      
      if (clientId) setActiveClientId(clientId)
      if (productFocus) setActiveProductFocus(productFocus)
      if (clientName) setActiveClientName(clientName)
    }
  }, [])

  return (
    <ClientContext.Provider value={{
      activeClientId,
      activeProductFocus,
      activeClientName,
      setActiveClientId,
      setActiveProductFocus,
      setActiveClientName
    }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  const context = useContext(ClientContext)
  if (context === undefined) {
    throw new Error('useClient must be used within a ClientProvider')
  }
  return context
}
