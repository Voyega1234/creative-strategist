import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prompt, client_name, product_focus, selected_topics } = body

    console.log('[pinterest-research] Received request:', {
      prompt,
      client_name,
      product_focus,
      selected_topics: selected_topics?.length || 0
    })

    // N8N webhook URL for Pinterest research
    const n8nWebhookUrl = 'https://n8n.srv934175.hstgr.cloud/webhook-test/7d99dbe5-f303-4782-894e-c9d01f405f86'

    // Prepare the data for N8N Pinterest research webhook
    const n8nPayload = {
      prompt: prompt || '',
      client_name,
      product_focus,
      selected_topics: selected_topics || [],
      search_type: 'pinterest_research'
    }

    console.log('[pinterest-research] Sending to N8N:', n8nPayload)

    // Call N8N webhook
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload),
    })

    const rawResponse = await n8nResponse.text()
    console.log('[pinterest-research] Raw N8N response:', rawResponse)

    let pinterestResults
    try {
      pinterestResults = JSON.parse(rawResponse)
    } catch (error) {
      console.error('[pinterest-research] Failed to parse N8N response as JSON:', error)
      return NextResponse.json(
        { success: false, error: 'Invalid response format from Pinterest service' },
        { status: 500 }
      )
    }

    // Handle Pinterest search results from N8N
    let pinterestImages = []
    
    // Handle the specific N8N format: { "url": ["image1.jpg", "image2.jpg", ...] }
    if (pinterestResults.url && Array.isArray(pinterestResults.url)) {
      pinterestImages = pinterestResults.url
    }
    // Handle array format: [{ "url": ["image1.jpg", "image2.jpg", ...] }]
    else if (Array.isArray(pinterestResults) && pinterestResults.length > 0 && pinterestResults[0].url && Array.isArray(pinterestResults[0].url)) {
      pinterestImages = pinterestResults[0].url
    } 
    // Fallback format handlers for Pinterest image arrays
    else if (Array.isArray(pinterestResults)) {
      pinterestImages = pinterestResults
    } else if (pinterestResults.images && Array.isArray(pinterestResults.images)) {
      pinterestImages = pinterestResults.images
    } else if (pinterestResults.data && Array.isArray(pinterestResults.data)) {
      pinterestImages = pinterestResults.data
    } else if (pinterestResults.results && Array.isArray(pinterestResults.results)) {
      pinterestImages = pinterestResults.results
    }

    console.log('[pinterest-research] Processed Pinterest images:', pinterestImages.length)

    if (pinterestImages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Pinterest images found for this search'
      })
    }

    // Format images for consistent response
    const formattedImages = pinterestImages.map((imgUrl: string, index: number) => ({
      id: `pinterest-${Date.now()}-${index}`,
      url: imgUrl,
      title: `Pinterest Image ${index + 1}`,
      source: 'pinterest'
    }))

    return NextResponse.json({
      success: true,
      images: formattedImages,
      count: formattedImages.length
    })

  } catch (error) {
    console.error('[pinterest-research] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search Pinterest images' },
      { status: 500 }
    )
  }
}