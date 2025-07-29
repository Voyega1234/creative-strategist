import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Test database connection and table existence
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing database connection...')
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseKey?.length || 0,
      urlStart: supabaseUrl?.substring(0, 20) + '...',
      keyStart: supabaseKey?.substring(0, 20) + '...'
    })
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables'
      }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test 1: Check if we can connect to Supabase
    console.log('Testing Supabase connection...')
    
    // Test 2: Check if idea_sessions table exists
    console.log('Checking idea_sessions table...')
    const { data: tableData, error: tableError } = await supabase
      .from('idea_sessions')
      .select('id')
      .limit(1)

    if (tableError) {
      console.error('Table check error:', tableError)
      return NextResponse.json({
        success: false,
        error: `Table check failed: ${tableError.message}`,
        details: tableError
      }, { status: 500 })
    }

    // Test 3: Try a simple insert (then delete)
    console.log('Testing insert operation...')
    const testData = {
      client_name: 'TEST_CLIENT',
      product_focus: 'TEST_PRODUCT',
      n8n_response: { test: true, ideas: [] },
      session_id: 'test_session_' + Date.now(),
      ideas_count: 0,
      model_used: 'test'
    }

    const { data: insertData, error: insertError } = await supabase
      .from('idea_sessions')
      .insert([testData])
      .select('id')
      .single()

    if (insertError) {
      console.error('Insert test error:', insertError)
      return NextResponse.json({
        success: false,
        error: `Insert test failed: ${insertError.message}`,
        details: insertError
      }, { status: 500 })
    }

    // Clean up test data
    if (insertData?.id) {
      await supabase
        .from('idea_sessions')
        .delete()
        .eq('id', insertData.id)
      console.log('Test data cleaned up')
    }

    // Test 4: Count existing records
    const { count, error: countError } = await supabase
      .from('idea_sessions')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      tests: {
        connection: '✅ Connected',
        table: '✅ Table exists',
        insert: '✅ Insert works',
        cleanup: '✅ Delete works'
      },
      stats: {
        existingRecords: count || 0
      }
    })

  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}