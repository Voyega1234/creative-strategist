"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MoreHorizontal, Edit, Trash2, Filter, ThumbsUp, ThumbsDown } from "lucide-react"
import { FeedbackDetail } from "@/lib/data/feedback"

interface FeedbackTableProps {
  feedback: FeedbackDetail[]
  onEdit: (id: string, updates: { vote: 'good' | 'bad', comment: string }) => void
  onDelete: (id: string) => void
}

export function FeedbackTable({ feedback, onEdit, onDelete }: FeedbackTableProps) {
  const [voteFilter, setVoteFilter] = useState<'all' | 'good' | 'bad'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVote, setEditVote] = useState<'good' | 'bad'>('good')
  const [editComment, setEditComment] = useState('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const filteredFeedback = feedback.filter(item => 
    voteFilter === 'all' || item.vote === voteFilter
  )

  const handleEdit = (item: FeedbackDetail) => {
    setEditingId(item.id)
    setEditVote(item.vote)
    setEditComment(item.comment)
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (editingId) {
      onEdit(editingId, { vote: editVote, comment: editComment })
      setIsEditDialogOpen(false)
      setEditingId(null)
    }
  }

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false)
    setEditingId(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getVoteBadge = (vote: 'good' | 'bad') => {
    return vote === 'good' ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
        <ThumbsUp className="w-3 h-3 mr-1" />
        Good
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
        <ThumbsDown className="w-3 h-3 mr-1" />
        Bad
      </Badge>
    )
  }

  if (feedback.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4">Feedback</h2>
        <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
          <div className="text-center text-[#8e8e93]">
            No feedback data available
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Feedback</h2>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#8e8e93]" />
          <Select value={voteFilter} onValueChange={(value: 'all' | 'good' | 'bad') => setVoteFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter by vote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Votes</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="bad">Bad</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border border-[#d1d1d6] shadow-sm bg-white">
        <div className="p-4 border-b border-[#f0f0f0]">
          <div className="text-sm text-[#8e8e93]">
            Showing {filteredFeedback.length} of {feedback.length} feedback items
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          <div className="divide-y divide-[#f0f0f0]">
            {filteredFeedback.map((item) => (
              <div key={item.id} className="p-4 hover:bg-[#f8f9fa] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getVoteBadge(item.vote)}
                    <div className="text-sm text-[#8e8e93]">
                      {formatDate(item.created_at)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-[#8e8e93] hover:text-black">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(item)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium text-black mb-1">{item.idea_title}</h3>
                    <p className="text-sm text-[#666] line-clamp-2">{item.idea_description}</p>
                  </div>
                  
                  <div className="bg-[#f8f9fa] p-3 rounded-lg">
                    <div className="text-xs text-[#8e8e93] mb-1">Comment:</div>
                    <p className="text-sm text-black">{item.comment}</p>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Vote</label>
              <Select value={editVote} onValueChange={(value: 'good' | 'bad') => setEditVote(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="bad">Bad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Comment</label>
              <Textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                placeholder="Enter your comment..."
                className="min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}