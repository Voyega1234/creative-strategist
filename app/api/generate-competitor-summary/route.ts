import { NextRequest, NextResponse } from 'next/server'
import { getCompetitors } from '@/lib/data/competitors'
import { getSupabase } from '@/lib/supabase/server'
import { vertexGenerateContent } from '@/lib/google/vertex-ai'

// Helper function to call Gemini API
async function callGeminiAPI(prompt: string) {
  const response = await vertexGenerateContent('gemini-2.5-flash', {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: { temperature: 0.7 }
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const result = await response.json()
  return result.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, productFocus, clientName } = await request.json()
    
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    // Get competitor data
    const { data: competitors } = await getCompetitors(clientId)
    
    if (!competitors || competitors.length === 0) {
      return NextResponse.json({ error: 'No competitor data found' }, { status: 404 })
    }

    // Format competitor data for the prompt
    const competitorSummary = competitors.map(competitor => {
      return `**${competitor.name}**
` +
        `- บริการ: ${competitor.services || 'N/A'}
` +
        `- ราคา: ${competitor.pricing || 'N/A'}
` +
        `- จุดแข็ง: ${competitor.strengths || 'N/A'}
` +
        `- จุดอ่อน: ${competitor.weaknesses || 'N/A'}
` +
        `- กลุ่มเป้าหมาย: ${competitor.targetAudience || 'N/A'}
` +
        `- โทนแบรนด์: ${competitor.brandTone || 'N/A'}
`
    }).join('\n')

    // Create prompt for Gemini
    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านการวิเคราะห์คู่แข่งทางการตลาด กรุณาสร้างสรุปข้อมูลคู่แข่งสำหรับ ${clientName || 'ลูกค้า'} ในธุรกิจ ${productFocus || 'ที่กำหนด'}

ข้อมูลคู่แข่ง:
${competitorSummary}

กรุณาวิเคราะห์และสร้างสรุปในรูปแบบย่อหน้าเดียว โดยครอบคลุมภาพรวมของตลาดและคู่แข่งหลัก จุดแข็งและจุดอ่อนของคู่แข่งโดยรวม ช่องว่างในตลาด (Market Gaps) โอกาสในการสร้างความแตกต่าง และข้อเสนอแนะเชิงกลยุทธ์

ให้ตอบเป็นภาษาไทยในรูปแบบย่อหน้าเดียวที่ต่อเนื่องและอ่านง่าย ไม่ต้องใช้ bullet points หรือหัวข้อย่อย เน้นข้อมูลที่เป็นประโยชน์ต่อการวางแผนกลยุทธ์การตลาด
`

    // Call Gemini API
    const summary = await callGeminiAPI(prompt)
    
    // Save summary to Clients table
    try {
      const supabase = getSupabase()
      await supabase
        .from('Clients')
        .update({
          competitor_summary: summary,
          competitor_summary_generated_at: new Date().toISOString()
        })
        .eq('id', clientId)
    } catch (dbError) {
      console.error('Failed to save summary to database:', dbError)
      // Continue anyway - we can still return the summary
    }
    
    return NextResponse.json({ summary })
    
  } catch (error) {
    console.error('Error generating competitor summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}