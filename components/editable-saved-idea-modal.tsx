"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Save, X, Plus } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"

interface SavedIdea {
  id: string
  clientname: string
  productfocus: string
  title: string
  description: string
  category: string
  impact: string
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

interface EditableSavedIdeaModalProps {
  isOpen: boolean
  onClose: () => void
  idea: SavedIdea | null
  onSave: (updatedIdea: SavedIdea) => void
}

export function EditableSavedIdeaModal({ isOpen, onClose, idea, onSave }: EditableSavedIdeaModalProps) {
  const [editedIdea, setEditedIdea] = useState<SavedIdea | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [bulletInput, setBulletInput] = useState("")

  // Initialize edited idea when modal opens
  useEffect(() => {
    if (isOpen && idea) {
      setEditedIdea({ ...idea })
    }
  }, [isOpen, idea])

  if (!editedIdea) return null

  // Parse tags and bullets for display/editing
  const parseTags = (tagsString: string): string[] => {
    try {
      if (Array.isArray(tagsString)) return tagsString
      return JSON.parse(tagsString || '[]')
    } catch (error) {
      if (typeof tagsString === 'string') {
        return tagsString.split(',').map(tag => tag.trim()).filter(Boolean)
      }
      return []
    }
  }

  const parseBullets = (bulletsString: string): string[] => {
    try {
      if (Array.isArray(bulletsString)) return bulletsString
      return JSON.parse(bulletsString || '[]')
    } catch (error) {
      if (typeof bulletsString === 'string') {
        return bulletsString.split(',').map(bullet => bullet.trim()).filter(Boolean)
      }
      return []
    }
  }

  const tags = parseTags(editedIdea.tags)
  const bullets = parseBullets(editedIdea.copywriting_bullets)

  const handleAddTag = () => {
    if (tagInput.trim()) {
      const newTags = [...tags, tagInput.trim()]
      setEditedIdea(prev => prev ? {
        ...prev,
        tags: JSON.stringify(newTags)
      } : null)
      setTagInput("")
    }
  }

  const handleRemoveTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    setEditedIdea(prev => prev ? {
      ...prev,
      tags: JSON.stringify(newTags)
    } : null)
  }

  const handleAddBullet = () => {
    if (bulletInput.trim()) {
      const newBullets = [...bullets, bulletInput.trim()]
      setEditedIdea(prev => prev ? {
        ...prev,
        copywriting_bullets: JSON.stringify(newBullets)
      } : null)
      setBulletInput("")
    }
  }

  const handleRemoveBullet = (index: number) => {
    const newBullets = bullets.filter((_, i) => i !== index)
    setEditedIdea(prev => prev ? {
      ...prev,
      copywriting_bullets: JSON.stringify(newBullets)
    } : null)
  }

  const handleSave = async () => {
    if (!editedIdea) return
    
    setIsSaving(true)
    try {
      const supabase = getSupabase()
      
      const { error } = await supabase
        .from('savedideas')
        .update({
          title: editedIdea.title,
          description: editedIdea.description,
          category: editedIdea.category,
          impact: editedIdea.impact,
          competitivegap: editedIdea.competitivegap,
          tags: editedIdea.tags,
          content_pillar: editedIdea.content_pillar,
          product_focus: editedIdea.product_focus,
          concept_idea: editedIdea.concept_idea,
          copywriting_headline: editedIdea.copywriting_headline,
          copywriting_sub_headline_1: editedIdea.copywriting_sub_headline_1,
          copywriting_sub_headline_2: editedIdea.copywriting_sub_headline_2,
          copywriting_bullets: editedIdea.copywriting_bullets,
          copywriting_cta: editedIdea.copywriting_cta
        })
        .eq('id', editedIdea.id)

      if (error) {
        console.error('Error saving idea:', error)
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
        return
      }

      onSave(editedIdea)
      onClose()
    } catch (error) {
      console.error('Error saving idea:', error)
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <ScrollArea className="max-h-[80vh] pr-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              แก้ไขไอเดียที่บันทึก
              <Badge variant="outline">{editedIdea.clientname}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editedIdea.title || ''}
                  onChange={(e) => setEditedIdea(prev => prev ? { ...prev, title: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={editedIdea.category || ''}
                  onValueChange={(value) => setEditedIdea(prev => prev ? { ...prev, category: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inspire">Inspire</SelectItem>
                    <SelectItem value="Educate">Educate</SelectItem>
                    <SelectItem value="Convert">Convert</SelectItem>
                    <SelectItem value="Entertain">Entertain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="impact">Impact</Label>
                <Select
                  value={editedIdea.impact || ''}
                  onValueChange={(value) => setEditedIdea(prev => prev ? { ...prev, impact: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content_pillar">Content Pillar</Label>
                <Input
                  id="content_pillar"
                  value={editedIdea.content_pillar || ''}
                  onChange={(e) => setEditedIdea(prev => prev ? { ...prev, content_pillar: e.target.value } : null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editedIdea.description || ''}
                onChange={(e) => setEditedIdea(prev => prev ? { ...prev, description: e.target.value } : null)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="competitive_gap">Competitive Gap</Label>
              <Textarea
                id="competitive_gap"
                value={editedIdea.competitivegap || ''}
                onChange={(e) => setEditedIdea(prev => prev ? { ...prev, competitivegap: e.target.value } : null)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="concept_idea">Concept Idea</Label>
              <Textarea
                id="concept_idea"
                value={editedIdea.concept_idea || ''}
                onChange={(e) => setEditedIdea(prev => prev ? { ...prev, concept_idea: e.target.value } : null)}
                rows={3}
              />
            </div>

            {/* Tags Section */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add new tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button type="button" size="sm" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    {tag}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => handleRemoveTag(index)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Copywriting Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Copywriting</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    value={editedIdea.copywriting_headline || ''}
                    onChange={(e) => setEditedIdea(prev => prev ? { ...prev, copywriting_headline: e.target.value } : null)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sub_headline_1">Sub-Headline 1</Label>
                    <Input
                      id="sub_headline_1"
                      value={editedIdea.copywriting_sub_headline_1 || ''}
                      onChange={(e) => setEditedIdea(prev => prev ? { ...prev, copywriting_sub_headline_1: e.target.value } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub_headline_2">Sub-Headline 2</Label>
                    <Input
                      id="sub_headline_2"
                      value={editedIdea.copywriting_sub_headline_2 || ''}
                      onChange={(e) => setEditedIdea(prev => prev ? { ...prev, copywriting_sub_headline_2: e.target.value } : null)}
                    />
                  </div>
                </div>

                {/* Bullets Section */}
                <div className="space-y-2">
                  <Label>Bullet Points</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder="Add new bullet point..."
                      value={bulletInput}
                      onChange={(e) => setBulletInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddBullet()}
                    />
                    <Button type="button" size="sm" onClick={handleAddBullet}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {bullets.map((bullet, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 border rounded">
                        <span className="flex-1 text-sm">• {bullet}</span>
                        <X 
                          className="h-4 w-4 cursor-pointer text-red-500" 
                          onClick={() => handleRemoveBullet(index)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cta">Call to Action (CTA)</Label>
                  <Input
                    id="cta"
                    value={editedIdea.copywriting_cta || ''}
                    onChange={(e) => setEditedIdea(prev => prev ? { ...prev, copywriting_cta: e.target.value } : null)}
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            ยกเลิก
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                บันทึกการเปลี่ยนแปลง
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}