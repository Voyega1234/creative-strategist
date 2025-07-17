import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a value into an array of strings.
 * If the input is a comma-separated string, it splits it into an array.
 * If it's already an array, it returns it as is.
 * Handles null/undefined by returning an empty array.
 */
export function normalizeToArray(data: string | string[] | null | undefined): string[] {
  if (Array.isArray(data)) {
    return data.map((item) => String(item).trim()) // Ensure all items are strings and trimmed
  }
  if (typeof data === "string") {
    return data.split(",").map((item) => item.trim())
  }
  return []
}
