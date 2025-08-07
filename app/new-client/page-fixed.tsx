"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowRight, ArrowLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { getClients } from "@/lib/data/clients"
import { useRouter } from "next/navigation"

export default function NewClientPage() {
  const [clients, setClients] = useState<{ id: string; clientName: string }[]>([])
  const [formData, setFormData] = useState({
    clientName: "",
    websiteUrl: "",
    facebookUrl: "",
    market: "Thailand",
    productFocus: "",
    additionalInfo: "",
    userCompetitors: "",
    ad_account_id: ""
  })
  const [isCreating, setIsCreating] = useState(false)
  const [adAccountError, setAdAccountError] = useState("")
  const router = useRouter()

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/new-notification-011-364050.mp3')
      audio.volume = 0.5
      console.log('Attempting to play notification sound...')
      
      audio.play().then(() => {
        console.log('Notification sound played successfully')
      }).catch(error => {
        console.error('Could not play notification sound:', error)
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
          
          console.log('Played fallback beep sound')
        } catch (fallbackError) {
          console.error('Fallback sound also failed:', fallbackError)
        }
      })
    } catch (error) {
      console.error('Could not initialize notification sound:', error)
    }
  }

  useEffect(() => {
    const fetchClients = async () => {
      const fetchedClients = await getClients()
      setClients(fetchedClients)
    }
    fetchClients()
  }, [])

  const validateAndFormatAdAccountId = (adAccountId: string): string | null => {
    if (!adAccountId.trim()) return null
    
    const trimmed = adAccountId.trim()
    
    if (trimmed.startsWith('act_')) {
      const numberPart = trimmed.substring(4)
      if (!/^\d{15,16}$/.test(numberPart)) {
        throw new Error("Ad Account ID must be in format: act_1234567890123456 (15-16 digits after act_)")
      }
      return trimmed
    }
    
    if (/^\d{15,16}$/.test(trimmed)) {
      return `act_${trimmed}`
    }
    
    throw new Error("Ad Account ID must be either 15-16 digits or in format: act_1234567890123456")
  }

  const handleAdAccountChange = (value: string) => {
    setFormData(prev => ({ ...prev, ad_account_id: value }))
    
    if (!value.trim()) {
      setAdAccountError("")
      return
    }
    
    try {
      validateAndFormatAdAccountId(value)
      setAdAccountError("")
    } catch (error: any) {
      setAdAccountError(error.message)
    }
  }

  const handleCreateNewClient = async () => {
    if (!formData.clientName || !formData.market) {
      alert("Please enter client name and target market.")
      return
    }

    let validatedAdAccountId = null
    if (formData.ad_account_id) {
      try {
        validatedAdAccountId = validateAndFormatAdAccountId(formData.ad_account_id)
      } catch (error: any) {
        alert(error.message)
        return
      }
    }

    setIsCreating(true)
    
    try {
      const response = await fetch('/api/competitor-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ad_account_id: validatedAdAccountId
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        const insightsStatus = result.strategicInsightsGenerated ? 
          "Competitor analysis and strategic insights completed successfully!" :
          "Competitor analysis completed successfully! (Strategic insights generation encountered an issue)"
        
        playNotificationSound()
        alert(insightsStatus)
        
        const destination = result.analysisRunId 
          ? `/configure?clientId=${result.analysisRunId}` 
          : `/configure`
        router.push(destination)
      } else {
        alert(`Failed to analyze competitors: ${result.error}`)
      }
    } catch (error) {
      console.error('Error calling Jina search API:', error)
      alert('An error occurred while analyzing competitors. Please try again.')
    }
    
    setIsCreating(false)
  }

  return (
    <div className="flex min-h-screen bg-white relative animate-in fade-in-0 duration-500">
      <div className="flex w-full relative z-10">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1d4ed8] to-[#063def] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.05\"%3E%3Ccircle cx=\"30\" cy=\"30\" r=\"1\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
          
          <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
            <div className="mb-8">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-[#1d4ed8] rounded-sm"></div>
                </div>
              </div>
              <h1 className="text-4xl font-bold mb-4 leading-tight">
                Strategic Competitor<br />Research Platform
              </h1>
              <p className="text-xl text-white/90 leading-relaxed">
                Perform deep competitor analysis, generate strategic insights, and create data-driven marketing strategies.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">AI-powered competitor analysis</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">Strategic insights generation</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">Real-time market research</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Back Navigation */}
            <div className="mb-6">
              <Link
                href="/"
                className="inline-flex items-center text-[#8e8e93] hover:text-[#1d4ed8] transition-colors text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </div>

            <div className="text-center mb-8">
              <div className="lg:hidden w-12 h-12 bg-[#dbeafe] rounded-xl flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 bg-[#1d4ed8] rounded-lg flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-sm"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[#535862] mb-2">Create New Analysis</h2>
              <p className="text-[#8e8e93]">Start your competitor research journey</p>
            </div>

            <Tabs defaultValue="new-client" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border-b border-[#e4e7ec] mb-8">
                <TabsTrigger
                  value="new-client"
                  className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-base font-medium py-3 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                >
                  New Client
                </TabsTrigger>
                <TabsTrigger
                  value="select-client"
                  className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-base font-medium py-3 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                >
                  Select Client
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new-client">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-2">
                        Client Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="Enter client name"
                        className="border-[#e4e7ec] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20 h-12 text-base transition-colors"
                        value={formData.clientName}
                        onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-2">
                        Target Market <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="Thailand, Singapore, etc."
                        className="border-[#e4e7ec] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20 h-12 text-base transition-colors"
                        value={formData.market}
                        onChange={(e) => setFormData(prev => ({ ...prev, market: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-2">
                        Product Focus
                      </label>
                      <Input
                        type="text"
                        placeholder="Gold trading, Investment services, etc."
                        className="border-[#e4e7ec] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20 h-12 text-base transition-colors"
                        value={formData.productFocus}
                        onChange={(e) => setFormData(prev => ({ ...prev, productFocus: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#535862] mb-2">
                          Website URL
                        </label>
                        <Input
                          type="url"
                          placeholder="https://example.com"
                          className="border-[#e4e7ec] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20 h-12 text-base transition-colors"
                          value={formData.websiteUrl}
                          onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                          disabled={isCreating}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#535862] mb-2">
                          Facebook Page
                        </label>
                        <Input
                          type="url"
                          placeholder="Facebook page URL"
                          className="border-[#e4e7ec] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20 h-12 text-base transition-colors"
                          value={formData.facebookUrl}
                          onChange={(e) => setFormData(prev => ({ ...prev, facebookUrl: e.target.value }))}
                          disabled={isCreating}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-2">
                        Additional Information
                      </label>
                      <Textarea
                        placeholder="Any additional context about the client..."
                        className="border-[#e4e7ec] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20 text-base resize-none transition-colors"
                        rows={3}
                        value={formData.additionalInfo}
                        onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-2">
                        Known Competitors
                      </label>
                      <Textarea
                        placeholder="Competitor names (separate with commas)"
                        className="border-[#e4e7ec] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20 text-base resize-none transition-colors"
                        rows={2}
                        value={formData.userCompetitors}
                        onChange={(e) => setFormData(prev => ({ ...prev, userCompetitors: e.target.value }))}
                        disabled={isCreating}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#535862] mb-2">
                        Ad Account ID
                      </label>
                      <Input
                        type="text"
                        placeholder="act_1234567890123456 (optional)"
                        className={`border-[#e4e7ec] focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/20 h-12 text-base transition-colors ${
                          adAccountError ? '!border-red-500 !focus:border-red-500 !focus:ring-red-500/20' : ''
                        }`}
                        value={formData.ad_account_id}
                        onChange={(e) => handleAdAccountChange(e.target.value)}
                        disabled={isCreating}
                      />
                      {adAccountError && (
                        <p className="text-red-500 text-sm mt-1">{adAccountError}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 bg-[#1d4ed8] text-white hover:bg-[#063def] text-base font-medium transition-colors shadow-sm disabled:opacity-50"
                    onClick={handleCreateNewClient}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Analyzing Competitors & Generating Insights...
                      </>
                    ) : (
                      <>
                        Start Competitor Analysis
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="select-client">
                <div className="space-y-4">
                  <p className="text-[#8e8e93] text-center mb-6">
                    Choose an existing client to view their analysis
                  </p>
                  
                  {clients.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {clients.map((client) => (
                        <Link
                          key={client.id}
                          href={`/configure?clientId=${client.id}`}
                          className="group"
                        >
                          <div className="flex items-center justify-between p-4 border border-[#e4e7ec] rounded-lg hover:border-[#1d4ed8] hover:bg-[#eff6ff] transition-all duration-200 cursor-pointer">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-[#dbeafe] rounded-lg flex items-center justify-center group-hover:bg-[#1d4ed8] transition-colors">
                                <div className="w-5 h-5 bg-[#1d4ed8] rounded-sm group-hover:bg-white transition-colors"></div>
                              </div>
                              <div>
                                <h3 className="font-medium text-[#535862] group-hover:text-[#063def]">
                                  {client.clientName}
                                </h3>
                                <p className="text-sm text-[#8e8e93]">View analysis results</p>
                              </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-[#8e8e93] group-hover:text-[#1d4ed8] transition-colors" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-[#f1f5f9] rounded-full flex items-center justify-center mx-auto mb-4">
                        <div className="w-8 h-8 bg-[#e4e7ec] rounded-full"></div>
                      </div>
                      <p className="text-[#8e8e93] mb-2">No clients found</p>
                      <p className="text-sm text-[#8e8e93]">Create your first client analysis</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}