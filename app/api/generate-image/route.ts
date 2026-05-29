import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 600; // Allow up to 10 minutes for each image generation request

// Types for the n8n image generation response
interface N8NImageResponse {
  success: boolean;
  image_url?: string;
  error?: string;
}

type TextToImageCodeWorkflow = {
  runTextToImageWorkflow: (
    body: Record<string, any>,
    options?: {
      outputDir?: string
      publicPathPrefix?: string
      skipUpload?: boolean
    },
  ) => Promise<{
    success: boolean
    publicUrl?: string | null
    localUrl?: string | null
    gemini?: string | null
    model?: string
    imageCount?: number
    size?: string
    finalPrompt?: string
    visualThinking?: string
    revisedPrompt?: string | null
  }>
}

async function runCodeImageGenerator(payload: Record<string, any>) {
  const workflow = (await import("@/text-to-image-code/src/workflow.mjs")) as TextToImageCodeWorkflow
  const result = await workflow.runTextToImageWorkflow(payload, {
    outputDir: "public/generated-images",
    publicPathPrefix: "/generated-images",
    skipUpload: process.env.TEXT_TO_IMAGE_SKIP_SUPABASE_UPLOAD === "true",
  })

  const imageUrl = result.publicUrl || result.localUrl || result.gemini
  if (!imageUrl) {
    throw new Error("Code image generator completed but returned no image URL")
  }

  return {
    rawResponse: result,
    images: [
      {
        url: imageUrl,
        source: "code-openai",
      },
    ],
  }
}

async function runN8NImageGenerator(payload: Record<string, any>) {
  // N8N webhook URL for AI image generation
  const N8N_AI_IMAGE_WEBHOOK_URL = 'https://n8n.srv934175.hstgr.cloud/webhook/631578fd-816a-4670-aea4-f9ae0f0253d7';

  const webhookResponse = await fetch(N8N_AI_IMAGE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Check webhook response
  if (!webhookResponse.ok) {
    const errorText = await webhookResponse.text();
    console.error(`[generate-image] N8N webhook error: ${webhookResponse.status} - ${errorText}`);
    throw new Error(`N8N webhook error: ${webhookResponse.status}`);
  }

  const responseBody = await webhookResponse.text();
  let rawResponse: any = null
  if (responseBody) {
    try {
      rawResponse = JSON.parse(responseBody)
    } catch (parseError) {
      console.error("[generate-image] Failed to parse JSON from n8n:", parseError, responseBody)
      throw new Error("Image generator returned invalid JSON")
    }
  } else {
    throw new Error("Image generator returned empty response")
  }
  console.log('[generate-image] Raw n8n response type:', typeof rawResponse);
  console.log('[generate-image] Raw n8n response is array:', Array.isArray(rawResponse));
  console.log('[generate-image] Raw n8n response length:', rawResponse?.length);
  console.log('[generate-image] Raw n8n response sample:', rawResponse?.slice ? rawResponse.slice(0, 3) : rawResponse);

  // Handle Pinterest search results from N8N
  console.log('[generate-image] Raw Pinterest search response:', rawResponse);

  let pinterestImages = [];

  // Handle different possible response formats from N8N
  if (Array.isArray(rawResponse)) {
    // Case 1: Direct array of objects [{url: "..."}, {url: "..."}, ...]
    pinterestImages = rawResponse;
    console.log('[generate-image] Found direct array format with', pinterestImages.length, 'images');
  } else if (rawResponse.images && Array.isArray(rawResponse.images)) {
    // Case 2: Nested in images property
    pinterestImages = rawResponse.images;
    console.log('[generate-image] Found nested images array with', pinterestImages.length, 'images');
  } else if (rawResponse.data && Array.isArray(rawResponse.data)) {
    // Case 3: Nested in data property
    pinterestImages = rawResponse.data;
    console.log('[generate-image] Found nested data array with', pinterestImages.length, 'images');
  } else if (rawResponse.urls && Array.isArray(rawResponse.urls)) {
    // Case 4: Array of URL strings in urls property
    pinterestImages = rawResponse.urls.map((url: string) => ({ url }));
    console.log('[generate-image] Found URLs array format with', pinterestImages.length, 'images');
  } else if (rawResponse.url && Array.isArray(rawResponse.url)) {
    // Case 5: Array of URL strings in url property: {url: ["url1", "url2", ...]}
    pinterestImages = rawResponse.url.map((url: string) => ({ url }));
    console.log('[generate-image] Found URL array in url property with', pinterestImages.length, 'images');
  } else if (
    (rawResponse.image_url && typeof rawResponse.image_url === 'string') ||
    (rawResponse.ideogram && typeof rawResponse.ideogram === 'string') ||
    (rawResponse.gemini && typeof rawResponse.gemini === 'string')
  ) {
    pinterestImages = []
    if (rawResponse.image_url) {
      pinterestImages.push({ url: rawResponse.image_url })
    }
    if (rawResponse.ideogram) {
      pinterestImages.push({ url: rawResponse.ideogram, source: 'ideogram' })
    }
    if (rawResponse.gemini) {
      pinterestImages.push({ url: rawResponse.gemini, source: 'gemini' })
    }
    console.log('[generate-image] Found single image_url/ideogram/gemini format with', pinterestImages.length, 'images')
  } else if (rawResponse.url && typeof rawResponse.url === 'string') {
    // Case 6: Single image object format: {url: "..."}
    pinterestImages = [rawResponse];
    console.log('[generate-image] Found single image object format');
  } else if (typeof rawResponse === 'string') {
    // Case 7: Single URL string
    pinterestImages = [{ url: rawResponse }];
    console.log('[generate-image] Found single URL string format');
  } else {
    console.error('[generate-image] Unknown Pinterest response format:', rawResponse);
    console.error('[generate-image] Response type:', typeof rawResponse);
    console.error('[generate-image] Response keys:', Object.keys(rawResponse || {}));

    // Try to extract any URL-like properties
    const possibleUrls = Object.keys(rawResponse || {}).filter(key =>
      key.toLowerCase().includes('url') || key.toLowerCase().includes('image')
    );
    console.error('[generate-image] Possible URL keys:', possibleUrls);

    throw new Error('Invalid response format from Pinterest search');
  }

  return {
    rawResponse,
    images: pinterestImages,
  }
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { 
      prompt, 
      reference_image_url, 
      client_name, 
      product_focus, 
      selected_topics,
      core_concept,
      topic_title,
      topic_description,
      content_pillar,
      copywriting,
      selected_visual_route,
      color_palette,
      material_image_urls,
      ad_style,
      user_brief,
      aspect_ratio,
      image_count,
    } = body;
    
    // Prompt is now optional - user can generate from saved ideas and reference image only
    
    console.log('[generate-image] Generating AI images with prompt:', prompt);
    console.log('[generate-image] Client:', client_name);
    console.log('[generate-image] Product Focus:', product_focus);
    console.log('[generate-image] Selected Topics:', selected_topics?.length || 0);
    console.log('[generate-image] Core Concept:', core_concept);
    console.log('[generate-image] Topic Title:', topic_title);
    console.log('[generate-image] Ad Style:', ad_style);
    console.log('[generate-image] Selected Visual Route:', selected_visual_route?.route_name || 'none');
    if (reference_image_url) {
      console.log('[generate-image] Using reference image:', reference_image_url);
    }

    if (material_image_urls?.length) {
      console.log("[generate-image] Material images selected:", material_image_urls.length)
    }
    const parsedImageCount = typeof image_count === 'string' ? parseInt(image_count, 10) : image_count
    const numericImageCount = typeof parsedImageCount === 'number' ? parsedImageCount : Number(parsedImageCount)
    const sanitizedImageCount = Math.min(5, Math.max(1, Number.isFinite(numericImageCount) ? numericImageCount : 1))
    const selectedAspectRatio = typeof aspect_ratio === 'string' && aspect_ratio.trim().length > 0 ? aspect_ratio : '1:1'
    console.log('[generate-image] Image count requested:', sanitizedImageCount)
    console.log('[generate-image] Aspect ratio selected:', selectedAspectRatio)

    try {
      const payload: Record<string, any> = {
        prompt: prompt || "",
        saved_ideas: selected_topics || [],
        client: client_name || "",
        productFocus: product_focus || "",
        core_concept: core_concept || "",
        topic_title: topic_title || "",
        topic_description: topic_description || "",
        content_pillar: content_pillar || "",
        copywriting: copywriting || null,
        selected_visual_route: selected_visual_route || null,
        selectedVisualRoute: selected_visual_route || null,
        color_palette: color_palette || [],
        material_image_urls: material_image_urls || [],
        ad_style: ad_style || "",
        user_brief: user_brief || "",
        userBrief: user_brief || "",
        aspect_ratio: selectedAspectRatio,
        image_count: sanitizedImageCount,
        imageCount: sanitizedImageCount,
        aspectRatio: selectedAspectRatio,
      }

      if (reference_image_url) {
        payload.reference_image_url = reference_image_url
      }

      const provider = process.env.TEXT_TO_IMAGE_PROVIDER || "code"
      console.log("[generate-image] Provider:", provider)
      const generationResult =
        provider === "n8n"
          ? await runN8NImageGenerator(payload)
          : await runCodeImageGenerator(payload)
      const pinterestImages = generationResult.images
      
      if (pinterestImages.length === 0) {
        throw new Error('No images found for the search criteria');
      }
      
      console.log('[generate-image] Successfully found', pinterestImages.length, 'images');

      return NextResponse.json({ 
        success: true,
        images: pinterestImages,
        imageUrl: pinterestImages[0]?.url,
        image_url: pinterestImages[0]?.url,
        prompt,
        provider,
      });

    } catch (webhookError: any) {
      console.error('[generate-image] Error calling N8N webhook:', webhookError);
      
      // Provide more specific error messages for debugging
      if (webhookError.name === 'AbortError') {
        throw new Error('Request timeout - image generation took too long');
      } else if (webhookError.message?.includes('fetch')) {
        throw new Error(`Network error connecting to image generation service: ${webhookError.message}`);
      } else {
        throw new Error(`Failed to generate image: ${webhookError.message}`);
      }
    }

  } catch (error: any) {
    console.error('[generate-image] Error in POST handler:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to generate image' 
    }, { status: 500 });
  }
}
