"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ConfigureLoading() {
  return (
    <div className="flex min-h-screen bg-white relative animate-in fade-in-0 duration-500">
      <div className="flex w-full relative z-10">
        {/* Sidebar Loading - matching ConfigureSidebar structure */}
        <aside className="w-64 bg-white/90 backdrop-blur-sm p-6 border-r border-white/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-8">
              <Skeleton className="h-6 w-40" />
            </div>
            
            {/* Back to Main Button */}
            <div className="mb-6">
              <Skeleton className="h-10 w-full" />
            </div>

            <nav className="space-y-2">
              <div className="w-full">
                <Skeleton className="h-10 w-full mb-2" />
                <div className="space-y-1 pl-8 pt-2">
                  <div className="max-h-64 overflow-y-auto">
                    <div className="space-y-1">
                      <Skeleton className="h-8 w-full" />
                      <div className="ml-4 space-y-1 mb-2">
                        <Skeleton className="h-6 w-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
            </nav>
            <div className="my-4 border-t border-[#e4e7ec]" />
            <nav className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </nav>
          </div>
          <div className="flex items-center space-x-3 p-2 border-t border-[#e4e7ec] mt-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </aside>

        {/* Main Content Loading - matching actual configure page structure */}
        <main className="flex-1 p-8 overflow-auto bg-transparent">
          {/* Main Tabs - 2 tabs only like actual page */}
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border-b border-[#e4e7ec] mb-8">
              <div className="flex items-center justify-center py-3">
                <Skeleton className="h-5 w-12" />
              </div>
              <div className="flex items-center justify-center py-3">
                <Skeleton className="h-5 w-20" />
              </div>
            </TabsList>

            <TabsContent value="client" className="mt-4">
              {/* Sub-Tabs for Client - 3 tabs like actual page */}
              <Tabs defaultValue="information" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto bg-transparent p-0 border-b border-[#e4e7ec] mb-6">
                  <div className="flex items-center justify-center py-2">
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center justify-center py-2">
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="flex items-center justify-center py-2">
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TabsList>

                <TabsContent value="information">
                  <Card className="p-6 border border-[#e4e7ec] shadow-sm bg-white">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="strategic-insights" className="space-y-6">
                  <Card className="p-6 border border-[#e4e7ec] shadow-sm bg-white">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-40" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-6 border border-[#e4e7ec] shadow-sm bg-white">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-36" />
                      <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="manage-feedback" className="space-y-6">
                  <Card className="p-6 border border-[#e4e7ec] shadow-sm bg-white">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-32" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="competitors" className="mt-4">
              {/* Competitor Summary */}
              <Card className="p-6 border border-[#e4e7ec] shadow-sm bg-white mb-8">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-40" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" /> 
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </Card>

              {/* Service Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4 mt-8">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>

              {/* Competitor Table */}
              <Card className="p-6 border border-[#e4e7ec] shadow-sm bg-white">
                <div className="space-y-4">
                  <div className="grid grid-cols-7 gap-4 text-sm font-medium border-b pb-2">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="grid grid-cols-7 gap-4 py-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Pagination */}
              <div className="flex items-center justify-end gap-2 mt-4">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </TabsContent>

          </Tabs>
        </main>
      </div>
    </div>
  )
}