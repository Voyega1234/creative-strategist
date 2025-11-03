import { NextResponse } from 'next/server'

const N8N_FACEBOOK_WEBHOOK = process.env.N8N_FACEBOOK_WEBHOOK_URL || 'https://n8n.srv934175.hstgr.cloud/webhook/a6f8d152-df0d-4323-93ce-4b291703bb3f'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    const response = await fetch(N8N_FACEBOOK_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[facebook-post] N8N webhook error:', response.status, data)
      return NextResponse.json(
        { success: false, error: 'Failed to generate facebook post', details: data },
        { status: response.status },
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[facebook-post] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
