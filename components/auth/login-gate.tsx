"use client"

import type { FormEvent } from "react"
import { Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type LoginGateProps = {
  isCheckingAuth: boolean
  password: string
  passwordError: string
  showPassword: boolean
  isAuthenticating: boolean
  onPasswordChange: (password: string) => void
  onShowPasswordChange: (showPassword: boolean) => void
  onLogin: (event: FormEvent) => void
}

export function LoginGate({
  isCheckingAuth,
  password,
  passwordError,
  showPassword,
  isAuthenticating,
  onPasswordChange,
  onShowPasswordChange,
  onLogin,
}: LoginGateProps) {
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1d4ed8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#8e8e93]">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-white relative animate-in fade-in-0 duration-500">
      <div className="flex w-full relative z-10">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'url("https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/coolbackgrounds-topography-orleans.svg")',
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-[#0f172a]/70" />

          <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
            <div className="mb-8">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold mb-4 leading-tight">
                Creative Compass<br />Dashboard
              </h1>
              <p className="text-xl text-white/90 leading-relaxed">
                เข้าสู่ระบบเพื่อเริ่มสร้างไอเดียคอนเทนต์และวิเคราะห์คู่แข่ง
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">การสร้างไอเดียคอนเทนต์ด้วย AI</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">การวิเคราะห์คู่แข่งเชิงลึก</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">การค้นหารูปภาพอ้างอิง</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-white/90">การจัดการข้อมูลลูกค้า</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="lg:hidden w-12 h-12 bg-[#dbeafe] rounded-xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-[#1d4ed8]" />
              </div>
              <h2 className="text-3xl font-bold text-[#535862] mb-2">เข้าสู่ระบบ</h2>
              <p className="text-[#8e8e93]">กรุณาใส่รหัสผ่านเพื่อเข้าสู่ Creative Compass</p>
            </div>

            <form onSubmit={onLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#535862] mb-2">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="ใส่รหัสผ่าน"
                    className="pr-10 border-[#d1d1d6] focus:border-[#1d4ed8] focus:ring-0"
                    required
                    disabled={isAuthenticating}
                  />
                  <button
                    type="button"
                    onClick={() => onShowPasswordChange(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8e8e93] hover:text-[#535862]"
                    disabled={isAuthenticating}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordError && <p className="text-red-500 text-sm mt-2">{passwordError}</p>}
              </div>

              <Button
                type="submit"
                disabled={isAuthenticating || !password.trim()}
                className="w-full bg-[#1d4ed8] hover:bg-[#063def] text-white py-3 rounded-lg font-medium transition-colors"
              >
                {isAuthenticating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    กำลังตรวจสอบ...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    เข้าสู่ระบบ
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
