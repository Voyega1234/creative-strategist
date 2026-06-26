import { IdeaExportCard } from "@/components/ideas/idea-export-card"
import type { IdeaRecommendation } from "@/lib/ideas/types"

function makeIdea(index: number, section: "Recommended" | "Option"): IdeaRecommendation {
  const copyByIndex = [
    {
      pillar: "Performance Marketing",
      headline: "แชทเยอะ แต่ไม่มีคนซื้อ",
      subheadline: "เหนื่อยตอบแชทผีที่ทักมาแล้วเงียบ? เปลี่ยนมาหาลูกค้าที่พร้อมจ่ายจริงด้วยระบบคัดกรองอัจฉริยะ",
      cta: "ขอรับคำปรึกษาเพื่อตั้งค่าระบบแอดคัดกรองแชทฟรีวันนี้",
      concept: "แชทมีระบาด",
      why: "เน้นผลลัพธ์คุณภาพแชทจริงแทนการอวดสถิติจำนวนแชทราคาถูกแบบทั่วไป",
    },
    {
      pillar: "Safety and Trust",
      headline: "ลูกบินไกล แต่ใจพ่อแม่เบาลง",
      subheadline: "ส่งลูกไปเรียนต่ออเมริกาอย่างสบายใจ ด้วยสายการบินที่ดูแลใกล้ชิดทุกขั้นตอน",
      cta: "ดูรายละเอียดบริการสำหรับนักเรียน",
      concept: "อุ่นใจวัยเรียนนอก",
      why: "เน้นกลุ่มครอบครัวที่ส่งลูกเรียนนอก ซึ่งคู่แข่งมักพูดถึงแต่ราคา แต่ละเลยความกังวลของพ่อแม่",
    },
    {
      pillar: "Content & Influencer",
      headline: "จ้างคนดัง แต่ยอดสั่งเงียบ",
      subheadline: "ยอดฟอลหลักล้านไม่เท่าคนเชื่อใจหลักแสน เลือกอินฟลูเอนเซอร์ที่พูดแล้วคนพร้อมควักเงินจริง",
      cta: "ติดต่อปรึกษากลยุทธ์การจับคู่คนรีวิวที่ใช่สำหรับแบรนด์คุณ",
      concept: "พลังแห่งความเชื่อใจ",
      why: "ช่วยคัดเลือกบุคคลที่เหมาะสมด้วยเกณฑ์ความน่าเชื่อถือและการตอบสนองจริง ไม่ใช่แค่ตัวเลขผู้ติดตาม",
    },
  ]
  const item = copyByIndex[(index - 1) % copyByIndex.length]

  return {
    title: item.concept,
    concept_idea: item.concept,
    concept_type: "Proven Concept",
    competitiveGap: item.why,
    content_pillar: item.pillar,
    description: item.why,
    visual_routes: [],
    copywriting: {
      headline: item.headline,
      sub_headline_1: item.subheadline,
      sub_headline_2: "",
      cta: item.cta,
    },
    product_focus: section,
  } as IdeaRecommendation
}

const recommendedIdeas = [1, 2, 3].map((index) => makeIdea(index, "Recommended"))
const otherIdeas = [1, 2, 3].map((index) => makeIdea(index + 3, "Option"))

function Section({
  title,
  ideas,
  startIndex,
}: {
  title: string
  ideas: IdeaRecommendation[]
  startIndex: number
}) {
  return (
    <section className="mb-[18px]">
      <h2 className="mb-[14px] text-[14px] font-semibold leading-none text-[#111827]">{title}</h2>
      <div className="grid grid-cols-3 gap-[10px]">
        {ideas.map((idea, index) => (
          <IdeaExportCard
            key={`${title}-${index}`}
            topic={idea}
            index={startIndex + index}
            width={230}
            selectionLabel="Select this topic"
          />
        ))}
      </div>
    </section>
  )
}

export default function PdfHtmlPreviewPage() {
  return (
    <main className="min-h-screen bg-[#f3f4f6] py-8 text-[#111827]">
      <div className="mx-auto mb-4 w-[794px] text-sm text-[#667085]">
        HTML preview of the PDF layout
      </div>

      <div
        className="mx-auto min-h-[1123px] w-[794px] bg-white p-[30px] shadow-[0_18px_55px_rgba(15,23,42,0.16)]"
        style={{
          fontFamily: "'Sukhumvit Set', Arial, Helvetica, sans-serif",
        }}
      >
        <Section title="Recommended topics" ideas={recommendedIdeas} startIndex={1} />
        <Section title="Other options" ideas={otherIdeas} startIndex={recommendedIdeas.length + 1} />
      </div>
    </main>
  )
}
