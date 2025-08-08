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
    
    // Query all necessary fields for Pinterest Research component
    const { data, error } = await supabase
      .from('savedideas')
      .select(`
        id,
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
      .limit(20); // Increased limit for Pinterest Research

    if (error) {
      console.error('Error fetching saved topics:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch saved topics' 
      }, { status: 500 });
    }

    // Transform data to match SavedTopic interface for Pinterest Research
    const savedTopics = data.map(item => {
      // Parse tags from JSON array format
      let tags = [];
      try {
        tags = item.tags ? JSON.parse(item.tags) : [];
      } catch (e) {
        // Fallback to comma-separated if not JSON
        tags = item.tags ? item.tags.split(',').map((tag: string) => tag.trim()) : [];
      }

      // Parse bullets from JSON array format  
      let bullets = [];
      try {
        bullets = item.copywriting_bullets ? JSON.parse(item.copywriting_bullets) : [];
      } catch (e) {
        // Fallback to newline-separated if not JSON
        bullets = item.copywriting_bullets ? item.copywriting_bullets.split('\n').filter((b: string) => b.trim()) : [];
      }

      return {
        title: item.title,
        description: item.description,
        category: item.category,
        impact: item.impact,
        competitiveGap: item.competitivegap,
        tags: tags,
        content_pillar: item.content_pillar,
        product_focus: item.product_focus,
        concept_idea: item.concept_idea,
        copywriting: {
          headline: item.copywriting_headline || '',
          sub_headline_1: item.copywriting_sub_headline_1 || '',
          sub_headline_2: item.copywriting_sub_headline_2 || '',
          bullets: bullets,
          cta: item.copywriting_cta || ''
        }
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