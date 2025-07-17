import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientName = searchParams.get('client')
  const productFocus = searchParams.get('product')

  if (!clientName || !productFocus) {
    return new NextResponse('Missing parameters', { status: 400 })
  }
  
  const { data, error } = await getSupabase()
    .from('research_market')
    .select('analysis_data')
    .eq('client_name', clientName)
    .eq('product_focus', productFocus)
    .single()

  if (error || !data) {
    return new NextResponse('Not found', { status: 404 })
  }

  return NextResponse.json(data.analysis_data)
}
