import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received request body:', JSON.stringify(body, null, 2))
    
    const { clientName, productFocus, strategicInsights } = body

    console.log('Parsed values:', {
      clientName,
      productFocus,
      strategicInsights: strategicInsights ? 'present' : 'missing'
    })

    if (!clientName || !productFocus || !strategicInsights) {
      console.log('Validation failed:', {
        hasClientName: !!clientName,
        hasProductFocus: !!productFocus,
        hasStrategicInsights: !!strategicInsights
      })
      return NextResponse.json(
        { 
          error: 'clientName, productFocus, and strategicInsights are required',
          received: { clientName, productFocus, hasStrategicInsights: !!strategicInsights }
        },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Get existing research market data
    const { data: existingData, error: fetchError } = await supabase
      .from('research_market')
      .select('analysis_data')
      .eq('client_name', clientName)
      .eq('product_focus', productFocus)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing data:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch existing data' },
        { status: 500 }
      )
    }

    console.log('Existing data fetch result:', {
      hasData: !!existingData,
      error: fetchError?.code,
      clientName,
      productFocus,
      hasExistingResearch: !!existingData?.analysis_data?.analysis?.research?.length
    })

    // Merge the strategic insights with existing data
    const currentAnalysisData = existingData?.analysis_data || {}
    const updatedAnalysisData = {
      ...currentAnalysisData,
      analysis: {
        ...currentAnalysisData.analysis,
        summary: strategicInsights.summary || '',
        strengths: strategicInsights.strengths || [],
        weaknesses: strategicInsights.weaknesses || [],
        market_gaps: strategicInsights.market_gaps || [],
        shared_patterns: strategicInsights.shared_patterns || [],
        differentiation_strategies: strategicInsights.differentiation_strategies || [],
        // Preserve existing research insights
        research: currentAnalysisData.analysis?.research || []
      }
    }

    // Update or Insert the database record
    let saveError = null
    
    if (existingData) {
      // UPDATE existing record
      console.log('Updating existing record...')
      const { error } = await supabase
        .from('research_market')
        .update({
          analysis_data: updatedAnalysisData
        })
        .eq('client_name', clientName)
        .eq('product_focus', productFocus)
      saveError = error
    } else {
      // INSERT new record
      console.log('Creating new record...')
      const { error } = await supabase
        .from('research_market')
        .insert([{
          client_name: clientName,
          product_focus: productFocus,
          analysis_data: updatedAnalysisData
        }])
      saveError = error
    }

    if (saveError) {
      console.error('Error saving strategic insights:', saveError)
      return NextResponse.json(
        { error: 'Failed to save strategic insights', details: saveError },
        { status: 500 }
      )
    }

    const action = existingData ? 'updated' : 'created'
    const preservedResearchCount = currentAnalysisData.analysis?.research?.length || 0
    console.log(`Successfully ${action} strategic insights for ${clientName} - ${productFocus}`)
    console.log(`Preserved ${preservedResearchCount} research insights`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Strategic insights ${action} for ${clientName} - ${productFocus}. Preserved ${preservedResearchCount} research insights.`,
      action: action,
      preservedResearchCount
    })
  } catch (error) {
    console.error('Error in save-strategic-insights API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}