import { readdir, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const COOKBOOK_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../AW-Boon-Visual-Style-Cookbook-V2/styles",
)

let cachedStyles = null

function compactStyle(style) {
  return {
    style_slug: style.style_slug,
    style_name: style.style_name,
    style_summary: style.style_summary,
    style_category: style.visual_deconstruction?.style_category || "",
    core_visual_proposition: style.visual_deconstruction?.core_visual_proposition || "",
    first_read: style.visual_deconstruction?.first_read || "",
    mood: style.visual_deconstruction?.mood || "",
    typography: style.typography?.personality || "",
    color_palette: style.color_palette?.usage || "",
    anchors: Array.isArray(style.style_fidelity_anchors)
      ? style.style_fidelity_anchors.slice(0, 5)
      : [],
  }
}

export async function loadCookbookStyles() {
  if (cachedStyles) return cachedStyles

  const dirs = await readdir(COOKBOOK_DIR, { withFileTypes: true })
  const styles = []

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue
    const file = resolve(COOKBOOK_DIR, dir.name, "style.json")
    const style = JSON.parse(await readFile(file, "utf8"))
    styles.push(style)
  }

  cachedStyles = styles.sort((a, b) => a.style_slug.localeCompare(b.style_slug))
  return cachedStyles
}

export async function getCookbookStyleIndex() {
  const styles = await loadCookbookStyles()
  return styles.map(compactStyle)
}

export async function findCookbookStyleBySlug(slug) {
  if (!slug || typeof slug !== "string") return null
  const styles = await loadCookbookStyles()
  return styles.find((style) => style.style_slug === slug.trim()) || null
}

export function pickFallbackStyle(body = {}) {
  const text = [
    body.client,
    body.productFocus,
    body.product_focus,
    body.prompt,
    body.userBrief,
    body.user_brief,
    body.topic_description,
    body.main_benefit,
    body.mainBenefit,
    body.creative_format,
    body.creativeFormat,
    body.ad_style,
    body.adStyle,
    body.copywriting?.headline,
    body.copywriting?.sub_headline_1,
    body.copywriting?.sub_headline_2,
    body.copywriting?.cta,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const rules = [
    [/airline|flight|fare|travel|destination|korea|japan|taiwan|eva|สายการบิน|เที่ยว|บิน/, "airline-destination-fare-schedule-poster-style"],
    [/clinic|beauty|skin|iv|drip|lift|hifu|botox|หน้า|ผิว|คลินิก|ยกกระชับ/, "pink-iv-drip-combo-upsell-promo-style"],
    [/car|vehicle|automotive|ev|toyota|รถ|ยานยนต์|แบตเตอรี่/, "ghosted-chassis-ev-tech-reveal-style"],
    [/sale|flash|discount|deal|shopee|lazada|ลด|โปร|ราคา|ซื้อ/, "flash-sale-podium-date-tiers-style"],
    [/marketplace|cpm|roi|ads|seo|marketing|campaign|performance|โฆษณา|การตลาด/, "cobalt-3d-trap-marketing-metaphor-style"],
    [/app|users|install|download|mobile|แอป/, "watering-can-app-growth-metaphor-style"],
    [/mosquito|insect|repellent|spray|ยุง|แมลง|ปลวก/, "spy-mosquito-villain-threat-spray-style"],
    [/meal|replacement|weight|diet|nutrition|หุ่น|อาหาร|โปรตีน/, "green-bodygoal-meal-replacement-stat-style"],
    [/kid|kids|child|children|height|dha|calcium|เด็ก|สูง|แคลเซียม/, "kids-height-calcium-sport-lifestyle-style"],
  ]

  const match = rules.find(([pattern]) => pattern.test(text))
  return match?.[1] || "cobalt-3d-trap-marketing-metaphor-style"
}

export function summarizeStyleForPrompt(style) {
  if (!style) return "No cookbook style selected."

  const selected = {
    style_name: style.style_name,
    style_slug: style.style_slug,
    style_summary: style.style_summary,
    source_content_to_avoid: style.source_content_to_avoid,
    transferable_visual_dna: {
      style_category: style.visual_deconstruction?.style_category,
      core_visual_proposition: style.visual_deconstruction?.core_visual_proposition,
      first_read: style.visual_deconstruction?.first_read,
      eye_path: style.visual_deconstruction?.eye_path,
      depth_strategy: style.visual_deconstruction?.depth_strategy,
      copy_density: style.visual_deconstruction?.copy_density,
      mood: style.visual_deconstruction?.mood,
    },
    composition_principles: {
      hero_scale: style.composition?.hero_scale,
      information_hierarchy: style.composition?.information_hierarchy,
      negative_space: style.composition?.negative_space,
      overlap: style.composition?.overlap,
      safe_area: style.composition?.safe_area,
    },
    typography_principles: {
      personality: style.typography?.personality,
      hierarchy: style.typography?.hierarchy,
      effects: style.typography?.effects,
      language_handling: style.typography?.language_handling,
    },
    color_principles: {
      dominant_family: style.color_palette?.dominant_family,
      support_family: style.color_palette?.support_family,
      accent_family: style.color_palette?.accent_family,
      contrast_family: style.color_palette?.contrast_family,
      usage: style.color_palette?.usage,
      proportion: style.color_palette?.proportion,
    },
    production_principles: style.image_treatment || style.photographic_direction,
    pitfalls_to_avoid: style.avoid,
    negative_prompt: style.negative_prompt,
  }

  return JSON.stringify(selected, null, 2)
}
