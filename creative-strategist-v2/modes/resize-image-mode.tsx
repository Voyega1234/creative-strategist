"use client";

import { ImageResizePanel } from "@/components/image-resize-panel";

type ResizeImageModeProps = {
  productFocus?: string | null;
};

export function ResizeImageMode({ productFocus }: ResizeImageModeProps) {
  return (
    <section className="mx-auto h-full w-full max-w-[1480px]">
      <ImageResizePanel productFocus={productFocus} />
    </section>
  );
}
