import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('savedideas')
      .select('*')
      .eq('clientname', clientName)
      .eq('productfocus', productFocus)
      .order('savedat', { ascending: false });

    if (error) {
      console.error('Error fetching saved topics:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch saved topics' 
      }, { status: 500 });
    }

    // Transform the data back to the expected format
    const savedTopics = data.map(item => ({
      title: item.title,
      description: item.description,
      category: item.category,
      impact: item.impact,
      competitiveGap: item.competitivegap,
      tags: JSON.parse(item.tags || '[]'),
      content_pillar: item.content_pillar,
      product_focus: item.product_focus,
      concept_idea: item.concept_idea,
      copywriting: {
        headline: item.copywriting_headline,
        sub_headline_1: item.copywriting_sub_headline_1,
        sub_headline_2: item.copywriting_sub_headline_2,
        bullets: JSON.parse(item.copywriting_bullets || '[]'),
        cta: item.copywriting_cta
      }
    }));

    return NextResponse.json({ 
      success: true, 
      savedTopics 
    });

  } catch (error) {
    console.error('Error in saved-topics API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}