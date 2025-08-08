"use client"

import { RefreshCcw } from "lucide-react"

interface LoadingPopupProps {
  isOpen: boolean
  message?: string
}

export function LoadingPopup({ isOpen, message = "กำลังโหลด..." }: LoadingPopupProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-white/20 max-w-md w-full mx-4 animate-in fade-in-0 duration-300">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Loading Icon */}
          <div className="relative">
            <RefreshCcw className="h-12 w-12 text-[#1d4ed8] animate-spin" />
          </div>
          
          {/* Loading Message */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#000000]">{message}</h3>
            <p className="text-sm text-[#535862]">กำลังเตรียมข้อมูลสำหรับคุณ...</p>
          </div>
        </div>
      </div>
    </div>
  )
}