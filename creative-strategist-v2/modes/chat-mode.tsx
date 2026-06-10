"use client";

import { PromptInputBox } from "@/creative-strategist-v2/chat-model";
import type { WorkspaceMode } from "./types";

type ChatModeProps = {
  mode: Extract<WorkspaceMode, "concept" | "edit-image">;
};

export function ChatMode({ mode }: ChatModeProps) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PromptInputBox
        placeholder={
          mode === "edit-image"
            ? "Upload an image and describe what you want to edit..."
            : "Type your request..."
        }
        className="flex min-h-[108px] flex-col justify-between !border-black/10 !bg-white !shadow-[0_16px_48px_rgba(15,23,42,0.10)] sm:min-h-[116px]"
      />
    </div>
  );
}
