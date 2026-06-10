"use client";

import { MaterialToScenePanel } from "@/components/material-to-scene-panel";

type ProductSceneModeProps = {
  clientName?: string | null;
  productFocus?: string | null;
};

export function ProductSceneMode({ clientName, productFocus }: ProductSceneModeProps) {
  return (
    <section className="mx-auto w-full max-w-6xl">
      <MaterialToScenePanel clientName={clientName} productFocus={productFocus} />
    </section>
  );
}
