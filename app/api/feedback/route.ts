import { NextRequest, NextResponse } from 'next/server'
import { updateFeedback, deleteFeedback } from '@/lib/data/feedback'
import { getSupabase } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

// POST - Create new feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      idea_id, 
      run_id, 
      vote, 
      comment, 
      client_name, 
      product_focus, 
      idea_title, 
      idea_description, 
      concept_ideas 
    } = body
    
    // Validate required fields
    if (!vote || !comment || !client_name || !product_focus || !idea_title) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    // Validate vote value
    if (vote !== 'good' && vote !== 'bad') {
      return NextResponse.json({ 
        success: false, 
        error: 'Vote must be either "good" or "bad"' 
      }, { status: 400 })
    }

    const supabase = getSupabase()

    // Generate IDs if not provided
    const feedbackId = uuidv4()
    const finalIdeaId = idea_id || `idea-${uuidv4()}`
    const finalRunId = run_id || uuidv4()

    const feedbackData = {
      id: feedbackId,
      idea_id: finalIdeaId,
      run_id: finalRunId,
      vote,
      comment: comment.trim(),
      client_name,
      product_focus,
      idea_title,
      idea_description: idea_description || '',
      concept_ideas: concept_ideas || '',
      created_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('idea_feedback')
      .insert([feedbackData])

    if (error) {
      console.error('Error saving feedback:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to save feedback' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Feedback saved successfully',
      feedback_id: feedbackId
    })

  } catch (error) {
    console.error('Error in feedback API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

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