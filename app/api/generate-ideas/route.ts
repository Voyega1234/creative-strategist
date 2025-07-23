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
    const { clientName, productFocus, instructions, targetMarket, model } = body;
    
    if (!clientName || !productFocus) {
      return NextResponse.json({ 
        success: false, 
        error: 'Client name and product focus are required' 
      }, { status: 400 });
    }
    
    console.log('[generate-ideas] Generating ideas and strategic insights for:', { clientName, productFocus, instructions, targetMarket, model });

    // Strategic Insights webhook URL - Replace with your actual Strategic Insights n8n webhook
    const N8N_STRATEGIC_INSIGHTS_WEBHOOK_URL = 'https://n8n.srv909701.hstgr.cloud/webhook/strategic-insights-url-here';
    
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
            model: model || "gemini-2.5-pro"
          }),
        }),
        // Strategic Insights (Market Analysis)
        fetch(N8N_STRATEGIC_INSIGHTS_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientName,
            productFocus,
            instructions,
            targetMarket,
            model: model || "gemini-2.5-pro"
          }),
        })
      ]);

      // Check deep research response
      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error(`[generate-ideas] N8N webhook error: ${webhookResponse.status} - ${errorText}`);
        throw new Error(`N8N webhook error: ${webhookResponse.status}`);
      }

      const ideaData: N8NIdeaResponse = await webhookResponse.json();
      console.log(`[generate-ideas] Successfully generated ${ideaData.output.recommendations.length} ideas`);

      // Handle strategic insights response - WAIT for completion
      if (strategicInsightsResponse.ok) {
        try {
          const strategicInsightsData = await strategicInsightsResponse.json();
          console.log('[generate-ideas] Successfully generated strategic insights');
          
          // Save strategic insights to database and WAIT for completion
          const saveResponse = await fetch('/api/save-strategic-insights', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clientName,
              productFocus,
              strategicInsights: strategicInsightsData.output || strategicInsightsData
            }),
          });

          if (!saveResponse.ok) {
            console.error('[generate-ideas] Failed to save strategic insights:', await saveResponse.text());
          } else {
            console.log('[generate-ideas] Strategic insights saved successfully');
          }
          
        } catch (strategicInsightsError) {
          console.error('[generate-ideas] Error processing strategic insights:', strategicInsightsError);
        }
      } else {
        const strategicInsightsError = await strategicInsightsResponse.text();
        console.error('[generate-ideas] Strategic insights webhook failed:', strategicInsightsResponse.status, strategicInsightsError);
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