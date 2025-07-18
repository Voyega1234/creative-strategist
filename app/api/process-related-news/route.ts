import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface RelatedNewsResponse {
  id: string;
  title: string;
  description: string;
}

export async function POST(request: Request) {
  try {
    const N8N_WEBHOOK_URL = 'https://n8n.srv909701.hstgr.cloud/webhook-test/94c24213-722c-4a6d-933f-ff03b598d588';

    // Parse request body
    const body = await request.json();
    const { clientName, productFocus, forceRefresh = false } = body;
    
    if (!clientName || !productFocus) {
      return NextResponse.json({ 
        success: false, 
        error: 'Client name and product focus are required' 
      }, { status: 400 });
    }
    
    console.log('[process-related-news] Processing for:', { clientName, productFocus });

    // Get Supabase client
    const supabase = getSupabase();

    // Check if related news already processed for this client/product focus
    const { data: existingData, error: checkError } = await supabase
      .from('AnalysisRun')
      .select('related_news_ids')
      .eq('clientName', clientName)
      .eq('productFocus', productFocus)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing related news:', checkError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error while checking existing data' 
      }, { status: 500 });
    }

    // If already processed and has results, return them (unless forceRefresh is true)
    if (existingData?.related_news_ids && existingData.related_news_ids.length > 0 && !forceRefresh) {
      console.log('[process-related-news] Found existing results, fetching news articles');
      
      // Fetch the actual news articles
      const { data: newsArticles, error: newsError } = await supabase
        .from('news_articles')
        .select('id, title, description, date, is_sponsored, created_at')
        .in('id', existingData.related_news_ids);

      // Use the newest created_at from news_articles as the processing date
      const latestDate = newsArticles && newsArticles.length > 0 
        ? newsArticles.reduce((latest, article) => 
            new Date(article.created_at) > new Date(latest) ? article.created_at : latest, 
            newsArticles[0].created_at)
        : null;

      if (newsError) {
        console.error('Error fetching news articles:', newsError);
        return NextResponse.json({ 
          success: false, 
          error: 'Error fetching news articles' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        relatedNews: newsArticles || [],
        latestDate,
        fromCache: true
      });
    }

    // Process with N8N webhook
    try {
      const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName,
          productFocus
        }),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error(`[process-related-news] N8N webhook error: ${webhookResponse.status} - ${errorText}`);
        throw new Error(`N8N webhook error: ${webhookResponse.status}`);
      }

      const responseData = await webhookResponse.json();
      console.log('[process-related-news] N8N raw response:', JSON.stringify(responseData, null, 2));

      // Handle different response structures
      let relatedNewsData: RelatedNewsResponse[] = [];
      
      if (Array.isArray(responseData)) {
        // Check if it's an array with a data property
        if (responseData.length > 0 && responseData[0].data && Array.isArray(responseData[0].data)) {
          relatedNewsData = responseData[0].data;
          console.log('[process-related-news] Array with data property received');
        } else {
          relatedNewsData = responseData;
        }
      } else if (responseData && Array.isArray(responseData.data)) {
        relatedNewsData = responseData.data;
      } else if (responseData && Array.isArray(responseData.output)) {
        relatedNewsData = responseData.output;
      } else if (responseData && responseData.id && responseData.title) {
        // Handle single news object - wrap it in an array
        relatedNewsData = [responseData];
        console.log('[process-related-news] Single news object received, wrapped in array');
      } else {
        console.error('[process-related-news] Unexpected response format:', responseData);
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid response format from N8N webhook' 
        }, { status: 500 });
      }

      console.log(`[process-related-news] N8N returned ${relatedNewsData.length} related news articles`);

      // Validate that we have valid news items
      if (!relatedNewsData || relatedNewsData.length === 0) {
        console.log('[process-related-news] No related news found');
        return NextResponse.json({ 
          success: true,
          relatedNews: [],
          fromCache: false
        });
      }

      // Extract IDs from the response
      console.log('[process-related-news] Raw news data:', relatedNewsData);
      const newsIds = relatedNewsData.map(news => news.id).filter(id => id);
      console.log('[process-related-news] Extracted IDs:', newsIds);
      console.log('[process-related-news] Number of IDs:', newsIds.length);

      if (newsIds.length === 0) {
        console.log('[process-related-news] No valid news IDs found');
        return NextResponse.json({ 
          success: true,
          relatedNews: [],
          fromCache: false
        });
      }

      console.log('[process-related-news] Valid news IDs:', newsIds);

      // Save the related news IDs to database
      const { error: saveError } = await supabase
        .from('AnalysisRun')
        .update({ related_news_ids: newsIds })
        .eq('clientName', clientName)
        .eq('productFocus', productFocus);

      if (saveError) {
        console.error('Error saving related news IDs:', saveError);
        // Continue anyway, we can still return the results
      }

      // Fetch full news articles data
      const { data: newsArticles, error: newsError } = await supabase
        .from('news_articles')
        .select('id, title, description, date, is_sponsored, created_at')
        .in('id', newsIds);

      // Get the newest created_at from news_articles as the processing date
      const latestDate = newsArticles && newsArticles.length > 0 
        ? newsArticles.reduce((latest, article) => 
            new Date(article.created_at) > new Date(latest) ? article.created_at : latest, 
            newsArticles[0].created_at)
        : null;

      if (newsError) {
        console.error('Error fetching news articles:', newsError);
        return NextResponse.json({ 
          success: false, 
          error: 'Error fetching news articles' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        relatedNews: newsArticles || [],
        latestDate,
        fromCache: false
      });

    } catch (webhookError: any) {
      console.error('[process-related-news] Error calling N8N webhook:', webhookError);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to process related news: ${webhookError.message}` 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[process-related-news] Error in POST handler:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process related news' 
    }, { status: 500 });
  }
}