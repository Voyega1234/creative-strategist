export const MAX_PRODUCT_REFERENCES = 10

export const PHOTOSTOCK_IMAGE_MODELS = [
  "openai/gpt-image-2.5-flare",
  "openai/gpt-image-2.5-sunburst",
] as const

export type PhotostockImageModel = (typeof PHOTOSTOCK_IMAGE_MODELS)[number]

export function isPhotostockImageModel(value: unknown): value is PhotostockImageModel {
  return PHOTOSTOCK_IMAGE_MODELS.some((model) => model === value)
}
