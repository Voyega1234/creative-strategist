"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EditableSavedIdeaModal } from "@/components/editable-saved-idea-modal"
import { getSupabase } from "@/lib/supabase/client"
import { 
  Bookmark, 
  Clock, 
  User, 
  Target, 
  Sparkles, 
  ChevronRight,
  Calendar,
  TrendingUp,
  X,
  BookmarkCheck,
  Eye,
  Edit
} from "lucide-react"
import { format } from "date-fns"
import { th } from "date-fns/locale"

interface SavedIdea {
  id: string
  clientname: string
  productfocus: string
  title: string
  description: string
  category: string
  concept_type: string
  impact?: string
  competitivegap: string
  tags: string
  content_pillar: string
  product_focus: string
  concept_idea: string
  copywriting_headline: string
  copywriting_sub_headline_1: string
  copywriting_sub_headline_2: string
  copywriting_bullets: string
  copywriting_cta: string
  savedat: string
}

interface SavedIdeasProps {
  isOpen: boolean
  onClose: () => void
  activeClientName?: string
  activeProductFocus?: string
  onViewDetails?: (idea: any, savedId: string) => void
}

export function SavedIdeas({ isOpen, onClose, activeClientName, activeProductFocus, onViewDetails }: SavedIdeasProps) {
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedIdeaForEdit, setSelectedIdeaForEdit] = useState<SavedIdea | null>(null)

  // Fetch saved ideas when modal opens
  useEffect(() => {
    if (isOpen && activeClientName && activeProductFocus) {
      fetchSavedIdeas()
    }
  }, [isOpen, activeClientName, activeProductFocus])

  const fetchSavedIdeas = async () => {
    if (!activeClientName || !activeProductFocus) return
    
    setLoading(true)
    try {
      const supabase = getSupabase()
      
      console.log('Direct Supabase query for:', { activeClientName, activeProductFocus })
      const startTime = performance.now()
      
      const { data, error } = await supabase
        .from('savedideas')
        .select(`
          id,
          clientname,
          productfocus,
          title,
          description,
          category,
          concept_type,
          impact,
          competitivegap,
          tags,
          content_pillar,
          product_focus,
          concept_idea,
          copywriting_headline,
          copywriting_sub_headline_1,
          copywriting_sub_headline_2,
          copywriting_bullets,
          copywriting_cta,
          savedat
        `)
        .eq('clientname', activeClientName)
        .eq('productfocus', activeProductFocus)
        .order('savedat', { ascending: false })
        .limit(50)

      const endTime = performance.now()
      console.log(`Direct Supabase query completed in ${endTime - startTime}ms for ${data?.length || 0} items`)

      if (error) {
        console.error('Supabase error:', error)
        return
      }

      setSavedIdeas(data || [])
    } catch (error) {
      console.error('Error fetching saved ideas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditIdea = (idea: SavedIdea) => {
    setSelectedIdeaForEdit(idea)
    setEditModalOpen(true)
  }

  const handleSaveEditedIdea = (updatedIdea: SavedIdea) => {
    // Update the local state
    setSavedIdeas(prev => prev.map(idea => 
      idea.id === updatedIdea.id ? updatedIdea : idea
    ))
    setEditModalOpen(false)
    setSelectedIdeaForEdit(null)
  }

  const handleViewDetails = (idea: SavedIdea) => {
    // Convert SavedIdea to IdeaRecommendation format for the existing modal
    const convertedIdea = {
      title: idea.title,
      description: (() => {
        try {
          // Try to parse as JSON first (new format)
          const parsed = JSON.parse(idea.description)
          
          // New format with summary and sections
          if (parsed && typeof parsed === 'object' && parsed.summary && parsed.sections) {
            return parsed
          }
          
          // Old array format
          if (Array.isArray(parsed)) {
            return {
              summary: parsed.length > 0 ? parsed[0].text : 'No description available',
              sections: parsed.map((item: any) => ({
                group: item.label || 'Description',
                bullets: [item.text || '']
              }))
            }
          }
        } catch {
          // If parsing fails, it's probably an old string format
          return {
            summary: idea.description,
            sections: []
          }
        }
        // Fallback
        return {
          summary: idea.description,
          sections: []
        }
      })(),
      category: idea.category,
      concept_type: (idea.concept_type || idea.impact || 'Proven Concept') as 'Proven Concept' | 'New Concept',
      competitiveGap: idea.competitivegap,
      tags: (() => {
        try {
          // If tags is already an array, return it
          if (Array.isArray(idea.tags)) {
            return idea.tags
          }
          // If it's a string, try to parse as JSON first
          return JSON.parse(idea.tags || '[]')
        } catch (error) {
          // If parsing fails and it's a string, split by comma
          if (typeof idea.tags === 'string') {
            return idea.tags.split(',').map(tag => tag.trim())
          }
          // Otherwise return empty array
          return []
        }
      })(),
      content_pillar: idea.content_pillar,
      product_focus: idea.product_focus,
      concept_idea: idea.concept_idea,
      copywriting: {
        headline: idea.copywriting_headline || '',
        sub_headline_1: idea.copywriting_sub_headline_1 || '',
        sub_headline_2: idea.copywriting_sub_headline_2 || '',
        bullets: (() => {
          try {
            if (Array.isArray(idea.copywriting_bullets)) {
              return idea.copywriting_bullets
            }
            return JSON.parse(idea.copywriting_bullets || '[]')
          } catch (error) {
            if (typeof idea.copywriting_bullets === 'string') {
              return idea.copywriting_bullets.split(',').map(bullet => bullet.trim())
            }
            return []
          }
        })(),
        cta: idea.copywriting_cta || ''
      }
    }
    
    // Set this as the selected detail idea to open the existing modal
    if (onViewDetails) {
      onViewDetails(convertedIdea, idea.id)
    }
  }

  const handleRemoveIdea = async (idea: SavedIdea) => {
    try {
      const supabase = getSupabase()
      
      const { error } = await supabase
        .from('savedideas')
        .delete()
        .eq('id', idea.id)

      if (error) {
        console.error('Error removing idea:', error)
        alert('เกิดข้อผิดพลาดในการลบ')
        return
      }

      setSavedIdeas(prev => prev.filter(saved => saved.id !== idea.id))
      alert('ยกเลิกการบันทึกเรียบร้อยแล้ว!')
    } catch (error) {
      console.error('Error removing idea:', error)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookmarkCheck className="h-5 w-5 text-blue-600" />
              รายการไอเดียที่บันทึก
              {activeClientName && (
                <Badge variant="outline" className="ml-2">
                  {activeClientName}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">กำลังโหลดไอเดียที่บันทึก...</p>
                </div>
              </div>
            ) : savedIdeas.length === 0 ? (
              <div className="text-center py-12">
                <Bookmark className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มีไอเดียที่บันทึก</h3>
                <p className="text-gray-500">เมื่อคุณบันทึกไอเดีย จะแสดงที่นี่</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {savedIdeas.map((idea) => (
                  <Card key={idea.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`text-white text-xs px-2 py-1 rounded-full ${
                            (idea.concept_type || idea.impact) === 'Proven Concept' ? 'bg-blue-500' :
                            (idea.concept_type || idea.impact) === 'New Concept' ? 'bg-purple-500' : 'bg-gray-500'
                          }`}>
                            {idea.concept_type || idea.impact}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {idea.content_pillar}
                          </Badge>
                        </div>
                        
                        <h4 className="font-semibold text-lg mb-2 line-clamp-2">
                          {idea.concept_idea || idea.title}
                        </h4>
                        
                        <div className="text-gray-600 text-sm mb-3 space-y-2">
                          {(() => {
                            try {
                              // Try to parse as JSON first (new format)
                              const parsed = JSON.parse(idea.description)
                              
                              // New format with summary and sections
                              if (parsed && typeof parsed === 'object' && parsed.summary && parsed.sections) {
                                return (
                                  <>
                                    <p className="text-xs font-medium text-[#000000] line-clamp-2">
                                      {parsed.summary}
                                    </p>
                                    {parsed.sections.length > 0 && (
                                      <div className="text-xs">
                                        <span className="font-medium text-[#1d4ed8]">
                                          {parsed.sections[0].group}:
                                        </span>
                                        <span className="ml-1 line-clamp-1">
                                          {parsed.sections[0].bullets[0]}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )
                              }
                              
                              // Old array format
                              if (Array.isArray(parsed)) {
                                return parsed.slice(0, 2).map((item: any, index: number) => (
                                  <div key={index} className="text-xs">
                                    <span className="font-medium text-[#1d4ed8]">{item.label}:</span>
                                    <span className="ml-1 line-clamp-1">{item.text}</span>
                                  </div>
                                ))
                              }
                            } catch {
                              // If parsing fails, it's probably an old string format
                              return <span className="line-clamp-3">{idea.description}</span>
                            }
                            // Fallback
                            return <span className="line-clamp-3">{idea.description}</span>
                          })()}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {idea.category}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(idea)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          ดู
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditIdea(idea)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="h-3 w-3" />
                          แก้ไข
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveIdea(idea)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EditableSavedIdeaModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setSelectedIdeaForEdit(null)
        }}
        idea={selectedIdeaForEdit}
        onSave={handleSaveEditedIdea}
      />
    </>
  )
}
