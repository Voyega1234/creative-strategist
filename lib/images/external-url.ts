const GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com", "drive.usercontent.google.com"])

function withProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export function getGoogleDriveFileId(value: string) {
  try {
    const url = new URL(withProtocol(value.trim()))
    if (!GOOGLE_DRIVE_HOSTS.has(url.hostname.toLowerCase())) return ""

    const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
    return pathMatch?.[1] || url.searchParams.get("id") || ""
  } catch {
    return ""
  }
}

export function normalizeExternalImageUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  try {
    const url = new URL(withProtocol(trimmed))
    if (!["http:", "https:"].includes(url.protocol)) return ""

    const googleDriveFileId = getGoogleDriveFileId(url.toString())
    if (googleDriveFileId) {
      return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(googleDriveFileId)}`
    }

    return url.toString()
  } catch {
    return ""
  }
}
