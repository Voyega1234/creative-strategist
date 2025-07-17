"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  Eye, 
  Target, 
  TrendingUp, 
  MessageSquare, 
  Lightbulb,
  FileText,
  Quote,
  List,
  MousePointer,
  Copy
} from "lucide-react"
import { IdeaRecommendation } from "@/app/page"

interface IdeaDetailModalProps {
  isOpen: boolean
  onClose: () => void
  idea: IdeaRecommendation | null
}

export function IdeaDetailModal({ isOpen, onClose, idea }: IdeaDetailModalProps) {
  if (!idea) return null

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Could add a toast notification here
    console.log('Copied to clipboard!')
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'High':
        return 'bg-[#34c759] text-white'
      case 'Medium':
        return 'bg-[#f59e0b] text-white'
      case 'Low':
        return 'bg-[#ef4444] text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Eye className="w-6 h-6" />
            Idea Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className={`text-xs font-normal px-3 py-1 ${getImpactColor(idea.impact)}`}>
                <TrendingUp className="w-3 h-3 mr-1" />
                {idea.impact} Impact
              </Badge>
              <Badge variant="outline" className="text-xs px-3 py-1">
                <Target className="w-3 h-3 mr-1" />
                {idea.category}
              </Badge>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900">{idea.concept_idea}</h2>
            
            {idea.title && idea.title !== idea.concept_idea && (
              <h3 className="text-lg font-semibold text-gray-700">{idea.title}</h3>
            )}
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold">Description</h3>
            </div>
            <p className="text-gray-700 leading-relaxed">{idea.description}</p>
          </div>

          {/* Competitive Gap */}
          {idea.competitiveGap && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Competitive Gap</h3>
                </div>
                <p className="text-gray-700 leading-relaxed bg-blue-50 p-4 rounded-lg">
                  {idea.competitiveGap}
                </p>
              </div>
            </>
          )}

          {/* Content Pillar & Product Focus */}
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {idea.content_pillar && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold">Content Pillar</h3>
                </div>
                <p className="text-gray-700 bg-orange-50 p-3 rounded-lg">{idea.content_pillar}</p>
              </div>
            )}
            
            {idea.product_focus && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold">Product Focus</h3>
                </div>
                <p className="text-gray-700 bg-purple-50 p-3 rounded-lg">{idea.product_focus}</p>
              </div>
            )}
          </div>

          {/* Tags */}
          {idea.tags && idea.tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {idea.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="bg-green-50 border-green-200 text-green-800">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Copywriting Details */}
          {idea.copywriting && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Quote className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold">Copywriting</h3>
                </div>
                
                <div className="space-y-4 bg-indigo-50 p-6 rounded-lg">
                  {/* Headline */}
                  {idea.copywriting.headline && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-indigo-900">Main Headline</h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.headline)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-lg font-medium text-gray-800 bg-white p-4 rounded border-l-4 border-indigo-500">
                        {idea.copywriting.headline}
                      </p>
                    </div>
                  )}

                  {/* Sub Headlines */}
                  {idea.copywriting.sub_headline_1 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-indigo-900">Sub Headline 1</h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.sub_headline_1)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-indigo-300">
                        {idea.copywriting.sub_headline_1}
                      </p>
                    </div>
                  )}

                  {idea.copywriting.sub_headline_2 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-indigo-900">Sub Headline 2</h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.sub_headline_2)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-indigo-300">
                        {idea.copywriting.sub_headline_2}
                      </p>
                    </div>
                  )}

                  {/* Bullets */}
                  {idea.copywriting.bullets && idea.copywriting.bullets.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-indigo-900">Key Points</h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.bullets.join('\n• '))}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="bg-white p-4 rounded border-l-4 border-indigo-300">
                        <ul className="space-y-2">
                          {idea.copywriting.bullets.map((bullet, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-indigo-500 font-bold">•</span>
                              <span className="text-gray-700">{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  {idea.copywriting.cta && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-indigo-900">Call to Action</h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(idea.copywriting.cta)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded font-medium text-center">
                        <MousePointer className="w-5 h-5 inline mr-2" />
                        {idea.copywriting.cta}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}