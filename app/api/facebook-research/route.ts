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
      
      // Handle Facebook ad data extraction results from N8N
      console.log('[facebook-research] Raw Facebook extraction response:', JSON.stringify(rawResponse, null, 2));
      
      let facebookImages: any[] = [];
      let adsData: any[] = [];

      // Parse the response - handle different response formats
      if (Array.isArray(rawResponse)) {
        adsData = rawResponse;
        console.log('[facebook-research] Found', adsData.length, 'Facebook ad entries');
      } else if (rawResponse && typeof rawResponse === 'object') {
        // If it's already an object (not a string), use it directly
        adsData = [rawResponse]; // Wrap single object in array
        console.log('[facebook-research] Found single Facebook ad object, wrapped in array');
      } else if (typeof rawResponse === 'string') {
        // Try to parse if it's a string
        try {
          const parsed = JSON.parse(rawResponse);
          if (Array.isArray(parsed)) {
            adsData = parsed;
          } else {
            adsData = [parsed]; // Wrap single object in array
          }
        } catch (e) {
          console.error('[facebook-research] Failed to parse response as JSON:', e);
          throw new Error('Invalid response format from Facebook extraction');
        }
      } else {
        console.error('[facebook-research] Unexpected response format:', typeof rawResponse);
        throw new Error('Invalid response format from Facebook extraction');
      }

      // Extract ONLY actual images from Facebook ad data structure (no video previews)
      for (const ad of adsData) {
        try {
          const images: any[] = [];
          
          // Extract ONLY images from snapshot.images array - skip videos
          if (ad.snapshot?.images && Array.isArray(ad.snapshot.images)) {
            ad.snapshot.images.forEach((img: any) => {
              if (img.original_image_url) {
                images.push({
                  url: img.original_image_url,
                  title: ad.snapshot?.title || ad.page_name || 'Facebook Ad',
                  description: ad.snapshot?.body?.text || '',
                  ad_id: ad.ad_archive_id,
                  page_name: ad.page_name,
                  type: 'ad_image'
                });
              }
            });
          }
          
          // Skip video previews as requested - user only wants actual images
          
          // Skip profile pictures as requested - user only wants ad images
          
          // Add all found images
          facebookImages.push(...images);
          
        } catch (adError) {
          console.warn('[facebook-research] Error processing ad data:', adError);
          // Continue with other ads even if one fails
        }
      }
      
      if (facebookImages.length === 0) {
        // Fallback: try to extract any URL-like properties from the raw data
        console.log('[facebook-research] No images found in standard fields, checking for fallback URLs...');
        
        const fallbackImages: any[] = [];
        for (const ad of adsData) {
          // Check for any property containing 'url' and 'image'
          const checkForImageUrls = (obj: any, prefix = '') => {
            for (const [key, value] of Object.entries(obj || {})) {
              if (typeof value === 'string' && 
                  key.toLowerCase().includes('url') && 
                  key.toLowerCase().includes('image') &&
                  value.includes('http') &&
                  // Exclude video-related URLs
                  !key.toLowerCase().includes('video') &&
                  !key.toLowerCase().includes('preview') &&
                  !key.toLowerCase().includes('profile') &&
                  // Only show original images, skip resized duplicates
                  !key.toLowerCase().includes('resized')) {
                fallbackImages.push({
                  url: value,
                  title: `${ad.page_name || 'Facebook'} - ${key}`,
                  description: ad.snapshot?.body?.text || '',
                  ad_id: ad.ad_archive_id,
                  page_name: ad.page_name,
                  type: 'fallback'
                });
              } else if (typeof value === 'object' && value !== null) {
                checkForImageUrls(value, `${prefix}${key}.`);
              }
            }
          };
          
          checkForImageUrls(ad);
        }
        
        facebookImages = fallbackImages;
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