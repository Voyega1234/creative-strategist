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
    const N8N_WEBHOOK_URL = 'https://n8n.srv909701.hstgr.cloud/webhook-test/ee9dbf72-1c09-4dd2-83e9-a6c1775ed8c1';

    // Parse request body
    const body = await request.json();
    const { clientName, productFocus, instructions, targetMarket } = body;
    
    if (!clientName || !productFocus) {
      return NextResponse.json({ 
        success: false, 
        error: 'Client name and product focus are required' 
      }, { status: 400 });
    }
    
    console.log('[generate-ideas] Generating ideas for:', { clientName, productFocus, instructions, targetMarket });

    // Call N8N webhook
    try {
      const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName,
          productFocus,
          instructions,
          targetMarket
        }),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error(`[generate-ideas] N8N webhook error: ${webhookResponse.status} - ${errorText}`);
        throw new Error(`N8N webhook error: ${webhookResponse.status}`);
      }

      const ideaData: N8NIdeaResponse = await webhookResponse.json();
      console.log(`[generate-ideas] Successfully generated ${ideaData.output.recommendations.length} ideas`);

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