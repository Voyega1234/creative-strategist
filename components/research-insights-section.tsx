"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Save, X, Sparkles } from "lucide-react"

interface ResearchInsightsSectionProps {
  insights: string[]
  clientName?: string
  productFocus?: string
}

export function ResearchInsightsSection({ insights, clientName, productFocus }: ResearchInsightsSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedInsights, setEditedInsights] = useState(insights)
  const [isGenerating, setIsGenerating] = useState(false)

  const displayedInsights = showAll ? editedInsights : editedInsights.slice(0, 10)

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = () => {
    // TODO: Implement save functionality to update database
    setIsEditing(false)
    console.log("Saving insights:", editedInsights)
  }

  const handleCancel = () => {
    setEditedInsights(insights) // Reset to original
    setIsEditing(false)
  }

  const handleInsightChange = (index: number, value: string) => {
    const newInsights = [...editedInsights]
    newInsights[index] = value
    setEditedInsights(newInsights)
  }

  const handleAddInsight = () => {
    setEditedInsights([...editedInsights, ""])
  }

  const handleRemoveInsight = (index: number) => {
    const newInsights = editedInsights.filter((_, i) => i !== index)
    setEditedInsights(newInsights)
  }

  const handleGenerate = async () => {
    if (!clientName || !productFocus) {
      alert("Client name and product focus are required to generate insights")
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch(`/api/google_research?clientName=${encodeURIComponent(clientName)}&productFocus=${encodeURIComponent(productFocus || 'default')}`)
      
      if (!response.ok) {
        throw new Error('Failed to generate insights')
      }

      const data = await response.json()
      const newInsights = data.research || []
      setEditedInsights(newInsights)
      
      // Refresh the page to get updated data
      window.location.reload()
    } catch (error) {
      console.error('Error generating insights:', error)
      alert('Failed to generate insights. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-4 mt-6">Research Insights</h2>
      <Card className="border border-[#d1d1d6] shadow-sm bg-white">
        <div className="p-4 border-b border-[#f0f0f0]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8e8e93]">
              {editedInsights.length} insights available
            </span>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                  onClick={handleEdit}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Insights
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="bg-black text-white hover:bg-gray-800"
                    onClick={handleSave}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                    onClick={handleCancel}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {editedInsights.length > 0 ? (
            <div className="p-4 space-y-3">
              {displayedInsights.map((insight, index) => (
                <div key={index} className="border-b border-[#f0f0f0] pb-3 last:border-b-0">
                  <div className="flex items-start gap-2">
                    <span className="text-[#8e8e93] text-sm font-medium min-w-[20px]">
                      {index + 1}.
                    </span>
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={insight}
                            onChange={(e) => handleInsightChange(index, e.target.value)}
                            className="min-h-[60px] border-[#999999] focus:border-black focus:ring-0 text-sm resize-none"
                            placeholder="Enter insight..."
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 h-6 px-2"
                            onClick={() => handleRemoveInsight(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="text-sm text-[#000000] flex-1 leading-relaxed">
                          {insight}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isEditing && (
                <div className="pt-3 border-t border-[#f0f0f0]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                    onClick={handleAddInsight}
                  >
                    Add New Insight
                  </Button>
                </div>
              )}
              
              {!isEditing && !showAll && editedInsights.length > 10 && (
                <div className="pt-3 border-t border-[#f0f0f0]">
                  <div className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#8e8e93] hover:text-[#000000]"
                      onClick={() => setShowAll(true)}
                    >
                      View All {editedInsights.length} Insights
                    </Button>
                  </div>
                </div>
              )}
              
              {!isEditing && showAll && editedInsights.length > 10 && (
                <div className="pt-3 border-t border-[#f0f0f0]">
                  <div className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#8e8e93] hover:text-[#000000]"
                      onClick={() => setShowAll(false)}
                    >
                      Show Less
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="text-[#8e8e93] mb-4">No research insights available</div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !clientName || !productFocus}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Insights
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </>
  )
}