import { NextRequest, NextResponse } from 'next/server'
import { updateFeedback, deleteFeedback } from '@/lib/data/feedback'

// PUT - Update feedback
export async function PUT(request: NextRequest) {
  try {
    const { id, updates } = await request.json()
    
    if (!id || !updates) {
      return NextResponse.json({ error: 'ID and updates are required' }, { status: 400 })
    }

    const success = await updateFeedback(id, updates)
    
    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error updating feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete feedback
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const success = await deleteFeedback(id)
    
    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error deleting feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}