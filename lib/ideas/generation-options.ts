export const MODEL_OPTIONS = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gpt-4o", name: "GPT-4o" },
] as const

export const BRIEF_TEMPLATES = [
  {
    id: "pain-point",
    title: "เขียนคอนเทนต์โปรโมชั่น เพื่อกระตุ้นยอดขายแบบเพลิดเพลิน",
    content:
      "I want you to generate ideas that directly address a key pain point of our target customers, and clearly show how our product or service uniquely solves this problem.",
  },
  {
    id: "brand-engagement",
    title: "คิดไอเดียคอนเทนต์เพื่อสร้างการตอบรับแบรนด์",
    content:
      "Please create ideas that leverage real or hypothetical testimonials—showing authentic customer voices and how their lives improved after using our product or service.",
  },
  {
    id: "content-planning",
    title: "ช่วยวางแผนคอนเทนต์รายสัปดาห์ / อีสีลีพอด 5 วัน สำหรับสินค้าของ",
    content:
      "Develop ideas that use 'before and after' scenarios, direct comparisons, or transformation stories to vividly illustrate the difference our product or service makes.",
  },
  {
    id: "tiktok-ideas",
    title: "คิดไอเดียสมุด TikTok โปรโมชันแบรนด์สินค้า",
    content:
      "I want you to come up with ideas that highlight unusual, overlooked, or unexpected ways our product or service can be used, providing fresh perspectives that competitors aren't talking about.",
  },
] as const
