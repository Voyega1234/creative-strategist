"use client"

import { X } from "lucide-react"

type PendingIdeaNotificationProps = {
  onReplaySound: () => void
  onDismiss: () => void
}

export function PendingIdeaNotification({
  onReplaySound,
  onDismiss,
}: PendingIdeaNotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg border-l-4 border-green-600 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 bg-white rounded-full animate-ping"></div>
        <div>
          <p className="font-medium">🎉 ไอเดียสร้างเสร็จแล้ว!</p>
          <p className="text-sm opacity-90">คลิกแท็บนี้เพื่อดูผลลัพธ์และฟังเสียงแจ้งเตือน</p>
        </div>
        <button
          onClick={() => {
            onReplaySound()
            onDismiss()
          }}
          className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
