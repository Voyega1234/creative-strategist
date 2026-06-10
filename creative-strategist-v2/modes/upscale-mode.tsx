"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  base64ToBlob,
  downloadImageFromUrl,
  getClosestAspectRatioLabel,
  readImageDimensions,
  uploadFileToImageStorage,
  uploadGeneratedImageBlob,
} from "@/lib/images/client";
import { cn } from "@/lib/utils";
import { Copy, Download, ImagePlus, Loader2, Maximize2, Sparkles, Upload, X } from "lucide-react";

const UPSCALE_SIZE_OPTIONS = ["1K", "2K", "4K"] as const;

type UpscaleSize = (typeof UPSCALE_SIZE_OPTIONS)[number];

type UploadedImage = {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  detectedRatio: string;
};

type UpscaleResult = {
  id: string;
  url: string;
  size: UpscaleSize;
  fileName: string;
  createdAt: string;
};

export function UpscaleMode() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const upscaleInFlightRef = useRef(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [targetSize, setTargetSize] = useState<UpscaleSize>("2K");
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);
  const [results, setResults] = useState<UpscaleResult[]>([]);

  useEffect(() => {
    return () => {
      uploadedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [uploadedImages]);

  const appendFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;

    const acceptedFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const nextImages = await Promise.all(
      acceptedFiles.map(async (file) => {
        const { width, height } = await readImageDimensions(file);
        return {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          width,
          height,
          detectedRatio: getClosestAspectRatioLabel(width, height),
        };
      }),
    );

    setUploadedImages((prev) => [...prev, ...nextImages]);
  };

  const removeUploadedImage = (imageId: string) => {
    setUploadedImages((prev) => {
      const image = prev.find((item) => item.id === imageId);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return prev.filter((item) => item.id !== imageId);
    });
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void appendFiles(Array.from(event.dataTransfer.files));
  };

  const uploadFileToStorage = async (file: File) => {
    return uploadFileToImageStorage(file, "generated/upscale-inputs");
  };

  const uploadUpscaledBlobToStorage = async (blob: Blob, mimeType: string, size: UpscaleSize) => {
    return uploadGeneratedImageBlob(new Blob([blob], { type: mimeType }), "generated/upscaled", size.toLowerCase());
  };

  const handleDownload = async (url: string, sourceFileName = "upscaled-image", size: UpscaleSize = targetSize) => {
    try {
      await downloadImageFromUrl(url, `upscaled-${size.toLowerCase()}-${sourceFileName}`);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const handleUpscale = async () => {
    if (upscaleInFlightRef.current || uploadedImages.length === 0) return;

    try {
      upscaleInFlightRef.current = true;
      setIsUpscaling(true);

      for (let index = 0; index < uploadedImages.length; index += 1) {
        const image = uploadedImages[index];
        setActiveBatchIndex(index + 1);

        const sourceUrl = await uploadFileToStorage(image.file);
        const response = await fetch("/api/upscale-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: sourceUrl,
            source_width: image.width,
            source_height: image.height,
            detected_aspect_ratio: image.detectedRatio,
            target_size: targetSize,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success || !result.image_base64) {
          throw new Error(result?.error || `ไม่สามารถ upscale ภาพ ${image.file.name} ได้`);
        }

        const mimeType = result.mime_type || "image/png";
        const publicUrl = await uploadUpscaledBlobToStorage(
          base64ToBlob(result.image_base64, mimeType),
          mimeType,
          targetSize,
        );

        setResults((prev) => [
          {
            id: crypto.randomUUID(),
            url: publicUrl,
            size: targetSize,
            fileName: image.file.name,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (error) {
      console.error("Upscale failed:", error);
      alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการ upscale ภาพ");
    } finally {
      upscaleInFlightRef.current = false;
      setIsUpscaling(false);
      setActiveBatchIndex(0);
    }
  };

  const latestResult = results[0];

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
      <div className="flex shrink-0 flex-col gap-3 border-b border-black/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Utility Tool</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1f1f1f]">Upscale Image</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#667085]">
            เพิ่มความละเอียดภาพสำหรับงานโฆษณาและไฟล์ส่งต่อ โดยคงสัดส่วนเดิมและเตรียมผลลัพธ์ให้ดาวน์โหลดได้ทันที
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full bg-white text-[#3f3f3f] ring-1 ring-black/10 hover:bg-white">
            {uploadedImages.length} selected
          </Badge>
          <div className="flex rounded-full border border-black/10 bg-white/75 p-1">
            {UPSCALE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setTargetSize(size)}
                className={cn(
                  "h-8 rounded-full px-4 text-sm font-medium transition",
                  targetSize === size ? "bg-[#1f1f1f] text-white" : "text-[#667085] hover:bg-black/5 hover:text-[#1f1f1f]",
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(280px,360px),minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void appendFiles(event.target.files)}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="flex h-[168px] shrink-0 items-center justify-center rounded-[24px] border border-dashed border-black/15 bg-white px-5 text-center transition hover:bg-slate-50"
          >
            <div>
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1f1f1f] text-white">
                <Upload className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#1f1f1f]">
                {uploadedImages.length > 0 ? "Add more images" : "Drop or upload images"}
              </p>
              <p className="mt-1 text-xs text-[#667085]">PNG, JPG, WEBP</p>
            </div>
          </button>

          <div className="min-h-0 flex-1 rounded-[22px] border border-black/10 bg-white">
            <div className="flex h-11 items-center justify-between border-b border-black/10 px-4">
              <p className="text-sm font-semibold text-[#1f1f1f]">Queue</p>
              <p className="text-xs text-[#667085]">{uploadedImages.length} file{uploadedImages.length === 1 ? "" : "s"}</p>
            </div>
            <div className="max-h-[260px] overflow-y-auto p-3">
              {uploadedImages.length === 0 ? (
                <div className="flex h-[180px] flex-col items-center justify-center text-center text-sm text-[#667085]">
                  <ImagePlus className="mb-2 h-5 w-5" />
                  Uploaded images will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-2">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                        <Image src={image.previewUrl} alt={image.file.name} fill className="object-cover" sizes="56px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#1f1f1f]">{image.file.name}</p>
                        <p className="mt-0.5 text-xs text-[#667085]">
                          {image.width} x {image.height} · {image.detectedRatio}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeUploadedImage(image.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#667085] transition hover:bg-black/5 hover:text-[#1f1f1f]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-[24px] border border-black/10 bg-white">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-black/10 px-5">
            <p className="text-sm font-semibold text-[#1f1f1f]">Preview / Result</p>
            {latestResult && <Badge className="rounded-full bg-[#1f1f1f] text-white hover:bg-[#1f1f1f]">{latestResult.size}</Badge>}
          </div>

          <div className="min-h-0 flex-1 p-4">
            {!latestResult ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[22px] border border-dashed border-black/10 bg-white text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f1f1f] text-white">
                  <Maximize2 className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#1f1f1f]">Result preview</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#667085]">
                  Upload images, select a target size, then run upscale. The latest output appears here.
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white">
                <div className="relative min-h-[260px] flex-1 bg-slate-50/60">
                  <Image
                    src={latestResult.url}
                    alt={`Upscaled ${latestResult.size}`}
                    fill
                    className="object-contain p-5"
                    sizes="60vw"
                  />
                </div>

                {results.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto border-t border-black/10 bg-white px-4 py-3">
                    {results.slice(1).map((result) => (
                      <div
                        key={result.id}
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-slate-50"
                        title={result.fileName}
                      >
                        <Image src={result.url} alt={result.fileName} fill className="object-cover" sizes="56px" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-black/10 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[#1f1f1f]">{latestResult.fileName}</p>
                      <Badge className="shrink-0 rounded-full bg-slate-100 text-[#475467] hover:bg-slate-100">
                        {latestResult.size}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[#667085]">Upscaled output ready</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-black/10 bg-white"
                      onClick={() => handleCopyUrl(latestResult.url)}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy URL
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full bg-[#1f1f1f] px-4 text-white hover:bg-black"
                      onClick={() => handleDownload(latestResult.url, latestResult.fileName, latestResult.size)}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-black/10 px-5 py-4">
        <p className="text-sm text-[#667085]">
          {isUpscaling
            ? `Processing ${activeBatchIndex}/${uploadedImages.length}`
            : uploadedImages.length > 0
              ? `${uploadedImages.length} image${uploadedImages.length === 1 ? "" : "s"} ready`
              : "Upload at least one image to start."}
        </p>
        <Button
          onClick={handleUpscale}
          disabled={uploadedImages.length === 0 || isUpscaling}
          className="h-11 rounded-full bg-[#1f1f1f] px-6 text-white hover:bg-black"
        >
          {isUpscaling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Upscaling to {targetSize}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Upscale to {targetSize}
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
