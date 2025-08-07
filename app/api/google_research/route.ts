import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server'; // Import Supabase client

// --- Environment Variables ---
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

// Define a basic Competitor type matching Supabase table structure
interface Competitor {
  id: string;
  analysisRunId: string;
  name?: string | null;
  services?: string[] | null;
  pricing?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  targetAudience?: string | null;
  adThemes?: string[] | null;
  usp?: string | null;
  brandTone?: string | null;
  positivePerception?: string | null;
  negativePerception?: string | null;
}

// Helper function to call Gemini API via HTTP POST
async function callGeminiAPI(prompt: string, apiKey: string, model: string = "gemini-2.5-flash", useGrounding: boolean = true) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    let body: any = {
        contents: [
            {   
                parts: [
                    { text: prompt }
                ]
            }
        ],
        generationConfig: { temperature: 1.0 }
    };
    
    // Add Google Search grounding if requested
    if (useGrounding) {
        body.tools = [
            {
                google_search: {}
            }
        ];
        console.log("Using Google grounding search for Gemini API call");
    }
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log("Gemini API response grounding chunks:", result.candidates?.[0]?.groundingMetadata?.groundingChunks);
    // Extract the model's response text
    // Extract text and groundingChunks
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text, groundingChunks };
}

// Helper function to clean Gemini response of code blocks and other formatting
function cleanGeminiResponse(text: string): string {
    // Remove markdown code block formatting if present
    if (text.startsWith('```json') || text.startsWith('```')) {
        return text
            .replace(/^```json\n/, '')
            .replace(/^```\n/, '')
            .replace(/\n```$/, '')
            .trim();
    }
    
    // Try to extract JSON if there's text before the JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/); 
    if (jsonMatch) {
        return jsonMatch[0].trim();
    }
    
    return text.trim();
}

// Helper function to robustly parse JSON from Gemini (fixes trailing commas, logs on error)
function tryParseJSON(text: string): any {
    try {
        return JSON.parse(text);
    } catch (e) {
        // Try to fix common issues (e.g., trailing commas)
        const fixed = text
            .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
            .replace(/\n/g, ' '); // Remove newlines if needed
        try {
            return JSON.parse(fixed);
        } catch (e2) {
            console.error('[Gemini JSON parse error] Raw text:', text);
            return { error: "Invalid JSON", raw: text };
        }
    }
}

// Function to fetch market trends and news using Google Grounding Search
async function fetchMarketTrendsWithGrounding(clientName: string, competitors: Competitor[] = [], productFocus?: string): Promise<any> {
    if (!GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY environment variable");
    }
    
    // If no competitors provided, query the database directly for any competitors related to this client
    let competitorInfo = 'ไม่มีข้อมูลคู่แข่งที่ชัดเจน';
    
    if (!competitors || competitors.length === 0) {
        try {
            console.log(`No competitors provided to fetchMarketTrendsWithGrounding, querying database for ${clientName}`);
            
            // Find all analysis runs for this client
            const { data: analysisRuns } = await getSupabase()
                .from('Clients')
                .select('id')
                .eq('clientName', clientName);
                
            if (analysisRuns && analysisRuns.length > 0) {
                const runIds = analysisRuns.map(run => run.id);
                
                // Find all competitors across these runs
                const { data: dbCompetitors } = await getSupabase()
                    .from('Competitor')
                    .select('*')
                    .in('analysisRunId', runIds);
                    
                if (dbCompetitors && dbCompetitors.length > 0) {
                    competitors = dbCompetitors;
                    console.log(`Found ${dbCompetitors.length} competitors in database for ${clientName}`);
                }
            }
        } catch (error) {
            console.error("Error fetching competitors from database:", error);
            // Continue with empty competitors list
        }
    }
    
    // Extract competitor names for the prompt
    const competitorNames = competitors
        .filter(comp => comp.name) // Filter out null or undefined names
        .map(comp => comp.name)
        .join(', ');
    
    if (competitorNames) {
        competitorInfo = `คู่แข่งที่สำคัญได้แก่: ${competitorNames}`;
    }

    // Thai prompt for market trends and news search with competitor information
    const prompt = `ช่วยหาข้อมูล, ข่าว หรือเทรนกระแสที่เกี่ยวข้องกับประเภทของธุรกิจ ${clientName} ในไทย
    พยายามหาข้อมูลที่ล่าสุด ณ วันที่ ${Date.now()} 
    ขออย่างน้อย 20-30 Useful bullet data
    * เข้าใจธุรกิจหรือสินค้าโดยเปรียบเสมือนเราเป็นผู้ใช้งานหรือลูกค้าจริงๆ คัดสรรมาแค่ข้อมูลสำคัญ
    * รู้ข้อมูลพื้นฐานเกี่ยวกับธุรกิจหรือสินค้า เช่น ราคา ค่าธรรมเนียม โปรโมชั่นล่าสุด ฟีเจอร์สำคัญ
    * หาข่าวสดรายวันทั่วไปที่เกี่ยวข้องกับแวดวงธุรกิจของ ${clientName} ที่สามารถคิดไอเดียใหม่ๆ หรือข้อเสนอแนะใหม่ๆ อาจจะเอามาจาก Facebook, Pantip, Social Medias ณ วันที่ ${Date.now()}
    อยากได้ข้อมูลในหลายแง่มุมมากที่สุด เพื่อให้สามารถผลิตข้อมูลที่มีคุณภาพและครบถ้วน ทุกข้อมูลควรมีตัวเลขรองรับถ้าเป็นไปได้
    สำคัญมาก ไม่ต้องมีข้อความแนะนำหรือคำอธิบายใดๆ ไม่ต้องมีหัวข้อหรือ Bold text ที่ไม่ใช่ JSON
    ไม่ต้องเริ่มต้นด้วยคำว่า \"แน่นอนครับ\" หรือข้อความอื่นๆ ให้ส่งเฉพาะโครงสร้าง JSON นี้เท่านั้น ตอบเป็นภาษาไทย:
{
  "research": ["ข้อมูลงานวิจัย 1", "ข้อมูลงานวิจัย 2", "ข้อมูลงานวิจัย 3", ...] // ทำไมต้อง ${clientName} ?, วิเคราะห์ ${clientName} และจุดแข็งที่แตกต่างจากคู่แข่ง ผลการค้นหาที่เกี่ยวข้องกับธุรกิจและคู่แข่ง รวมทั้งข่าวล่าสุด, เทรนด์ตลาด, และโอกาสทางธุรกิจ
}`;

    // Thai prompt for news search only (latest headlines and summaries from trusted sources)
    const newsPrompt = `ขอข่าวสารล่าสุดที่เกี่ยวข้องกับธุรกิจของ ${clientName} หรือ ${competitorInfo} หรือสินค้าประเภท ${productFocus || ''} โดยจะนำข่าวเหล่านี้ไปใช้สำหรับการสร้างคอนเทนต์โฆษณา
ขอเพียงหัวข้อข่าวและสรุปเนื้อหาสั้น ๆ ที่เกิดขึ้นภายในประเทศไทย เอาข้อมูลมาจากข่าวไทยรัฐ หรือ สำนักข่าวที่น่าเชื่อถืออื่นๆเท่านั้น ขออย่างน้อย 10 ข่าว โดยเป็นข่าวล่าสุด ณ วันที่ ${Date.now()} อยากได้แนวข่าวสดข่าวประชาชนทั่วไปที่คนให้ความสนใจหรือเทรนที่กำลังฮิต
สำคัญมาก ส่งเฉพาะ JSON นี้เท่านั้น ห้ามมีข้อความอื่น:
{
  "research": ["หัวข้อข่าว 1: สรุปแบบรายละเอียดครบถ้วน", "หัวข้อข่าว 2: สรุปแบบรายละเอียดครบถ้วน", ...]
}`;

    // Make two separate Gemini API calls: one for market trends, one for news
    try {
        // 1. Market Trends
        console.log(`[API /competitor-analysis] Calling Gemini with Google Grounding Search for ${clientName} market trends...`);
        const trendsResult = await callGeminiAPI(prompt, GEMINI_API_KEY, "gemini-2.5-flash", true);
        let cleanedTrends = trendsResult.text ? cleanGeminiResponse(trendsResult.text) : '';
        let trendsGroundingMetadata = { groundingChunks: trendsResult.groundingChunks };
        let trendsRawGemini = trendsResult;
        let marketTrendsParsed: any = null;
        try {
            marketTrendsParsed = tryParseJSON(cleanedTrends);
        } catch (e) {
            console.error("[API /competitor-analysis] Failed to parse market trends JSON (even after fix):", e);
            marketTrendsParsed = { error: "Market trends response was not valid JSON", research: [] };
        }

        // 2. News Insights
        console.log(`[API /competitor-analysis] Calling Gemini for news insights for ${clientName}...`);
        const newsResult = await callGeminiAPI(newsPrompt, GEMINI_API_KEY, "gemini-2.5-flash", true);
        let cleanedNews = newsResult.text ? cleanGeminiResponse(newsResult.text) : '';
        let newsGroundingMetadata = { groundingChunks: newsResult.groundingChunks };
        let newsRawGemini = newsResult;
        let newsParsed: any = null;
        try {
            newsParsed = tryParseJSON(cleanedNews);
        } catch (e) {
            console.error("[API /competitor-analysis] Failed to parse news insights JSON (even after fix):", e);
            newsParsed = { error: "News insights response was not valid JSON", research: [] };
        }

        // Combine research arrays from both sources
        const combinedResearch = [
            ...(marketTrendsParsed?.research || []),
            ...(newsParsed?.research || [])
        ];

        // Return both results, plus combined research
        return {
            market_trends: marketTrendsParsed,
            market_trends_grounding: trendsGroundingMetadata,
            market_trends_gemini_raw: trendsRawGemini,
            news_insights: newsParsed,
            news_insights_grounding: newsGroundingMetadata,
            news_insights_gemini_raw: newsRawGemini,
            research: combinedResearch,
        };
    } catch (error) {
        console.error("[API /competitor-analysis] Error calling Gemini with Grounding Search or News:", error);
        throw new Error("Failed to fetch market trends or news via Google Grounding Search.");
    }
}

// Function to generate detailed analysis of competitors and their marketing strategies
async function analyzeCompetitorsWithGemini(competitors: Competitor[], clientName: string): Promise<any> {
    if (!competitors || competitors.length === 0) {
        return { error: "No competitor data available." };
    }

    if (!GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY environment variable");
    }

    // Format competitor data for Gemini
    const competitorData = competitors.map(comp => {
        return {
            name: comp.name || 'Unnamed Competitor',
            services: comp.services || [],
            pricing: comp.pricing || 'N/A',
            strengths: comp.strengths || [],
            weaknesses: comp.weaknesses || [],
            targetAudience: comp.targetAudience || 'N/A',
            adThemes: comp.adThemes || [],
            usp: comp.usp || 'N/A',
            brandTone: comp.brandTone || 'N/A',
            positivePerception: comp.positivePerception || 'N/A',
            negativePerception: comp.negativePerception || 'N/A'
        };
    });

    // Ask Gemini for JSON output with clear structure for UI rendering (in Thai) - FOCUS ON CLIENT
    const prompt = `
คุณเป็นผู้เชี่ยวชาญด้านกลยุทธ์การตลาดไทย โปรดทำการวิเคราะห์ SWOT สำหรับ ${clientName} โดยใช้เฉพาะข้อมูลคู่แข่งที่ให้มาเป็นบริบท:

รายชื่อคู่แข่งที่ต้องวิเคราะห์:
${JSON.stringify(competitorData, null, 2)}

**ข้อกำหนดสำคัญ:**
1. วิเคราะห์เฉพาะ ${clientName} เป็นหลัก
2. ใช้เฉพาะข้อมูลคู่แข่งที่ระบุไว้ข้างต้นเท่านั้น ห้ามเพิ่มคู่แข่งอื่นๆ
3. ตอบเป็นภาษาไทยทั้งหมด สามารถมีคำทับศัพท์ได้
4. เปรียบเทียบ ${clientName} กับคู่แข่งที่มีในรายการเท่านั้น
5. เน้นเนื้อหากระชับ ได้ใจความ ไม่ยาวจนเกินไป

ต้องการผลลัพธ์เป็น JSON ที่ถูกต้องตามโครงสร้างต่อไปนี้:

{
  "strengths": ["จุดแข็งของ ${clientName} เป็นภาษาไทย", "จุดแข็งอื่นๆ เป็นภาษาไทย"],
  "weaknesses": ["จุดอ่อนของ ${clientName} เป็นภาษาไทย", "จุดอ่อนอื่นๆ เป็นภาษาไทย"],
  "shared_patterns": ["อุปสรรคของ ${clientName} เป็นภาษาไทย", "อุปสรรคอื่นๆ เป็นภาษาไทย"],
  "market_gaps": ["โอกาสของ ${clientName} เป็นภาษาไทย", "โอกาสอื่นๆ เป็นภาษาไทย"],
  "differentiation_strategies": ["กลยุทธ์ของ ${clientName} เป็นภาษาไทย", "กลยุทธ์อื่นๆ เป็นภาษาไทย"],
  "summary": "บทสรุปการวิเคราะห์ SWOT ของ ${clientName} เป็นภาษาไทยทั้งหมด"
}

**คำเตือน:**
- ตอบเป็นภาษาไทยเท่านั้น
- ห้ามใช้ข้อมูลคู่แข่งอื่นๆ ที่ไม่ได้ระบุไว้
- ส่งเฉพาะ JSON ไม่ต้องมีคำอธิบายเพิ่มเติม
- ห้ามใส่ markdown หรือ code block ใดๆ`;

    try {
        console.log("[API /competitor-analysis] Calling Gemini for competitor analysis via HTTP API...");
        const geminiResult = await callGeminiAPI(prompt, GEMINI_API_KEY, "gemini-2.5-flash");
        // Use new return shape: { text, groundingChunks }
        let cleanedText = geminiResult.text ? cleanGeminiResponse(geminiResult.text) : '';
        let groundingMetadata = { groundingChunks: geminiResult.groundingChunks };
        let rawGemini = geminiResult;
        // No need to extract from candidates/content anymore
        
        // Try to parse JSON
        try {
            // Get market trends with grounding search in parallel
            const marketTrends = await fetchMarketTrendsWithGrounding(clientName, competitors);
            
            // Parse the competitor analysis from Gemini
            const competitorAnalysis = tryParseJSON(cleanedText);
            
            // Combine the results
            const combinedResults = {
                ...competitorAnalysis,
                research: marketTrends.research || [],
                // Forward grounding metadata from marketTrends if present
                groundingMetadata: marketTrends.groundingMetadata || marketTrends.geminiRaw?.candidates?.[0]?.groundingMetadata,
                geminiRaw: marketTrends.geminiRaw,
                // Also include the full market_trends and news_insights for reference if needed
                news_insights: marketTrends.news_insights,
            };

            // Auto-save the analysis data to research_market table
            // We need to get productFocus from the request or analysis run
            let productFocus = 'N/A';
            try {
                const { data: analysisRun } = await getSupabase()
                    .from('Clients')
                    .select('productFocus')
                    .eq('clientName', clientName)
                    .limit(1)
                    .single();
                productFocus = analysisRun?.productFocus || 'N/A';
            } catch (e) {
                console.log('[analyzeCompetitorsWithGemini] Could not get productFocus from Clients');
            }
            
            await saveAnalysisToDatabase(clientName, productFocus, combinedResults);
            
            return combinedResults;
        } catch (e) {
            // fallback: return as string if not valid JSON
            return { error: "Gemini response was not valid JSON", raw: geminiResult, groundingMetadata, geminiRaw: rawGemini };
        }
    } catch (error) {
        console.error("[API /competitor-analysis] Error calling Gemini:", error);
        throw new Error("Failed to generate competitor analysis via Gemini.");
    }
}

// --- Helper: Find Clients and Competitors ---
async function findCompetitors(clientName: string, productFocus?: string, runId?: string) {
    // If runId is provided, use it directly
    if (runId) {
        const { data: competitorsData, error: competitorError } = await getSupabase()
            .from('Competitor')
            .select('*')
            .eq('analysisRunId', runId);
        if (competitorError) throw new Error(competitorError.message || 'Failed to fetch competitor data');
        return { competitorsData, analysisRunId: runId };
    }
    // Try to find Clients by clientName and productFocus (with trailing comma fallback)
    let { data: analysisRunRows, error: analysisRunError } = await getSupabase()
        .from('Clients')
        .select('id')
        .eq('clientName', clientName)
        .eq('productFocus', productFocus)
        .limit(1);
    if ((!analysisRunRows || analysisRunRows.length === 0) && productFocus) {
        ({ data: analysisRunRows, error: analysisRunError } = await getSupabase()
            .from('Clients')
            .select('id')
            .eq('clientName', clientName)
            .eq('productFocus', `${productFocus},`)
            .limit(1));
    }
    if (analysisRunError) throw new Error(analysisRunError.message || 'Failed to fetch analysis run');
    if (!analysisRunRows || analysisRunRows.length === 0) return { competitorsData: null, analysisRunId: null };
    const analysisRunId = analysisRunRows[0].id;
    // Query Competitor table by analysisRunId
    let { data: competitorsData, error: competitorError } = await getSupabase()
        .from('Competitor')
        .select('*')
        .eq('analysisRunId', analysisRunId);
    if (competitorError) throw new Error(competitorError.message || 'Failed to fetch competitor data');
    // If no competitors found, try all runs for this client
    if (!competitorsData || competitorsData.length === 0) {
        const { data: allClientRuns, error: clientRunsError } = await getSupabase()
            .from('Clients')
            .select('id')
            .eq('clientName', clientName);
        if (!clientRunsError && allClientRuns && allClientRuns.length > 0) {
            const allRunIds = allClientRuns.map(run => run.id);
            ({ data: competitorsData, error: competitorError } = await getSupabase()
                .from('Competitor')
                .select('*')
                .in('analysisRunId', allRunIds));
            if (competitorError) throw new Error(competitorError.message || 'Failed to fetch competitor data');
        }
    }
    return { competitorsData, analysisRunId };
}

// --- Helper: Save Analysis to Database ---
async function saveAnalysisToDatabase(clientName: string, productFocus: string, analysisData: any) {
    try {
        const supabase = getSupabase();
        
        // Structure the data for the research_market table
        const dataToSave = {
            analysis: {
                strengths: analysisData.strengths || [],
                weaknesses: analysisData.weaknesses || [],
                shared_patterns: analysisData.shared_patterns || [],
                market_gaps: analysisData.market_gaps || [],
                differentiation_strategies: analysisData.differentiation_strategies || [],
                summary: analysisData.summary || '',
                research: analysisData.research || []
            },
            news_insights: analysisData.news_insights || {},
            groundingMetadata: analysisData.groundingMetadata || {}
        };

        console.log(`[saveAnalysisToDatabase] Saving analysis for ${clientName} - ${productFocus}`);
        console.log(`[saveAnalysisToDatabase] Data structure:`, JSON.stringify(dataToSave, null, 2).substring(0, 200) + '...');

        // Delete existing analysis for this client+product
        await supabase
            .from('research_market')
            .delete()
            .eq('client_name', clientName)
            .eq('product_focus', productFocus);

        // Insert new analysis
        const { error } = await supabase
            .from('research_market')
            .insert([{
                client_name: clientName,
                product_focus: productFocus,
                analysis_data: dataToSave
            }]);

        if (error) {
            console.error('[saveAnalysisToDatabase] Error saving to database:', error);
        } else {
            console.log(`[saveAnalysisToDatabase] Successfully saved analysis for ${clientName} - ${productFocus}`);
        }
    } catch (error) {
        console.error('[saveAnalysisToDatabase] Error:', error);
    }
}

// --- Helper: Direct Gemini Analysis Fallback ---
async function directGeminiAnalysis(clientName: string, productFocus: string) {
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY environment variable");
    const directAnalysisPrompt = `
As an expert marketing analyst, I need a detailed analysis of competitors for ${clientName} in the ${productFocus} space.

I need your analysis in JSON format for direct parsing by my application.
Return ONLY the following JSON structure with no markdown formatting, no code blocks, no backticks, and no explanatory text:

{
  "strengths": ["..."], // Key strengths of competitors in this market
  "weaknesses": ["..."], // Key weaknesses of competitors in this market
  "shared_patterns": ["..."], // Shared marketing patterns or themes
  "market_gaps": ["..."], // Market gaps or unmet needs
  "differentiation_strategies": ["..."], // Actionable differentiation strategies for content and brand positioning
  "summary": "..." // One-paragraph summary of the competitive landscape
}

IMPORTANT: Your response must be valid, parseable JSON. Do not include any text outside the JSON object. Do not wrap the JSON in code blocks or backticks. Please give me the right json syntax am begging you`;
    const analysisText = await callGeminiAPI(directAnalysisPrompt, GEMINI_API_KEY, "gemini-2.5-flash");
    const cleanedText = cleanGeminiResponse(typeof analysisText === 'object' && analysisText !== null && 'text' in analysisText ? analysisText.text : analysisText);
    try {
        const analysis = tryParseJSON(cleanedText);
        const marketTrends = await fetchMarketTrendsWithGrounding(clientName);
        const combinedResults = { ...analysis, research: marketTrends.research || [] };
        
        // Auto-save the analysis data to research_market table
        await saveAnalysisToDatabase(clientName, productFocus, combinedResults);
        
        return combinedResults;
    } catch (e) {
        return {
            error: "Gemini response was not valid JSON",
            strengths: ["No data available"],
            weaknesses: ["No data available"],
            shared_patterns: ["No data available"],
            market_gaps: ["No data available"],
            differentiation_strategies: ["No data available"],
            summary: "No data available",
            research: ["No data available"]
        };
    }
}

// --- Helper: Standard Error Response ---
function standardErrorResponse(errorMessage: string) {
    return {
        error: errorMessage,
        strengths: ["No data available due to server error"],
        weaknesses: ["No data available due to server error"],
        shared_patterns: ["No data available due to server error"],
        market_gaps: ["No data available due to server error"],
        differentiation_strategies: ["No data available due to server error"],
        summary: "No competitor data available due to server error.",
        research: ["No data available due to server error"]
    };
}

// --- REFACTORED GET HANDLER ---
export async function GET(request: NextRequest) {
    console.log("[API /competitor-analysis] GET request received");
    const searchParams = request.nextUrl.searchParams;
    const clientName = searchParams.get('clientName');
    const productFocus = searchParams.get('productFocus');
    if (!clientName || !productFocus) {
        return new NextResponse(JSON.stringify({ error: 'Both clientName and productFocus query parameters are required' }), { status: 400 });
    }
    try {
        const { competitorsData } = await findCompetitors(clientName, productFocus);
        if (competitorsData && competitorsData.length > 0) {
            const analysis = await analyzeCompetitorsWithGemini(competitorsData, clientName);
            return NextResponse.json({ analysis, competitors: competitorsData, isJson: !analysis.error });
        } else {
            const analysis = await directGeminiAnalysis(clientName, productFocus);
            return NextResponse.json(analysis);
        }
    } catch (error) {
        let errorMessage = "Unknown error";
        if (error instanceof Error) errorMessage = error.message;
        return new NextResponse(JSON.stringify(standardErrorResponse(errorMessage)), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// --- REFACTORED POST HANDLER ---
export async function POST(request: NextRequest) {
    console.log("[API /competitor-analysis] POST request received");
    try {
        const body = await request.json();
        const { clientName, productFocus, runId } = body;
        if (!clientName || !productFocus) {
            return new NextResponse(JSON.stringify({ error: 'Both clientName and productFocus are required in the request body' }), { status: 400 });
        }
        const { competitorsData } = await findCompetitors(clientName, productFocus, runId);
        if (competitorsData && competitorsData.length > 0) {
            const analysis = await analyzeCompetitorsWithGemini(competitorsData, clientName);
            return NextResponse.json({ ...analysis, isJson: !analysis.error });
        } else {
            const analysis = await directGeminiAnalysis(clientName, productFocus);
            return NextResponse.json(analysis);
        }
    } catch (error) {
        let errorMessage = "Unknown error";
        if (error instanceof Error) errorMessage = error.message;
        return new NextResponse(JSON.stringify(standardErrorResponse(errorMessage)), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
