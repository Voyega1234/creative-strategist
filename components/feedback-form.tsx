"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ThumbsUp, ThumbsDown, MessageSquare, Send } from "lucide-react"
import { IdeaRecommendation } from "@/app/page"

interface FeedbackFormProps {
  isOpen: boolean
  onClose: () => void
  idea: IdeaRecommendation | null
  clientName: string
  productFocus: string
  onSuccess?: () => void
}

export function FeedbackForm({ 
  isOpen, 
  onClose, 
  idea, 
  clientName, 
  productFocus,
  onSuccess 
}: FeedbackFormProps) {
  const [vote, setVote] = useState<'good' | 'bad' | ''>('')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    setVote('')
    setComment('')
    setIsSubmitting(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!vote || !comment.trim() || !idea) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote,
          comment: comment.trim(),
          client_name: clientName,
          product_focus: productFocus,
          idea_title: idea.title,
          idea_description: idea.description,
          concept_ideas: idea.concept_idea,
        }),
      })

      const data = await response.json()

      if (data.success) {
        handleClose()
        onSuccess?.()
        // Could add a toast notification here
        console.log('Feedback submitted successfully!')
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`)
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('เกิดข้อผิดพลาดในการส่งความคิดเห็น กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = vote !== '' && comment.trim() !== '' && !isSubmitting

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Add Feedback
          </DialogTitle>
        </DialogHeader>
        
        {idea && (
          <div className="space-y-4">
            {/* Idea Summary */}
            <div className="bg-[#f8f9fa] p-3 rounded-lg">
              <h4 className="font-medium text-sm mb-1">{idea.concept_idea}</h4>
              <p className="text-xs text-[#666] line-clamp-2">{idea.description}</p>
            </div>

            {/* Vote Selection */}
            <div className="space-y-2">
              <Label htmlFor="vote">How do you rate this idea?</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className={`flex-1 ${
                    vote === 'good' 
                      ? 'bg-green-600 border-green-600 text-white hover:bg-green-700 hover:border-green-700' 
                      : 'border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400'
                  }`}
                  onClick={() => setVote('good')}
                >
                  <div className="flex items-center justify-center">
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Good
                  </div>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={`flex-1 ${
                    vote === 'bad' 
                      ? 'bg-red-600 border-red-600 text-white hover:bg-red-700 hover:border-red-700' 
                      : 'border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400'
                  }`}
                  onClick={() => setVote('bad')}
                >
                  <div className="flex items-center justify-center">
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Bad
                  </div>
                </Button>
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="comment">Your feedback</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Please share your thoughts about this idea..."
                className="min-h-[100px] resize-none"
                maxLength={500}
              />
              <div className="text-xs text-[#8e8e93] text-right">
                {comment.length}/500 characters
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!isFormValid}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}