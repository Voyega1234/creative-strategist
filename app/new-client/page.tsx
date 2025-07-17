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
    market: "",
    productFocus: "",
    additionalInfo: "",
    userCompetitors: "",
    ad_account_id: ""
  })
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchClients = async () => {
      const fetchedClients = await getClients()
      setClients(fetchedClients)
    }
    fetchClients()
  }, [])

  const handleCreateNewClient = async () => {
    if (!formData.clientName || !formData.market) {
      alert("Please enter client name and target market.")
      return
    }
    setIsCreating(true)
    
    try {
      const response = await fetch('/api/competitor-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
    <div className="flex min-h-screen items-center justify-center bg-[#f2f2f7] p-4">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">Competitor Research</h1>
        <p className="text-lg text-[#8e8e93] mb-8">
          Perform deep competitor analysis, view detailed comparisons, and generate strategic recommendations.
        </p>

        <Tabs defaultValue="new-client" className="w-full max-w-md mx-auto">
          <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border border-[#999999] rounded-md overflow-hidden mb-8">
            <TabsTrigger
              value="new-client"
              className="data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none rounded-none text-base font-medium py-2"
            >
              New Client
            </TabsTrigger>
            <TabsTrigger
              value="select-client"
              className="data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none rounded-none text-base font-medium py-2"
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

              <Input
                type="text"
                placeholder="Ad Account ID (optional)"
                className="border-[#999999] focus:border-black focus:ring-0 h-12 text-base"
                value={formData.ad_account_id}
                onChange={(e) => setFormData(prev => ({ ...prev, ad_account_id: e.target.value }))}
                disabled={isCreating}
              />

              <Button
                className="w-full h-12 bg-black hover:bg-gray-800 text-base"
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
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
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
