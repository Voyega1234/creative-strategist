export const ASPECT_RATIO_OPTIONS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
]

export const DEFAULT_IMAGE_COUNT = 1
export const IMAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5]

export const AD_STYLE_OPTIONS = [
  {
    value: "clean-product-focus",
    label: "Clean Product Focus",
    previewImage: "/style-previews/clean-product-focus.svg",
    hoverDescription:
      "โฟกัสที่สินค้าเป็นหลัก ภาพสะอาด ดูพรีเมียม และมีลำดับสายตาที่ชัดแบบ product-led commercial ad.",
    userBrief:
      "Create a clean, premium product-led ad with disciplined composition, strong hierarchy, clear product focus, minimal clutter, refined typography integration, and polished commercial lighting.",
  },
  {
    value: "bold-offer-graphic",
    label: "Bold Offer Graphic",
    previewImage: "/style-previews/bold-offer-graphic.svg",
    hoverDescription:
      "เหมาะกับ ads ที่ต้องการชูโปรโมชัน ข้อเสนอ หรือ CTA ให้เด่น อ่านเร็ว และหยุดสายตาได้ทันที.",
    userBrief:
      "Create a bold performance ad with strong offer visibility, graphic framing, assertive typography, fast commercial readability, high contrast, and a composition built for thumb-stop conversion.",
  },
  {
    value: "lifestyle-human-story",
    label: "Lifestyle Human Story",
    previewImage: "/style-previews/lifestyle-human-story.svg",
    hoverDescription:
      "ใช้คนเป็นตัวนำอารมณ์และความน่าเชื่อถือ เพื่อให้ภาพดูมีชีวิตและเชื่อมโยงกับผู้ชมมากขึ้น.",
    userBrief:
      "Create a premium lifestyle ad where human presence drives aspiration, trust, and emotional clarity, with believable realism, natural posing, authentic skin texture, and strong product-message integration.",
  },
  {
    value: "editorial-premium",
    label: "Editorial Premium",
    previewImage: "/style-previews/editorial-premium.svg",
    hoverDescription:
      "ลุค editorial ที่มี negative space และ art direction ชัด เหมาะกับแบรนด์ที่อยากดู refined และ elevated.",
    userBrief:
      "Create an editorial-inspired premium ad with art-directed negative space, elegant type placement, elevated styling, restrained luxury cues, and a composition that feels authored rather than templated.",
  },
  {
    value: "comparison-education",
    label: "Comparison / Education",
    previewImage: "/style-previews/comparison-education.svg",
    hoverDescription:
      "เหมาะกับงานเปรียบเทียบ before/after หรือสื่อสารความต่างของ value proposition ให้เข้าใจในครั้งเดียว.",
    userBrief:
      "Create a persuasive comparison-led ad using a clear visual contrast or modular system to explain the value proposition quickly, with disciplined hierarchy and immediate commercial understanding.",
  },
  {
    value: "mixed-media-campaign",
    label: "Mixed Media Campaign",
    previewImage: "/style-previews/mixed-media-campaign.svg",
    hoverDescription:
      "ผสมภาพถ่ายกับกราฟิกเลเยอร์เพื่อให้ได้ความรู้สึก campaign ที่มีพลังและมีเอกลักษณ์มากกว่า static ad ปกติ.",
    userBrief:
      "Create a premium mixed-media campaign ad that blends photography and graphic design intentionally, with layered framing, text integrated into the composition, and a distinctive brand-ownable visual system.",
  },
] as const
