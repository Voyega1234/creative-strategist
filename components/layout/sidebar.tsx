'use client'

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, Plus } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

type AppSidebarProps = {
  activeClientId: string | null
  activeClientName: string | null
  activeProductFocus: string | null
}

type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

export function AppSidebar({ activeClientId, activeClientName, activeProductFocus }: AppSidebarProps) {
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const currentPath = usePathname()

  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await fetch('/api/clients-with-product-focus')
        if (response.ok) {
          const clientsData = await response.json()
          setClients(clientsData)
        }
      } catch (error) {
        console.error('Error loading clients:', error)
      }
    }
    loadClients()
  }, [])

  return (
    <div className="hidden border-r border-gray-200 bg-white/80 backdrop-blur-sm md:flex md:flex-col shadow-sm">
      <div className="flex h-20 items-center border-b border-gray-200 px-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 text-lg font-semibold w-full justify-start">
              <Avatar className="h-6 w-6">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback>CC</AvatarFallback>
              </Avatar>
              {activeClientName?.split(' - ')[0] || activeClientName || "Select Client"}
              <ChevronDown className="ml-auto h-4 w-4 text-[#8e8e93]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="max-h-[400px] overflow-y-auto w-60"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 #f1f5f9'
            }}
          >
            {clients.map((client) => (
              <DropdownMenuItem key={client.id} asChild>
                <Link href={`${currentPath}?clientId=${client.productFocuses[0]?.id || client.id}&clientName=${encodeURIComponent(client.clientName)}`}>
                  {client.clientName}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem asChild>
              <Link href="/new-client">
                <Plus className="mr-2 h-4 w-4" />
                New Client
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 overflow-auto py-4">
        {/* Show product focuses for current client */}
        {activeClientName && activeClientName !== "No Client Selected" && (
          <div className="px-4">
            <h3 className="text-sm font-medium text-black mb-2">Product Focuses</h3>
            <div className="space-y-1">
              {clients
                .find(client => client.clientName === activeClientName)
                ?.productFocuses.map((pf) => (
                  <Link
                    key={pf.id}
                    href={`${currentPath}?clientId=${pf.id}&productFocus=${encodeURIComponent(pf.productFocus)}&clientName=${encodeURIComponent(activeClientName)}`}
                    className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                      activeProductFocus === pf.productFocus
                        ? 'bg-black text-white'
                        : 'text-[#8e8e93] hover:bg-[#f5f5f5] hover:text-black'
                    }`}
                  >
                    {pf.productFocus}
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
