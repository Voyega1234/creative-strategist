import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const normalizeIdea = (idea: any) => {
  const conceptType = idea?.concept_type || idea?.impact || null
  return {
    ...idea,
    concept_type: conceptType,
    impact: conceptType,
  }
}

// High-performance session history with pagination and caching
export async function GET(request: NextRequest) {
  const startTime = performance.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const ideaSessionId = searchParams.get('ideaSessionId')
    const clientName = searchParams.get('clientName')
    const favoritesOnly = searchParams.get('favoritesOnly') === 'true'
    // summary mode: skip heavy ideas payload (used by the sidebar list which only needs title/count/date)
    const summaryOnly = searchParams.get('summary') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50) // Cap at 50 for performance
    const offset = parseInt(searchParams.get('offset') || '0')

    // SessionId is optional - if not provided, we'll get all sessions for the client
    console.log('🔍 Session history request:', { sessionId, ideaSessionId, clientName, limit, offset })

    // Initialize Supabase client - using anon key since service role key is not properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Build optimized query - filter by client_name primarily for better performance
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
      .or('selected_template.is.null,selected_template.not.like.image:%')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add client filter - this should be the primary filter
    if (ideaSessionId) {
      query = query.eq('id', ideaSessionId)
    }
    if (clientName) {
      query = query.eq('client_name', clientName)
    }
    if (favoritesOnly) {
      query = query.eq('n8n_response->_is_favorite', true)
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
    let countQuery = supabase
      .from('idea_sessions')
      .select('id', { count: 'exact', head: true })
      .or('selected_template.is.null,selected_template.not.like.image:%')
    
    if (clientName) {
      countQuery = countQuery.eq('client_name', clientName)
    }
    if (ideaSessionId) {
      countQuery = countQuery.eq('id', ideaSessionId)
    }
    if (favoritesOnly) {
      countQuery = countQuery.eq('n8n_response->_is_favorite', true)
    }
    
    const { count } = await countQuery

    // Transform for frontend (minimize data transfer)
    const transformedSessions = sessions?.map(session => {
      const base = {
        id: session.id,
        clientName: session.client_name,
        productFocus: session.product_focus,
        userInput: session.user_input,
        selectedTemplate: session.selected_template,
        modelUsed: session.model_used,
        ideasCount: session.ideas_count,
        createdAt: session.created_at,
        isFavorite: session.n8n_response?._is_favorite === true,
        title: typeof session.n8n_response?._session_title === 'string' ? session.n8n_response._session_title : null,
      }

      if (summaryOnly) {
        return base
      }

      const normalizedIdeas = Array.isArray(session.n8n_response?.ideas) ? session.n8n_response.ideas.map(normalizeIdea) : []

      return {
        ...base,
        // Send full ideas data for loading complete sessions
        ideas: normalizedIdeas,
        n8nResponse: session.n8n_response ? { ...session.n8n_response, ideas: normalizedIdeas } : undefined
      }
    })

    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`📊 Session history query completed in ${queryTime.toFixed(2)}ms for client: ${clientName}, sessions: ${transformedSessions?.length || 0}`)

    // Add cache headers for performance
    const response = NextResponse.json({ 
      success: true, 
      sessions: transformedSessions,
      totalCount: count || 0,
      hasMore: (offset + limit) < (count || 0),
      queryTime: `${queryTime.toFixed(2)}ms`
    })

    // Optimized cache headers
    response.headers.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120')
    response.headers.set('X-Query-Time', `${queryTime.toFixed(2)}ms`)
    response.headers.set('X-Client-Name', clientName || 'unknown')
    
    return response

  } catch (error) {
    const endTime = performance.now()
    const errorTime = endTime - startTime
    
    console.error(`❌ Session history error after ${errorTime.toFixed(2)}ms:`, error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      queryTime: `${errorTime.toFixed(2)}ms`
    }, { status: 500 })
  }
}
