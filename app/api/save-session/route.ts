import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// High-performance session saving with minimal processing
export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now()
    
    const {
      clientName,
      productFocus,
      n8nResponse,
      userInput,
      selectedTemplate,
      modelUsed,
      sessionId
    } = await request.json()

    console.log('📝 Save session API called:', {
      clientName,
      productFocus,
      sessionId,
      hasN8nResponse: !!n8nResponse,
      ideasCount: n8nResponse?.ideas?.length || 0,
      userInput: userInput ? userInput.substring(0, 50) + '...' : null,
      selectedTemplate,
      modelUsed
    })

    // Quick validation
    if (!clientName || !productFocus || !n8nResponse || !sessionId) {
      console.error('❌ Validation failed:', {
        hasClientName: !!clientName,
        hasProductFocus: !!productFocus,
        hasN8nResponse: !!n8nResponse,
        hasSessionId: !!sessionId
      })
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    // Initialize Supabase client - using anon key since service role key is not properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    console.log('🔗 Supabase config:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseKey?.length || 0
    })
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Count ideas for performance optimization
    const ideasCount = Array.isArray(n8nResponse.ideas) ? n8nResponse.ideas.length : 0

    const insertData = {
      client_name: clientName,
      product_focus: productFocus,
      n8n_response: n8nResponse,
      user_input: userInput || null,
      selected_template: selectedTemplate || null,
      model_used: modelUsed || 'gemini-2.5-pro',
      session_id: sessionId,
      ideas_count: ideasCount
    }

    console.log('💾 Attempting database insert:', {
      client_name: insertData.client_name,
      product_focus: insertData.product_focus,
      session_id: insertData.session_id,
      ideas_count: insertData.ideas_count,
      model_used: insertData.model_used,
      hasN8nResponse: !!insertData.n8n_response
    })

    // Single optimized insert
    const { data, error } = await supabase
      .from('idea_sessions')
      .insert([insertData])
      .select('id, created_at')
      .single()

    if (error) {
      console.error('❌ Database error:', error)
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details
      })
      return NextResponse.json({ 
        success: false, 
        error: `Database error: ${error.message}` 
      }, { status: 500 })
    }

    const endTime = Date.now()
    
    console.log('✅ Database insert successful:', {
      sessionId: data.id,
      createdAt: data.created_at,
      processingTime: endTime - startTime
    })
    
    return NextResponse.json({ 
      success: true, 
      sessionId: data.id,
      createdAt: data.created_at,
      processingTime: endTime - startTime // For performance monitoring
    })

  } catch (error) {
    console.error('Session save error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}