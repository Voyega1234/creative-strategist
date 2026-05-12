"use client"

import Image from "next/image"
import { Copy, Download, Edit, Images, Loader2, RefreshCw, Wand2, X, CheckCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { GeneratedImage } from "@/lib/images/generated-ads"

type GeneratedAdsGalleryProps = {
  images: GeneratedImage[]
  visibleImages: GeneratedImage[]
  completedCount: number
  generatingCount: number
  errorCount: number
  showAllResults: boolean
  upscalingImageIds: string[]
  removingTextImageIds: string[]
  savingImageId: string | null
  getSourceLabel: (value?: string) => string | null
  onToggleShowAll: () => void
  onPreview: (url: string) => void
  onUpscale: (image: GeneratedImage) => void
  onRemoveText: (image: GeneratedImage) => void
  onSave: (url: string, imageId: string) => void
  onDownload: (url: string) => void
  onCopyUrl: (url: string) => void
  onRetry: (imageId: string) => void
}

export function GeneratedAdsGallery({
  images,
  visibleImages,
  completedCount,
  generatingCount,
  errorCount,
  showAllResults,
  upscalingImageIds,
  removingTextImageIds,
  savingImageId,
  getSourceLabel,
  onToggleShowAll,
  onPreview,
  onUpscale,
  onRemoveText,
  onSave,
  onDownload,
  onCopyUrl,
  onRetry,
}: GeneratedAdsGalleryProps) {
  return (
    <Card className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Images className="h-4 w-4 text-blue-600" />
              Results Gallery
            </div>
            <h4 className="mt-2 text-xl font-semibold text-slate-950">Generated static ads</h4>
            <p className="mt-1 text-sm text-slate-600">
              ผลลัพธ์ทั้งหมดจะแสดงแบบ gallery เพื่อคัดเลือกและบันทึก creative ได้เร็วขึ้น
            </p>
          </div>
          {images.length > 12 && (
            <Button variant="outline" onClick={onToggleShowAll} className="rounded-full border-slate-200">
              {showAllResults ? "แสดงน้อยลง" : `ดูทั้งหมด (${images.length})`}
            </Button>
          )}
        </div>
      </div>

      <div className="p-6">
        {images.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-[linear-gradient(135deg,_#f8fafc_0%,_#ffffff_100%)] px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Wand2 className="h-6 w-6" />
            </div>
            <h5 className="mt-5 text-lg font-semibold text-slate-950">Your gallery is empty</h5>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              เขียน brief หรือเลือก saved idea จากนั้นค่อยเติม references หรือ assets เพิ่ม แล้วกด Generate เพื่อเริ่มสร้าง static ad gallery
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                ทั้งหมด {images.length} ภาพ
              </Badge>
              <Badge className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                พร้อมใช้ {completedCount}
              </Badge>
              {generatingCount > 0 && (
                <Badge className="rounded-full bg-amber-50 text-amber-700 hover:bg-amber-50">
                  กำลังสร้าง {generatingCount}
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge className="rounded-full bg-rose-50 text-rose-700 hover:bg-rose-50">
                  ต้องลองใหม่ {errorCount}
                </Badge>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {visibleImages.map((image) => (
                <Card key={image.id} className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative aspect-[4/5] bg-slate-50">
                    {image.status === "generating" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        <p className="mt-3 text-sm font-medium text-slate-700">
                          {image.operation === "upscale"
                            ? "Upscaling to 2K..."
                            : image.operation === "remove_text"
                              ? "Removing text..."
                              : "Generating creative..."}
                        </p>
                      </div>
                    )}

                    {image.status === "completed" && image.url && (
                      <button type="button" className="absolute inset-0" onClick={() => onPreview(image.url)}>
                        <Image
                          src={image.url}
                          alt={image.prompt}
                          fill
                          className="object-contain p-3 transition-transform duration-200 hover:scale-[1.01]"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </button>
                    )}

                    {image.status === "error" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50">
                        <div className="rounded-full bg-white p-3 text-rose-500 shadow-sm">
                          <X className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-medium text-rose-600">สร้างไม่สำเร็จ</p>
                      </div>
                    )}

                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <Badge className="rounded-full bg-black/75 text-white hover:bg-black/75">
                        {image.status === "completed" ? "Ready" : image.status === "generating" ? "Generating" : "Retry"}
                      </Badge>
                      {image.source && (
                        <Badge className="rounded-full bg-white/90 text-slate-700 hover:bg-white/90">
                          {getSourceLabel(image.source)}
                        </Badge>
                      )}
                      {image.resolution && (
                        <Badge className="rounded-full bg-blue-600 text-white hover:bg-blue-600">
                          {image.resolution}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <p className="text-sm font-medium text-slate-950">{image.topicTitle || "Compass Idea"}</p>
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">
                        {image.prompt || image.topicSummary || "Generated from selected idea, palette, references, and brand materials."}
                      </p>
                    </div>

                    {image.status === "completed" && image.url ? (
                      <div className="flex flex-wrap gap-2">
                        {image.resolution !== "2K" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpscale(image)}
                            disabled={upscalingImageIds.includes(image.id)}
                            className="rounded-full border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                          >
                            {upscalingImageIds.includes(image.id) ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="mr-1 h-3.5 w-3.5" />
                            )}
                            Upscale 2K
                          </Button>
                        )}
                        {image.operation !== "remove_text" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRemoveText(image)}
                            disabled={removingTextImageIds.includes(image.id)}
                            className="rounded-full border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          >
                            {removingTextImageIds.includes(image.id) ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Edit className="mr-1 h-3.5 w-3.5" />
                            )}
                            Remove Text
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => onSave(image.url, image.id)}
                          disabled={savingImageId === image.id}
                          className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
                        >
                          {savingImageId === image.id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onDownload(image.url)} className="rounded-full border-slate-200">
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Download
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onCopyUrl(image.url)} className="rounded-full border-slate-200">
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy URL
                        </Button>
                      </div>
                    ) : image.status === "error" ? (
                      <Button size="sm" variant="outline" onClick={() => onRetry(image.id)} className="rounded-full border-slate-200">
                        <RefreshCw className="mr-1 h-3.5 w-3.5" />
                        ลองใหม่
                      </Button>
                    ) : (
                      <div className="text-sm text-slate-500">ระบบกำลังเพิ่มภาพเข้ากับ gallery</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
