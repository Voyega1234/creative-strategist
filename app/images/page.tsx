"use client"

// Performance optimization for client-side rendering
import { useState, useEffect, useMemo, Suspense } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpenText, Image as ImageIcon, Layers3, PanelLeftClose, PanelLeftOpen, Sparkles, Upload, Wand2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { AIImageGenerator } from "@/components/ai-image-generator"
import { Button } from "@/components/ui/button"
import { MainSidebar } from "@/components/main-sidebar"
import { ImageEditChatPanel } from "@/components/image-edit-chat-panel"
import { RemixChatPanel } from "@/components/remix-chat-panel"
import { ImageUpscalePanel } from "@/components/image-upscale-panel"
import { MaterialToScenePanel } from "@/components/material-to-scene-panel"
import { ImageEnhancePanel } from "@/components/image-enhance-panel"
import { SeoBlogBannerPanel } from "@/components/seo-blog-banner-panel"

type ImageTabValue = "reference-remix" | "generate" | "seo-blog-banner" | "upscale" | "material-to-scene" | "enhance"

const TAB_META: Record<
  ImageTabValue,
  {
    title: string
    description: string
    bestFor: string
  }
> = {
  "reference-remix": {
    title: "Edit Image",
    description: "ใช้อ้างอิงจากรูปเดิม แล้วพิมพ์สิ่งที่อยากสร้างหรืออยากแก้ต่อ เหมาะกับงานที่มี visual direction อยู่แล้ว",
    bestFor: "เหมาะกับการ remix, iterate, และแก้งานจาก reference image",
  },
  generate: {
    title: "Text to Image",
    description: "เริ่มจาก brief หรือ saved idea แล้วสร้างภาพโฆษณาใหม่จากศูนย์ เหมาะกับงาน static ad ที่ต้องการ concept ชัด",
    bestFor: "เหมาะกับการสร้างภาพแอดใหม่จาก brief",
  },
  "seo-blog-banner": {
    title: "SEO Blog Banner",
    description: "สร้างภาพหัวบทความ SEO จาก website, logo, reference และ headline โดยเริ่มจาก master image 16:9 ก่อน",
    bestFor: "เหมาะกับ blog header, SEO article hero และ content thumbnail",
  },
  upscale: {
    title: "Upscale",
    description: "อัปโหลดภาพที่มีอยู่แล้วเพื่อเพิ่มความคมชัดและขนาดไฟล์ โดยยังคงองค์ประกอบเดิมของภาพไว้",
    bestFor: "เหมาะกับการขยายภาพเดิมให้ชัดขึ้น",
  },
  "material-to-scene": {
    title: "Material to Scene",
    description: "อัปโหลด material หรือ product photo แล้วสร้างภาพใหม่ในฉากหรือบริบทที่ต้องการ โดยพยายามรักษา texture เดิมไว้",
    bestFor: "เหมาะกับงาน product, material, interior และ scene mockup",
  },
  enhance: {
    title: "Enhance",
    description: "อัปโหลดภาพเดิมเพื่อให้ AI วิจารณ์ก่อนว่าอะไรดี อะไรควรแก้ และควรไปทาง Preserve หรือ Reimagine",
    bestFor: "เหมาะกับการตัดสินใจว่าจะซ่อมภาพเดิมหรือคิด direction ใหม่",
  },
}

type ClientWithProductFocus = {
  id: string
  clientName: string
  productFocuses: Array<{
    id: string
    productFocus: string
  }>
}

// Client component that uses useSearchParams
function MainContent() {
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<ClientWithProductFocus[]>([])
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [activeTab, setActiveTab] = useState<ImageTabValue>("generate")
  const [editImageMode, setEditImageMode] = useState<"new" | "classic">("new")
  
  // Get URL parameters
  const activeProductFocusParam = searchParams.get('productFocus') || null
  const activeClientNameParam = searchParams.get('clientName') || "No Client Selected"
  const activeClientIdParam = searchParams.get('clientId')
  
  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const response = await fetch(`${baseUrl}/api/clients-with-product-focus`)
      const clientsData = await response.json()
      if (Array.isArray(clientsData)) {
        setClients(clientsData)
      }
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const activeClientRecord = useMemo(() => {
    if (clients.length === 0) return null
    if (activeClientIdParam) {
      const byProductFocus = clients.find((client) =>
        client.productFocuses.some((pf) => pf.id === activeClientIdParam),
      )
      if (byProductFocus) return byProductFocus
      const byClientId = clients.find((client) => client.id === activeClientIdParam)
      if (byClientId) return byClientId
    }
    if (activeClientNameParam && activeClientNameParam !== "No Client Selected") {
      const byName = clients.find((client) => client.clientName === activeClientNameParam)
      if (byName) return byName
    }
    // Don't auto-select first client - user must choose manually
    return null
  }, [clients, activeClientIdParam, activeClientNameParam])

  const resolvedClientName =
    (activeClientNameParam && activeClientNameParam !== "No Client Selected"
      ? activeClientNameParam
      : activeClientRecord?.clientName) || "No Client Selected"

  const resolvedProductFocus =
    activeProductFocusParam || activeClientRecord?.productFocuses[0]?.productFocus || null

  const resolvedClientId = activeClientRecord?.id || null
  const activeTabMeta = TAB_META[activeTab]

  return (
    <div className="flex h-dvh min-w-0 flex-col bg-white">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {!isSidebarHidden && (
          <MainSidebar
            clients={clients}
            activeClientName={resolvedClientName}
            activeProductFocus={resolvedProductFocus}
            activeClientId={resolvedClientId}
            showHistory={false}
            showServiceFilters={false}
            mode="images"
          />
        )}

        {/* Main Content */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ImageTabValue)}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="flex flex-none flex-col gap-3 border-b border-[#d1d1d6] bg-white px-3 py-3 sm:px-4 lg:px-6">
              <div className="flex min-w-0 items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsSidebarHidden((value) => !value)}
                className="h-10 w-10 shrink-0 rounded-full border-slate-200"
              >
                {isSidebarHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                <span className="sr-only">{isSidebarHidden ? "Show sidebar" : "Hide sidebar"}</span>
              </Button>

              <TabsList className="flex h-auto min-w-0 flex-1 flex-wrap gap-1 rounded-2xl bg-[#f2f2f7] p-1 sm:rounded-full">
                <TabsTrigger
                  value="generate"
                  className="min-h-9 flex-1 basis-[132px] justify-center gap-2 rounded-full px-3 text-xs text-[#8e8e93] transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm lg:text-sm"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="truncate">Text to Image</span>
                </TabsTrigger>
                <TabsTrigger
                  value="reference-remix"
                  className="min-h-9 flex-1 basis-[132px] justify-center gap-2 rounded-full px-3 text-xs text-[#8e8e93] transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm lg:text-sm"
                >
                  <ImageIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">Edit Image</span>
                </TabsTrigger>
                <TabsTrigger
                  value="seo-blog-banner"
                  className="min-h-9 flex-1 basis-[132px] justify-center gap-2 rounded-full px-3 text-xs text-[#8e8e93] transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm lg:text-sm"
                >
                  <BookOpenText className="h-4 w-4 shrink-0" />
                  <span className="truncate">SEO Banner</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="upscale" 
                  className="min-h-9 flex-1 basis-[112px] justify-center gap-2 rounded-full px-3 text-xs text-[#8e8e93] transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm lg:text-sm"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">Upscale</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="material-to-scene" 
                  className="min-h-9 flex-1 basis-[150px] justify-center gap-2 rounded-full px-3 text-xs text-[#8e8e93] transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm lg:text-sm"
                >
                  <Layers3 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Material to Scene</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="enhance" 
                  className="min-h-9 flex-1 basis-[112px] justify-center gap-2 rounded-full px-3 text-xs text-[#8e8e93] transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm lg:text-sm"
                >
                  <Wand2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Enhance</span>
                </TabsTrigger>
              </TabsList>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-[#fafafa] px-4 py-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-sm font-medium text-slate-950">{activeTabMeta.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{activeTabMeta.description}</p>
                  </div>
                  <div className="text-xs leading-5 text-slate-500 lg:max-w-[280px] lg:text-right">
                    {activeTabMeta.bestFor}
                  </div>
                </div>
              </div>
            </div>

            {/* Generate and Upload Images Tab */}
            <TabsContent value="generate" className="mt-0 min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
              <div className="mx-auto w-full max-w-[1480px]">
                <AIImageGenerator
                  activeClientId={resolvedClientId}
                  activeProductFocus={resolvedProductFocus}
                  activeClientName={resolvedClientName}
                />
              </div>
            </TabsContent>

            <TabsContent value="upscale" className="mt-0 min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
              <div className="mx-auto w-full max-w-[1480px]">
                <ImageUpscalePanel />
              </div>
            </TabsContent>

            <TabsContent value="seo-blog-banner" className="mt-0 min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
              <div className="mx-auto w-full max-w-[1480px]">
                <SeoBlogBannerPanel
                  clients={clients}
                  activeClientId={resolvedClientId}
                />
              </div>
            </TabsContent>

            <TabsContent value="material-to-scene" className="mt-0 min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
              <div className="mx-auto w-full max-w-[1480px]">
                <MaterialToScenePanel />
              </div>
            </TabsContent>

            <TabsContent value="enhance" className="mt-0 min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
              <div className="mx-auto w-full max-w-[1480px]">
                <ImageEnhancePanel />
              </div>
            </TabsContent>

              {/* Reference Remix Tab */}
              <TabsContent value="reference-remix" className="m-0 min-h-0 flex-1 overflow-hidden p-0">
                <div className="h-full min-h-0 overflow-y-auto bg-slate-50/60 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
                  <div className="mx-auto h-full w-full max-w-[1480px]">
                    <div className="mb-4 flex flex-col gap-4 rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.94)_100%)] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:flex-row sm:items-end sm:justify-between sm:rounded-[24px] sm:px-5">
                      <div className="min-w-0 max-w-2xl">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Edit Image</p>
                        <h3 className="mt-2 text-lg font-semibold text-slate-950 sm:text-xl">Edit Image mode</h3>
                        <p className="mt-2 max-w-xl text-xs leading-5 text-slate-600">
                          Choose the workflow that fits the task: direct image editing for focused changes, or Classic Remix for reference-led exploration.
                        </p>
                      </div>
                      <div className="grid shrink-0 grid-cols-2 rounded-full bg-slate-100 p-1 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setEditImageMode("new")}
                          className={`rounded-full px-4 py-2 transition ${
                            editImageMode === "new" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          New Edit Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditImageMode("classic")}
                          className={`rounded-full px-4 py-2 transition ${
                            editImageMode === "classic" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Classic Remix
                        </button>
                      </div>
                    </div>

                    {editImageMode === "new" ? (
                      <ImageEditChatPanel
                        clients={clients}
                        activeClientId={resolvedClientId}
                        activeProductFocus={resolvedProductFocus}
                      />
                    ) : (
                      <div className="min-h-[680px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                        <RemixChatPanel
                          activeClientId={resolvedClientId}
                          activeClientName={resolvedClientName}
                          activeProductFocus={resolvedProductFocus}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
        </main>
      </div>
    </div>
  )
}

export default function ImagesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-white" />}>
      <MainContent />
    </Suspense>
  )
}
