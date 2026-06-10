"use client";

import { ImageEditChatPanel } from "@/components/image-edit-chat-panel";
import type { ClientWithProductFocus } from "@/lib/client-options";

type EditImageModeProps = {
  clients: ClientWithProductFocus[];
  activeClientId?: string | null;
  productFocus?: string | null;
};

export function EditImageMode({
  clients,
  activeClientId,
  productFocus,
}: EditImageModeProps) {
  return (
    <section className="mx-auto h-full w-full max-w-[1480px]">
      <ImageEditChatPanel
        clients={clients}
        activeClientId={activeClientId}
        activeProductFocus={productFocus}
        variant="workspace"
      />
    </section>
  );
}
