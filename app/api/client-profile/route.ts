import { NextRequest, NextResponse } from 'next/server'
import { getClientProfile } from '@/lib/data/client-profile'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'Client ID is required'
      }, { status: 400 })
    }

    console.log('🔍 Fetching client profile for ID:', clientId)

    const clientProfile = await getClientProfile(clientId)

    if (!clientProfile) {
      return NextResponse.json({
        success: false,
        error: 'Client profile not found'
      }, { status: 404 })
    }

    console.log('✅ Client profile found:', {
      clientName: clientProfile.clientName,
      hasAdAccount: !!clientProfile.ad_account_id
    })

    return NextResponse.json({
      success: true,
      client: clientProfile
    })

  } catch (error) {
    console.error('❌ Error fetching client profile:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}