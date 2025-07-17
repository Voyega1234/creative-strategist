"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, ArrowRight } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getClients } from "@/lib/data/clients"
import { useRouter } from "next/navigation" // For redirection

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

  useEffect(() => {
    const fetchClients = async () => {
      const fetchedClients = await getClients()
      setClients(fetchedClients)
    }
    fetchClients()
  }, [])

  const validateAndFormatAdAccountId = (adAccountId: string): string | null => {
    if (!adAccountId.trim()) return null // Empty is allowed (optional)
    
    const trimmed = adAccountId.trim()
    
    // If it already has act_ prefix, validate the format
    if (trimmed.startsWith('act_')) {
      const numberPart = trimmed.substring(4)
      if (!/^\d{15,16}$/.test(numberPart)) {
        throw new Error("Ad Account ID must be in format: act_1234567890123456 (15-16 digits after act_)")
      }
      return trimmed
    }
    
    // If it's only numbers, add the act_ prefix
    if (/^\d{15,16}$/.test(trimmed)) {
      return `act_${trimmed}`
    }
    
    // Invalid format
    throw new Error("Ad Account ID must be either 15-16 digits or in format: act_1234567890123456")
  }

  const handleAdAccountChange = (value: string) => {
    setFormData(prev => ({ ...prev, ad_account_id: value }))
    
    // Clear error if field is empty (since it's optional)
    if (!value.trim()) {
      setAdAccountError("")
      return
    }
    
    // Validate format
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

    // Validate ad account ID if provided
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
        alert("Competitor analysis completed successfully!")
        // Navigate to configure page to view results
        const destination = result.analysisRunId 
          ? `/configure?clientId=${result.analysisRunId}` 
          : `/configure`;
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">Competitor Research</h1>
        <p className="text-lg text-[#8e8e93] mb-8">
          Perform deep competitor analysis, view detailed comparisons, and generate strategic recommendations.
        </p>

        <Tabs defaultValue="new-client" className="w-full max-w-md mx-auto">
          <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border border-blue-200 rounded-md overflow-hidden mb-8">
            <TabsTrigger
              value="new-client"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-none rounded-none text-base font-medium py-2 text-blue-700"
            >
              New Client
            </TabsTrigger>
            <TabsTrigger
              value="select-client"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-none rounded-none text-base font-medium py-2 text-blue-700"
            >
              Select Client
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new-client">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="text"
                  placeholder="Client Name *"
                  className="border-[#999999] focus:border-black focus:ring-0 h-12 text-base"
                  value={formData.clientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                  disabled={isCreating}
                />
                <Input
                  type="text"
                  placeholder="Target Market *"
                  className="border-[#999999] focus:border-black focus:ring-0 h-12 text-base"
                  value={formData.market}
                  onChange={(e) => setFormData(prev => ({ ...prev, market: e.target.value }))}
                  disabled={isCreating}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="url"
                  placeholder="Website URL"
                  className="border-[#999999] focus:border-black focus:ring-0 h-12 text-base"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                  disabled={isCreating}
                />
                <Input
                  type="url"
                  placeholder="Facebook Page URL"
                  className="border-[#999999] focus:border-black focus:ring-0 h-12 text-base"
                  value={formData.facebookUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, facebookUrl: e.target.value }))}
                  disabled={isCreating}
                />
              </div>

              <Input
                type="text"
                placeholder="Product Focus (e.g., Gold trading, Investment services)"
                className="border-[#999999] focus:border-black focus:ring-0 h-12 text-base"
                value={formData.productFocus}
                onChange={(e) => setFormData(prev => ({ ...prev, productFocus: e.target.value }))}
                disabled={isCreating}
              />

              <Textarea
                placeholder="Additional Information (optional)"
                className="border-[#999999] focus:border-black focus:ring-0 text-base resize-none"
                rows={3}
                value={formData.additionalInfo}
                onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: e.target.value }))}
                disabled={isCreating}
              />

              <Textarea
                placeholder="Known Competitors (optional - separate with commas)"
                className="border-[#999999] focus:border-black focus:ring-0 text-base resize-none"
                rows={2}
                value={formData.userCompetitors}
                onChange={(e) => setFormData(prev => ({ ...prev, userCompetitors: e.target.value }))}
                disabled={isCreating}
              />

              <div>
                <Input
                  type="text"
                  placeholder="Ad Account ID (optional) - e.g., act_1234567890123456"
                  className={`border-[#999999] focus:border-black focus:ring-0 h-12 text-base ${
                    adAccountError ? 'border-red-500 focus:border-red-500' : ''
                  }`}
                  value={formData.ad_account_id}
                  onChange={(e) => handleAdAccountChange(e.target.value)}
                  disabled={isCreating}
                />
                {adAccountError && (
                  <p className="text-red-500 text-sm mt-1">{adAccountError}</p>
                )}
              </div>

              <Button
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-base shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={handleCreateNewClient}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <span className="animate-spin mr-2">🌀</span>
                    Analyzing Competitors...
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-between border-[#999999] text-[#8e8e93] hover:bg-[#eeeeee] bg-transparent h-12 text-base px-4"
                >
                  Select your client...
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#cbd5e1 #f1f5f9'
                }}
              >
                {clients.map((client) => (
                  <DropdownMenuItem key={client.id} asChild>
                    <Link href={`/configure?clientId=${client.id}`}>{client.clientName}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
