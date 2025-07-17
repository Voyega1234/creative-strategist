"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Loader2, Search } from "lucide-react"
import { useRouter } from "next/navigation"

interface AddCompetitorModalProps {
  clientId: string
  clientName: string
  productFocus?: string
}

export function AddCompetitorModal({ clientId, clientName, productFocus }: AddCompetitorModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [competitorName, setCompetitorName] = useState('')
  const [competitorWebsite, setCompetitorWebsite] = useState('')
  const [competitorDescription, setCompetitorDescription] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!competitorName.trim()) {
      setError('Competitor name is required')
      return
    }

    setIsResearching(true)
    setError('')

    try {
      const response = await fetch('/api/add-competitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          clientName,
          productFocus,
          competitorName: competitorName.trim(),
          competitorWebsite: competitorWebsite.trim(),
          competitorDescription: competitorDescription.trim()
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add competitor')
      }

      // Reset form and close modal
      setCompetitorName('')
      setCompetitorWebsite('')
      setCompetitorDescription('')
      setIsOpen(false)
      
      // Refresh the page to show new competitor
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsResearching(false)
    }
  }

  const handleClose = () => {
    if (!isResearching) {
      setIsOpen(false)
      setError('')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto bg-black text-white hover:bg-gray-800">
          <Plus className="mr-2 h-4 w-4" />
          Add Competitor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Competitor</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="competitorName">Competitor Name *</Label>
            <Input
              id="competitorName"
              value={competitorName}
              onChange={(e) => setCompetitorName(e.target.value)}
              placeholder="Enter competitor name"
              disabled={isResearching}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="competitorWebsite">Website (Optional)</Label>
            <Input
              id="competitorWebsite"
              value={competitorWebsite}
              onChange={(e) => setCompetitorWebsite(e.target.value)}
              placeholder="https://competitor-website.com"
              disabled={isResearching}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="competitorDescription">Additional Details (Optional)</Label>
            <Textarea
              id="competitorDescription"
              value={competitorDescription}
              onChange={(e) => setCompetitorDescription(e.target.value)}
              placeholder="Any additional information about this competitor..."
              className="min-h-[80px] resize-none"
              disabled={isResearching}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isResearching}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isResearching || !competitorName.trim()}
              className="bg-black text-white hover:bg-gray-800"
            >
              {isResearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Research & Add
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}