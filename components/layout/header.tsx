'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Settings, UserPlus, Loader2, Image as ImageIcon, Building2, Globe, X, ChevronDown } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useClient } from "@/contexts/client-context"

type ClientOption = {
  id: string
  clientName: string
  productFocuses: string[]
}

// Check if there are new results available
const checkForNewResults = (clientName: string | null, productFocus: string | null): boolean => {
  try {
    const lastGeneration = localStorage.getItem('lastGenerationComplete')
    if (lastGeneration && clientName && productFocus) {
      const data = JSON.parse(lastGeneration)
      const now = Date.now()
      const timeDiff = now - data.timestamp
      
      return (
        timeDiff < 30 * 60 * 1000 && // 30 minutes
        !data.shown &&
        data.clientName === clientName &&
        data.productFocus === productFocus
      )
    }
  } catch (error) {
    console.log('Error checking for new results:', error)
  }
  return false
}

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [hasNewResults, setHasNewResults] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [loadingClients, setLoadingClients] = useState(false)
  
  const { activeClientId, activeProductFocus, activeClientName, setActiveClientId, setActiveProductFocus } = useClient()
  
  // Build URLs with all available parameters
  let configureHref = "/configure"
  let createHref = "/"
  let imagesHref = "/images"
  
  if (activeClientId) {
    const params = new URLSearchParams()
    params.set("clientId", activeClientId)
    if (activeProductFocus) {
      params.set("productFocus", activeProductFocus)
    }
    if (activeClientName) {
      params.set("clientName", activeClientName)
    }
    configureHref = `/configure?${params.toString()}`
    createHref = `/?${params.toString()}`
    imagesHref = `/images?${params.toString()}`
  }

  const isCreateActive = pathname === "/"
  const isConfigureActive = pathname === "/configure"
  const isImagesActive = pathname === "/images"

  const handleConfigureClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsNavigating(true)
    
    try {
      router.push(configureHref)
    } catch (error) {
      console.error('Navigation error:', error)
      setIsNavigating(false)
    }
  }

  // Reset loading state when pathname changes
  useEffect(() => {
    setIsNavigating(false)
  }, [pathname])

  // Check for new results periodically
  useEffect(() => {
    const checkResults = () => {
      setHasNewResults(checkForNewResults(activeClientName ?? null, activeProductFocus ?? null))
    }
    
    checkResults()
    const interval = setInterval(checkResults, 5000) // Check every 5 seconds
    
    return () => clearInterval(interval)
  }, [activeClientName, activeProductFocus])

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      setLoadingClients(true)
      try {
        const response = await fetch('/api/clients')
        if (response.ok) {
          const data = await response.json()
          setClients(data)
        }
      } catch (error) {
        console.error('Failed to load clients:', error)
      } finally {
        setLoadingClients(false)
      }
    }
    
    loadClients()
  }, [])

  // Filter clients based on search
  const filteredClients = clients.filter(client =>
    clientSearchTerm === "" ||
    client.clientName.toLowerCase().includes(clientSearchTerm.toLowerCase())
  )

  // Get current client
  const selectedClient = clients.find(c => c.id === activeClientId)

  // Handle client selection
  const handleClientSelection = (clientId: string) => {
    setActiveClientId(clientId)
    setClientDropdownOpen(false)
    setClientSearchTerm("")
    
    // Update URL params
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (clientId === "general") {
        url.searchParams.delete('clientId')
        url.searchParams.delete('clientName')
        url.searchParams.delete('productFocus')
      } else {
        const client = clients.find(c => c.id === clientId)
        if (client) {
          url.searchParams.set('clientId', clientId)
          url.searchParams.set('clientName', client.clientName)
          // Set first product focus if none selected
          if (!activeProductFocus && client.productFocuses.length > 0) {
            url.searchParams.set('productFocus', client.productFocuses[0])
          }
        }
      }
      window.history.pushState({}, '', url.toString())
    }
  }

  return (
    <header className="sticky top-0 z-50 h-20 bg-white border-b border-gray-200 shadow-sm">
      
      <div className="relative flex h-full items-center justify-between px-8">
        {/* Left Side - Empty Space */}
        <div className="flex items-center">
        </div>

        {/* Center - Main Navigation */}
        <div className="flex items-center gap-1 bg-white rounded-2xl p-1 shadow-md border border-gray-200">
          {/* Create Button */}
          <Link href={createHref} passHref>
            <Button 
              variant="ghost" 
              className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                isCreateActive
                  ? 'bg-black text-white shadow-lg hover:bg-gray-800'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate
              {hasNewResults && pathname !== "/" && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-500 rounded-full animate-pulse flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              )}
              {isCreateActive && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
              )}
            </Button>
          </Link>
          
          {/* Configure Button */}
          <Button 
            variant="ghost" 
            onClick={handleConfigureClick}
            disabled={isNavigating}
            className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              isConfigureActive
                ? 'bg-black text-white shadow-lg hover:bg-gray-800'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {isNavigating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            {isNavigating ? 'Loading...' : 'Configure'}
            {isConfigureActive && !isNavigating && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
            )}
          </Button>
          
          {/* Images Button */}
          <Link href={imagesHref} passHref>
            <Button 
              variant="ghost" 
              className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                isImagesActive
                  ? 'bg-black text-white shadow-lg hover:bg-gray-800'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Images
              {isImagesActive && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
              )}
            </Button>
          </Link>
        </div>

        {/* Right Side - Client Selection */}
        <div className="flex items-center">
          <div className="relative">
            <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-2 shadow-sm">
              {selectedClient ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">{selectedClient.clientName}</span>
                  {activeProductFocus && (
                    <span className="text-xs text-gray-500">• {activeProductFocus}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-gray-600" />
                  </div>
                  <span className="text-sm">Select Client</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              {selectedClient && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleClientSelection("")}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {clientDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
                <div className="p-3 border-b border-gray-100">
                  <Input
                    value={clientSearchTerm}
                    placeholder="Search clients..."
                    className="h-8 text-sm"
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setClientDropdownOpen(false)
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleClientSelection("general")}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <Globe className="w-3 h-3 text-gray-600" />
                  </div>
                  <div>
                    <div className="font-medium">General Mode</div>
                    <div className="text-xs text-gray-500">Use session materials</div>
                  </div>
                </button>
                <div className="max-h-64 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">No clients found</div>
                  ) : (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleClientSelection(client.id)}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                          <Building2 className="w-3 h-3 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{client.clientName}</div>
                          <div className="text-xs text-gray-500">{client.productFocuses.length} products</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
