'use client'

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

type AppHeaderProps = {
  activeClientId: string | null
  activeProductFocus?: string | null
  activeClientName?: string | null
}

export function AppHeader({ activeClientId, activeProductFocus, activeClientName }: AppHeaderProps) {
  // Build URLs with all available parameters
  let configureHref = "/configure"
  let createHref = "/"
  
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
  }

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-white px-6">
      <div className="flex items-center gap-2">
        {/* Create Button */}
        <Link href={createHref} passHref>
          <Button variant="outline" className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent">
            Create
          </Button>
        </Link>
        {/* Configure Button */}
        <Link href={configureHref} passHref>
          <Button variant="outline" className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent">
            Configure
          </Button>
        </Link>
      </div>
      {/* New Client Button */}
      <Link href="/new-client" passHref>
        <Button variant="outline" className="ml-auto border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent">
          <Plus className="mr-2 h-4 w-4" />
          New Client
        </Button>
      </Link>
    </header>
  )
}
