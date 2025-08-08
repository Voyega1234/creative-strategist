import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Types for the n8n webhook response
interface IdeaRecommendation {
  title: string;
  description: string;
  category: string;
  impact: 'High' | 'Medium' | 'Low';
  competitiveGap: string;
  tags: string[];
  content_pillar: string;
  product_focus: string;
  concept_idea: string;
  copywriting: {
    headline: string;
    sub_headline_1: string;
    sub_headline_2: string;
    bullets: string[];
    cta: string;
  };
}

interface N8NIdeaResponse {
  output: {
    recommendations: IdeaRecommendation[];
  };
}

export async function POST(request: Request) {
  try {
    const N8N_WEBHOOK_URL = 'https://n8n.srv934175.hstgr.cloud/webhook/ee9dbf72-1c09-4dd2-83e9-a6c1775ed8c1';

    // Parse request body


    const body = await request.json();
    const { clientName, productFocus, instructions, targetMarket, model, productDetails, hasProductDetails, negativePrompts } = body;
    
    if (!clientName || !productFocus) {
      return NextResponse.json({ 
        success: false, 
        error: 'Client name and product focus are required' 
      }, { status: 400 });
    }
    
    console.log('[generate-ideas] Generating ideas and strategic insights for:', { clientName, productFocus, instructions, targetMarket, model, productDetails, hasProductDetails, negativePrompts });

    // Debug: Check environment variable value
    console.log('[generate-ideas] NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('[generate-ideas] All env vars with NEXT_PUBLIC:', Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC')));

    // Get base URL from request headers (reliable in any environment)
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001');
    console.log('[generate-ideas] Detected baseUrl:', baseUrl);

    // Use existing google_research API instead of non-existent webhook
    const GOOGLE_RESEARCH_URL = `${baseUrl}/api/google_research?clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus)}`;
    console.log('[generate-ideas] GOOGLE_RESEARCH_URL:', GOOGLE_RESEARCH_URL);
    
    // Call both N8N webhooks in parallel
    try {
      const [webhookResponse, strategicInsightsResponse] = await Promise.all([
        // Deep Research (Ideas generation)
        fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientName,
            productFocus,
            instructions,
            targetMarket,
            productDetails,
            hasProductDetails,
            negativePrompts,
            model: model || "gemini-2.5-flash"
          }),
        }),
        // Strategic Insights (Market Analysis) - Use existing google_research API
        fetch(GOOGLE_RESEARCH_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      ]);

      // Check deep research response
      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error(`[generate-ideas] N8N webhook error: ${webhookResponse.status} - ${errorText}`);
        throw new Error(`N8N webhook error: ${webhookResponse.status}`);
      }

      const rawResponse = await webhookResponse.json();
      console.log('[generate-ideas] Raw n8n response:', rawResponse);
      
      // Handle n8n response format - multiple possible structures
      let ideaData: N8NIdeaResponse;
      if (Array.isArray(rawResponse) && rawResponse.length > 0 && rawResponse[0].recommendations) {
        // Format 1: [{recommendations: [...]}]
        ideaData = { output: { recommendations: rawResponse[0].recommendations } };
      } else if (rawResponse.output?.recommendations) {
        // Format 2: {output: {recommendations: [...]}}
        ideaData = rawResponse;
      } else if (rawResponse.recommendations && Array.isArray(rawResponse.recommendations)) {
        // Format 3: {recommendations: [...]} - Current format
        ideaData = { output: { recommendations: rawResponse.recommendations } };
      } else {
        console.error('[generate-ideas] Unknown response format:', rawResponse);
        throw new Error('Invalid response format from n8n webhook');
      }
      
      console.log(`[generate-ideas] Successfully generated ${ideaData.output.recommendations.length} ideas`);

      // Handle strategic insights response - WAIT for completion
      if (strategicInsightsResponse.ok) {
        try {
          await strategicInsightsResponse.json(); // Process response but don't need to store data
          console.log('[generate-ideas] Successfully generated strategic insights via google_research API');
          // Strategic insights are already saved to database by google_research API
        } catch (strategicInsightsError) {
          console.error('[generate-ideas] Error processing strategic insights:', strategicInsightsError);
        }
      } else {
        const strategicInsightsError = await strategicInsightsResponse.text();
        console.error('[generate-ideas] Strategic insights generation failed:', strategicInsightsResponse.status, strategicInsightsError);
        // Don't fail the whole process, just log the error
      }

      return NextResponse.json({ 
        success: true,
        ideas: ideaData.output.recommendations,
        clientName,
        productFocus
      });

    } catch (webhookError: any) {
      console.error('[generate-ideas] Error calling N8N webhook:', webhookError);
      throw new Error(`Failed to generate ideas: ${webhookError.message}`);
    }

  } catch (error: any) {
    console.error('[generate-ideas] Error in POST handler:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to generate ideas' 
    }, { status: 500 });
  }
}