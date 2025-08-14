import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ideas, clientName, productFocus, instructions, model } = body;
    
    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No ideas provided' 
      }, { status: 400 });
    }

    if (!clientName || !productFocus) {
      return NextResponse.json({ 
        success: false, 
        error: 'Client name and product focus are required' 
      }, { status: 400 });
    }

    const supabase = getSupabase();
    const shareId = uuidv4();

    // Create the shared ideas record
    const sharedIdeasRecord = {
      id: shareId,
      clientname: clientName,
      productfocus: productFocus,
      instructions: instructions || null,
      model: model || 'Gemini 2.5 Pro',
      ideas: JSON.stringify(ideas),
      createdat: new Date().toISOString(),
      totalideas: ideas.length
    };

    const { data, error } = await supabase
      .from('sharedideas')
      .insert([sharedIdeasRecord])
      .select('id');

    if (error) {
      console.error('Error creating shared ideas:', error);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to create shareable link: ${error.message}` 
      }, { status: 500 });
    }

    // Generate the shareable URL
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shared/${shareId}`;

    const response = NextResponse.json({ 
      success: true, 
      shareId,
      shareUrl,
      message: 'Shareable link created successfully' 
    });

    // Add performance headers
    response.headers.set('Cache-Control', 'no-cache, no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    return response;

  } catch (error) {
    console.error('Error in share-ideas API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Get shared ideas by ID
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shareId = url.searchParams.get('id');
    
    if (!shareId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Share ID is required' 
      }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sharedideas')
      .select('*')
      .eq('id', shareId)
      .single();

    if (error) {
      console.error('Error fetching shared ideas:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Shared ideas not found' 
      }, { status: 404 });
    }

    if (!data) {
      return NextResponse.json({ 
        success: false, 
        error: 'Shared ideas not found' 
      }, { status: 404 });
    }

    // Parse the ideas JSON
    let ideas;
    try {
      ideas = JSON.parse(data.ideas);
    } catch (parseError) {
      console.error('Error parsing ideas JSON:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid ideas data' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        id: data.id,
        clientName: data.clientname,
        productFocus: data.productfocus,
        instructions: data.instructions,
        model: data.model,
        ideas: ideas,
        createdAt: data.createdat,
        totalIdeas: data.totalideas
      }
    });

  } catch (error) {
    console.error('Error in share-ideas GET API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}