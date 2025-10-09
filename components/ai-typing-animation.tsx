"use client"

import { useEffect, useState } from "react"
import { Zap } from "lucide-react"

interface AITypingAnimationProps {
  activeClientName: string
}

export function AITypingAnimation({ activeClientName }: AITypingAnimationProps) {
  const [currentText, setCurrentText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showCursor, setShowCursor] = useState(true)

  const messages = [
    "กำลังคิดอะไรสนุกๆ ให้คุณอยู่...",
    "ขอเวลานิดนึง กำลังวอร์มไอเดียอยู่เลย!",
    "กำลังจับคู่ข้อมูลกับแรงบันดาลใจ...",
    "AI กำลังครุ่นคิดอย่างตั้งใจ 😌",
    "ขอเวลาให้สมองกลทำงานนิดนึง...",
    "กำลังเปิดคลังไอเดียลับอยู่!",
    "กำลังค้นหาอะไรที่น่าสนใจมาให้คุณ...",
    "ขอเบรนสตอร์มแป๊บนึงนะ 😄",
    "กำลังสแกนความเป็นไปได้ทั้งหมด...",
    "คิดให้สุดแล้วหยุดที่ความครีเอทีฟ ✨"
  ];
  

  const currentMessage = messages[Math.floor(currentIndex / 40) % messages.length]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => prev + 1)
      
      const messageIndex = Math.floor(currentIndex / 40) % messages.length
      const charIndex = currentIndex % 40
      const targetMessage = messages[messageIndex]
      
      if (charIndex < targetMessage.length) {
        setCurrentText(targetMessage.slice(0, charIndex + 1))
      } else {
        setCurrentText(targetMessage + ".")
      }
    }, 100)

    return () => clearInterval(interval)
  }, [currentIndex, messages])

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)

    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-12 shadow-lg border border-white/20 max-w-2xl w-full">
        {/* Animated Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[#1d4ed8]/10 blur-2xl scale-110 animate-pulse" />
            <div
              className="relative h-[208px] w-[208px] rounded-full overflow-hidden animate-spin"
              style={{ animationDuration: "2.4s" }}
            >
              <img
                src="https://cfislibqbzcquplksmqt.supabase.co/storage/v1/object/public/image-creative-strategist-public/a-minimalist-logo-design-featuring-a-sty_i3vs-y0STaWbGUfO4JyaDw_iMf0MEt0Qq6mW_Qu-aloAg-Photoroom.png"
                alt="AI generating ideas"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Client Name */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-[#000000] mb-2">
            กำลังสร้างไอเดียสำหรับ
          </h2>
          <div className="inline-flex items-center px-4 py-2 bg-[#dbeafe] text-[#063def] rounded-full font-medium mb-3">
            <Zap className="w-4 h-4 mr-2" />
            {activeClientName}
          </div>
          <p className="text-sm text-[#8e8e93] font-medium">
            จะใช้เวลาประมาณ 2-3 นาที
          </p>
        </div>

        {/* Typing Animation */}
        <div className="mb-8">
          <div className="text-lg text-[#535862] font-medium min-h-[1.5rem] flex items-center justify-center">
            <span>{currentText}</span>
            <span className={`ml-1 text-[#1d4ed8] ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
              |
            </span>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center space-x-2">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                (currentIndex + index) % 3 === 0
                  ? 'bg-[#1d4ed8] scale-125'
                  : 'bg-[#e4e7ec]'
              }`}
            />
          ))}
        </div>

        {/* Fun fact or tip */}
        <div className="mt-8 p-4 bg-[#f8fafc] rounded-lg border border-[#e4e7ec]">
          <p className="text-sm text-[#535862] italic">
            💡 เคล็ดลับ: ไอเดียที่ดีที่สุดมักจะมาจากการเข้าใจลูกค้าอย่างลึกซึ้ง
          </p>
        </div>
      </div>
    </div>
  )
}
