import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const N8N_WEBHOOK_URL = 'https://n8n.srv909701.hstgr.cloud/webhook/94c24213-722c-4a6d-933f-ff03b598d588';

    // Parse request body
    const body = await request.json();
    const { clientName, productFocus } = body;
    
    console.log('[test-n8n-webhook] Testing webhook with:', { clientName, productFocus });

    // Call N8N webhook
    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientName: clientName || 'StashAway',
        productFocus: productFocus || 'Investment platforms'
      }),
    });

    console.log('[test-n8n-webhook] Response status:', webhookResponse.status);
    console.log('[test-n8n-webhook] Response headers:', Object.fromEntries(webhookResponse.headers.entries()));

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('[test-n8n-webhook] Error response:', errorText);
      return NextResponse.json({ 
        success: false, 
        error: `N8N webhook error: ${webhookResponse.status}`,
        details: errorText
      }, { status: 500 });
    }

    const responseData = await webhookResponse.json();
    console.log('[test-n8n-webhook] Raw response:', JSON.stringify(responseData, null, 2));

    return NextResponse.json({ 
      success: true,
      responseData,
      responseType: Array.isArray(responseData) ? 'array' : typeof responseData,
      hasData: responseData?.data ? 'yes' : 'no',
      hasOutput: responseData?.output ? 'yes' : 'no'
    });

  } catch (error: any) {
    console.error('[test-n8n-webhook] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to test webhook' 
    }, { status: 500 });
  }
}