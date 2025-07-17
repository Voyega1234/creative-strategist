"use client"

import { useState } from "react"
import { FeedbackTable } from "@/components/feedback-table"
import { FeedbackDetail } from "@/lib/data/feedback"
import { useRouter } from "next/navigation"

interface FeedbackTableWrapperProps {
  initialFeedback: FeedbackDetail[]
}

export function FeedbackTableWrapper({ initialFeedback }: FeedbackTableWrapperProps) {
  const [feedback, setFeedback] = useState(initialFeedback)
  const router = useRouter()

  const handleEdit = async (id: string, updates: { vote: 'good' | 'bad', comment: string }) => {
    try {
      const response = await fetch('/api/feedback', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, updates }),
      })

      if (response.ok) {
        // Update local state immediately for better UX
        setFeedback(prev => prev.map(item => 
          item.id === id ? { ...item, ...updates } : item
        ))
        console.log('Feedback updated successfully in database')
        // Refresh to sync with server state
        router.refresh()
      } else {
        console.error('Failed to update feedback in database')
        alert('Failed to update feedback. Please try again.')
      }
    } catch (error) {
      console.error('Error updating feedback:', error)
      alert('Error updating feedback. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/feedback?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Update local state immediately for better UX
        setFeedback(prev => prev.filter(item => item.id !== id))
        console.log('Feedback deleted successfully from database')
        // Refresh to sync with server state
        router.refresh()
      } else {
        console.error('Failed to delete feedback from database')
        alert('Failed to delete feedback. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting feedback:', error)
      alert('Error deleting feedback. Please try again.')
    }
  }

  return (
    <FeedbackTable
      feedback={feedback}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  )
}