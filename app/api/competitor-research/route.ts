import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/supabase/server';

// Mark the route as dynamic
export const dynamic = 'force-dynamic';

// Define the structure for competitor data
interface ParsedCompetitor {
  name: string;
  website?: string | null;
  facebookUrl?: string | null;
  services?: string[] | null;
  serviceCategories?: string[] | null;
  features?: string[] | null;
  pricing?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  specialty?: string | null;
  targetAudience?: string | null;
  brandTone?: string | null;
  brandPerception?: {
    positive?: string | null;
    negative?: string | null;
  } | null;
  complaints?: string[] | null;
  usp?: string | null;
}

// Expected output structure from N8N webhook
interface N8NOutput {
  competitors: ParsedCompetitor[];
  summary_competitor?: string;
}

// Final structure for a competitor used in the frontend/API response
interface FinalCompetitor extends Omit<ParsedCompetitor, 'website' | 'facebookUrl' | 'services' | 'serviceCategories' | 'features' | 'pricing' | 'strengths' | 'weaknesses' | 'specialty' | 'targetAudience' | 'brandTone' | 'brandPerception' | 'complaints' | 'usp'> {
  id: string;
  name: string;
  website: string | null;
  facebookUrl: string | null;
  services: string[];
  serviceCategories: string[];
  features: string[];
  pricing: string;
  strengths: string[];
  weaknesses: string[];
  specialty: string;
  targetAudience: string;
  brandTone: string;
  brandPerception: { positive: string; negative: string; };
  complaints: string[];
  usp: string;
}

// Helper function to ensure URL is absolute
function ensureAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  // Trim whitespace
  url = url.trim();
  // Decode URI components like %20
  try {
    url = decodeURI(url);
  } catch (e) {
    console.warn(`[competitor-research] Failed to decode URL: ${url}`, e);
  }
  // Check if it already has a protocol
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Check if it starts with // (protocol-relative)
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  // Prepend https:// otherwise
  return `https://${url}`;
}

export async function POST(request: Request) {
  try {
    const N8N_WEBHOOK_URL = 'https://n8n.srv909701.hstgr.cloud/webhook/8fdf1d50-9a01-4bd8-a93e-8ab57352a39b';

    // Parse request body
    const body = await request.json();
    const { clientName, facebookUrl: clientFacebookUrl, websiteUrl: clientWebsiteUrl, market, productFocus, additionalInfo, userCompetitors, ad_account_id } = body;
    
    const analysisInput = {
      clientName,
      clientWebsiteUrl,
      clientFacebookUrl,
      market,
      productFocus,
      additionalInfo,
      userCompetitors,
      timestamp: new Date().toISOString(),
    };
    
    if (!clientName || !market) {
      console.error('Client name and market are required from form data');
      return NextResponse.json({ success: false, error: 'Client name and target market are required' }, { status: 400 });
    }
    
    // --- Call N8N Webhook ---
    let parsedData: N8NOutput;
    try {
      console.log('[competitor-research] Calling N8N webhook...');

      const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName,
          productFocus,
          market,
          additionalInfo,
          website: clientWebsiteUrl,
          ad_account_id
        }),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error(`[competitor-research] N8N webhook error response: ${webhookResponse.status} - ${errorText}`);
        throw new Error(`N8N webhook error: ${webhookResponse.status} - ${errorText.substring(0, 200)}`);
      }

      const rawResponse = await webhookResponse.json();
      console.log('[competitor-research] Received response from N8N webhook:', rawResponse);
      
      // Handle n8n response format - it returns an array with the data inside
      if (Array.isArray(rawResponse) && rawResponse.length > 0) {
        parsedData = rawResponse[0];
      } else {
        parsedData = rawResponse;
      }

    } catch (apiError: any) {
      console.error('[competitor-research] Error calling N8N webhook:', apiError);
      throw new Error(`Failed to get analysis from N8N service: ${apiError.message}`);
    }
    // --- End API Call ---
    
    // --- Process N8N Output --- 
    // Extract client data and filter out client from competitors
    // Since client is always the first index, we'll extract it directly
    const allCompetitors = parsedData.competitors || [];
    let clientData = null;
    
    if (allCompetitors.length > 0) {
      clientData = allCompetitors[0];
      console.log(`[competitor-research] Extracted client data from first index: ${clientData.name}`);
    }
    
    // Process all competitors including the client (they all get saved to Competitors table)
    const processedCompetitors: FinalCompetitor[] = allCompetitors.map((comp): FinalCompetitor => {
      // Ensure nested objects exist and provide defaults
      const perception = comp.brandPerception || { positive: null, negative: null };

      // Process targetAudience specifically to ensure it's a string
      let finalTargetAudience: string;
      if (typeof comp.targetAudience === 'string' && comp.targetAudience) {
        finalTargetAudience = comp.targetAudience;
      } else if (Array.isArray(comp.targetAudience)) {
        finalTargetAudience = (comp.targetAudience as string[]).filter(Boolean).join(', ') || 'N/A';
      } else {
        finalTargetAudience = 'N/A';
      }

      // Helper function to process potentially array string fields
      const processStringOrArrayField = (fieldValue: string | string[] | null | undefined): string => {
        if (typeof fieldValue === 'string' && fieldValue) {
          return fieldValue;
        } else if (Array.isArray(fieldValue)) {
          return (fieldValue as string[]).filter(Boolean).join(', ') || 'N/A';
        } else {
          return 'N/A';
        }
      };

      // Post-process Service Categories
      let cleanedServiceCategories: string[] = [];
      if (comp.serviceCategories && Array.isArray(comp.serviceCategories)) {
        const normalizedCategories = comp.serviceCategories
          .map(category => typeof category === 'string' ? category.trim().toLowerCase() : null)
          .filter((category): category is string => category !== null && category !== '');
        
        cleanedServiceCategories = Array.from(new Set(normalizedCategories));
      }

      return {
        id: uuidv4(),
        name: comp.name || 'Unknown Competitor',
        website: ensureAbsoluteUrl(comp.website),
        facebookUrl: ensureAbsoluteUrl(comp.facebookUrl),
        services: comp.services || [],
        serviceCategories: cleanedServiceCategories,
        features: comp.features || [],
        pricing: processStringOrArrayField(comp.pricing),
        strengths: comp.strengths || [],
        weaknesses: comp.weaknesses || [],
        specialty: processStringOrArrayField(comp.specialty),
        targetAudience: finalTargetAudience,
        brandTone: processStringOrArrayField(comp.brandTone),
        brandPerception: {
          positive: processStringOrArrayField(perception.positive),
          negative: processStringOrArrayField(perception.negative)
        },
        complaints: comp.complaints || [],
        usp: processStringOrArrayField(comp.usp)
      };
    }).filter(comp => comp.name !== 'Unknown Competitor');

    console.log(`[competitor-research] Processed ${processedCompetitors.length} competitors.`);

    // --- Save to Database --- 
    let newRunId: string | null = null;
    try {
        const supabase = getSupabase();
        
        // 1. Insert AnalysisRun 
        const analysisRunData = {
            id: uuidv4(),
            clientName: analysisInput.clientName,
            clientWebsiteUrl: analysisInput.clientWebsiteUrl,
            clientFacebookUrl: analysisInput.clientFacebookUrl,
            market: analysisInput.market,
            productFocus: analysisInput.productFocus,
            additionalInfo: analysisInput.additionalInfo,
            ad_account_id: ad_account_id,
            timestamp: analysisInput.timestamp,
            updatedAt: analysisInput.timestamp
        };

        const { data: savedAnalysisRun, error: runInsertError } = await supabase
            .from('AnalysisRun')
            .insert(analysisRunData)
            .select()
            .single();

        if (runInsertError) {
            console.error('[competitor-research] Supabase error inserting AnalysisRun:', runInsertError);
            throw new Error(runInsertError.message || 'Failed to save analysis run data.');
        }

        if (!savedAnalysisRun || !savedAnalysisRun.id) {
            throw new Error('Failed to retrieve ID after inserting AnalysisRun.');
        }

        newRunId = savedAnalysisRun.id;
        console.log(`[competitor-research] Successfully saved AnalysisRun (ID: ${newRunId}) to database.`);

        // Update with competitor summary if provided by n8n
        if (parsedData.summary_competitor) {
            const { error: summaryError } = await supabase
                .from('AnalysisRun')
                .update({
                    competitor_summary: parsedData.summary_competitor,
                    competitor_summary_generated_at: new Date().toISOString()
                })
                .eq('id', newRunId);

            if (summaryError) {
                console.error('[competitor-research] Failed to save competitor summary:', summaryError);
            } else {
                console.log('[competitor-research] Successfully saved competitor summary');
            }
        }

        // 2. Insert Competitors
        if (processedCompetitors.length > 0) {
            const competitorsToInsert = processedCompetitors.map(comp => ({
                id: comp.id, 
                analysisRunId: newRunId, 
                name: comp.name,
                website: comp.website,
                facebookUrl: comp.facebookUrl,
                services: comp.services,
                serviceCategories: comp.serviceCategories,
                features: comp.features,
                pricing: comp.pricing,
                strengths: comp.strengths,
                weaknesses: comp.weaknesses,
                specialty: comp.specialty,
                targetAudience: comp.targetAudience,
                brandTone: comp.brandTone,
                positivePerception: comp.brandPerception.positive, 
                negativePerception: comp.brandPerception.negative, 
                complaints: comp.complaints,
                usp: comp.usp
            }));

            const { error: competitorInsertError } = await supabase
                .from('Competitor')
                .insert(competitorsToInsert);

            if (competitorInsertError) {
                console.error('[competitor-research] Supabase error inserting Competitors:', competitorInsertError);
                throw new Error(competitorInsertError.message || 'Failed to save competitor data.');
            }
            console.log(`[competitor-research] Successfully saved ${competitorsToInsert.length} competitors.`);
        } else {
            console.log(`[competitor-research] No competitors processed, skipping competitor insert.`);
        }

    } catch (dbError: any) {
      console.error('[competitor-research] Failed to save analysis result to database:', dbError);
      throw dbError; 
    }

    // --- Generate Strategic Insights ---
    let strategicInsightsGenerated = false;
    try {
      console.log('[competitor-research] Generating strategic insights using Gemini API...');
      
      // Use the existing google_research API logic internally instead of webhook
      const googleResearchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/google_research?clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (googleResearchResponse.ok) {
        await googleResearchResponse.json(); // Process response but don't need to store data
        console.log('[competitor-research] Successfully generated strategic insights via google_research API');
        strategicInsightsGenerated = true;
      } else {
        const errorText = await googleResearchResponse.text();
        console.error('[competitor-research] Strategic insights generation failed:', googleResearchResponse.status, errorText);
      }
    } catch (strategicInsightsError: any) {
      console.error('[competitor-research] Error generating strategic insights:', strategicInsightsError);
      // Don't fail the whole process, just log the error
    }

    // Return success response
    return NextResponse.json({ 
      success: true,
      competitors: processedCompetitors,
      analysisRunId: newRunId,
      strategicInsightsGenerated
    });

  } catch (error: any) {
    console.error('[competitor-research] Error in POST handler:', error);
    const errorMessage = error.message || 'An unexpected server error occurred';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}