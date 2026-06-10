"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

const AUTH_STORAGE_KEY = "creative_strategist_auth"
const AUTH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days, matches the login page
// Routes reachable without logging in.
const PUBLIC_PATHS = ["/login", "/shared"]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function hasValidAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return false
    const { authenticated, timestamp } = JSON.parse(raw)
    return (
      Boolean(authenticated) &&
      typeof timestamp === "number" &&
      Date.now() - timestamp < AUTH_MAX_AGE_MS
    )
  } catch {
    return false
  }
}

// Client-side guard: auth lives in localStorage (no server middleware can read it), so we verify
// on mount and redirect unauthenticated users to /login. Public paths render straight through.
export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "allowed">("checking")

  useEffect(() => {
    if (isPublicPath(pathname) || hasValidAuth()) {
      setStatus("allowed")
      return
    }
    setStatus("checking")
    router.replace("/login")
  }, [pathname, router])

  // Public pages never gate (avoids a redirect loop on /login itself).
  if (isPublicPath(pathname)) return <>{children}</>

  if (status !== "allowed") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#667085]">
        กำลังตรวจสอบสิทธิ์...
      </div>
    )
  }

  return <>{children}</>
}
