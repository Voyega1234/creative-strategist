import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { MainSidebar } from "@/components/main-sidebar"
import { getCompetitors, getUniqueServices, getClientBusinessProfile, type Competitor } from "@/lib/data/competitors"
import { ClientInformationSection } from "@/components/client-information-section"
import { ResearchInsightsSection } from "@/components/research-insights-section"
import { StrategicInsightsWrapper } from "@/components/strategic-insights-wrapper"
import { TopPerformingAds } from "@/components/top-performing-ads"
import { FeedbackTableWrapper } from "@/components/feedback-table-wrapper"
import { CompetitorSummary } from "@/components/competitor-summary"
import { AddCompetitorModal } from "@/components/add-competitor-modal"
import { CompetitorTable } from "@/components/competitor-table"
import { FacebookAdsForm } from "@/components/facebook-ads-form"
import { getClientProfile } from "@/lib/data/client-profile"
import { getClients, getClientsWithProductFocus } from "@/lib/data/clients"
import { getResearchMarketDataByRunId, getResearchMarketData, type ResearchMarketData } from "@/lib/data/research-market"
import { getTopPerformingAdsByMetric, type AdDetail } from "@/lib/data/ads-details"
import { getFeedback, type FeedbackDetail } from "@/lib/data/feedback"
import { getSupabase } from "@/lib/supabase/server"
import Link from "next/link"

const ITEMS_PER_PAGE = 5 // Define items per page

// Add caching and performance optimization
export const revalidate = 60 // Cache for 1 minute for faster updates
export const dynamic = 'force-dynamic' // Ensure fresh data for user-specific content

async function ConfigurePageContent({
  searchParams,
}: {
  searchParams: { clientId?: string; productFocus?: string; serviceFilter?: string; page?: string; clientName?: string }
}) {
  const params = await searchParams
  const clients = await getClients()
  const clientsWithProductFocus = await getClientsWithProductFocus()
  const defaultClient = clients[0]

  // Prioritize clientName from URL params, then find matching client
  let activeClientName = params.clientName || "No Client Selected"
  let activeClientId = params.clientId || null
  
  // If we have a clientName but no clientId, try to find the matching client
  if (activeClientName && activeClientName !== "No Client Selected" && !activeClientId) {
    const matchingClient = clients.find((c) => c.clientName === activeClientName)
    activeClientId = matchingClient?.id || null
  }
  
  // If we have clientId but it doesn't match the clientName, prioritize clientName
  if (activeClientName && activeClientName !== "No Client Selected" && activeClientId) {
    const clientById = clients.find((c) => c.id === activeClientId)
    if (clientById && clientById.clientName !== activeClientName) {
      // ClientId doesn't match clientName, find the right client by name
      const matchingClient = clients.find((c) => c.clientName === activeClientName)
      activeClientId = matchingClient?.id || activeClientId
    }
  }
  
  // Fallback to default client if nothing is found
  if (!activeClientName || activeClientName === "No Client Selected") {
    activeClientName = defaultClient?.clientName || "No Client Selected"
    activeClientId = activeClientId || defaultClient?.id || null
  }

  // Get the first product focus for this client if not specified
  let activeProductFocus = params.productFocus || null
  if (!activeProductFocus && activeClientName && activeClientName !== "No Client Selected") {
    // Use already loaded clientsWithProductFocus to find the first one for this client
    const currentClient = clientsWithProductFocus.find(c => c.clientName === activeClientName)
    if (currentClient && currentClient.productFocuses.length > 0) {
      activeProductFocus = currentClient.productFocuses[0].productFocus
    }
  }

  const selectedServiceFilter = params.serviceFilter || null
  const currentPage = Number.parseInt(params.page || "1") // Get current page from search params

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
    // Execute ALL queries in parallel for maximum performance
    const effectiveProductFocus = activeProductFocus || "default"
    
    const [
      clientProfileResult,
      analysisRunResult,
      clientBusinessProfileResult,
      researchMarketDataResult,
      researchMarketDataByRunIdResult,
      competitorsResult,
      uniqueServicesResult,
      feedbackDataResult,
    ] = await Promise.all([
      getClientProfile(activeClientId),
      getSupabase()
        .from('Clients')
        .select('competitor_summary')
        .eq('id', activeClientId)
        .single(),
      getClientBusinessProfile(activeClientId),
      activeClientName ? getResearchMarketData(activeClientName, effectiveProductFocus).catch(() => null) : Promise.resolve(null),
      getResearchMarketDataByRunId(activeClientId).catch(() => null),
      getCompetitors(activeClientId, selectedServiceFilter, currentPage, ITEMS_PER_PAGE),
      getUniqueServices(activeClientId),
      getFeedback(activeClientName, activeProductFocus || undefined, 'all'),
    ])

    // Assign results
    initialClientProfileData = clientProfileResult
    existingCompetitorSummary = analysisRunResult.data?.competitor_summary || ''
    clientBusinessProfile = clientBusinessProfileResult
    researchMarketData = researchMarketDataResult || researchMarketDataByRunIdResult
    competitorsData = competitorsResult.data
    totalCompetitorsCount = competitorsResult.count
    uniqueServices = uniqueServicesResult
    feedbackData = feedbackDataResult

    // Get top performing ads if we have ad account ID (this depends on client profile)
    if (initialClientProfileData?.ad_account_id) {
      topPerformingAds = await getTopPerformingAdsByMetric('roas', initialClientProfileData.ad_account_id, 10)
    }


  }

  if (!initialClientProfileData) {
    return (
      <div className="flex min-h-screen bg-white relative">
        <div className="flex w-full relative z-10">
          <MainSidebar 
            clients={clientsWithProductFocus} 
            activeClientName={activeClientName} 
            activeProductFocus={activeProductFocus} 
            activeClientId={activeClientId} 
          />
          <main className="flex-1 p-8 flex items-center justify-center min-h-screen bg-transparent">
            <div className="text-center text-[#535862]">
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
    <div className="flex min-h-screen bg-white relative animate-in fade-in-0 duration-500">
      <div className="flex w-full relative z-10">
        <MainSidebar 
          clients={clientsWithProductFocus} 
          activeClientName={activeClientName} 
          activeProductFocus={activeProductFocus} 
          activeClientId={activeClientId} 
        />
        <main className="flex-1 p-8 overflow-auto bg-transparent">
          {/* Main Tabs */}
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border-b border-[#e4e7ec] mb-8">
              <TabsTrigger
                value="client"
                className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-base font-medium py-3 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
              >
                Client
              </TabsTrigger>
              <TabsTrigger
                value="competitors"
                className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-base font-medium py-3 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
              >
                Competitors
              </TabsTrigger>
            </TabsList>

            {/* Client Tab Content */}
            <TabsContent value="client" className="mt-4">
              {/* Sub-Tabs for Client */}
              <Tabs defaultValue="information" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto bg-transparent p-0 border-b border-[#e4e7ec] mb-6">
                  <TabsTrigger
                    value="information"
                    className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-sm font-medium py-2 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                  >
                    Information
                  </TabsTrigger>
                  <TabsTrigger
                    value="strategic-insights"
                    className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-sm font-medium py-2 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                  >
                    Facebook Ads
                  </TabsTrigger>
                  <TabsTrigger
                    value="manage-feedback"
                    className="data-[state=active]:bg-[#dbeafe] data-[state=active]:text-[#063def] data-[state=active]:shadow-sm rounded-md text-sm font-medium py-2 text-[#535862] hover:text-[#063def] hover:bg-[#f5f5f5]"
                  >
                    Manage Feedback
                  </TabsTrigger>
                </TabsList>

                {/* Information Sub-tab Content */}
                <TabsContent value="information" className="space-y-6">
                  <ClientInformationSection initialClientProfileData={initialClientProfileData} clientBusinessProfile={clientBusinessProfile} />
                  
                  {/* Strategic Insights moved here */}
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

                  {/* Research Insights Section moved here */}
                  <ResearchInsightsSection 
                    insights={researchMarketData?.analysis_data?.analysis?.research || []}
                    clientName={activeClientName}
                    productFocus={activeProductFocus || undefined}
                  />
                </TabsContent>

                {/* Facebook Ads Sub-tab Content */}
                <TabsContent value="strategic-insights" className="space-y-6">
                  {/* Only Top Performing Ads Section */}
                  {topPerformingAds.length > 0 ? (
                    <TopPerformingAds 
                      ads={topPerformingAds}
                      title="Top 10 Performing Facebook Ads"
                    />
                  ) : (
                    <FacebookAdsForm 
                      activeClientId={activeClientId}
                      activeClientName={activeClientName}
                    />
                  )}
                </TabsContent>

                {/* Manage Feedback Sub-tab Content */}
                <TabsContent value="manage-feedback" className="space-y-6">
                  {/* Feedback Table */}
                  <FeedbackTableWrapper initialFeedback={feedbackData} />
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
                        ? "bg-[#1d4ed8] text-white hover:bg-[#063def]"
                        : "border-[#e4e7ec] text-[#535862] hover:bg-[#f5f5f5] hover:text-[#063def] bg-transparent"
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
                          ? "bg-[#1d4ed8] text-white hover:bg-[#063def]"
                          : "border-[#e4e7ec] text-[#535862] hover:bg-[#f5f5f5] hover:text-[#063def] bg-transparent"
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
                    className="h-8 w-8 border-[#e4e7ec] text-[#535862] hover:bg-[#f5f5f5] hover:text-[#063def] bg-transparent"
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
                          ? "bg-[#1d4ed8] text-white hover:bg-[#063def]"
                          : "border-[#e4e7ec] text-[#535862] hover:bg-[#f5f5f5] hover:text-[#063def] bg-transparent"
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
                    className="h-8 w-8 border-[#e4e7ec] text-[#535862] hover:bg-[#f5f5f5] hover:text-[#063def] bg-transparent"
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Next</span>
                  </Button>
                </Link>
              </div>
            </TabsContent>

          </Tabs>
        </main>
      </div>
    </div>
  )
}

interface ConfigurePageProps {
  searchParams: { clientId?: string; productFocus?: string; serviceFilter?: string; page?: string; clientName?: string }
}

export default function ConfigurePage({ searchParams }: ConfigurePageProps) {
  return <ConfigurePageContent searchParams={searchParams} />
}
