import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY

// Helper function to call Gemini API with Google Grounding Search
async function callGeminiWithGrounding(prompt: string, apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      tools: [{
        google_search: {}
      }],
      generationConfig: { 
        response_mime_type: "application/json",
        temperature: 0.7 
      }
    })
  })
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }
  
  const result = await response.json()
  return result.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// Helper function to clean and parse JSON from Gemini response
function cleanAndParseJSON(text: string): any {
  try {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new Error('No valid text content returned')
    }
    
    // Remove markdown code blocks if present
    let cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')
    
    // Try to find JSON object in the text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]
    }
    
    // Fix common JSON issues
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
    
    const parsedJson = JSON.parse(cleaned)
    
    // Basic validation
    if (!parsedJson || typeof parsedJson !== 'object') {
      throw new Error('Invalid JSON structure received')
    }
    
    return parsedJson
  } catch (e) {
    console.error('Failed to parse JSON:', text, 'Error:', e)
    throw new Error(`JSON parsing error: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, clientName, productFocus, competitorName, competitorWebsite, competitorDescription } = await request.json()
    
    if (!clientId || !competitorName) {
      return NextResponse.json({ error: 'Client ID and competitor name are required' }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    // Create comprehensive research prompt
    const researchPrompt = `
You are a market research expert. Please research and analyze the competitor "${competitorName}" for client "${clientName}" in the ${productFocus || 'business'} industry.

${competitorWebsite ? `Competitor Website: ${competitorWebsite}` : ''}
${competitorDescription ? `Additional Context: ${competitorDescription}` : ''}

Use Google Search to find the most current information about this competitor. Research thoroughly and provide a comprehensive analysis in the following JSON format:

{
  "name": "${competitorName}",
  "website": "competitor website URL",
  "facebookUrl": "Facebook page URL if found",
  "services": ["service 1", "service 2", "service 3"],
  "serviceCategories": ["category 1", "category 2"],
  "features": ["feature 1", "feature 2", "feature 3"],
  "pricing": "pricing information or pricing model",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "specialty": "main specialty or unique selling point",
  "targetAudience": "target customer description",
  "brandTone": "brand personality and communication style",
  "positivePerception": "positive customer feedback or reputation",
  "negativePerception": "negative feedback or challenges",
  "adThemes": ["advertising theme 1", "advertising theme 2"],
  "usp": "unique selling proposition"
}

IMPORTANT:
- Use Google Search to find current, accurate information
- Focus on factual data from reliable sources
- If specific information is not available, use null for strings/objects or empty arrays [] for arrays
- Return ONLY valid JSON, no additional text, explanations, or markdown formatting
- The response must start with { and end with }
- Ensure proper JSON syntax with double quotes for keys and strings
- Search for recent information about their marketing, services, and market position
`

    // Call Gemini with Google Grounding Search
    console.log(`[add-competitor] Researching ${competitorName} using Gemini with Google Grounding...`)
    const geminiResponse = await callGeminiWithGrounding(researchPrompt, GEMINI_API_KEY)
    
    if (!geminiResponse || typeof geminiResponse !== 'string') {
      console.error('[add-competitor] Invalid Gemini response:', geminiResponse)
      throw new Error('No valid response from Gemini API')
    }
    
    console.log(`[add-competitor] Received Gemini response (length: ${geminiResponse.length})`)
    console.log(`[add-competitor] First 200 chars of response:`, geminiResponse.substring(0, 200))

    // Parse the JSON response
    let competitorData
    try {
      competitorData = cleanAndParseJSON(geminiResponse)
    } catch (parseError) {
      console.error('[add-competitor] Gemini response parsing failed:', parseError)
      console.error('[add-competitor] Raw Gemini response:', geminiResponse)
      throw new Error(`Failed to parse competitor data: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`)
    }
    
    if (!competitorData) {
      throw new Error('Failed to parse competitor data from Gemini response')
    }

    // Generate unique ID for the competitor
    const competitorId = uuidv4()
    
    // Prepare data for database insertion (matching Competitor table structure)
    const competitorRecord = {
      id: competitorId,
      analysisRunId: clientId,
      name: competitorData.name || competitorName,
      website: competitorData.website || competitorWebsite || null,
      facebookUrl: competitorData.facebookUrl || null,
      services: Array.isArray(competitorData.services) ? competitorData.services.join(', ') : (competitorData.services || null),
      serviceCategories: Array.isArray(competitorData.serviceCategories) ? competitorData.serviceCategories.join(', ') : (competitorData.serviceCategories || null),
      features: Array.isArray(competitorData.features) ? competitorData.features.join(', ') : (competitorData.features || null),
      pricing: competitorData.pricing || null,
      strengths: Array.isArray(competitorData.strengths) ? competitorData.strengths.join(', ') : (competitorData.strengths || null),
      weaknesses: Array.isArray(competitorData.weaknesses) ? competitorData.weaknesses.join(', ') : (competitorData.weaknesses || null),
      specialty: competitorData.specialty || null,
      targetAudience: competitorData.targetAudience || null,
      brandTone: competitorData.brandTone || null,
      positivePerception: competitorData.positivePerception || null,
      negativePerception: competitorData.negativePerception || null,
      adThemes: Array.isArray(competitorData.adThemes) ? competitorData.adThemes.join(', ') : (competitorData.adThemes || null)
    }
    
    console.log(`[add-competitor] Prepared competitor record:`, JSON.stringify(competitorRecord, null, 2))

    // Save to database
    const supabase = getSupabase()
    const { error } = await supabase
      .from('Competitor')
      .insert([competitorRecord])

    if (error) {
      console.error('Database error:', error)
      throw new Error('Failed to save competitor to database')
    }

    console.log(`[add-competitor] Successfully added competitor: ${competitorName}`)
    
    return NextResponse.json({ 
      success: true, 
      competitor: competitorRecord 
    })
    
  } catch (error) {
    console.error('Error adding competitor:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add competitor' },
      { status: 500 }
    )
  }
}