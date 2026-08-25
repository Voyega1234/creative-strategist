import { NextResponse } from "next/server"
import {
  createPasswordAccessToken,
  isCorrectAccessPassword,
  PASSWORD_ACCESS_COOKIE,
  PASSWORD_ACCESS_MAX_AGE_SECONDS,
} from "@/lib/password-auth"

export async function POST(request: Request) {
  const accessPassword = process.env.NEXT_ACCESS_KEY
  if (!accessPassword) {
    return NextResponse.json(
      { error: "External access is not configured." },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const password = typeof body?.password === "string" ? body.password : ""

  if (!isCorrectAccessPassword(password, accessPassword)) {
    return NextResponse.json(
      { error: "Incorrect access password." },
      { status: 401 }
    )
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(
    PASSWORD_ACCESS_COOKIE,
    await createPasswordAccessToken(accessPassword),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PASSWORD_ACCESS_MAX_AGE_SECONDS,
    }
  )
  response.headers.set("Cache-Control", "no-store")
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(PASSWORD_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  response.headers.set("Cache-Control", "no-store")
  return response
}
