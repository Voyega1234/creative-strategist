import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// High-performance session history with pagination and caching
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const clientName = searchParams.get('clientName')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Session ID required' 
      }, { status: 400 })
    }

    // Initialize Supabase client  
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Build optimized query
    let query = supabase
      .from('idea_sessions')
      .select(`
        id,
        client_name,
        product_focus,
        user_input,
        selected_template,
        model_used,
        ideas_count,
        created_at,
        n8n_response
      `)
      .eq('session_id', sessionId)
      .gte('expires_at', new Date().toISOString()) // Only non-expired
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add client filter if specified
    if (clientName) {
      query = query.eq('client_name', clientName)
    }

    const { data: sessions, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch history' 
      }, { status: 500 })
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('idea_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .gte('expires_at', new Date().toISOString())

    // Transform for frontend (minimize data transfer)
    const transformedSessions = sessions?.map(session => ({
      id: session.id,
      clientName: session.client_name,
      productFocus: session.product_focus,
      userInput: session.user_input,
      selectedTemplate: session.selected_template,
      modelUsed: session.model_used,
      ideasCount: session.ideas_count,
      createdAt: session.created_at,
      // Only send idea summaries for list view
      ideas: session.n8n_response?.ideas?.map((idea: any) => ({
        title: idea.concept_idea || idea.title,
        category: idea.category,
        impact: idea.impact
      })) || []
    }))

    // Add cache headers for performance
    const response = NextResponse.json({ 
      success: true, 
      sessions: transformedSessions,
      totalCount: count || 0,
      hasMore: (offset + limit) < (count || 0)
    })

    // Cache for 1 minute
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
    
    return response

  } catch (error) {
    console.error('Session history error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}