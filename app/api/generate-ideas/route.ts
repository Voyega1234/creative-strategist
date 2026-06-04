import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { getWebhookResponseError, IDEA_GENERATION_FAILED_MESSAGE } from '@/lib/ideas/generation-response'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // this route should respond quickly after enqueueing

const N8N_FIRE_TIMEOUT_MS = 30_000
const N8N_WEBHOOK_URL = 'https://n8n.srv934175.hstgr.cloud/webhook/ee9dbf72-1c09-4dd2-83e9-a6c1775ed8c1'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clientName, productFocus } = body

    if (!clientName || !productFocus) {
      return NextResponse.json(
        { success: false, error: 'Client name and product focus are required' },
        { status: 400 }
      )
    }

    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const baseUrl = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001')
    const callbackUrl = `${baseUrl}/api/generate-ideas/callback`
    const taskId = randomUUID()

    const supabase = getSupabase()
    const insertPayload = {
      task_id: taskId,
      status: 'processing',
      client_name: clientName,
      product_focus: productFocus,
      payload: body,
      error: null,
      result: null,
      updated_at: new Date().toISOString()
    }

    const { error: insertError } = await supabase.from('idea_generation_tasks').insert(insertPayload)
    if (insertError) {
      console.error('[generate-ideas] Failed to record task:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create generation task' }, { status: 500 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), N8N_FIRE_TIMEOUT_MS)

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          taskId,
          callbackUrl,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[generate-ideas] Failed to trigger n8n:', response.status, errorText)
        await supabase
          .from('idea_generation_tasks')
          .update({ status: 'failed', error: IDEA_GENERATION_FAILED_MESSAGE, updated_at: new Date().toISOString() })
          .eq('task_id', taskId)

        return NextResponse.json({ success: false, error: IDEA_GENERATION_FAILED_MESSAGE, taskId }, { status: 502 })
      }

      const responseText = await response.text()
      if (responseText.trim()) {
        try {
          const responseData = JSON.parse(responseText)
          const webhookError = getWebhookResponseError(responseData)
          if (webhookError) {
            console.error('[generate-ideas] n8n returned an error payload:', webhookError)
            await supabase
              .from('idea_generation_tasks')
              .update({ status: 'failed', error: IDEA_GENERATION_FAILED_MESSAGE, updated_at: new Date().toISOString() })
              .eq('task_id', taskId)

            return NextResponse.json({ success: false, error: IDEA_GENERATION_FAILED_MESSAGE, taskId }, { status: 502 })
          }
        } catch {
          console.log('[generate-ideas] n8n returned a non-JSON acknowledgement')
        }
      }
    } catch (error: any) {
      clearTimeout(timeout)
      console.error('[generate-ideas] Error firing n8n webhook:', error)
      await supabase
        .from('idea_generation_tasks')
        .update({ status: 'failed', error: IDEA_GENERATION_FAILED_MESSAGE, updated_at: new Date().toISOString() })
        .eq('task_id', taskId)

      return NextResponse.json({ success: false, error: IDEA_GENERATION_FAILED_MESSAGE, taskId }, { status: 502 })
    }

    return NextResponse.json({ success: true, taskId, status: 'processing' })
  } catch (error: any) {
    console.error('[generate-ideas] Error in POST handler:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to start idea generation' }, { status: 500 })
  }
}
