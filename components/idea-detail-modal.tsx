"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { IdeaRecommendation } from "@/app/page"
import { RefreshCcw } from "lucide-react"
import { FacebookPost } from "./facebook-post"

interface IdeaDetailModalProps {
  isOpen: boolean
  onClose: () => void
  idea: IdeaRecommendation | null
  clientName?: string
  productFocus?: string
  adAccount?: string
  instructions?: string
}

export function IdeaDetailModal({ isOpen, onClose, idea, clientName, productFocus, adAccount, instructions }: IdeaDetailModalProps) {
  const [isGeneratingFacebook, setIsGeneratingFacebook] = useState(false)
  const [facebookPostData, setFacebookPostData] = useState<{ [key: string]: any }>({})
  const [showFacebookPost, setShowFacebookPost] = useState<{ [key: string]: boolean }>({})
  
  if (!idea) return null

  // Create unique key for current idea
  const ideaKey = `${idea.title}-${idea.description}`.substring(0, 50)

  const handleGenerateFacebookPost = async () => {
    setIsGeneratingFacebook(true)
    
    try {
      const payload = {
        clientName: clientName,
        productFocus: productFocus,
        adAccount: adAccount,
        instructions: instructions,
        title: idea.title,
        description: idea.description,
        category: idea.category,
        impact: idea.impact,
        competitiveGap: idea.competitiveGap,
        tags: idea.tags,
        content_pillar: idea.content_pillar,
        product_focus: idea.product_focus,
        concept_idea: idea.concept_idea,
        copywriting: idea.copywriting
      }

      console.log('🔄 Generating Facebook post with payload:', payload)

      const response = await fetch('https://n8n.srv934175.hstgr.cloud/webhook/a6f8d152-df0d-4323-93ce-4b291703bb3f', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      
      if (response.ok) {
        console.log('✅ Facebook post generated:', result)
        // Handle both array and direct object responses
        const postData = Array.isArray(result) ? result : [result]
        setFacebookPostData(prev => ({ ...prev, [ideaKey]: postData[0] }))
        setShowFacebookPost(prev => ({ ...prev, [ideaKey]: true }))
      } else {
        console.error('❌ Facebook post generation failed:', result)
        alert('Failed to generate Facebook post. Please try again.')
      }
    } catch (error) {
      console.error('❌ Facebook post generation error:', error)
      alert('An error occurred while generating Facebook post. Please try again.')
    } finally {
      setIsGeneratingFacebook(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl idea-detail-modal">
        <ScrollArea className="max-h-[80vh] pr-6">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-2">{idea.title}</DialogTitle>
          </DialogHeader>
          <div className="space-x-2 mb-4">
            <Badge variant="secondary" className="mr-1">{idea.category}</Badge>
            <Badge variant={
              idea.impact === 'High' ? 'default' : 
              idea.impact === 'Medium' ? 'outline' : 
              'secondary'
            } className={cn(
              idea.impact === 'High' ? 'bg-green-500 text-white' :
              idea.impact === 'Medium' ? 'bg-yellow-500 text-white' :
              ''
            )}>{idea.impact} Impact</Badge>
            {(idea.tags || []).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>

          <div className="py-4 space-y-6">
            <section>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm">{idea.description}</p>
              {idea.competitiveGap && (
                <>
                  <h5 className="mt-3 font-semibold text-sm">Competitive Gap Addressed</h5>
                  <p className="text-sm">{idea.competitiveGap}</p>
                </>
              )}
            </section>

            {/* Creative Execution Details Section */}
            {(idea.content_pillar || idea.product_focus || idea.concept_idea || idea.copywriting) && (
              <section className="space-y-3 pt-4 border-t mt-4">
                <h4 className="font-semibold">Creative Execution Details</h4>
                {idea.content_pillar && (
                  <div className="text-sm">
                    <h5 className="inline-block font-medium text-sm mr-2 text-muted-foreground">Content Pillar:</h5>
                    <span>{idea.content_pillar}</span>
                  </div>
                )}
                {idea.product_focus && (
                  <div className="text-sm">
                    <h5 className="inline-block font-medium text-sm mr-2 text-muted-foreground">Product Focus:</h5>
                    <span>{idea.product_focus}</span>
                  </div>
                )}
                {idea.concept_idea && (
                  <div className="text-sm">
                    <h5 className="inline-block font-medium text-sm mr-2 text-muted-foreground">Concept Idea:</h5>
                    <span>{idea.concept_idea}</span>
                  </div>
                )}

                {/* Display Copywriting Details */}
                {idea.copywriting && (
                  <div className="mt-3 space-y-2 border p-3 rounded-md bg-muted/20">
                    <h5 className="font-medium text-sm mb-1">Draft Copywriting:</h5>
                    {idea.copywriting.headline && (
                      <p className="text-sm"><strong>Headline:</strong> {idea.copywriting.headline}</p>
                    )}
                    {idea.copywriting.sub_headline_1 && (
                      <p className="text-sm text-muted-foreground"><strong>Sub-Headline 1:</strong> {idea.copywriting.sub_headline_1}</p>
                    )}
                    {idea.copywriting.sub_headline_2 && (
                      <p className="text-sm text-muted-foreground"><strong>Sub-Headline 2:</strong> {idea.copywriting.sub_headline_2}</p>
                    )}
                    {idea.copywriting.bullets && idea.copywriting.bullets.length > 0 && (
                      <div className="text-sm mt-1">
                        <strong className="block text-xs text-muted-foreground mb-0.5">Bullets:</strong>
                        <ul className="list-disc list-inside pl-2 space-y-0.5">
                          {idea.copywriting.bullets.map((bullet, idx) => (
                            <li key={idx}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {idea.copywriting.cta && (
                      <div className="text-sm mt-2"><strong>CTA:</strong> <Badge variant="outline">{idea.copywriting.cta}</Badge></div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Facebook Post Preview */}
            {showFacebookPost[ideaKey] && facebookPostData[ideaKey] && (
              <section className="pt-6 border-t">
                <h4 className="font-semibold mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-[#1877f2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Mockup Facebook Post Preview
                </h4>
                <FacebookPost data={facebookPostData[ideaKey]} />
              </section>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-4 pr-6 flex gap-2">
          <Button
            onClick={handleGenerateFacebookPost}
            disabled={isGeneratingFacebook}
            className="bg-[#1877f2] hover:bg-[#166fe5] text-white"
          >
            {isGeneratingFacebook ? (
              <>
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Generate Mockup Post
              </>
            )}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}