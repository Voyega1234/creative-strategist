import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idea, clientName, productFocus, action } = body;
    
    console.log('Received data:', { idea, clientName, productFocus, action });
    
    if (!idea || !clientName || !productFocus || !action) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const supabase = getSupabase();

    if (action === 'save') {
      // First, let's test if we can connect to the table at all
      const { data: testData, error: testError } = await supabase
        .from('savedideas')
        .select('*')
        .limit(1);
      
      console.log('Table test:', { testData, testError });
      
      if (testError) {
        console.error('Cannot access savedideas table:', testError);
        return NextResponse.json({ 
          success: false, 
          error: `Table access error: ${testError.message || JSON.stringify(testError)}` 
        }, { status: 500 });
      }
      
      // Save the idea - dynamic import for UUID only
      const { v4: uuidv4 } = await import('uuid');
      const savedIdea = {
        id: uuidv4(),
        clientname: clientName,
        productfocus: productFocus,
        title: idea.title,
        description: typeof idea.description === 'string' ? idea.description : JSON.stringify(idea.description),
        category: idea.category,
        concept_type: idea.concept_type || idea.impact,
        impact: idea.concept_type || idea.impact,
        competitivegap: idea.competitiveGap,
        tags: JSON.stringify(idea.tags || []),
        content_pillar: idea.content_pillar,
        product_focus: idea.product_focus,
        concept_idea: idea.concept_idea,
        copywriting_headline: idea.copywriting?.headline,
        copywriting_sub_headline_1: idea.copywriting?.sub_headline_1,
        copywriting_sub_headline_2: idea.copywriting?.sub_headline_2,
        copywriting_bullets: JSON.stringify(idea.copywriting?.bullets || []),
        copywriting_cta: idea.copywriting?.cta,
        savedat: new Date().toISOString()
      };

      console.log('Attempting to save:', savedIdea);
      
      const { data, error } = await supabase
        .from('savedideas')
        .insert([savedIdea]);

      console.log('Insert result data:', data);
      console.log('Insert result error:', error);

      if (error) {
        // Check if it's a duplicate
        if (error.code === '23505') {
          return NextResponse.json({ 
            success: false, 
            error: 'Idea already saved' 
          }, { status: 409 });
        }
        console.error('Error saving idea:', error);
        return NextResponse.json({ 
          success: false, 
          error: `Failed to save idea: ${error.message || JSON.stringify(error)}` 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Idea saved successfully' 
      });

    } else if (action === 'unsave') {
      // Remove the idea
      const { error } = await supabase
        .from('savedideas')
        .delete()
        .eq('clientname', clientName)
        .eq('productfocus', productFocus)
        .eq('title', idea.title);

      if (error) {
        console.error('Error removing idea:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to remove idea' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Idea removed successfully' 
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid action' 
    }, { status: 400 });

  } catch (error) {
    console.error('Error in save-idea API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Cache for saved ideas titles - increased cache time for better performance
const savedIdeasCache = new Map();
const SAVED_IDEAS_CACHE_TTL = 300000; // 5 minutes cache (increased from 1 minute)

// API to check if ideas are saved
export async function GET(request: Request) {
  const startTime = performance.now();
  
  try {
    const url = new URL(request.url);
    const clientName = url.searchParams.get('clientName');
    const productFocus = url.searchParams.get('productFocus');
    
    console.log('[save-idea] GET request params:', {
      clientName,
      productFocus,
      rawClientName: url.searchParams.get('clientName'),
      rawProductFocus: url.searchParams.get('productFocus')
    });
    
    if (!clientName || !productFocus) {
      console.log('[save-idea] Missing parameters - clientName:', !!clientName, 'productFocus:', !!productFocus);
      return NextResponse.json({ 
        success: false, 
        error: 'Missing clientName or productFocus' 
      }, { status: 400 });
    }

    // Cache disabled for production reliability - Vercel serverless functions don't maintain memory
    // const cacheKey = `${clientName}:${productFocus}`;
    // const cached = savedIdeasCache.get(cacheKey);
    // if (cached && (Date.now() - cached.timestamp) < SAVED_IDEAS_CACHE_TTL) {
    //   console.log(`[save-idea] Cache hit for ${cacheKey} - ${performance.now() - startTime}ms`);
    //   return NextResponse.json({ 
    //     success: true, 
    //     savedTitles: cached.data,
    //     topics: cached.topics || []
    //   });
    // }

    const supabase = getSupabase();
    // Query to get full saved ideas data for the AI Image Generator
    const { data, error } = await supabase
      .from('savedideas')
      .select(`
        id,
        title,
        description,
        category,
        concept_type,
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
      .limit(100);

    console.log('[save-idea] Supabase query result:', {
      dataCount: data?.length || 0,
      error: error?.message,
      firstItem: data?.[0] ? {
        clientname: data[0].clientname,
        productfocus: data[0].productfocus,
        title: data[0].title
      } : null
    });

    if (error) {
      console.error('Error fetching saved ideas:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch saved ideas' 
      }, { status: 500 });
    }

    // Transform data for AI Image Generator
    const topics = data.map(item => ({
      title: item.title,
      description: item.description,
      category: item.category,
      concept_type: item.concept_type || item.impact,
      competitiveGap: item.competitivegap,
      tags: (() => {
        try {
          return JSON.parse(item.tags || '[]');
        } catch {
          return [];
        }
      })(),
      content_pillar: item.content_pillar,
      product_focus: item.product_focus,
      concept_idea: item.concept_idea,
      copywriting: {
        headline: item.copywriting_headline,
        sub_headline_1: item.copywriting_sub_headline_1,
        sub_headline_2: item.copywriting_sub_headline_2,
        bullets: (() => {
          try {
            return JSON.parse(item.copywriting_bullets || '[]');
          } catch {
            return [];
          }
        })(),
        cta: item.copywriting_cta
      }
    }));

    const savedTitles = data.map(item => item.title);
    
    // Cache disabled for production reliability
    // savedIdeasCache.set(cacheKey, {
    //   data: savedTitles,
    //   topics: topics,
    //   timestamp: Date.now()
    // });

    const endTime = performance.now();
    console.log(`[save-idea] Query completed in ${endTime - startTime}ms for ${topics.length} topics`);
    
    return NextResponse.json({ 
      success: true, 
      savedTitles,
      topics
    });

  } catch (error) {
    const endTime = performance.now();
    console.error(`[save-idea] Error after ${endTime - startTime}ms:`, error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
