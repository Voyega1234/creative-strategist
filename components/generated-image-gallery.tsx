"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock3, Images, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type ImageGenerationSession = {
  id: string
  clientName: string
  productFocus: string
  prompt: string
  model: string
  outputCount: number
  createdAt: string
  title: string
  outputUrls: string[]
  inputUrls: string[]
  metadata: Record<string, unknown>
}

type GeneratedImageGalleryProps = {
  featureType: "seo-banner" | "product-scene"
  clientName?: string | null
  productFocus?: string | null
  refreshKey?: number
  selectedSessionId?: string | null
  onSelect: (session: ImageGenerationSession, imageIndex: number) => void
}

const GALLERY_PAGE_SIZE = 20

export function GeneratedImageGallery({
  featureType,
  clientName,
  productFocus,
  refreshKey = 0,
  selectedSessionId,
  onSelect,
}: GeneratedImageGalleryProps) {
  const [sessions, setSessions] = useState<ImageGenerationSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE_SIZE)

  useEffect(() => {
    const controller = new AbortController()

    const loadGallery = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ featureType, limit: "100" })
        if (clientName) params.set("clientName", clientName)
        if (productFocus) params.set("productFocus", productFocus)

        const response = await fetch(`/api/image-sessions?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json()
        setSessions(response.ok && payload.success && Array.isArray(payload.sessions) ? payload.sessions : [])
      } catch {
        if (!controller.signal.aborted) setSessions([])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadGallery()
    return () => controller.abort()
  }, [clientName, featureType, productFocus, refreshKey])

  const galleryImages = useMemo(
    () =>
      sessions.flatMap((session) =>
        session.outputUrls.map((url, imageIndex) => ({
          id: `${session.id}:${imageIndex}`,
          url,
          imageIndex,
          session,
        })),
      ),
    [sessions],
  )

  useEffect(() => {
    setVisibleCount(GALLERY_PAGE_SIZE)
  }, [galleryImages.length])

  if (isLoading) {
    return (
      <div className="flex h-28 items-center justify-center rounded-[22px] border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading generated gallery...
      </div>
    )
  }

  if (galleryImages.length === 0) return null

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Images className="h-4 w-4 text-slate-500" />
          <div>
            <p className="text-sm font-semibold text-slate-950">Generated Gallery</p>
            <p className="text-xs text-slate-500">ภาพที่เคยสร้างสำหรับแบรนด์นี้</p>
          </div>
        </div>
        <span className="text-xs text-slate-400">{galleryImages.length} images</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {galleryImages.slice(0, visibleCount).map(({ id, url, imageIndex, session }) => {
          const createdAt = session.createdAt
            ? new Intl.DateTimeFormat("th-TH", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(session.createdAt))
            : ""

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(session, imageIndex)}
              className={cn(
                "group overflow-hidden rounded-[16px] border bg-slate-50 text-left transition hover:border-slate-400 hover:shadow-sm",
                selectedSessionId === session.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200",
              )}
            >
              <div className={cn("overflow-hidden bg-slate-100", featureType === "seo-banner" ? "aspect-video" : "aspect-square")}>
                <img
                  src={url}
                  alt={session.title || session.prompt || "Generated image"}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-[10px] text-slate-400">
                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                  <Clock3 className="h-3 w-3 shrink-0" />
                  {createdAt}
                </span>
                {session.outputUrls.length > 1 ? (
                  <span className="shrink-0">
                    {imageIndex + 1}/{session.outputUrls.length}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {galleryImages.length > visibleCount ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + GALLERY_PAGE_SIZE)}
            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
          >
            See more ({galleryImages.length - visibleCount})
          </button>
        </div>
      ) : null}
    </section>
  )
}
