'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Settings, UserPlus, Loader2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

type AppHeaderProps = {
  activeClientId: string | null
  activeProductFocus?: string | null
  activeClientName?: string | null
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

export function AppHeader({ activeClientId, activeProductFocus, activeClientName }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [hasNewResults, setHasNewResults] = useState(false)
  
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

  const isCreateActive = pathname === "/"
  const isConfigureActive = pathname === "/configure"

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

  return (
    <header className="relative h-20 bg-gradient-to-r from-white via-slate-50 to-white border-b border-gray-200 shadow-sm">
      {/* Premium Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/20 via-transparent to-blue-50/20" />
      
      <div className="relative flex h-full items-center justify-between px-8">
        {/* Left Side - Logo/Brand Space */}
        <div className="flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-400 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Creative Strategist
              </h1>
              <p className="text-xs text-gray-500 -mt-1">AI-Powered Content Creation</p>
            </div>
          </div>
        </div>

        {/* Center - Main Navigation */}
        <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-2xl p-1 shadow-md border border-blue-200">
          {/* Create Button */}
          <Link href={createHref} passHref>
            <Button 
              variant="ghost" 
              className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                isCreateActive
                  ? 'bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-lg hover:from-blue-700 hover:to-blue-500'
                  : 'text-blue-700 hover:bg-blue-50 hover:text-blue-900'
              }`}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              สร้างหัวข้อ
              {hasNewResults && pathname !== "/" && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse flex items-center justify-center">
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
                ? 'bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-lg hover:from-blue-700 hover:to-blue-500'
                : 'text-blue-700 hover:bg-blue-50 hover:text-blue-900'
            }`}
          >
            {isNavigating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            {isNavigating ? 'กำลังโหลด...' : 'ตั้งค่าและวิเคราะห์'}
            {isConfigureActive && !isNavigating && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
            )}
          </Button>
        </div>

        {/* Right Side - New Client Button */}
        <div className="flex items-center">
          <Link href="/new-client" passHref>
            <Button 
              variant="outline" 
              className="relative bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-blue-200 hover:border-blue-300 px-6 py-3 rounded-xl font-medium shadow-sm transition-all duration-200 hover:shadow-md group"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserPlus className="w-3 h-3 text-white" />
                </div>
                <span>ลูกค้าใหม่</span>
              </div>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
