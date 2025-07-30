import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
    
    // Optimized query - only select needed fields for display
    const { data, error } = await supabase
      .from('savedideas')
      .select(`
        id,
        clientname,
        productfocus,
        title,
        description,
        category,
        impact,
        competitivegap,
        tags,
        content_pillar,
        product_focus,
        concept_idea,
        copywriting_headline,
        copywriting_sub_headline_1,
        copywriting_sub_headline_2,
        copywriting_bullets,
        copywriting_cta,
        savedat
      `)
      .eq('clientname', clientName)
      .eq('productfocus', productFocus)
      .order('savedat', { ascending: false })
      .limit(50); // Limit results for performance

    if (error) {
      console.error('Error fetching saved topics:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch saved topics' 
      }, { status: 500 });
    }

    // Optimized transformation - return raw data as-is for EditableSavedIdeaModal
    const savedTopics = data.map(item => {
      return {
        id: item.id,
        clientname: item.clientname,
        productfocus: item.productfocus,
        title: item.title,
        description: item.description,
        category: item.category,
        impact: item.impact,
        competitivegap: item.competitivegap,
        tags: item.tags, // Keep as raw string for EditableSavedIdeaModal
        content_pillar: item.content_pillar,
        product_focus: item.product_focus,
        concept_idea: item.concept_idea,
        copywriting_headline: item.copywriting_headline,
        copywriting_sub_headline_1: item.copywriting_sub_headline_1,
        copywriting_sub_headline_2: item.copywriting_sub_headline_2,
        copywriting_bullets: item.copywriting_bullets, // Keep as raw string for EditableSavedIdeaModal
        copywriting_cta: item.copywriting_cta,
        savedat: item.savedat
      };
    });

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