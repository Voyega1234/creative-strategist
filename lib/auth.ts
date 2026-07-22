export const ALLOWED_EMAIL_DOMAIN = "convertcake.com"

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) return false

  const normalizedEmail = email.trim().toLowerCase()
  const atIndex = normalizedEmail.lastIndexOf("@")

  return atIndex > 0 && normalizedEmail.slice(atIndex + 1) === ALLOWED_EMAIL_DOMAIN
}

export function getSafeNextPath(next: string | null | undefined) {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return "/"
  }
  return next
}
