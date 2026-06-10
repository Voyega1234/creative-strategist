import type { LucideIcon } from "lucide-react";
import type { IdeaRecommendation } from "@/lib/ideas/types";

export type WorkspaceMode =
  | "concept"
  | "text-to-image"
  | "single-post"
  | "album-post"
  | "carousel"
  | "edit-image"
  | "image-assets"
  | "seo-banner"
  | "upscale"
  | "material-to-scene"
  | "enhance";

export type WorkspaceKind = "chat" | "tool" | "pending";

export type WorkspaceFeature = {
  id: WorkspaceMode;
  label: string;
  description: string;
  icon: LucideIcon;
  kind: WorkspaceKind;
};

export type TextToImageIdeaHandoff = {
  requestId: number;
  idea: IdeaRecommendation;
  selectedVisualRouteIndex: number | null;
};

export type TextToImageReferenceHandoff = {
  requestId: number;
  imageUrl: string;
};
