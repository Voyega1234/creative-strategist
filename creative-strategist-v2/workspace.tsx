"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
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

const ROLE_IMAGES = {
  strategist:
    "https://canufwodqxjmmkniktgb.supabase.co/storage/v1/object/public/image_documents/edited-image%20(1).png",
  designer:
    "https://canufwodqxjmmkniktgb.supabase.co/storage/v1/object/public/image_documents/ChatGPT%20Image%20Jun%2011,%202026,%2004_06_05%20PM.png",
  materials:
    "https://canufwodqxjmmkniktgb.supabase.co/storage/v1/object/public/image_documents/edited-image%20(2)%20(1).png",
} as const;

const LANDING_GROUPS: Array<{
  title: string;
  description: string;
  image: string;
  tint: string;
  modes: WorkspaceMode[];
}> = [
  {
    title: "Create Creative",
    description: "เริ่มงานใหม่ — คิดคอนเซ็ปต์ไอเดีย เจนภาพโฆษณาจาก brief หรือทำ SEO Banner",
    image: ROLE_IMAGES.strategist,
    tint: "bg-gradient-to-b from-[#F4F1FE] to-white",
    modes: ["concept", "text-to-image", "seo-banner"],
  },
  {
    title: "Revise Creative",
    description: "ปรับงานเดิม — แก้รูปด้วยแชท ตรวจและเพิ่มคุณภาพ หรือขยายความละเอียด",
    image: ROLE_IMAGES.designer,
    tint: "bg-gradient-to-b from-[#EEF6FF] to-white",
    modes: ["edit-image", "enhance", "upscale"],
  },
  {
    title: "Brand Library",
    description: "คลังภาพของแบรนด์ — สร้างภาพสต็อกสินค้า และจัดการรูป reference ที่เคยอัปไว้",
    image: ROLE_IMAGES.materials,
    tint: "bg-gradient-to-b from-[#FFF9E8] to-white",
    modes: ["material-to-scene", "image-assets"],
  },
];

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeMode, setActiveMode] = useState<WorkspaceMode>(DEFAULT_WORKSPACE_MODE);
  // Landing view: show the three mode groups with a guide until the user picks a mode.
  // Deep links (history session / new session) skip straight into concept mode.
  const [hasChosenMode, setHasChosenMode] = useState(Boolean(ideaSessionId) || startNewSession);
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
    activeMode === "material-to-scene" ||
    activeMode === "image-assets" ||
    activeMode === "seo-banner";
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
    setHasChosenMode(true);
  };

  // Clicking a history session (or New Session) while on the landing view jumps into concept mode.
  useEffect(() => {
    if (ideaSessionId || startNewSession) {
      setHasChosenMode(true);
    }
  }, [ideaSessionId, startNewSession]);

  // The sidebar home button returns the workspace to the landing (mode picker).
  useEffect(() => {
    const showLanding = () => setHasChosenMode(false);
    window.addEventListener("workspace-show-landing", showLanding);
    return () => window.removeEventListener("workspace-show-landing", showLanding);
  }, []);

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

  if (!hasChosenMode) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-1">
        <div className="mb-12 shrink-0 text-center">
          <p className="mb-3 text-sm font-medium text-[#667085]">
            {clientName ? `${clientName}${productFocus ? ` / ${productFocus}` : ""}` : "Creative workspace"}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-[#1f1f1f] sm:text-5xl">Creative Compass</h1>
          <p className="mt-4 text-base font-medium tracking-normal text-[#555] sm:text-lg">
            เลือกโหมดที่ตรงกับงานของคุณเพื่อเริ่มต้น
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {LANDING_GROUPS.map((group, index) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: index * 0.09, ease: [0.32, 0.72, 0, 1] }}
              className="rounded-[2rem] bg-black/[0.04] p-1.5 ring-1 ring-black/5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1"
            >
              <section
                className={`flex h-full flex-col rounded-[calc(2rem-0.375rem)] ${group.tint} p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_18px_44px_rgba(15,23,42,0.06)]`}
              >
                <div className="relative mx-auto h-36 w-full">
                  <Image
                    src={group.image}
                    alt={group.title}
                    fill
                    sizes="(max-width: 1024px) 80vw, 320px"
                    className="object-contain"
                  />
                </div>
                <h2 className="mt-5 text-center text-2xl font-semibold tracking-tight text-[#111827]">
                  {group.title}
                </h2>
                <p className="mt-2 text-center text-sm leading-6 text-[#667085]">{group.description}</p>
                <div className="mt-auto flex flex-wrap justify-center gap-2 pt-7">
                  {group.modes.map((mode) => {
                    const feature = getWorkspaceFeature(mode);
                    const Icon = feature.icon;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleModeChange(mode)}
                        className="group inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-[#3f3f3f] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-black/20 hover:bg-slate-50 hover:text-[#111827] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] active:scale-[0.98]"
                      >
                        <Icon className="h-4 w-4 text-[#98a2b3] transition-colors duration-300 group-hover:text-[#111827]" />
                        {feature.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "mx-auto flex min-h-0 w-full flex-col transition-[max-width] duration-300 ease-out",
        showModeRail ? "max-w-[110rem]" : "max-w-6xl",
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
          ref={scrollRef}
          onScroll={(event) => setShowScrollTop(event.currentTarget.scrollTop > 320)}
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
              <WorkspaceMascotHint image={ROLE_IMAGES.strategist}>
                ชอบไอเดียไหนให้คลิกการ์ดเพื่อเปิด popup แล้วเจนรูปต่อได้ หรือกดเซฟมุมขวาบนเพื่อเก็บไว้ใช้กับ Text to Image
              </WorkspaceMascotHint>
            )}
            {activeMode === "seo-banner" && (
              <WorkspaceMascotHint image={ROLE_IMAGES.strategist}>
                เลือก Client ก่อน แล้วตรวจสอบ Logo และสีของแบรนด์ หรือใส่ Website URL แล้วกด Extract เพื่อดึงข้อมูลอัตโนมัติ
              </WorkspaceMascotHint>
            )}
            {activeMode === "text-to-image" && (
              <WorkspaceMascotHint image={ROLE_IMAGES.strategist}>
                เริ่มจากเขียน brief หรือเลือก Saved idea แล้วค่อยกำหนด format, ratio, style และแนบภาพประกอบก่อนกด Generate Image
              </WorkspaceMascotHint>
            )}
            {activeMode === "edit-image" && (
              <WorkspaceMascotHint image={ROLE_IMAGES.designer}>
                เลือก Source Image ที่ต้องการแก้ก่อน จากนั้นพิมพ์คำสั่งแก้ไข ใช้ Brush ระบุพื้นที่ หรือแนบ Reference และ Materials เพิ่มได้
              </WorkspaceMascotHint>
            )}
            {activeMode === "upscale" && (
              <WorkspaceMascotHint image={ROLE_IMAGES.designer}>
                อัปโหลดภาพ เลือกความละเอียด 1K, 2K หรือ 4K แล้วตรวจ Preview ก่อนดาวน์โหลดไฟล์ที่ขยายเสร็จ
              </WorkspaceMascotHint>
            )}
            {activeMode === "enhance" && (
              <WorkspaceMascotHint image={ROLE_IMAGES.designer}>
                อัปโหลดรูปแล้วกด Run AI Check ก่อน จากนั้นปรับคำแนะนำหรือเลือก Preserve/Reimagine เพื่อสร้างภาพเวอร์ชันที่ดีขึ้น
              </WorkspaceMascotHint>
            )}
            {activeMode === "material-to-scene" && (
              <WorkspaceMascotHint image={ROLE_IMAGES.materials}>
                อัปโหลดภาพสินค้าหรือวัสดุ เขียนฉากที่ต้องการ แล้วเลือกอัตราส่วนกับสไตล์ภาพก่อนกดสร้าง 4 scenes
              </WorkspaceMascotHint>
            )}
            {activeMode === "image-assets" && (
              <WorkspaceMascotHint image={ROLE_IMAGES.materials}>
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

      {isScrollableMode && showScrollTop && (
        <button
          type="button"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="กลับขึ้นด้านบน"
          className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#1f1f1f] text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)] transition hover:bg-black"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function WorkspaceMascotHint({ children, image }: { children: ReactNode; image: string }) {
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
          src={image}
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
