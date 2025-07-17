import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

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
      
      // Save the idea
      const savedIdea = {
        id: uuidv4(),
        clientname: clientName,
        productfocus: productFocus,
        title: idea.title,
        description: idea.description,
        category: idea.category,
        impact: idea.impact,
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

// API to check if ideas are saved
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
      .select('title')
      .eq('clientname', clientName)
      .eq('productfocus', productFocus);

    if (error) {
      console.error('Error fetching saved ideas:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch saved ideas' 
      }, { status: 500 });
    }

    const savedTitles = data.map(item => item.title);
    return NextResponse.json({ 
      success: true, 
      savedTitles 
    });

  } catch (error) {
    console.error('Error in save-idea GET API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}