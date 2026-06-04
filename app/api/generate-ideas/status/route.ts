import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { IDEA_GENERATION_FAILED_MESSAGE, validateIdeaGenerationResult } from '@/lib/ideas/generation-response'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 })
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('idea_generation_tasks')
      .select('status, result, error, client_name, product_focus, payload')
      .eq('task_id', taskId)
      .maybeSingle()

    if (error) {
      console.error('[generate-ideas][status] Supabase error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch task status' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
    }

    if (data.status === 'completed') {
      const validation = validateIdeaGenerationResult(data.result)
      if (!validation.valid) {
        console.error('[generate-ideas][status] Invalid completed output:', validation.reason, data.result)
        await supabase
          .from('idea_generation_tasks')
          .update({
            status: 'failed',
            result: null,
            error: IDEA_GENERATION_FAILED_MESSAGE,
            updated_at: new Date().toISOString(),
          })
          .eq('task_id', taskId)

        return NextResponse.json({
          success: true,
          status: 'failed',
          result: null,
          error: IDEA_GENERATION_FAILED_MESSAGE,
          clientName: data.client_name,
          productFocus: data.product_focus,
          payload: data.payload,
        })
      }
    }

    return NextResponse.json({
      success: true,
      status: data.status,
      result: data.result,
      error: data.error,
      clientName: data.client_name,
      productFocus: data.product_focus,
      payload: data.payload,
    })
  } catch (err: any) {
    console.error('[generate-ideas][status] Error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch status' }, { status: 500 })
  }
}
