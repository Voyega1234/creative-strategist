import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getSafeNextPath, isAllowedEmail } from "@/lib/auth"

function setLocation(response: NextResponse, request: NextRequest, path: string) {
  response.headers.set("location", new URL(path, request.url).toString())
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const next = getSafeNextPath(request.nextUrl.searchParams.get("next"))
  const response = NextResponse.redirect(new URL(next, request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
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

  if (!code) {
    setLocation(response, request, "/login?error=invalid_link")
    return response
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    setLocation(response, request, "/login?error=invalid_link")
    return response
  }

  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut()
    setLocation(response, request, "/login?error=domain")
  }

  return response
}
