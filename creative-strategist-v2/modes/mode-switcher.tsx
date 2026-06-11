"use client";

import { WORKSPACE_FEATURES } from "./mode-registry";
import type { WorkspaceMode } from "./types";

type ModeSwitcherProps = {
  activeMode: WorkspaceMode | null;
  onModeChange: (mode: WorkspaceMode) => void;
  variant?: "bottom" | "rail";
};

const MODE_GROUPS: Array<{
  title: string;
  description: string;
  modes: WorkspaceMode[];
}> = [
  {
    title: "Create Creative",
    description: "Start a new idea or ad asset.",
    modes: ["concept", "text-to-image", "seo-banner"],
  },
  {
    title: "Revise Creative",
    description: "Improve or edit existing work.",
    modes: ["edit-image", "enhance", "upscale"],
  },
  {
    title: "Brand Library",
    description: "Create product photostock and manage brand references.",
    modes: ["material-to-scene", "image-assets"],
  },
];

export function ModeSwitcher({ activeMode, onModeChange, variant = "bottom" }: ModeSwitcherProps) {
  const isRail = variant === "rail";

  return (
    <div
      className={[
        "grid w-full gap-3",
        isRail ? "grid-cols-1" : "mb-6 lg:grid-cols-3",
      ].join(" ")}
      aria-label="Creative tools"
    >
      {MODE_GROUPS.map((group) => {
        const isActiveGroup = activeMode !== null && group.modes.includes(activeMode);
        const isReducedRailGroup = isRail && !isActiveGroup;

        return (
          <section
            key={group.title}
            className={[
              "border border-black/10 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-[opacity,box-shadow] duration-200",
              isRail ? "rounded-[18px]" : "rounded-[24px]",
              isReducedRailGroup ? "opacity-80 shadow-none" : "",
            ].join(" ")}
          >
            <div className="mb-3 px-1">
              <p className="text-sm font-semibold text-[#1f1f1f]">{group.title}</p>
              {!isReducedRailGroup ? <p className="mt-0.5 text-xs leading-5 text-[#667085]">{group.description}</p> : null}
            </div>
            <div className={isRail ? "grid gap-2" : "flex flex-wrap gap-2"}>
              {group.modes.map((mode) => {
                const feature = WORKSPACE_FEATURES.find((item) => item.id === mode);
                if (!feature) return null;

                const Icon = feature.icon;
                const isActive = feature.id === activeMode;

                return (
                  <button
                    key={feature.id}
                    type="button"
                    onClick={() => onModeChange(feature.id)}
                    aria-pressed={isActive}
                    className={[
                      "group inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200 active:scale-[0.98]",
                      isRail ? "w-full justify-start" : "",
                      isActive
                        ? "border-[#1f1f1f] bg-[#1f1f1f] text-white shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
                        : "border-black/10 bg-white text-[#3f3f3f] hover:-translate-y-0.5 hover:border-black/15 hover:bg-slate-50 hover:text-[#1f1f1f] hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)]",
                    ].join(" ")}
                  >
                    <Icon
                      className={[
                        "h-3.5 w-3.5 transition",
                        isActive ? "text-white" : "text-[#777] group-hover:text-[#1f1f1f]",
                      ].join(" ")}
                    />
                    <span className="whitespace-nowrap">{feature.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
