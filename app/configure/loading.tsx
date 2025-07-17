import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Loading() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[260px_1fr] bg-[#f2f2f7]">
      {/* Left Sidebar Skeleton */}
      <div className="hidden border-r bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center border-b px-4">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
        <div className="flex-1 overflow-auto py-4">
          <div className="px-4 pb-4">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <nav className="grid items-start px-4 text-sm font-medium">
            <div className="text-xs font-medium text-[#8e8e93] mb-2">
              <Skeleton className="h-4 w-24 mb-2" />
            </div>
            <div className="grid gap-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex flex-col">
        {/* Top Header Skeleton */}
        <header className="flex h-16 items-center gap-4 border-b bg-white px-6">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="ml-auto h-10 w-32 rounded-md" />
        </header>

        {/* Main Content Body Skeleton */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Research Name Input Skeleton */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-[#d1d1d6] mb-6">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Main Tabs Skeleton */}
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto bg-transparent p-0 border-b border-[#d1d1d6]">
              <TabsTrigger value="client" className="rounded-none text-base font-medium py-3">
                <Skeleton className="h-6 w-20" />
              </TabsTrigger>
              <TabsTrigger value="competitors" className="rounded-none text-base font-medium py-3">
                <Skeleton className="h-6 w-24" />
              </TabsTrigger>
              <TabsTrigger value="instruction" className="rounded-none text-base font-medium py-3">
                <Skeleton className="h-6 w-20" />
              </TabsTrigger>
            </TabsList>

            {/* Client Tab Content Skeleton (default active) */}
            <div className="mt-4">
              {/* Sub-Tabs for Client Skeleton */}
              <Tabs defaultValue="information" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border-b border-[#d1d1d6] mb-6">
                  <TabsTrigger value="information" className="rounded-none text-sm font-medium py-2">
                    <Skeleton className="h-5 w-24" />
                  </TabsTrigger>
                  <TabsTrigger value="strategic-insights" className="rounded-none text-sm font-medium py-2">
                    <Skeleton className="h-5 w-32" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Information Sub-tab Content Skeleton */}
              <h2 className="text-lg font-semibold mb-4">
                <Skeleton className="h-6 w-48 mb-4" />
              </h2>
              <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                  {[...Array(7)].map((_, i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  ))}
                </div>
              </Card>

              <h2 className="text-lg font-semibold mb-4">
                <Skeleton className="h-6 w-48 mb-4" />
              </h2>
              <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                  {[...Array(4)].map((_, i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
