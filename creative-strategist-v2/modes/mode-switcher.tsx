"use client";

import { WORKSPACE_FEATURES, modeRequiresClient } from "./mode-registry";
import type { WorkspaceMode } from "./types";

type ModeSwitcherProps = {
  activeMode: WorkspaceMode | null;
  onModeChange: (mode: WorkspaceMode) => void;
  variant?: "bottom" | "rail";
  /** No client selected yet: client-dependent modes render gray and unclickable. */
  disableClientModes?: boolean;
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

export function ModeSwitcher({
  activeMode,
  onModeChange,
  variant = "bottom",
  disableClientModes = false,
}: ModeSwitcherProps) {
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
              "border border-black/10 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-[opacity,box-shadow] duration-200",
              isRail ? "rounded-[18px] p-2.5" : "rounded-[24px] p-3",
              isReducedRailGroup ? "opacity-80 shadow-none" : "",
            ].join(" ")}
          >
            <div className={isRail ? "mb-2 px-1" : "mb-3 px-1"}>
              <p className={[isRail ? "text-base" : "text-lg", "font-bold tracking-tight text-[#111827]"].join(" ")}>
                {group.title}
              </p>
              {!isReducedRailGroup ? (
                <p className={["mt-0.5 leading-5 text-[#667085]", isRail ? "text-xs" : "text-sm"].join(" ")}>
                  {group.description}
                </p>
              ) : null}
            </div>
            <div className={isRail ? "grid gap-2" : "flex flex-wrap gap-2"}>
              {group.modes.map((mode) => {
                const feature = WORKSPACE_FEATURES.find((item) => item.id === mode);
                if (!feature) return null;

                const Icon = feature.icon;
                const isActive = feature.id === activeMode;
                const isLocked = disableClientModes && modeRequiresClient(feature.id);

                return (
                  <button
                    key={feature.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => onModeChange(feature.id)}
                    aria-pressed={isActive}
                    title={isLocked ? "เลือกลูกค้าก่อนเพื่อใช้ฟีเจอร์นี้" : undefined}
                    className={[
                      "group inline-flex items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200",
                      isRail ? "h-9 w-full justify-start" : "h-10",
                      isLocked
                        ? "cursor-not-allowed border-black/5 bg-slate-100/80 text-[#b6bcc6]"
                        : isActive
                          ? "border-[#1f1f1f] bg-[#1f1f1f] text-white shadow-[0_8px_18px_rgba(15,23,42,0.12)] active:scale-[0.98]"
                          : "border-black/10 bg-white text-[#3f3f3f] hover:-translate-y-0.5 hover:border-black/15 hover:bg-slate-50 hover:text-[#1f1f1f] hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] active:scale-[0.98]",
                    ].join(" ")}
                  >
                    <Icon
                      className={[
                        "h-3.5 w-3.5 transition",
                        isLocked
                          ? "text-[#c8cdd5]"
                          : isActive
                            ? "text-white"
                            : "text-[#777] group-hover:text-[#1f1f1f]",
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
