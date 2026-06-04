import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const promptCache = new Map()

export async function loadPrompt(name) {
  if (promptCache.has(name)) return promptCache.get(name)

  const filePath = resolve("text-to-image-code/prompts", `${name}.md`)
  const prompt = await readFile(filePath, "utf8")
  promptCache.set(name, prompt)
  return prompt
}

export function renderPrompt(template, values = {}) {
  return Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value ?? "")),
    template,
  )
}
