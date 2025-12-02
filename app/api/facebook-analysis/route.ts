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
    const N8N_WEBHOOK_URL = 'https://n8n.srv934175.hstgr.cloud/webhook/6c2ebd81-8085-43d3-b315-e221f7339194';
    
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
    
    const analysisData = Array.isArray(n8nData) ? n8nData[0] : n8nData;
    if (!analysisData || typeof analysisData !== 'object') {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid response format from analysis service' 
      }, { status: 500 });
    }

    const summary = typeof analysisData.summary_competitor === 'string' ? analysisData.summary_competitor : '';
    const competitors = Array.isArray(analysisData.competitors) ? analysisData.competitors : [];
    const primaryCompetitor = competitors[0] || {};

    const extractStrings = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .map(item => typeof item === 'string' ? item.trim() : null)
          .filter((item): item is string => !!item);
      }
      if (typeof value === 'string') {
        return value.trim() ? [value.trim()] : [];
      }
      return [];
    };

    const productCandidates = [
      ...extractStrings(primaryCompetitor.services),
      ...extractStrings(primaryCompetitor.serviceCategories)
    ];

    return NextResponse.json({ 
      success: true,
      data: {
        clientName: typeof primaryCompetitor.name === 'string' ? primaryCompetitor.name : 'Facebook Page',
        products: productCandidates,
        summary
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
