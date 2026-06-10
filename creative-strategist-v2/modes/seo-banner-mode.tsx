"use client";

import { SeoBlogBannerPanel } from "@/components/seo-blog-banner-panel";
import type { ClientWithProductFocus } from "@/lib/client-options";

type SeoBannerModeProps = {
  clients: ClientWithProductFocus[];
  activeClientId?: string | null;
};

export function SeoBannerMode({ clients, activeClientId }: SeoBannerModeProps) {
  return (
    <section className="mx-auto w-full max-w-[1480px]">
      <SeoBlogBannerPanel clients={clients} activeClientId={activeClientId} variant="v2" />
    </section>
  );
}
