"use client"

import { useCallback, useEffect, useState } from "react"

const NOTIFICATION_SOUND_PATH = "/new-notification-011-364050.mp3"

export function useIdeaNotifications() {
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default")
  const [pendingNotification, setPendingNotification] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission)
        })
      }
    }
  }, [])

  useEffect(() => {
    const initAudio = async () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        setAudioContext(ctx)

        const response = await fetch(NOTIFICATION_SOUND_PATH)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer)
        setAudioBuffer(buffer)

        console.log("✅ Audio system initialized")
      } catch (error) {
        console.error("❌ Failed to initialize audio:", error)
      }
    }

    initAudio()
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && pendingNotification) {
        console.log("🔔 Tab is now visible, clearing pending notification visual indicator")
        setPendingNotification(false)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [pendingNotification])

  useEffect(() => {
    const originalTitle = document.title

    if (pendingNotification) {
      document.title = "🔔 ไอเดียสร้างเสร็จแล้ว! - Creative Compass"

      const flashInterval = setInterval(() => {
        document.title = document.title.startsWith("🔔")
          ? "Creative Compass"
          : "🔔 ไอเดียสร้างเสร็จแล้ว! - Creative Compass"
      }, 1000)

      return () => {
        clearInterval(flashInterval)
        document.title = originalTitle
      }
    }

    document.title = originalTitle
  }, [pendingNotification])

  const playNotificationSoundImmediate = useCallback(async () => {
    try {
      if (audioContext && audioBuffer) {
        if (audioContext.state === "suspended") {
          await audioContext.resume()
          console.log("📢 Audio context resumed")
        }

        const source = audioContext.createBufferSource()
        const gainNode = audioContext.createGain()

        source.buffer = audioBuffer
        gainNode.gain.value = 0.5

        source.connect(gainNode)
        gainNode.connect(audioContext.destination)

        source.start(0)
        console.log("🔊 Notification sound played via Web Audio API")
        return
      }

      const audio = new Audio(NOTIFICATION_SOUND_PATH)
      audio.volume = 0.5
      audio
        .play()
        .then(() => {
          console.log("🔊 Notification sound played via HTML5 Audio")
        })
        .catch((error) => {
          console.error("❌ Could not play notification sound:", error)
        })
    } catch (error) {
      console.error("❌ Could not initialize notification sound:", error)
    }
  }, [audioBuffer, audioContext])

  const playNotificationSound = useCallback(async () => {
    console.log("🔔 Notification triggered, tab hidden:", document.hidden)

    await playNotificationSoundImmediate()

    if (document.hidden) {
      setPendingNotification(true)
      console.log("📝 Audio played immediately, pending notification set for visual feedback")
    } else {
      console.log("🔊 Audio played immediately on visible tab")
    }
  }, [playNotificationSoundImmediate])

  const showNotification = useCallback(
    (title: string, message: string, ideaCount: number) => {
      if (notificationPermission === "granted") {
        const notification = new Notification(title, {
          body: message,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "idea-generation",
          requireInteraction: true,
          data: { ideaCount },
        })

        notification.onclick = () => {
          window.focus()
          notification.close()
          setPendingNotification(false)
        }

        setTimeout(() => notification.close(), 10000)
      }
    },
    [notificationPermission]
  )

  return {
    pendingNotification,
    clearPendingNotification: () => setPendingNotification(false),
    playNotificationSound,
    playNotificationSoundImmediate,
    showNotification,
  }
}
