"use client";

import { Children, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadedReferencePreview = {
  file: File;
  url: string;
};

export function ImageCountSummary({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 text-xs text-[#667085]">
      <p className="font-semibold text-[#1f1f1f]">{count}</p>
      <p>{label}</p>
    </div>
  );
}

export function ImagePickerSection({
  title,
  loading,
  emptyText,
  columns,
  children,
}: {
  title: string;
  loading: boolean;
  emptyText: string;
  columns: string;
  children: ReactNode;
}) {
  const hasChildren = Children.count(children) > 0;

  return (
    <section>
      <p className="mb-3 text-sm font-semibold text-[#1f1f1f]">{title}</p>
      {loading ? (
        <div className="flex items-center rounded-2xl border border-black/10 bg-slate-50 px-4 py-5 text-sm text-[#667085]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading images...
        </div>
      ) : hasChildren ? (
        <div className={cn("grid max-h-64 gap-2 overflow-y-auto pr-1", columns)}>{children}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/10 bg-slate-50 px-4 py-5 text-sm text-[#667085]">
          {emptyText}
        </div>
      )}
    </section>
  );
}

export function SelectedUploadedFileStrip({
  label,
  previews,
  onRemove,
}: {
  label: string;
  previews: UploadedReferencePreview[];
  onRemove: (file: File) => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">{label}</p>
        <p className="text-xs text-[#667085]">{previews.length} selected</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {previews.map((preview) => (
          <div
            key={`${preview.file.name}-${preview.file.lastModified}`}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white"
          >
            <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(preview.file)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[11px] font-semibold text-[#475467] shadow-sm ring-1 ring-black/10 transition hover:bg-red-50 hover:text-red-600"
              aria-label="Remove uploaded reference"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SelectedImageStrip({
  label,
  urls,
  onRemove,
}: {
  label: string;
  urls: string[];
  onRemove: (url: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">{label}</p>
        <p className="text-xs text-[#667085]">{urls.length} selected</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {urls.map((url) => (
          <div key={url} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white">
            <img src={url} alt={label} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(url)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[11px] font-semibold text-[#475467] opacity-100 shadow-sm ring-1 ring-black/10 transition hover:bg-red-50 hover:text-red-600"
              aria-label={`Remove ${label}`}
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
