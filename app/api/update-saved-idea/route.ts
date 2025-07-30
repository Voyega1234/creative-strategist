import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idea } = body;
    
    if (!idea || !idea.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing idea or idea ID' 
      }, { status: 400 });
    }

    const supabase = getSupabase();

    // Update the saved idea
    const { data, error } = await supabase
      .from('savedideas')
      .update({
        title: idea.title,
        description: idea.description,
        category: idea.category,
        impact: idea.impact,
        competitivegap: idea.competitivegap,
        tags: idea.tags, // Already JSON stringified from frontend
        content_pillar: idea.content_pillar,
        product_focus: idea.product_focus,
        concept_idea: idea.concept_idea,
        copywriting_headline: idea.copywriting_headline,
        copywriting_sub_headline_1: idea.copywriting_sub_headline_1,
        copywriting_sub_headline_2: idea.copywriting_sub_headline_2,
        copywriting_bullets: idea.copywriting_bullets, // Already JSON stringified from frontend
        copywriting_cta: idea.copywriting_cta
      })
      .eq('id', idea.id);

    if (error) {
      console.error('Error updating saved idea:', error);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to update idea: ${error.message}` 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Idea updated successfully' 
    });

  } catch (error) {
    console.error('Error in update-saved-idea API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}