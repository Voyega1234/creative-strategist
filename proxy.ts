import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { AUTH_ENABLED, getSafeNextPath, isAllowedEmail } from "@/lib/auth"

const PUBLIC_PATHS = ["/login", "/auth", "/shared"]

function isPublicRequest(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPage = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

  return (
    isPublicPage ||
    pathname === "/api/generate-ideas/callback" ||
    (pathname === "/api/share-ideas" && request.method === "GET") ||
    (pathname === "/api/facebook-post" && request.method === "POST")
  )
}

export async function proxy(request: NextRequest) {
  if (!AUTH_ENABLED) {
    if (request.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url))
    }

    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value)
          )
        },
      },
    }
  )

  const { data: claimsData } = await supabase.auth.getClaims()
  const email =
    typeof claimsData?.claims.email === "string" ? claimsData.claims.email : null
  const isAuthorized = isAllowedEmail(email)
  const { pathname, search } = request.nextUrl

  if (!isPublicRequest(request) && !isAuthorized) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    loginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === "/login" && isAuthorized) {
    const next = getSafeNextPath(request.nextUrl.searchParams.get("next"))
    return NextResponse.redirect(new URL(next, request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
}
