"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ConceptMode } from "./modes/concept-mode";
import { EditImageMode } from "./modes/edit-image-mode";
import { EnhanceMode } from "./modes/enhance-mode";
import { ImageAssetsMode } from "./modes/image-assets-mode";
import { DEFAULT_WORKSPACE_MODE, getWorkspaceFeature } from "./modes/mode-registry";
import { ModeSwitcher } from "./modes/mode-switcher";
import { PendingMode } from "./modes/pending-mode";
import { ProductSceneMode } from "./modes/product-scene-mode";
import { SeoBannerMode } from "./modes/seo-banner-mode";
import { TextToImageMode } from "./modes/text-to-image-mode";
import type {
  TextToImageIdeaHandoff,
  TextToImageReferenceHandoff,
  WorkspaceMode,
} from "./modes/types";
import { UpscaleMode } from "./modes/upscale-mode";
import type { ClientWithProductFocus } from "@/lib/client-options";
import type { IdeaRecommendation } from "@/lib/ideas/types";

type V2WorkspaceProps = {
  clientId?: string | null;
  clientName?: string;
  productFocus?: string | null;
  colorPalette?: string[];
  clients?: ClientWithProductFocus[];
  ideaSessionId?: string | null;
  startNewSession?: boolean;
};

export function V2Workspace({
  clientId,
  clientName,
  productFocus,
  colorPalette,
  clients = [],
  ideaSessionId,
  startNewSession = false,
}: V2WorkspaceProps) {
  const [activeMode, setActiveMode] = useState<WorkspaceMode>(DEFAULT_WORKSPACE_MODE);
  const [mountedModes, setMountedModes] = useState<WorkspaceMode[]>([DEFAULT_WORKSPACE_MODE]);
  const [conceptHasIdeas, setConceptHasIdeas] = useState(false);
  const [textToImageNeedsScroll, setTextToImageNeedsScroll] = useState(false);
  const [textToImageIdeaHandoff, setTextToImageIdeaHandoff] =
    useState<TextToImageIdeaHandoff | null>(null);
  const [textToImageReferenceHandoff, setTextToImageReferenceHandoff] =
    useState<TextToImageReferenceHandoff | null>(null);

  const isToolMode =
    activeMode === "upscale" ||
    activeMode === "seo-banner" ||
    activeMode === "enhance" ||
    activeMode === "edit-image" ||
    activeMode === "material-to-scene" ||
    activeMode === "image-assets";
  const isScrollableMode =
    (activeMode === "concept" && conceptHasIdeas) ||
    (activeMode === "text-to-image" && textToImageNeedsScroll) ||
    activeMode === "enhance" ||
    activeMode === "edit-image" ||
    activeMode === "material-to-scene" ||
    activeMode === "image-assets";
  const usesFullHeight = isToolMode || isScrollableMode;
  const showModeRail =
    (activeMode === "concept" && conceptHasIdeas) ||
    activeMode === "text-to-image" ||
    activeMode === "upscale" ||
    activeMode === "seo-banner" ||
    activeMode === "enhance" ||
    activeMode === "edit-image" ||
    activeMode === "material-to-scene" ||
    activeMode === "image-assets";

  const handleModeChange = (mode: WorkspaceMode) => {
    setMountedModes((current) => (current.includes(mode) ? current : [...current, mode]));
    setActiveMode(mode);
  };

  const handleUseIdeaForImage = (
    idea: IdeaRecommendation,
    selectedVisualRouteIndex: number | null,
  ) => {
    setTextToImageIdeaHandoff({
      requestId: Date.now(),
      idea,
      selectedVisualRouteIndex,
    });
    handleModeChange("text-to-image");
  };

  const handleUseReferenceForImage = (imageUrl: string) => {
    setTextToImageReferenceHandoff({
      requestId: Date.now(),
      imageUrl,
    });
    handleModeChange("text-to-image");
  };

  const renderModeContent = (mode: WorkspaceMode) => {
    const feature = getWorkspaceFeature(mode);

    if (mode === "concept") {
      return (
        <ConceptMode
          clientName={clientName}
          productFocus={productFocus}
          selectedSessionId={ideaSessionId}
          startNewSession={startNewSession}
          onHasIdeasChange={setConceptHasIdeas}
          onUseIdeaForImage={handleUseIdeaForImage}
        />
      );
    }

    if (mode === "text-to-image") {
      return (
        <TextToImageMode
          clientId={clientId}
          clientName={clientName}
          productFocus={productFocus}
          colorPalette={colorPalette}
          onNeedsScrollChange={setTextToImageNeedsScroll}
          ideaHandoff={textToImageIdeaHandoff}
          referenceHandoff={textToImageReferenceHandoff}
        />
      );
    }

    if (mode === "edit-image") {
      return (
        <EditImageMode
          clients={clients}
          activeClientId={clientId}
          productFocus={productFocus}
        />
      );
    }
    if (mode === "seo-banner") return <SeoBannerMode clients={clients} activeClientId={clientId} />;
    if (mode === "upscale") return <UpscaleMode />;
    if (mode === "enhance") return <EnhanceMode />;
    if (mode === "material-to-scene") {
      return <ProductSceneMode clientName={clientName} productFocus={productFocus} />;
    }
    if (mode === "image-assets") {
      return (
        <ImageAssetsMode
          clientId={clientId}
          clientName={clientName}
          onUseImage={handleUseReferenceForImage}
        />
      );
    }
    if (feature.kind === "pending") return <PendingMode feature={feature} />;

    return null;
  };

  return (
    <div
      className={[
        "mx-auto flex min-h-0 w-full flex-col transition-[max-width] duration-300 ease-out",
        showModeRail ? "max-w-[82rem]" : "max-w-6xl",
        usesFullHeight ? "h-full justify-start" : "min-h-full justify-center",
      ].join(" ")}
    >
      <div className={["shrink-0 text-center", usesFullHeight ? "mb-4" : "mb-8"].join(" ")}>
        <p className="mb-3 text-sm font-medium text-[#667085]">
          {clientName ? `${clientName}${productFocus ? ` / ${productFocus}` : ""}` : "Creative workspace"}
        </p>
        <h1 className="text-4xl font-semibold tracking-normal text-[#1f1f1f] sm:text-5xl">Creative Compass</h1>
        <p className="mt-4 text-base font-medium tracking-normal text-[#555] sm:text-lg">
          Choose a mode, then work in the format that fits the task.
        </p>
      </div>

      <div
        className={[
          "min-h-0",
          usesFullHeight ? "flex-1 overflow-hidden" : "",
          showModeRail ? "lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-4" : "",
        ].join(" ")}
      >
        <div
          className={[
            "min-h-0",
            usesFullHeight ? "h-full" : "",
            isScrollableMode ? "overscroll-contain overflow-y-auto pr-1" : "",
          ].join(" ")}
        >
          <div className={["relative min-h-0", usesFullHeight ? "h-full" : ""].join(" ")}>
            {mountedModes.map((mode) => {
              const isActive = mode === activeMode;
              return (
                <motion.div
                  key={mode}
                  aria-hidden={!isActive}
                  className={[
                    "min-h-0 w-full",
                    usesFullHeight && isActive ? "h-full" : "",
                    isActive
                      ? "relative"
                      : "pointer-events-none absolute inset-x-0 top-0 max-h-full overflow-hidden",
                  ].join(" ")}
                  initial={false}
                  animate={{
                    opacity: isActive ? 1 : 0,
                    y: isActive ? 0 : 3,
                  }}
                  transition={{
                    duration: 0.22,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {renderModeContent(mode)}
                </motion.div>
              );
            })}
          </div>
        </div>

        {showModeRail && (
          <aside className="hidden min-h-0 lg:block">
            <ModeSwitcher activeMode={activeMode} onModeChange={handleModeChange} variant="rail" />
            {activeMode === "concept" && (
              <WorkspaceMascotHint>
                ชอบไอเดียไหนให้คลิกการ์ดเพื่อเปิด popup แล้วเจนรูปต่อได้ หรือกดเซฟมุมขวาบนเพื่อเก็บไว้ใช้กับ Text to Image
              </WorkspaceMascotHint>
            )}
            {activeMode === "seo-banner" && (
              <WorkspaceMascotHint>
                เลือก Client ก่อน แล้วตรวจสอบ Logo และสีของแบรนด์ หรือใส่ Website URL แล้วกด Extract เพื่อดึงข้อมูลอัตโนมัติ
              </WorkspaceMascotHint>
            )}
            {activeMode === "text-to-image" && (
              <WorkspaceMascotHint>
                เริ่มจากเขียน brief หรือเลือก Saved idea แล้วค่อยกำหนด format, ratio, style และแนบภาพประกอบก่อนกด Generate Image
              </WorkspaceMascotHint>
            )}
            {activeMode === "edit-image" && (
              <WorkspaceMascotHint>
                เลือก Source Image ที่ต้องการแก้ก่อน จากนั้นพิมพ์คำสั่งแก้ไข ใช้ Brush ระบุพื้นที่ หรือแนบ Reference และ Materials เพิ่มได้
              </WorkspaceMascotHint>
            )}
            {activeMode === "upscale" && (
              <WorkspaceMascotHint>
                อัปโหลดภาพ เลือกความละเอียด 1K, 2K หรือ 4K แล้วตรวจ Preview ก่อนดาวน์โหลดไฟล์ที่ขยายเสร็จ
              </WorkspaceMascotHint>
            )}
            {activeMode === "enhance" && (
              <WorkspaceMascotHint>
                อัปโหลดรูปแล้วกด Run AI Check ก่อน จากนั้นปรับคำแนะนำหรือเลือก Preserve/Reimagine เพื่อสร้างภาพเวอร์ชันที่ดีขึ้น
              </WorkspaceMascotHint>
            )}
            {activeMode === "material-to-scene" && (
              <WorkspaceMascotHint>
                อัปโหลดภาพสินค้าหรือวัสดุ เขียนฉากที่ต้องการ แล้วเลือกอัตราส่วนกับสไตล์ภาพก่อนกดสร้าง 4 scenes
              </WorkspaceMascotHint>
            )}
            {activeMode === "image-assets" && (
              <WorkspaceMascotHint>
                เลือก “แบรนด์นี้” เพื่อดูรูปเฉพาะแบรนด์ หรือ “ทั้งหมด” เพื่อดูคลังรวมของทีม กดที่รูปเพื่อพรีวิวแล้วส่งไปใช้ต่อใน Text to Image ได้เลย
              </WorkspaceMascotHint>
            )}
          </aside>
        )}
      </div>

      <div
        className={[
          "shrink-0",
          usesFullHeight ? "mt-4" : "mt-6",
          showModeRail ? "lg:hidden" : "",
        ].join(" ")}
      >
        <ModeSwitcher activeMode={activeMode} onModeChange={handleModeChange} />
      </div>
    </div>
  );
}

function WorkspaceMascotHint({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="mt-4 flex items-end justify-end gap-3"
      animate={{ y: [0, -5, 0] }}
      transition={{
        duration: 3.2,
        ease: "easeInOut",
        repeat: Infinity,
      }}
    >
      <div className="relative max-w-[12.5rem] rounded-[20px] border border-black/10 bg-white/95 px-4 py-3 text-sm leading-relaxed text-[#475467] shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
        <span className="font-semibold text-[#111827]">ทิปเล็กน้อย:</span> {children}
        <span className="absolute -right-2 bottom-5 h-4 w-4 rotate-45 border-r border-t border-black/10 bg-white" />
      </div>
      <div className="relative h-24 w-20 shrink-0">
        <Image
          src="/SCR-20250730-myam-Photoroom.png"
          alt="Creative Compass mascot"
          fill
          sizes="80px"
          className="object-contain drop-shadow-[0_14px_18px_rgba(15,23,42,0.16)]"
          priority={false}
        />
      </div>
    </motion.div>
  );
}
