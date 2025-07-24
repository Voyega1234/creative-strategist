import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { AppSidebar } from "@/components/layout/sidebar"
import { AppHeader } from "@/components/layout/header"
import { ConfigureLoading } from "@/components/configure-loading"
import { getCompetitors, getUniqueServices, getClientBusinessProfile, type Competitor } from "@/lib/data/competitors"
import { ClientInformationSection } from "@/components/client-information-section"
import { ResearchInsightsSection } from "@/components/research-insights-section"
import { StrategicInsightsWrapper } from "@/components/strategic-insights-wrapper"
import { TopPerformingAds } from "@/components/top-performing-ads"
import { FeedbackTableWrapper } from "@/components/feedback-table-wrapper"
import { CompetitorSummary } from "@/components/competitor-summary"
import { AddCompetitorModal } from "@/components/add-competitor-modal"
import { CompetitorTable } from "@/components/competitor-table"
import { getClientProfile } from "@/lib/data/client-profile"
import { getClients } from "@/lib/data/clients"
import { getResearchMarketDataByRunId, type ResearchMarketData } from "@/lib/data/research-market"
import { getTopPerformingAdsByMetric, type AdDetail } from "@/lib/data/ads-details"
import { getFeedback, type FeedbackDetail } from "@/lib/data/feedback"
import { getSupabase } from "@/lib/supabase/server"
import Link from "next/link"
import { Suspense } from "react"

const ITEMS_PER_PAGE = 5 // Define items per page

async function ConfigurePageContent({
  searchParams,
}: {
  searchParams: { clientId?: string; productFocus?: string; serviceFilter?: string; page?: string; clientName?: string }
}) {
  const clients = await getClients()
  const defaultClient = clients[0]

  const activeClientId = searchParams.clientId || defaultClient?.id || null
  const activeClientName = searchParams.clientName || 
    clients.find((c) => c.id === activeClientId)?.clientName || defaultClient?.clientName || "No Client Selected"

  // Get the first product focus for this client if not specified
  let activeProductFocus = searchParams.productFocus || null
  if (!activeProductFocus && activeClientName && activeClientName !== "No Client Selected") {
    // Get clients with product focuses to find the first one for this client
    const { getClientsWithProductFocus } = await import("@/lib/data/clients")
    const clientsWithProductFocus = await getClientsWithProductFocus()
    const currentClient = clientsWithProductFocus.find(c => c.clientName === activeClientName)
    if (currentClient && currentClient.productFocuses.length > 0) {
      activeProductFocus = currentClient.productFocuses[0].productFocus
      console.log(`Auto-selected first product focus for ${activeClientName}: ${activeProductFocus}`)
    }
  }

  const selectedServiceFilter = searchParams.serviceFilter || null
  const currentPage = Number.parseInt(searchParams.page || "1") // Get current page from search params

  let initialClientProfileData = null
  let clientBusinessProfile = null
  let researchMarketData: ResearchMarketData | null = null
  let competitorsData: Competitor[] = []
  let totalCompetitorsCount = 0
  let uniqueServices: string[] = []
  let topPerformingAds: AdDetail[] = []
  let feedbackData: FeedbackDetail[] = []
  let existingCompetitorSummary = ''

  if (activeClientId) {
    initialClientProfileData = await getClientProfile(activeClientId)
    
    // Get competitor summary from AnalysisRun table
    const { data: analysisRunData } = await getSupabase()
      .from('AnalysisRun')
      .select('competitor_summary')
      .eq('id', activeClientId)
      .single()
    
    existingCompetitorSummary = analysisRunData?.competitor_summary || ''
    
    // Get client business profile (may return null if not found)
    clientBusinessProfile = await getClientBusinessProfile(activeClientId)
    
    // Use the actual productFocus or fall back to "default" only if really needed
    const effectiveProductFocus = activeProductFocus || "default"
    
    if (activeClientName) {
      const { getResearchMarketData } = await import("@/lib/data/research-market")
      researchMarketData = await getResearchMarketData(activeClientName, effectiveProductFocus)
      console.log(`Fetching research data for: ${activeClientName} - ${effectiveProductFocus}`)
    }
    
    // If no data found and we have activeClientId, try the fallback method
    if (!researchMarketData && activeClientId) {
      console.log(`No data found, trying fallback with activeClientId: ${activeClientId}`)
      researchMarketData = await getResearchMarketDataByRunId(activeClientId)
    }
    
    const { data, count } = await getCompetitors(activeClientId, selectedServiceFilter, currentPage, ITEMS_PER_PAGE)
    competitorsData = data
    totalCompetitorsCount = count
    uniqueServices = await getUniqueServices(activeClientId)
    
    // Get top performing ads - try to get ad_account from client profile
    const adAccount = initialClientProfileData?.ad_account_id || undefined
    console.log("Ad Account ID:", adAccount)
    topPerformingAds = await getTopPerformingAdsByMetric('roas', adAccount, 10)
    console.log("Top Performing Ads fetched:", topPerformingAds.length)
    console.log("Client Business Profile found:", !!clientBusinessProfile)
    
    // Get feedback data for this client and product focus
    feedbackData = await getFeedback(activeClientName, activeProductFocus || undefined, 'all')
    console.log("Feedback data fetched:", feedbackData.length)

    console.log("Active Client ID in ConfigurePage:", activeClientId)
    console.log("Active Product Focus:", activeProductFocus)
    console.log("Client Business Profile:", clientBusinessProfile)
    console.log("Research Market Data:", researchMarketData)
    console.log("Competitors Data fetched in ConfigurePage:", competitorsData)
    console.log("Total Competitors Count:", totalCompetitorsCount)
    console.log("Unique Services fetched in ConfigurePage:", uniqueServices)
  }

  if (!initialClientProfileData) {
    return (
      <div className="grid min-h-screen w-full md:grid-cols-[280px_1fr] bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <AppSidebar activeClientId={activeClientId} activeClientName={activeClientName} activeProductFocus={activeProductFocus} />
        <div className="flex flex-col">
          <AppHeader activeClientId={activeClientId} activeProductFocus={activeProductFocus} activeClientName={activeClientName} />
          <main className="flex-1 p-6 overflow-auto">
            <div className="text-center text-gray-500">
              Client profile not found for the selected client. Please ensure data is seeded or create a new client.
            </div>
          </main>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCompetitorsCount / ITEMS_PER_PAGE)
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[280px_1fr] bg-gradient-to-br from-slate-50 via-white to-slate-50 animate-in fade-in-0 duration-500">
      <AppSidebar activeClientId={activeClientId} activeClientName={activeClientName} activeProductFocus={activeProductFocus} />
      <div className="flex flex-col">
        <AppHeader activeClientId={activeClientId} activeProductFocus={activeProductFocus} activeClientName={activeClientName} />
        <main className="flex-1 p-6 overflow-auto">
          {/* Main Tabs */}
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto bg-transparent p-0 border-b border-[#d1d1d6]">
              <TabsTrigger
                value="client"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none text-base font-medium py-3"
              >
                Client
              </TabsTrigger>
              <TabsTrigger
                value="competitors"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none text-base font-medium py-3"
              >
                Competitors
              </TabsTrigger>
              <TabsTrigger
                value="instruction"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none text-base font-medium py-3"
              >
                Instruction
              </TabsTrigger>
            </TabsList>

            {/* Client Tab Content */}
            <TabsContent value="client" className="mt-4">
              {/* Sub-Tabs for Client */}
              <Tabs defaultValue="information" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border-b border-[#d1d1d6] mb-6">
                  <TabsTrigger
                    value="information"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none text-sm font-medium py-2"
                  >
                    Information
                  </TabsTrigger>
                  <TabsTrigger
                    value="strategic-insights"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none text-sm font-medium py-2"
                  >
                    Strategic Insights
                  </TabsTrigger>
                </TabsList>

                {/* Information Sub-tab Content */}
                <TabsContent value="information">
                  <ClientInformationSection initialClientProfileData={initialClientProfileData} clientBusinessProfile={clientBusinessProfile} />
                </TabsContent>

                {/* Strategic Insights Sub-tab Content */}
                <TabsContent value="strategic-insights" className="space-y-6">
                  <StrategicInsightsWrapper
                    data={{
                      summary: researchMarketData?.analysis_data?.analysis?.summary,
                      strengths: researchMarketData?.analysis_data?.analysis?.strengths,
                      weaknesses: researchMarketData?.analysis_data?.analysis?.weaknesses,
                      market_gaps: researchMarketData?.analysis_data?.analysis?.market_gaps,
                      shared_patterns: researchMarketData?.analysis_data?.analysis?.shared_patterns,
                      differentiation_strategies: researchMarketData?.analysis_data?.analysis?.differentiation_strategies
                    }}
                    clientName={activeClientName}
                    productFocus={activeProductFocus || undefined}
                  />

                  {/* Research Insights Section */}
                  <ResearchInsightsSection 
                    insights={researchMarketData?.analysis_data?.analysis?.research || []}
                    clientName={activeClientName}
                    productFocus={activeProductFocus || undefined}
                  />

                  {/* Top Performing Ads Section */}
                  <TopPerformingAds 
                    ads={topPerformingAds}
                    title="Top 10 Performing Ads"
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Competitors Tab Content */}
            <TabsContent value="competitors" className="mt-4">
              <CompetitorSummary 
                clientId={activeClientId || ''}
                productFocus={activeProductFocus || undefined}
                clientName={activeClientName}
                initialSummary={existingCompetitorSummary}
              />

              <div className="flex flex-wrap gap-2 mb-4 mt-8">
                {/* "All Competitors" button */}
                <Link
                  href={`/configure?clientId=${activeClientId}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}&serviceFilter=All Competitors&page=1`}
                  passHref
                  className="h-auto"
                >
                  <Button
                    variant={
                      !selectedServiceFilter || selectedServiceFilter === "All Competitors" ? "default" : "outline"
                    }
                    className={`text-sm px-3 py-1 h-auto ${
                      !selectedServiceFilter || selectedServiceFilter === "All Competitors"
                        ? "bg-black text-white hover:bg-gray-800"
                        : "border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                    }`}
                  >
                    All Competitors
                  </Button>
                </Link>
                {/* Dynamic Service Filter Buttons */}
                {uniqueServices.map((service) => (
                  <Link
                    key={service}
                    href={`/configure?clientId=${activeClientId}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}&serviceFilter=${encodeURIComponent(service)}&page=1`}
                    passHref
                    className="h-auto"
                  >
                    <Button
                      variant={selectedServiceFilter === service ? "default" : "outline"}
                      className={`text-sm px-3 py-1 h-auto ${
                        selectedServiceFilter === service
                          ? "bg-black text-white hover:bg-gray-800"
                          : "border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                      }`}
                    >
                      {service}
                    </Button>
                  </Link>
                ))}
                <AddCompetitorModal
                  clientId={activeClientId || ''}
                  clientName={activeClientName}
                  productFocus={activeProductFocus || undefined}
                />
              </div>

              {/* Competitor Table with Column Selector */}
              <CompetitorTable competitors={competitorsData} clientName={activeClientName} />
              {/* Competitor Table Pagination */}
              <div className="flex items-center justify-end gap-2 mt-4">
                <Link
                  href={`/configure?clientId=${activeClientId}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}&serviceFilter=${
                    selectedServiceFilter || "All Competitors"
                  }&page=${currentPage - 1}`}
                  passHref
                >
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Previous</span>
                  </Button>
                </Link>
                {pageNumbers.map((page) => (
                  <Link
                    key={page}
                    href={`/configure?clientId=${activeClientId}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}&serviceFilter=${
                      selectedServiceFilter || "All Competitors"
                    }&page=${page}`}
                    passHref
                  >
                    <Button
                      variant={page === currentPage ? "default" : "outline"}
                      size="icon"
                      className={`h-8 w-8 ${
                        page === currentPage
                          ? "bg-black text-white hover:bg-gray-800"
                          : "border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                      }`}
                    >
                      {page}
                    </Button>
                  </Link>
                ))}
                <Link
                  href={`/configure?clientId=${activeClientId}${activeProductFocus ? `&productFocus=${encodeURIComponent(activeProductFocus)}` : ''}&serviceFilter=${
                    selectedServiceFilter || "All Competitors"
                  }&page=${currentPage + 1}`}
                  passHref
                >
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Next</span>
                  </Button>
                </Link>
              </div>
            </TabsContent>

            {/* Instruction Tab Content */}
            <TabsContent value="instruction" className="mt-4">
              <h2 className="text-lg font-semibold mb-4">Instruction</h2>
              <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white mb-6">
                <Textarea
                  placeholder="Provide additional context or specific instructions..."
                  className="min-h-[120px] border-[#999999] focus:border-black focus:ring-0 text-sm text-[#8e8e93]"
                />
              </Card>

              {/* Feedback Table */}
              <FeedbackTableWrapper initialFeedback={feedbackData} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

export default function ConfigurePage({
  searchParams,
}: {
  searchParams: { clientId?: string; productFocus?: string; serviceFilter?: string; page?: string; clientName?: string }
}) {
  return (
    <Suspense fallback={<ConfigureLoading />}>
      <ConfigurePageContent searchParams={searchParams} />
    </Suspense>
  )
}
