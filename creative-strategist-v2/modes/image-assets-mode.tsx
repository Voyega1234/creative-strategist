"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImageIcon, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  loadAllReferenceImages,
  loadBrandReferenceImages,
  uploadClientReferenceFiles,
  uploadSharedReferenceFiles,
} from "@/lib/images/reference-library";

type StoredReference = {
  name: string;
  url: string;
  createdAt: string;
};

type ImageAssetsModeProps = {
  clientId?: string | null;
  clientName?: string;
  onUseImage?: (imageUrl: string) => void;
};

type LibraryFilter = "brand" | "all";

const IMAGES_PAGE_SIZE = 40;

export function ImageAssetsMode({ clientId, clientName, onUseImage }: ImageAssetsModeProps) {
  const [images, setImages] = useState<StoredReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<StoredReference | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>("brand");
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [visibleCount, setVisibleCount] = useState(IMAGES_PAGE_SIZE);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks the client we've already auto-fallen-back to "all" for, so an empty brand library
  // switches to "all" once on load without bouncing the user if they manually re-pick "brand".
  const autoFallbackClientRef = useRef<string | null>(null);

  const canUploadToBrand = filter === "brand" && Boolean(clientId);

  const handleUploadFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      if (filter === "brand") {
        if (!clientId) {
          alert("เลือก Client ก่อนอัปโหลดรูปสำหรับแบรนด์นี้");
          return;
        }
        await uploadClientReferenceFiles(clientId, files);
      } else {
        await uploadSharedReferenceFiles(files);
      }
      // Reload the current view so the new images appear.
      setLibraryRevision((current) => current + 1);
    } catch (error) {
      console.error("Failed to upload reference images:", error);
      alert("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadReferences = async () => {
      setIsLoading(true);

      try {
        const loadedImages =
          filter === "brand"
            ? await loadBrandReferenceImages(clientId || "")
            : await loadAllReferenceImages();
        if (cancelled) return;

        // If this brand has no images, default to showing the full team library instead
        // (once per client; manual re-selection of "brand" afterwards is respected).
        if (
          filter === "brand" &&
          loadedImages.length === 0 &&
          autoFallbackClientRef.current !== (clientId || "")
        ) {
          autoFallbackClientRef.current = clientId || "";
          setFilter("all");
          return;
        }

        setImages(loadedImages);
      } catch (error) {
        console.error("Failed to load reference gallery:", error);
        if (!cancelled) setImages([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, [clientId, filter, libraryRevision]);

  useEffect(() => {
    setFilter("brand");
    setSelectedImage(null);
  }, [clientId]);

  useEffect(() => {
    setVisibleCount(IMAGES_PAGE_SIZE);
  }, [images]);

  useEffect(() => {
    const handleLibraryUpdate = (event: Event) => {
      const updatedClientId = (event as CustomEvent<{ clientId?: string }>).detail?.clientId;
      if (!updatedClientId || updatedClientId === clientId || filter === "all") {
        setLibraryRevision((current) => current + 1);
      }
    };

    window.addEventListener("reference-library-updated", handleLibraryUpdate);
    return () => window.removeEventListener("reference-library-updated", handleLibraryUpdate);
  }, [clientId, filter]);

  const handleUseImage = () => {
    if (!selectedImage) return;
    onUseImage?.(selectedImage.url);
    setSelectedImage(null);
  };

  return (
    <section className="min-h-full overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
      <div className="flex flex-col gap-3 border-b border-black/10 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
            Brand Library
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#1f1f1f]">Image Assets</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#667085]">
            คลังภาพ Reference ที่ทีมเคยเก็บไว้สำหรับ {clientName || "แบรนด์นี้"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-black/10 bg-[#f2f4f7] p-1">
            <button
              type="button"
              onClick={() => setFilter("brand")}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium transition",
                filter === "brand"
                  ? "bg-[#1f1f1f] text-white shadow-sm"
                  : "text-[#667085] hover:text-[#1f1f1f]",
              ].join(" ")}
            >
              แบรนด์นี้
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium transition",
                filter === "all"
                  ? "bg-[#1f1f1f] text-white shadow-sm"
                  : "text-[#667085] hover:text-[#1f1f1f]",
              ].join(" ")}
            >
              ทั้งหมด
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handleUploadFiles(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || (filter === "brand" && !canUploadToBrand)}
            className="rounded-full border-black/10 bg-white"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {filter === "brand" ? "อัปโหลดเข้าแบรนด์นี้" : "อัปโหลดเข้าทั้งหมด"}
          </Button>

          {!isLoading && (
            <div className="text-sm text-[#667085]">
              <span className="font-semibold text-[#1f1f1f]">{images.length}</span> images
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-dashed border-black/10 bg-[#f8fafc]">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#667085]" />
              <p className="mt-3 text-sm text-[#667085]">Loading reference images...</p>
            </div>
          </div>
        ) : images.length > 0 ? (
          <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {images.slice(0, visibleCount).map((image) => (
              <button
                key={image.url}
                type="button"
                onClick={() => setSelectedImage(image)}
                className="group relative aspect-[4/3] overflow-hidden rounded-[18px] border border-black/10 bg-[#f2f4f7] text-left transition duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
              >
                <Image
                  src={image.url}
                  alt={image.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 280px"
                  className="object-cover transition duration-300 group-hover:scale-[1.025]"
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/65 to-transparent px-3 pb-2.5 pt-8 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                  {image.name}
                </span>
              </button>
            ))}
          </div>
          {images.length > visibleCount && (
            <div className="mt-5 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVisibleCount((current) => current + IMAGES_PAGE_SIZE)}
                className="rounded-full border-black/10 bg-white px-5"
              >
                See more ({images.length - visibleCount})
              </Button>
            </div>
          )}
          </>
        ) : (
          <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-dashed border-black/10 bg-[#f8fafc] px-6 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#667085] shadow-sm ring-1 ring-black/10">
                <ImageIcon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#1f1f1f]">
                {filter === "brand" ? "แบรนด์นี้ยังไม่มี Reference images" : "ยังไม่มี Reference images"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#667085]">
                {filter === "brand"
                  ? "ลองเลือก “ทั้งหมด” เพื่อดูคลัง Reference ของทีม หรืออัปโหลด Reference สำหรับแบรนด์นี้"
                  : "รูปที่ทีมอัปโหลดเป็น Reference จะแสดงที่นี่"}
              </p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={Boolean(selectedImage)} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="flex h-[90vh] max-w-6xl flex-col overflow-hidden border-black/10 p-0">
          <DialogHeader className="border-b border-black/10 px-6 py-4">
            <DialogTitle className="truncate pr-8 text-base text-[#1f1f1f]">
              {selectedImage?.name || "Reference image"}
            </DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative min-h-0 flex-1 bg-[#f2f4f7]">
              <Image
                src={selectedImage.url}
                alt={selectedImage.name}
                fill
                sizes="90vw"
                className="object-contain p-5"
                priority
              />
            </div>
          )}
          <div className="flex shrink-0 justify-end border-t border-black/10 bg-white px-6 py-4">
            <Button
              type="button"
              onClick={handleUseImage}
              disabled={!selectedImage}
              className="rounded-full bg-[#1f1f1f] px-5 text-white hover:bg-black"
            >
              Use this image
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
