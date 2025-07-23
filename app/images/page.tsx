import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Upload, Image as ImageIcon, Sparkles, Grid3x3 } from "lucide-react"
import { AppSidebar } from "@/components/layout/sidebar"
import { AppHeader } from "@/components/layout/header"
import { getClients } from "@/lib/data/clients"
import { ImageGallery } from "@/components/image-gallery"
import { ImageUpload } from "@/components/image-upload"

export default async function ImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const clientId = typeof params.clientId === 'string' ? params.clientId : undefined
  const productFocus = typeof params.productFocus === 'string' ? params.productFocus : undefined
  const clientName = typeof params.clientName === 'string' ? params.clientName : undefined

  // Get clients data for sidebar
  const clients = await getClients()
  
  // Find active client
  const activeClient = clients.find(client => client.id === clientId)
  const activeClientId = activeClient?.id || null
  const activeProductFocus = productFocus || activeClient?.productFocus || null
  const activeClientName = clientName || activeClient?.clientName || null

  return (
    <div className="flex h-screen bg-gray-50">
      <AppSidebar 
        clients={clients}
        activeClientId={activeClientId}
        activeProductFocus={activeProductFocus}
        activeClientName={activeClientName}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader
          activeClientId={activeClientId}
          activeProductFocus={activeProductFocus}
          activeClientName={activeClientName}
        />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  สร้างรูปภาพ
                </h1>
                <p className="text-gray-600 mt-1">จัดการและสร้างรูปภาพโฆษณาสำหรับแคมเปญ</p>
              </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="reference" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="reference" className="flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4" />
                  รูปภาพอ้างอิง
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  อัปโหลดรูปภาพ
                </TabsTrigger>
                <TabsTrigger value="generate" className="flex items-center gap-2" disabled>
                  <Sparkles className="w-4 h-4" />
                  สร้างรูปภาพ AI
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">เร็วๆ นี้</span>
                </TabsTrigger>
              </TabsList>

              {/* Reference Images Tab */}
              <TabsContent value="reference" className="space-y-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">รูปภาพอ้างอิงจากคลัง</h2>
                      <p className="text-gray-600 text-sm">รูปภาพโฆษณาที่เก็บไว้เป็นแรงบันดาลใจ</p>
                    </div>
                  </div>
                  
                  <ImageGallery />
                </Card>
              </TabsContent>

              {/* Upload Images Tab */}
              <TabsContent value="upload" className="space-y-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">อัปโหลดรูปภาพใหม่</h2>
                      <p className="text-gray-600 text-sm">เพิ่มรูปภาพโฆษณาใหม่เข้าสู่คลัง</p>
                    </div>
                  </div>
                  
                  <ImageUpload />
                </Card>
              </TabsContent>

              {/* Generate Images Tab (Placeholder) */}
              <TabsContent value="generate" className="space-y-6">
                <Card className="p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Image Generation</h3>
                    <p className="text-gray-600 mb-6">
                      ฟีเจอร์สร้างรูปภาพด้วย AI กำลังพัฒนา จะพร้อมใช้งานเร็วๆ นี้
                    </p>
                    <div className="space-y-2 text-sm text-gray-500">
                      <p>• สร้างรูปภาพโฆษณาจากคำอธิบาย</p>
                      <p>• ปรับแต่งสไตล์และองค์ประกอบ</p>
                      <p>• สร้างหลายแบบพร้อมกัน</p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}