"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Download, 
  Eye, 
  Heart, 
  Copy, 
  MoreHorizontal,
  Grid3x3,
  List,
  Search,
  Filter
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { getStorageClient } from "@/lib/supabase/client"
import Image from "next/image"

interface AdImage {
  name: string
  url: string
  size: number
  created_at: string
  metadata?: {
    width?: number
    height?: number
    type?: string
  }
}

export function ImageGallery() {
  const [images, setImages] = useState<AdImage[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedImage, setSelectedImage] = useState<AdImage | null>(null)

  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async () => {
    try {
      const storageClient = getStorageClient()
      console.log('🔍 Testing storage client...')
      console.log('🔍 Storage URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      
      // First test: list buckets to verify connection
      try {
        const { data: buckets, error: bucketsError } = await storageClient.listBuckets()
        console.log('🔍 Available buckets:', { buckets, bucketsError })
      } catch (bucketError) {
        console.error('❌ Cannot list buckets:', bucketError)
      }
      
      // List files in the references folder
      const { data, error } = await storageClient
        .from('ads-creative-image')
        .list('references')

      console.log('🔍 Storage list response:', { data, error })

      if (error) {
        console.error('❌ Storage Error:', error)
        alert(`Storage Error: ${error.message}`)
        return
      }

      if (!data) {
        console.log('❌ No data returned from storage')
        return
      }

      console.log('✅ Files found:', data.length)
      console.log('🔍 Raw files:', data)

      // Filter for image files only
      const imageFiles = data.filter(file => {
        if (!file.name) return false
        const ext = file.name.toLowerCase()
        return ext.endsWith('.jpg') || 
               ext.endsWith('.jpeg') || 
               ext.endsWith('.png') || 
               ext.endsWith('.gif') || 
               ext.endsWith('.webp')
      })

      console.log('🔍 Image files found:', imageFiles.length)
      if (imageFiles.length > 0) {
        console.log('🔍 Image file names:', imageFiles.map(f => f.name))
      }

      const imagesWithUrls = imageFiles.map(file => {
        const { data: urlData } = storageClient
          .from('ads-creative-image')
          .getPublicUrl(`references/${file.name}`)
        
        console.log(`🔍 URL for ${file.name}:`, urlData.publicUrl)
        
        return {
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size || 0,
          created_at: file.created_at || '',
          metadata: file.metadata
        }
      })

      // Sort images by timestamp in filename (newest first)
      const sortedImages = [...imagesWithUrls].sort((a, b) => {
        // Extract timestamp from filename (format: timestamp-random.ext)
        const getTimeFromFilename = (filename: string) => {
          const match = filename.match(/^(\d+)-/);
          return match ? parseInt(match[1], 10) : 0;
        };
        
        const timeA = getTimeFromFilename(a.name);
        const timeB = getTimeFromFilename(b.name);
        return timeB - timeA; // Sort in descending order (newest first)
      })
      
      // Limit to 100 most recent images
      const limitedImages = sortedImages.slice(0, 100)
      console.log(`🔍 Loaded ${limitedImages.length} images (showing most recent 100 if more exist)`)
      setImages(limitedImages)
    } catch (error) {
      console.error('Error loading images:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredImages = images.filter(image =>
    image.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDownload = async (image: AdImage) => {
    try {
      const response = await fetch(image.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = image.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading image:', error)
    }
  }

  const copyImageUrl = async (image: AdImage) => {
    try {
      await navigator.clipboard.writeText(image.url)
      alert('URL ถูกคัดลอกแล้ว!')
    } catch (error) {
      console.error('Error copying URL:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="aspect-square bg-gray-200 rounded-lg animate-pulse mb-3" />
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="ค้นหารูปภาพ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            ตัวกรอง
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {filteredImages.length} รูปภาพ
          </Badge>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 w-8 p-0"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Images Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredImages.map((image) => (
            <Card key={image.name} className="group overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative aspect-square">
                <Image
                  src={image.url}
                  alt={image.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 20vw"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedImage(image)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(image)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => copyImageUrl(image)}>
                          <Copy className="w-4 h-4 mr-2" />
                          คัดลอก URL
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Heart className="w-4 h-4 mr-2" />
                          เพิ่มในรายการโปรด
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
              
              <div className="p-3">
                <h3 className="font-medium text-sm truncate mb-1">{image.name}</h3>
                <p className="text-xs text-gray-500">
                  {formatFileSize(image.size)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {filteredImages.map((image) => (
            <Card key={image.name} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 relative rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={image.url}
                    alt={image.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{image.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span>{formatFileSize(image.size)}</span>
                    {image.metadata?.width && image.metadata?.height && (
                      <span>{image.metadata.width} × {image.metadata.height}</span>
                    )}
                    <span>{new Date(image.created_at).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedImage(image)}>
                    <Eye className="w-4 h-4 mr-2" />
                    ดู
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(image)}>
                    <Download className="w-4 h-4 mr-2" />
                    ดาวน์โหลด
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => copyImageUrl(image)}>
                        <Copy className="w-4 h-4 mr-2" />
                        คัดลอก URL
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filteredImages.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Grid3x3 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">ไม่พบรูปภาพ</h3>
            <p className="text-gray-600">
              {searchTerm ? 'ไม่พบรูปภาพที่ตรงกับคำค้นหา' : 'ยังไม่มีรูปภาพในคลัง'}
            </p>
          </div>
        </Card>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-full relative">
            <Image
              src={selectedImage.url}
              alt={selectedImage.name}
              width={800}
              height={600}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              className="absolute top-4 right-4"
              variant="secondary"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}