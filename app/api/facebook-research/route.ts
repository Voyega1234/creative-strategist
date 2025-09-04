import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 180; // Allow up to 3 minutes for Facebook image extraction

export async function POST(request: Request) {
  try {
    // N8N webhook URL for Facebook image extraction
    const N8N_FACEBOOK_WEBHOOK_URL = 'https://n8n.srv934175.hstgr.cloud/webhook-test/facebook-seach-ref';

    // Parse request body
    const body = await request.json();
    const { 
      facebook_url,
      client_name, 
      product_focus, 
      selected_topics
    } = body;
    
    console.log('[facebook-research] Extracting images from Facebook URL:', facebook_url);
    console.log('[facebook-research] Client:', client_name);
    console.log('[facebook-research] Product Focus:', product_focus);
    console.log('[facebook-research] Selected Topics:', selected_topics?.length || 0);
    
    if (!facebook_url || !facebook_url.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Facebook URL is required' 
      }, { status: 400 });
    }

    // Validate Facebook URL format
    const facebookDomains = ['facebook.com', 'fb.com', 'm.facebook.com'];
    const isValidFacebookUrl = facebookDomains.some(domain => 
      facebook_url.toLowerCase().includes(domain)
    );
    
    if (!isValidFacebookUrl) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid Facebook URL. Please provide a valid Facebook page or post URL.' 
      }, { status: 400 });
    }

    try {
      // Call N8N Facebook image extraction webhook
      const webhookResponse = await fetch(N8N_FACEBOOK_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facebook_url: facebook_url.trim(),
          saved_ideas: selected_topics || [],
          client: client_name || "",
          productFocus: product_focus || ""
        }),
      });

      // Check webhook response
      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error(`[facebook-research] N8N webhook error: ${webhookResponse.status} - ${errorText}`);
        throw new Error(`N8N webhook error: ${webhookResponse.status}`);
      }

      const rawResponse = await webhookResponse.json();
      console.log('[facebook-research] Raw n8n response type:', typeof rawResponse);
      console.log('[facebook-research] Raw n8n response is array:', Array.isArray(rawResponse));
      console.log('[facebook-research] Raw n8n response length:', rawResponse?.length);
      console.log('[facebook-research] Raw n8n response sample:', rawResponse?.slice ? rawResponse.slice(0, 3) : rawResponse);
      
      // Handle Facebook image extraction results from N8N
      console.log('[facebook-research] Raw Facebook extraction response:', rawResponse);
      
      let facebookImages = [];
      
      // Handle different possible response formats from N8N
      if (Array.isArray(rawResponse)) {
        // Case 1: Direct array of objects [{url: "..."}, {url: "..."}, ...]
        facebookImages = rawResponse;
        console.log('[facebook-research] Found direct array format with', facebookImages.length, 'images');
      } else if (rawResponse.images && Array.isArray(rawResponse.images)) {
        // Case 2: Nested in images property
        facebookImages = rawResponse.images;
        console.log('[facebook-research] Found nested images array with', facebookImages.length, 'images');
      } else if (rawResponse.data && Array.isArray(rawResponse.data)) {
        // Case 3: Nested in data property
        facebookImages = rawResponse.data;
        console.log('[facebook-research] Found nested data array with', facebookImages.length, 'images');
      } else if (rawResponse.urls && Array.isArray(rawResponse.urls)) {
        // Case 4: Array of URL strings in urls property
        facebookImages = rawResponse.urls.map((url: string) => ({ url }));
        console.log('[facebook-research] Found URLs array format with', facebookImages.length, 'images');
      } else if (rawResponse.url && Array.isArray(rawResponse.url)) {
        // Case 5: Array of URL strings in url property: {url: ["url1", "url2", ...]}
        facebookImages = rawResponse.url.map((url: string) => ({ url }));
        console.log('[facebook-research] Found URL array in url property with', facebookImages.length, 'images');
      } else if (rawResponse.url && typeof rawResponse.url === 'string') {
        // Case 6: Single image object format: {url: "..."}
        facebookImages = [rawResponse];
        console.log('[facebook-research] Found single image object format');
      } else if (typeof rawResponse === 'string') {
        // Case 7: Single URL string
        facebookImages = [{ url: rawResponse }];
        console.log('[facebook-research] Found single URL string format');
      } else {
        console.error('[facebook-research] Unknown Facebook response format:', rawResponse);
        console.error('[facebook-research] Response type:', typeof rawResponse);
        console.error('[facebook-research] Response keys:', Object.keys(rawResponse || {}));
        
        // Try to extract any URL-like properties
        const possibleUrls = Object.keys(rawResponse || {}).filter(key => 
          key.toLowerCase().includes('url') || key.toLowerCase().includes('image')
        );
        console.error('[facebook-research] Possible URL keys:', possibleUrls);
        
        throw new Error('Invalid response format from Facebook image extraction');
      }
      
      if (facebookImages.length === 0) {
        throw new Error('No images found on the Facebook page or post');
      }
      
      console.log('[facebook-research] Successfully found', facebookImages.length, 'Facebook images');

      return NextResponse.json({ 
        success: true,
        images: facebookImages,
        facebook_url
      });

    } catch (webhookError: any) {
      console.error('[facebook-research] Error calling N8N webhook:', webhookError);
      
      // Provide more specific error messages for debugging
      if (webhookError.name === 'AbortError') {
        throw new Error('Request timeout - Facebook image extraction took too long');
      } else if (webhookError.message?.includes('fetch')) {
        throw new Error(`Network error connecting to Facebook extraction service: ${webhookError.message}`);
      } else {
        throw new Error(`Failed to extract Facebook images: ${webhookError.message}`);
      }
    }

  } catch (error: any) {
    console.error('[facebook-research] Error in POST handler:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to extract Facebook images' 
    }, { status: 500 });
  }
}