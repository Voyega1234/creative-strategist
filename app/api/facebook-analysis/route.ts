import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { facebook_url } = body;
    
    console.log('Received Facebook URL:', facebook_url);
    
    if (!facebook_url) {
      return NextResponse.json({ 
        success: false, 
        error: 'Facebook URL is required' 
      }, { status: 400 });
    }

    // Call N8N webhook for Facebook analysis
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://n8n.srv934175.hstgr.cloud';
    const N8N_WEBHOOK_URL = `${baseUrl}/webhook-test/b14e5c79-4730-4e9c-8708-092875053f3a`;
    
    console.log('Calling N8N webhook for Facebook analysis...');
    
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        facebook_url: facebook_url
      }),
    });

    if (!n8nResponse.ok) {
      console.error('N8N webhook failed:', n8nResponse.status, n8nResponse.statusText);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to analyze Facebook page' 
      }, { status: 500 });
    }

    const n8nData = await n8nResponse.json();
    console.log('N8N response:', n8nData);
    
    // Handle both array format and single object format
    let analysisData;
    if (Array.isArray(n8nData)) {
      if (n8nData.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'No data received from analysis service' 
        }, { status: 500 });
      }
      analysisData = n8nData[0];
    } else if (typeof n8nData === 'object' && n8nData !== null) {
      // Direct object response
      analysisData = n8nData;
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid response format from analysis service' 
      }, { status: 500 });
    }
    
    if (!analysisData.clientname || !Array.isArray(analysisData.list_product)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required data in analysis response' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      data: {
        clientName: analysisData.clientname,
        products: analysisData.list_product
      }
    });

  } catch (error) {
    console.error('Error in Facebook analysis API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}