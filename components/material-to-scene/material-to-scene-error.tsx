"use client"

import { Card } from "@/components/ui/card"

interface MaterialToSceneErrorProps {
  message: string | null
}

export function MaterialToSceneError({ message }: MaterialToSceneErrorProps) {
  if (!message) return null

  return (
    <Card className="rounded-[24px] border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
      {message}
    </Card>
  )
}
