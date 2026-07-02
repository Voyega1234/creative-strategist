export type VisualRoute = {
  route_name: string
  route_type: string
  visual_idea: string
  why_it_fits: string
}

export type IdeaContentType = "STATIC AD" | "UGC VIDEO" | "ALBUM AD" | "MOTION AD"

export type IdeaSelectionStatus = "recommended" | "option" | "empty"

export interface IdeaRecommendation {
  title: string
  description:
    | {
        summary: string
        sections: Array<{
          group: "pain" | "insight_solution" | "why_evidence"
          bullets: string[]
        }>
      }
    | Array<{
        label: "Pain" | "Insight" | "Solution/Product fit" | "Why this converts" | "Evidence/Counterpoint"
        text: string
      }>
    | string
  category: string
  concept_type: "Proven Concept" | "New Concept"
  impact?: "Proven Concept" | "New Concept"
  competitiveGap: string
  tags: string[]
  content_pillar: string
  product_focus: string
  concept_idea: string
  content_type?: IdeaContentType
  visual_routes?: VisualRoute[]
  copywriting: {
    headline: string
    sub_headline_1: string
    sub_headline_2: string
    bullets: string[]
    cta: string
  }
}
