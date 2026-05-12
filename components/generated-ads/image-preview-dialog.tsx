"use client"

import Image from "next/image"
import { CheckCircle, Copy, Download, Edit, ImageIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { GeneratedImage } from "@/lib/images/generated-ads"

interface ImagePreviewDialogProps {
  imageUrl: string | null
  imageData: GeneratedImage | null
  canSave: boolean
  isSaving: boolean
  isRemovingText: boolean
  onClose: () => void
  onRemoveText: (image: GeneratedImage) => void
  onSave: (imageUrl: string) => void
  onDownload: (imageUrl: string) => void
  onCopyUrl: (imageUrl: string) => void
}

export function ImagePreviewDialog({
  imageUrl,
  imageData,
  canSave,
  isSaving,
  isRemovingText,
  onClose,
  onRemoveText,
  onSave,
  onDownload,
  onCopyUrl,
}: ImagePreviewDialogProps) {
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-600" />
            ภาพที่สร้างด้วย AI
          </DialogTitle>
        </DialogHeader>

        {imageUrl && (
          <div className="relative">
            <div className="relative w-full" style={{ aspectRatio: "1/1", maxHeight: "70vh" }}>
              <Image
                src={imageUrl}
                alt="AI generated image preview"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 80vw"
              />
            </div>

            <div className="flex items-center justify-center gap-2 p-6 pt-4">
              {imageData && imageData.operation !== "remove_text" && (
                <Button variant="outline" onClick={() => onRemoveText(imageData)} disabled={isRemovingText}>
                  {isRemovingText ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Edit className="mr-2 h-4 w-4" />
                  )}
                  Remove Text
                </Button>
              )}
              <Button variant="outline" onClick={() => onSave(imageUrl)} disabled={!canSave || isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                บันทึกภาพที่สร้าง
              </Button>
              <Button variant="outline" onClick={() => onDownload(imageUrl)}>
                <Download className="mr-2 h-4 w-4" />
                ดาวน์โหลด
              </Button>
              <Button variant="outline" onClick={() => onCopyUrl(imageUrl)}>
                <Copy className="mr-2 h-4 w-4" />
                คัดลอก URL
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
