import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { articleId, clientName, productFocus } = body;
    
    if (!articleId || !clientName || !productFocus) {
      return NextResponse.json({ 
        success: false, 
        error: 'Article ID, client name, and product focus are required' 
      }, { status: 400 });
    }
    
    console.log('[delete-news-article] Deleting article:', { articleId, clientName, productFocus });

    // Get Supabase client
    const supabase = getSupabase();

    // Get the current related_news_ids from Clients
    const { data: analysisData, error: analysisError } = await supabase
      .from('Clients')
      .select('related_news_ids')
      .eq('clientName', clientName)
      .eq('productFocus', productFocus)
      .single();

    if (analysisError) {
      console.error('Error fetching analysis data:', analysisError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch analysis data' 
      }, { status: 500 });
    }

    // Remove the article ID from the related_news_ids array
    const currentIds = analysisData?.related_news_ids || [];
    const updatedIds = currentIds.filter((id: string) => id !== articleId);

    // Update the Clients with the new related_news_ids
    const { error: updateError } = await supabase
      .from('Clients')
      .update({ related_news_ids: updatedIds })
      .eq('clientName', clientName)
      .eq('productFocus', productFocus);

    if (updateError) {
      console.error('Error updating analysis run:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update analysis run' 
      }, { status: 500 });
    }

    console.log(`[delete-news-article] Successfully removed article ${articleId} from related_news_ids`);
    console.log(`[delete-news-article] Updated IDs: ${updatedIds.length} remaining`);

    return NextResponse.json({ 
      success: true,
      message: 'Article removed from related news',
      remainingCount: updatedIds.length
    });

  } catch (error: any) {
    console.error('[delete-news-article] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to delete article' 
    }, { status: 500 });
  }
}