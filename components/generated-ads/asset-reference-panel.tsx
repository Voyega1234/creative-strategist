"use client"

import Image from "next/image"
import { type RefObject } from "react"
import { CheckCircle, ChevronDown, ImageIcon, Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { ReferenceImage } from "@/lib/images/generated-ads"
import { cn } from "@/lib/utils"

interface AssetReferencePanelProps {
  canShow: boolean
  isMaterialsOpen: boolean
  isReferencesOpen: boolean
  materialInputRef: RefObject<HTMLInputElement | null>
  referenceInputRef: RefObject<HTMLInputElement | null>
  isUploadingMaterials: boolean
  isUploadingReferences: boolean
  loadingMaterialImages: boolean
  loadingReferenceImages: boolean
  materialImages: ReferenceImage[]
  referenceImages: ReferenceImage[]
  selectedMaterials: string[]
  selectedReferenceImages: string[]
  maxReferenceSelection: number
  isReferenceDropActive: boolean
  onMaterialsOpenChange: (open: boolean) => void
  onReferencesOpenChange: (open: boolean) => void
  onMaterialUpload: (files: FileList | null) => void
  onReferenceUpload: (files: FileList | null) => void
  onMaterialToggle: (url: string) => void
  onReferenceToggle: (url: string) => void
  onReferenceDropActiveChange: (active: boolean) => void
}

export function AssetReferencePanel({
  canShow,
  isMaterialsOpen,
  isReferencesOpen,
  materialInputRef,
  referenceInputRef,
  isUploadingMaterials,
  isUploadingReferences,
  loadingMaterialImages,
  loadingReferenceImages,
  materialImages,
  referenceImages,
  selectedMaterials,
  selectedReferenceImages,
  maxReferenceSelection,
  isReferenceDropActive,
  onMaterialsOpenChange,
  onReferencesOpenChange,
  onMaterialUpload,
  onReferenceUpload,
  onMaterialToggle,
  onReferenceToggle,
  onReferenceDropActiveChange,
}: AssetReferencePanelProps) {
  if (!canShow) return null

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Collapsible open={isMaterialsOpen} onOpenChange={onMaterialsOpenChange} className="rounded-2xl border border-slate-200 bg-slate-50/70">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Upload className="h-4 w-4 text-slate-700" />
              Product assets
            </div>
            <p className="mt-1 text-xs text-slate-500">optional: ใส่รูปสินค้าจริงหรือองค์ประกอบที่อยากให้ AI ใช้</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isMaterialsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 px-4 pb-4">
          <div>
            <input
              ref={materialInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => onMaterialUpload(event.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => materialInputRef.current?.click()}
              disabled={isUploadingMaterials}
              className="rounded-full border-slate-200"
            >
              <Upload className="mr-1 h-4 w-4" />
              {isUploadingMaterials ? "กำลังอัปโหลด..." : "อัปโหลด"}
            </Button>
          </div>

          {loadingMaterialImages ? (
            <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">กำลังโหลดวัสดุ...</span>
            </div>
          ) : materialImages.length > 0 ? (
            <>
              <div className="max-h-[24rem] overflow-y-auto pr-2">
                <div className="grid grid-cols-3 gap-2">
                  {materialImages.map((image) => {
                    const isSelected = selectedMaterials.includes(image.url)
                    return (
                      <button
                        key={image.url}
                        type="button"
                        className={cn(
                          "group overflow-hidden rounded-2xl border bg-white transition-all",
                          isSelected ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300",
                        )}
                        onClick={() => onMaterialToggle(image.url)}
                      >
                        <div className="relative aspect-square">
                          <Image src={image.url} alt="Material image" fill className="object-cover" sizes="(max-width: 768px) 33vw, 120px" />
                          {isSelected && (
                            <div className="absolute inset-0 flex items-start justify-end p-2">
                              <div className="rounded-full bg-violet-500 p-1 text-white">
                                <CheckCircle className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                มีทั้งหมด {materialImages.length} ภาพ, เลือกแล้ว {selectedMaterials.length} ภาพ
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
              ยังไม่มีวัสดุที่อัปโหลด
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={isReferencesOpen} onOpenChange={onReferencesOpenChange} className="rounded-2xl border border-slate-200 bg-slate-50/70">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <ImageIcon className="h-4 w-4 text-slate-700" />
              Reference images
            </div>
            <p className="mt-1 text-xs text-slate-500">optional: ใช้คุม mood, composition หรือ visual direction</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isReferencesOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 px-4 pb-4">
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => onReferenceUpload(event.target.files)}
          />

          <button
            type="button"
            onClick={() => referenceInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              onReferenceDropActiveChange(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              onReferenceDropActiveChange(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              onReferenceDropActiveChange(false)
              onReferenceUpload(event.dataTransfer.files)
            }}
            className={cn(
              "flex min-h-[84px] w-full items-center justify-center rounded-2xl border border-dashed px-4 text-center transition-colors",
              isReferenceDropActive ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-700 shadow-sm">
                <Upload className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-900">
                  {isUploadingReferences ? "กำลังอัปโหลดรูป..." : "Drop reference images here"}
                </p>
                <p className="text-xs text-slate-500">หรือคลิกเพื่ออัปโหลดเข้าคลัง reference</p>
              </div>
            </div>
          </button>

          {loadingReferenceImages ? (
            <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">กำลังโหลดรูปภาพ...</span>
            </div>
          ) : referenceImages.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {referenceImages.slice(0, 6).map((image) => {
                  const isSelected = selectedReferenceImages.includes(image.url)
                  const isLimitReached = !isSelected && selectedReferenceImages.length >= maxReferenceSelection
                  return (
                    <button
                      key={image.url}
                      type="button"
                      className={cn(
                        "group overflow-hidden rounded-2xl border bg-white transition-all",
                        isSelected ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200 hover:border-slate-300",
                        isLimitReached && "cursor-not-allowed opacity-60",
                      )}
                      onClick={() => onReferenceToggle(image.url)}
                    >
                      <div className="relative aspect-[4/3]">
                        <Image src={image.url} alt="Reference image" fill className="object-cover" sizes="(max-width: 768px) 50vw, 180px" />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-start justify-end p-2">
                            <div className="rounded-full bg-blue-500 p-1 text-white">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500">
                เลือกแล้ว {selectedReferenceImages.length}/{maxReferenceSelection} ภาพ
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
              ยังไม่มีรูปภาพในคลัง
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
