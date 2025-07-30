"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { IdeaRecommendation } from "@/app/page"

interface IdeaDetailModalProps {
  isOpen: boolean
  onClose: () => void
  idea: IdeaRecommendation | null
}

export function IdeaDetailModal({ isOpen, onClose, idea }: IdeaDetailModalProps) {
  if (!idea) return null


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
          </div>
        </ScrollArea>
        <DialogFooter className="mt-4 pr-6">
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