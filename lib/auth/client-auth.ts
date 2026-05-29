const AUTH_STORAGE_KEY = "creative_strategist_auth"
const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hasValidAuthSession() {
  try {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!authData) {
      return false
    }

    const { timestamp, authenticated } = JSON.parse(authData)
    const isValid = authenticated && Date.now() - timestamp < AUTH_SESSION_TTL_MS

    if (!isValid) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }

    return isValid
  } catch (error) {
    console.error("Error checking auth status:", error)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return false
  }
}

export function saveAuthSession() {
  try {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        authenticated: true,
        timestamp: Date.now(),
      })
    )
  } catch (error) {
    console.error("Error saving auth to localStorage:", error)
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch (error) {
    console.error("Error removing auth from localStorage:", error)
  }
}
