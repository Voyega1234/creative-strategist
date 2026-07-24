"use client"

import { Suspense, useState } from "react"
import { Loader2, LockKeyhole } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ALLOWED_EMAIL_DOMAIN, getSafeNextPath } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase/client"

const ERROR_MESSAGES: Record<string, string> = {
  domain: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses can access Creative Compass.`,
  provider: "Please sign in with your Convert Cake Google account.",
  invalid_link: "This Google sign-in attempt is invalid or has expired. Please try again.",
  oauth_error: "Google sign-in could not be completed. Please try again.",
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.31.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get("next"))
  const [error, setError] = useState(
    ERROR_MESSAGES[searchParams.get("error") ?? ""] ?? ""
  )
  const [isSigningIn, setIsSigningIn] = useState(false)

  async function handleGoogleSignIn() {
    setError("")
    setIsSigningIn(true)

    const callbackUrl = new URL("/auth/callback", window.location.origin)
    callbackUrl.searchParams.set("next", nextPath)

    const { error: signInError } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          hd: ALLOWED_EMAIL_DOMAIN,
          include_granted_scopes: "true",
          prompt: "select_account",
        },
      },
    })

    if (signInError) {
      setIsSigningIn(false)
      setError(signInError.message || "Google sign-in could not be started. Please try again.")
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#f8fafc]">
      <div
        className="absolute inset-0 hidden bg-cover bg-center lg:block lg:w-1/2"
        style={{
          backgroundImage:
            'url("https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/coolbackgrounds-topography-orleans.svg")',
        }}
      />
      <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-[#0f172a]/80 lg:block" />

      <section className="relative z-10 hidden w-1/2 flex-col justify-between p-12 text-white lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Creative Compass</span>
        </div>

        <div className="max-w-lg">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-blue-200">
            Convert Cake workspace
          </p>
          <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">
            From client research<br />to campaign-ready ideas.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-slate-200">
            Creative Compass helps the Convert Cake team uncover market opportunities, shape creative strategy, and build stronger campaign concepts in one workspace.
          </p>
        </div>

        <p className="text-sm text-slate-300">Restricted to Convert Cake team members</p>
      </section>

      <section className="relative z-10 flex min-h-screen w-full items-center justify-center px-6 py-12 lg:ml-auto lg:w-1/2 lg:px-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="mb-8 lg:hidden">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#1d4ed8]">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <p className="font-semibold text-slate-900">Creative Compass</p>
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Continue with your Convert Cake Google Workspace account.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {error && (
              <p id="login-error" role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              aria-describedby={error ? "login-error" : "google-account-help"}
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to Google...
                </>
              ) : (
                <>
                  <span className="mr-3">
                    <GoogleIcon />
                  </span>
                  Continue with Google
                </>
              )}
            </Button>

            <p id="google-account-help" className="text-center text-xs text-slate-500">
              Only @{ALLOWED_EMAIL_DOMAIN} Google accounts are allowed.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
          <Loader2 className="h-6 w-6 animate-spin text-[#1d4ed8]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
