"use client"

import { Suspense, useState, type FormEvent } from "react"
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, Mail } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ALLOWED_EMAIL_DOMAIN, getSafeNextPath, isAllowedEmail } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase/client"

const ERROR_MESSAGES: Record<string, string> = {
  domain: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses can access Creative Compass.`,
  invalid_link: "This sign-in link is invalid or has expired. Please request a new one.",
}

function LoginContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const nextPath = getSafeNextPath(searchParams.get("next"))
  const [error, setError] = useState(
    ERROR_MESSAGES[searchParams.get("error") ?? ""] ?? ""
  )
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()

    if (!isAllowedEmail(normalizedEmail)) {
      setError(`Please use your @${ALLOWED_EMAIL_DOMAIN} email address.`)
      return
    }

    setError("")
    setIsSending(true)

    const callbackUrl = new URL("/auth/callback", window.location.origin)
    callbackUrl.searchParams.set("next", nextPath)

    const { error: signInError } = await getSupabase().auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: true,
      },
    })

    setIsSending(false)

    if (signInError) {
      setError(signInError.message || "We could not send the sign-in link. Please try again.")
      return
    }

    setEmail(normalizedEmail)
    setIsSent(true)
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

          {isSent ? (
            <div aria-live="polite">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">Check your inbox</h2>
              <p className="mt-3 leading-7 text-slate-600">
                We sent a secure sign-in link to <strong className="font-medium text-slate-900">{email}</strong>.
                Open it in this browser to continue.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-7 w-full"
                onClick={() => {
                  setIsSent(false)
                  setError("")
                }}
              >
                Use another email
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</h2>
                <p className="mt-3 leading-7 text-slate-600">
                  Enter your company email and Supabase will send you a passwordless sign-in link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Work email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
                      className="h-11 pl-10"
                      required
                      disabled={isSending}
                      aria-describedby={error ? "login-error" : "email-help"}
                    />
                  </div>
                  <p id="email-help" className="mt-2 text-xs text-slate-500">
                    Only @{ALLOWED_EMAIL_DOMAIN} accounts are allowed.
                  </p>
                </div>

                {error && (
                  <p id="login-error" role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                  disabled={isSending || !email.trim()}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending secure link...
                    </>
                  ) : (
                    <>
                      Email me a sign-in link
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
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
