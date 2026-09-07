import { NextResponse } from 'next/server'

import { openRouterGenerateContent } from '@/lib/openrouter'

export const dynamic = 'force-dynamic'

const OPENROUTER_MODEL = process.env.OPENROUTER_PROMPT_MODEL || 'openai/gpt-5'

function simpleEnhancement(prompt: string): string {
  const trimmed = prompt.trim()
  if (!trimmed) return ''
  return `Refined Prompt (fallback):\n${trimmed}\n\nGuidance: Provide a structured, brand-aligned response with persuasive tone, clear bullet points, and explicit CTA.`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

    if (!prompt) {
      return NextResponse.json({
        success: false,
        error: 'ต้องมีข้อความเพื่อปรับปรุงพรอมป์'
      }, { status: 400 })
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({
        success: true,
        improvedPrompt: simpleEnhancement(prompt),
        warning: 'OPENROUTER_API_KEY ไม่ถูกตั้งค่า ใช้ prompt enhancer ภายในระบบแทน'
      })
    }

    try {
      const response = await openRouterGenerateContent(OPENROUTER_MODEL, {
        systemInstruction: {
          parts: [{
            text: 'You are PromptSmith, an elite prompt engineer. Rewrite the user prompt so it is clearer, more actionable, and optimized for high-quality AI outputs. Return only the improved prompt.'
          }]
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      const rawText = await response.text()
      console.log('[improve-prompt] OpenRouter response status:', response.status)

      if (!response.ok) {
        console.error('[improve-prompt] OpenRouter response error body:', rawText)
        return NextResponse.json({
          success: true,
          improvedPrompt: simpleEnhancement(prompt),
          warning: 'ไม่สามารถเชื่อมต่อ OpenRouter ได้ ใช้ prompt enhancer ภายในระบบแทน'
        })
      }

      let data: any = null
      try {
        data = rawText ? JSON.parse(rawText) : null
      } catch (parseError) {
        console.error('[improve-prompt] Failed to parse OpenRouter response JSON:', parseError)
        return NextResponse.json({
          success: true,
          improvedPrompt: simpleEnhancement(prompt),
          warning: 'ไม่สามารถแปลงผลลัพธ์จาก GPT-5 ได้ ใช้ prompt enhancer ภายในระบบแทน'
        })
      }

      let improved: string | undefined

      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (typeof candidateText === 'string') {
        improved = candidateText.trim()
      }

      if (typeof data?.output_text === 'string') {
        improved = data.output_text.trim()
      }

      if (!improved && Array.isArray(data?.choices) && data.choices.length > 0) {
        const choiceText = data.choices[0]?.output_text
        if (typeof choiceText === 'string') {
          improved = choiceText.trim()
        }
      }

      if (!improved && Array.isArray(data?.output)) {
        for (const item of data.output) {
          if (item?.type === 'message' && Array.isArray(item.content)) {
            const entry = item.content.find((c: any) => typeof c?.text === 'string')
            if (entry?.text) {
              improved = entry.text.trim()
              if (improved) break
            }
          }
        }
      }

      if (!improved) {
        console.warn('[improve-prompt] OpenRouter returned no improved text. Full payload:', data)
        return NextResponse.json({
          success: true,
          improvedPrompt: simpleEnhancement(prompt),
          warning: 'ไม่ได้รับคำตอบจาก OpenRouter ใช้ prompt enhancer ภายในระบบแทน'
        })
      }

      return NextResponse.json({
        success: true,
        improvedPrompt: improved
      })
    } catch (apiError) {
      console.error('[improve-prompt] OpenRouter API error:', apiError)
      return NextResponse.json({
        success: true,
        improvedPrompt: simpleEnhancement(prompt),
        warning: 'เกิดข้อผิดพลาดขณะเรียก OpenRouter ใช้ prompt enhancer ภายในระบบแทน'
      })
    }
  } catch (error) {
    console.error('[improve-prompt] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'ไม่สามารถปรับปรุงพรอมป์ได้ในขณะนี้'
    }, { status: 500 })
  }
}
