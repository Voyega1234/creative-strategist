import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;
export const fetchCache = 'force-cache';

// Cache for saved topics to reduce DB queries
const savedTopicsCache = new Map();
const CACHE_TTL = 60000; // 1 minute cache

export async function GET(request: Request) {
  const startTime = performance.now();
  
  try {
    const url = new URL(request.url);
    const clientName = url.searchParams.get('clientName');
    const productFocus = url.searchParams.get('productFocus');
    
    if (!clientName || !productFocus) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing clientName or productFocus' 
      }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `${clientName}:${productFocus}`;
    const cached = savedTopicsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`[saved-topics] Cache hit for ${cacheKey} - ${performance.now() - startTime}ms`);
      return NextResponse.json({ 
        success: true, 
        savedTopics: cached.data 
      });
    }

    const supabase = getSupabase();
    
    // Optimized query - only select essential fields for faster loading
    const { data, error } = await supabase
      .from('savedideas')
      .select('id, title, description, category, content_pillar, savedat')
      .eq('clientname', clientName)
      .eq('productfocus', productFocus)
      .order('savedat', { ascending: false })
      .limit(5); // Further reduced limit for faster loading

    if (error) {
      console.error('Error fetching saved topics:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch saved topics' 
      }, { status: 500 });
    }

    // Minimal transformation for fast loading
    const savedTopics = data.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      content_pillar: item.content_pillar,
      savedat: item.savedat
    }));

    // Cache the result
    savedTopicsCache.set(cacheKey, {
      data: savedTopics,
      timestamp: Date.now()
    });

    const endTime = performance.now();
    console.log(`[saved-topics] Query completed in ${endTime - startTime}ms for ${savedTopics.length} items`);

    return NextResponse.json({ 
      success: true, 
      savedTopics 
    });

  } catch (error) {
    const endTime = performance.now();
    console.error(`[saved-topics] Error after ${endTime - startTime}ms:`, error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}