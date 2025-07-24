// Utility for matching company names using Gemini 2.0 Flash as fallback
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

interface NameMatchResult {
  matchedName: string | null;
  confidence: 'high' | 'medium' | 'low' | 'no_match';
  error?: string;
}

// Helper function to call Gemini 2.0 Flash API
async function callGeminiAPI(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
  
  const body = {
    contents: [
      {   
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: { 
      temperature: 0.1, // Low temperature for consistent results
      maxOutputTokens: 50 // Short response expected
    }
  };
  
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
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

// In-memory cache for name matching results (only for fallback cases)
interface CachedNameMatchResult extends NameMatchResult {
  timestamp: number;
  expiresIn: number;
}

const nameMatchCache = new Map<string, CachedNameMatchResult>();

// Generate cache key for company name matching
function getCacheKey(targetName: string, companyList: string[]): string {
  return `${targetName}|${companyList.sort().join(',')}`;
}

/**
 * FALLBACK ONLY: Use Gemini 2.0 Flash to find matching company name when database query fails
 * Handles Thai and English company names with variations and abbreviations
 * 
 * @param targetCompanyName - The company name to match
 * @param companyNamesList - List of company names to search within
 * @returns Promise<NameMatchResult> - The best matching name or null if no match
 */
export async function findMatchingCompanyName(
  targetCompanyName: string,
  companyNamesList: string[]
): Promise<NameMatchResult> {
  if (!targetCompanyName || !companyNamesList || companyNamesList.length === 0) {
    return { matchedName: null, confidence: 'no_match', error: 'Invalid input parameters' };
  }

  // Check cache first (to avoid repeated API calls for same query)
  const cacheKey = getCacheKey(targetCompanyName, companyNamesList);
  const cachedResult = nameMatchCache.get(cacheKey);
  
  if (cachedResult) {
    const now = Date.now();
    // Check if cache entry is still valid (24 hours for successful matches, 1 hour for errors)
    if (now - cachedResult.timestamp < cachedResult.expiresIn) {
      console.log(`[name-matching] Using cached result for "${targetCompanyName}"`);
      return {
        matchedName: cachedResult.matchedName,
        confidence: cachedResult.confidence,
        error: cachedResult.error
      };
    } else {
      // Cache expired, remove it
      nameMatchCache.delete(cacheKey);
    }
  }

  try {
    const prompt = `You are a company name matching expert. Find which company name from the list best matches the target company name.

Target Company: "${targetCompanyName}"
Company List: ${JSON.stringify(companyNamesList)}

Return ONLY the exact company name from the list that best matches the target, or "NO_MATCH" if no good match exists.

Rules:
- Handle both Thai and English names (บริษัท, จำกัด, Co., Ltd., etc.)
- Consider abbreviations, translations, and variations (Airline = Air, Airways = Air)
- Must refer to the same business entity
- Return exact string from the provided list
- If uncertain, return "NO_MATCH"

Response:`;

    console.log(`[name-matching] Calling Gemini 2.0 Flash fallback for "${targetCompanyName}"...`);
    const geminiResponse = await callGeminiAPI(prompt);
    
    // Clean the response
    const cleanedResponse = geminiResponse.replace(/["`]/g, '').trim();
    
    let result: NameMatchResult;
    
    if (cleanedResponse === 'NO_MATCH' || !companyNamesList.includes(cleanedResponse)) {
      result = { matchedName: null, confidence: 'no_match' };
      console.log(`[name-matching] No match found for "${targetCompanyName}"`);
    } else {
      result = { matchedName: cleanedResponse, confidence: 'high' };
      console.log(`[name-matching] Matched "${targetCompanyName}" -> "${cleanedResponse}"`);
    }
    
    // Cache the result with longer expiration for successful matches
    const cachedResult: CachedNameMatchResult = {
      ...result,
      timestamp: Date.now(),
      expiresIn: result.matchedName ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000 // 24h for success, 2h for no match
    };
    nameMatchCache.set(cacheKey, cachedResult);
    return result;
    
  } catch (error) {
    console.error('[name-matching] Gemini API fallback failed:', error);
    const errorResult: NameMatchResult = { 
      matchedName: null, 
      confidence: 'no_match', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
    
    // Cache error result briefly to avoid repeated failures
    const cachedErrorResult: CachedNameMatchResult = {
      ...errorResult,
      timestamp: Date.now(),
      expiresIn: 30 * 60 * 1000 // 30 minutes for errors
    };
    nameMatchCache.set(cacheKey, cachedErrorResult);
    return errorResult;
  }
}

// Clear cache (useful for testing or memory management)
export function clearNameMatchCache(): void {
  nameMatchCache.clear();
  console.log('[name-matching] Cache cleared');
}