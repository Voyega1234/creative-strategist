"use client"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle,
  Cloud,
  FileImage
} from "lucide-react"
import { getStorageClient } from "@/lib/supabase/client"
import Image from "next/image"

interface UploadFile {
  id: string
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  uploadedPath?: string // Path returned by upload method
}

export function ImageUpload() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const newFiles: UploadFile[] = Array.from(selectedFiles)
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
        progress: 0
      }))

    setFiles(prev => [...prev, ...newFiles])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter(f => f.id !== id)
    })
  }

  const uploadFile = async (uploadFile: UploadFile) => {
    const storageClient = getStorageClient()
    console.log('🔍 Upload attempt for:', uploadFile.file.name)
    console.log('🔍 Storage client:', storageClient)
    console.log('🔍 Environment check:')
    console.log('  - SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('  - ANON_KEY (first 10 chars):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10))
    
    // Test the storage client first
    try {
      console.log('🔍 Testing storage client connection...')
      const { data: buckets, error: bucketsError } = await storageClient.listBuckets()
      console.log('🔍 Buckets test:', { buckets, bucketsError })
      
      if (bucketsError) {
        throw new Error(`Storage client connection failed: ${bucketsError.message}`)
      }
      
      // Test bucket access
      console.log('🔍 Testing bucket access...')
      const { data: bucketFiles, error: bucketError } = await storageClient
        .from('ads-creative-image')
        .list('references')
      console.log('🔍 Bucket test:', { bucketFiles, bucketError })
      
    } catch (connectionError) {
      console.error('❌ Storage connection test failed:', connectionError)
      throw connectionError
    }
    
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
      ))

      // Generate unique filename
      const fileExt = uploadFile.file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
      const fullPath = `references/${fileName}`
      
      console.log('🔍 Uploading to path:', fullPath)
      console.log('🔍 File size:', uploadFile.file.size)
      console.log('🔍 File type:', uploadFile.file.type)

      // Upload following the exact official docs syntax
      const fileBody = uploadFile.file
      const { data, error } = await storageClient.from('ads-creative-image').upload(fullPath, fileBody)

      console.log('🔍 Upload response:', { data, error })

      if (error) {
        console.error('❌ Upload error details:', error)
        throw error
      }

      console.log('✅ Upload successful:', { 
        id: data.id,
        path: data.path, 
        fullPath: data.fullPath 
      })

      // Update status to success
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { 
          ...f, 
          status: 'success', 
          progress: 100,
          uploadedPath: data.path // Store the actual path for future use
        } : f
      ))

    } catch (error) {
      console.error('❌ Upload error:', error)
      console.error('❌ Error type:', typeof error)
      console.error('❌ Error keys:', Object.keys(error || {}))
      
      let errorMessage = 'เกิดข้อผิดพลาดในการอัปโหลด'
      
      if (error && typeof error === 'object') {
        if ('message' in error && error.message) {
          errorMessage = error.message as string
        } else if ('error' in error && error.error) {
          errorMessage = String(error.error)
        } else {
          errorMessage = `Upload failed: ${JSON.stringify(error)}`
        }
      }
      
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { 
          ...f, 
          status: 'error', 
          progress: 0,
          error: errorMessage
        } : f
      ))
    }
  }

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    
    // Upload files one by one
    for (const file of pendingFiles) {
      await uploadFile(file)
    }
  }

  const retryUpload = (id: string) => {
    const file = files.find(f => f.id === id)
    if (file) {
      uploadFile(file)
    }
  }

  const clearCompleted = () => {
    setFiles(prev => {
      const toRemove = prev.filter(f => f.status === 'success')
      toRemove.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview)
      })
      return prev.filter(f => f.status !== 'success')
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const pendingCount = files.filter(f => f.status === 'pending').length
  const uploadingCount = files.filter(f => f.status === 'uploading').length
  const successCount = files.filter(f => f.status === 'success').length
  const errorCount = files.filter(f => f.status === 'error').length

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900">
              Reference Library
            </Badge>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                Upload inspiration images for the gallery
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                รูปที่อัปโหลดที่นี่จะเข้าไปอยู่ในคลัง reference กลาง และสามารถเลือกกลับไปใช้ใน Compass Ideas ได้ทันที
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {pendingCount > 0 && <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">{pendingCount} รออัปโหลด</Badge>}
            {uploadingCount > 0 && <Badge className="rounded-full bg-blue-50 text-blue-700 hover:bg-blue-50">{uploadingCount} กำลังอัปโหลด</Badge>}
            {successCount > 0 && <Badge className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{successCount} สำเร็จ</Badge>}
            {errorCount > 0 && <Badge className="rounded-full bg-rose-50 text-rose-700 hover:bg-rose-50">{errorCount} ล้มเหลว</Badge>}
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <Card 
        className={`relative overflow-hidden rounded-[28px] border-2 border-dashed shadow-sm transition-colors ${
          isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="p-12 text-center sm:p-16">
          <div className="flex flex-col items-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-sm">
              <Cloud className="h-8 w-8" />
            </div>
            
            <h3 className="mb-2 text-xl font-semibold text-slate-950">
              ลากและวางรูปภาพที่นี่
            </h3>
            <p className="mb-6 max-w-xl text-sm leading-6 text-slate-600">
              หรือคลิกเพื่อเลือกไฟล์ รองรับ JPG, PNG, GIF, WebP
            </p>
            
            <Button 
              onClick={() => fileInputRef.current?.click()}
              className="h-11 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800"
            >
              <Upload className="w-4 h-4 mr-2" />
              เลือกรูปภาพ
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>
        </div>
      </Card>

      {/* Upload Queue */}
      {files.length > 0 && (
        <Card className="rounded-[28px] border-slate-200 p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Upload Queue</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {pendingCount > 0 && <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">{pendingCount} รอ</Badge>}
                {uploadingCount > 0 && <Badge className="rounded-full bg-blue-50 text-blue-700 hover:bg-blue-50">{uploadingCount} กำลังอัปโหลด</Badge>}
                {successCount > 0 && <Badge className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{successCount} สำเร็จ</Badge>}
                {errorCount > 0 && <Badge className="rounded-full bg-rose-50 text-rose-700 hover:bg-rose-50">{errorCount} ล้มเหลว</Badge>}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {successCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearCompleted} className="rounded-full border-slate-200">
                  ล้างที่เสร็จแล้ว
                </Button>
              )}
              {pendingCount > 0 && (
                <Button onClick={uploadAllFiles} disabled={uploadingCount > 0} className="rounded-full bg-slate-900 text-white hover:bg-slate-800">
                  <Upload className="w-4 h-4 mr-2" />
                  อัปโหลดทั้งหมด
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                {/* Preview */}
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-200">
                  <Image
                    src={file.preview}
                    alt={file.file.name}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="truncate text-sm font-medium text-slate-950">{file.file.name}</h4>
                    <span className="text-xs text-slate-500">{formatFileSize(file.file.size)}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  {file.status === 'uploading' && (
                    <Progress value={file.progress} className="h-2" />
                  )}
                  
                  {/* Error Message */}
                  {file.status === 'error' && file.error && (
                    <p className="text-xs text-rose-600">{file.error}</p>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2">
                  {file.status === 'pending' && (
                    <FileImage className="w-5 h-5 text-gray-400" />
                  )}
                  {file.status === 'uploading' && (
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  )}
                  {file.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {file.status === 'error' && (
                    <>
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => retryUpload(file.id)}
                        className="rounded-full border-slate-200"
                      >
                        ลองใหม่
                      </Button>
                    </>
                  )}
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFile(file.id)}
                    disabled={file.status === 'uploading'}
                    className="rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tips */}
      <Card className="rounded-[28px] border border-blue-100 bg-[linear-gradient(135deg,_#eff6ff_0%,_#ffffff_100%)] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="mb-2 font-medium text-slate-950">เคล็ดลับการอัปโหลด</h4>
            <ul className="space-y-1 text-sm text-slate-600">
              <li>• รูปภาพที่มีคุณภาพสูงจะช่วยในการวิเคราะห์และเป็นแรงบันดาลใจ</li>
              <li>• ใช้ชื่อไฟล์ที่อธิบายเนื้อหาเพื่อให้ค้นหาง่าย</li>
              <li>• ขนาดไฟล์ที่แนะนำ: 1-5 MB ต่อรูป</li>
            </ul>
          </div>
        </div>
      </Card>
    </section>
  )
}
