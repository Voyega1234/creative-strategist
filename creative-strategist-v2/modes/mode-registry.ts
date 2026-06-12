import {
  Clapperboard,
  Files,
  ImageIcon,
  ImagePlus,
  Layers3,
  Lightbulb,
  Maximize2,
  PanelTop,
  PenTool,
  Sparkles,
} from "lucide-react";
import type { WorkspaceFeature, WorkspaceMode } from "./types";

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = "concept";

export const WORKSPACE_FEATURES: WorkspaceFeature[] = [
  {
    id: "concept",
    label: "Generate Concept Ideas",
    description: "Develop campaign ideas through conversation.",
    icon: Lightbulb,
    kind: "chat",
  },
  {
    id: "text-to-image",
    label: "Text to Image",
    description: "Turn a creative brief into advertising visuals.",
    icon: ImagePlus,
    kind: "tool",
  },
  {
    id: "single-post",
    label: "Single Post",
    description: "Create one focused social post asset.",
    icon: ImageIcon,
    kind: "pending",
  },
  {
    id: "album-post",
    label: "Album Post",
    description: "Create a multi-image post set around one idea.",
    icon: Files,
    kind: "pending",
  },
  {
    id: "carousel",
    label: "Carousel",
    description: "Plan and generate a swipeable story sequence.",
    icon: PanelTop,
    kind: "pending",
  },
  {
    id: "edit-image",
    label: "Edit Image",
    description: "Upload an image and refine it through chat.",
    icon: PenTool,
    kind: "chat",
  },
  {
    id: "image-assets",
    label: "Reference Folder",
    description: "Browse and manage reusable brand imagery.",
    icon: ImageIcon,
    kind: "tool",
  },
  {
    id: "seo-banner",
    label: "SEO Banner",
    description: "Create structured banners for articles and campaigns.",
    icon: Clapperboard,
    kind: "tool",
  },
  {
    id: "upscale",
    label: "Upscale Image",
    description: "Increase image resolution while preserving composition.",
    icon: Maximize2,
    kind: "tool",
  },
  {
    id: "material-to-scene",
    label: "Photostock",
    description: "Turn product materials into usable scene visuals.",
    icon: Layers3,
    kind: "tool",
  },
  {
    id: "enhance",
    label: "Enhance Image",
    description: "Improve image quality with controlled enhancement.",
    icon: Sparkles,
    kind: "tool",
  },
];

// Modes that work purely on uploaded files, so they are usable before a client is selected.
export const CLIENT_FREE_MODES: WorkspaceMode[] = [
  "edit-image",
  "enhance",
  "upscale",
  "material-to-scene",
  "image-assets",
];

export function modeRequiresClient(mode: WorkspaceMode) {
  return !CLIENT_FREE_MODES.includes(mode);
}

export function getWorkspaceFeature(mode: WorkspaceMode) {
  return WORKSPACE_FEATURES.find((feature) => feature.id === mode) ?? WORKSPACE_FEATURES[0];
}
