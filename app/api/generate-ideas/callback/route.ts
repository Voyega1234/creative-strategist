import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { IDEA_GENERATION_FAILED_MESSAGE, validateIdeaGenerationResult } from '@/lib/ideas/generation-response'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { taskId, status, data, error } = body

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 })
    }

    const supabase = getSupabase()
    let resolvedStatus = status || (data ? 'completed' : 'failed')
    let resolvedError = error || ''

    if (resolvedStatus === 'completed') {
      const validation = validateIdeaGenerationResult(data)
      if (!validation.valid) {
        console.error('[generate-ideas][callback] Invalid completed output:', validation.reason, data)
        resolvedStatus = 'failed'
      }
    }

    if (resolvedStatus !== 'completed') {
      console.error('[generate-ideas][callback] Generation failed:', resolvedError || 'Unknown n8n callback error')
      resolvedError = IDEA_GENERATION_FAILED_MESSAGE
    }

    const updatePayload: Record<string, any> = {
      status: resolvedStatus,
      updated_at: new Date().toISOString(),
    }

    if (resolvedStatus === 'completed') {
      updatePayload.result = data || null
      updatePayload.error = null
    } else {
      updatePayload.result = null
      updatePayload.error = resolvedError || IDEA_GENERATION_FAILED_MESSAGE
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
