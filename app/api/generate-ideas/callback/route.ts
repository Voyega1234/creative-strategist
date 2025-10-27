import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { taskId, status, data, error } = body

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 })
    }

    const supabase = getSupabase()
    const resolvedStatus = status || (data ? 'completed' : 'failed')

    const updatePayload: Record<string, any> = {
      status: resolvedStatus,
      updated_at: new Date().toISOString(),
    }

    if (resolvedStatus === 'completed') {
      updatePayload.result = data || null
      updatePayload.error = null
    } else {
      updatePayload.result = null
      updatePayload.error = error || 'Unknown error from n8n callback'
    }

    const { error: updateError } = await supabase
      .from('idea_generation_tasks')
      .update(updatePayload)
      .eq('task_id', taskId)

    if (updateError) {
      console.error('[generate-ideas][callback] Failed to update task:', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update task status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[generate-ideas][callback] Error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Callback processing failed' }, { status: 500 })
  }
}
