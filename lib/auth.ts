export const AUTH_ENABLED = true

export const ALLOWED_EMAIL_DOMAIN = "convertcake.com"

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) return false

  const normalizedEmail = email.trim().toLowerCase()
  const atIndex = normalizedEmail.lastIndexOf("@")

  return atIndex > 0 && normalizedEmail.slice(atIndex + 1) === ALLOWED_EMAIL_DOMAIN
}

export function isGoogleAuthProvider(
  appMetadata: { provider?: unknown; providers?: unknown } | null | undefined
) {
  if (appMetadata?.provider === "google") return true

  return (
    Array.isArray(appMetadata?.providers) &&
    appMetadata.providers.includes("google")
  )
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
