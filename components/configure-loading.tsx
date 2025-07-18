"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ConfigureLoading() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[280px_1fr] bg-gradient-to-br from-slate-50 via-white to-slate-50 animate-pulse">
      {/* Sidebar Loading */}
      <div className="hidden border-r border-gray-200 bg-white/80 backdrop-blur-sm md:flex md:flex-col shadow-sm">
        <div className="flex h-20 items-center border-b border-gray-200 px-6">
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex-1 overflow-auto py-4">
          <div className="px-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <div className="space-y-1">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Loading */}
      <div className="flex flex-col">
        {/* Header Loading */}
        <div className="relative h-20 bg-gradient-to-r from-white via-slate-50 to-white border-b border-gray-200 shadow-sm">
          <div className="relative flex h-full items-center justify-between px-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto bg-transparent p-0 border-b border-[#d1d1d6]">
              <div className="flex items-center justify-center py-3">
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="flex items-center justify-center py-3">
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="flex items-center justify-center py-3">
                <Skeleton className="h-5 w-18" />
              </div>
            </TabsList>

            <TabsContent value="client" className="mt-4">
              <Tabs defaultValue="information" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-auto bg-transparent p-0 border-b border-[#d1d1d6] mb-6">
                  <div className="flex items-center justify-center py-2">
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center justify-center py-2">
                    <Skeleton className="h-4 w-28" />
                  </div>
                </TabsList>

                <TabsContent value="information">
                  <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
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
                  <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-40" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-36" />
                      <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="competitors" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-8 w-32" />
                </div>
                
                <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
                  <Skeleton className="h-32 w-full" />
                </Card>

                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-8 w-24" />
                </div>

                <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
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
              </div>
            </TabsContent>

            <TabsContent value="instruction" className="mt-4">
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
                  <Skeleton className="h-32 w-full" />
                </Card>
                
                <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
                  <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-4 text-sm font-medium border-b pb-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="grid grid-cols-6 gap-4 py-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}