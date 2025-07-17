"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Save, X, Plus, Trash2 } from "lucide-react"

interface StrategicInsightsData {
  summary?: string
  strengths?: string[]
  weaknesses?: string[]
  market_gaps?: string[]
  shared_patterns?: string[]
  differentiation_strategies?: string[]
}

interface EditableStrategicInsightsProps {
  data: StrategicInsightsData
  clientName: string
  productFocus?: string
  onSave: (data: StrategicInsightsData) => Promise<void>
}

export function EditableStrategicInsights({ 
  data, 
  clientName, 
  productFocus, 
  onSave 
}: EditableStrategicInsightsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedData, setEditedData] = useState<StrategicInsightsData>(data)

  const handleEdit = () => {
    setIsEditing(true)
    setEditedData(data)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(editedData)
      setIsEditing(false)
    } catch (error) {
      console.error('Error saving strategic insights:', error)
      alert('Failed to save insights. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedData(data)
    setIsEditing(false)
  }

  const handleSummaryChange = (value: string) => {
    setEditedData({ ...editedData, summary: value })
  }

  const handleArrayChange = (key: keyof StrategicInsightsData, index: number, value: string) => {
    const currentArray = editedData[key] as string[] || []
    const newArray = [...currentArray]
    newArray[index] = value
    setEditedData({ ...editedData, [key]: newArray })
  }

  const handleAddItem = (key: keyof StrategicInsightsData) => {
    const currentArray = editedData[key] as string[] || []
    setEditedData({ ...editedData, [key]: [...currentArray, ""] })
  }

  const handleRemoveItem = (key: keyof StrategicInsightsData, index: number) => {
    const currentArray = editedData[key] as string[] || []
    const newArray = currentArray.filter((_, i) => i !== index)
    setEditedData({ ...editedData, [key]: newArray })
  }

  const renderEditableArray = (
    title: string,
    key: keyof StrategicInsightsData,
    items: string[] | undefined
  ) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-black">{title}</p>
        {isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAddItem(key)}
            className="h-6 px-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        )}
      </div>
      <div className="text-sm text-[#8e8e93] space-y-1">
        {items?.length ? (
          items.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              {isEditing ? (
                <>
                  <Textarea
                    value={item}
                    onChange={(e) => handleArrayChange(key, index, e.target.value)}
                    className="min-h-[60px] border-[#999999] focus:border-black focus:ring-0 text-sm resize-none flex-1"
                    placeholder={`Enter ${title.toLowerCase()}...`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(key, index)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 h-6 px-2 mt-2"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              ) : (
                <div>• {item}</div>
              )}
            </div>
          ))
        ) : (
          <div className="text-[#8e8e93]">No {title.toLowerCase()} data available</div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header with Edit/Save buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Strategic Insights</h2>
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
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                )}
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

      {/* Summary Information */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Summary Information</h3>
        <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white mb-6">
          {isEditing ? (
            <Textarea
              value={editedData.summary || ''}
              onChange={(e) => handleSummaryChange(e.target.value)}
              className="min-h-[120px] border-[#999999] focus:border-black focus:ring-0 text-sm resize-none"
              placeholder="Enter summary information..."
            />
          ) : (
            <div className="text-sm text-[#8e8e93] whitespace-pre-wrap">
              {editedData.summary || 'No summary available'}
            </div>
          )}
        </Card>
      </div>

      {/* SWOT Analysis */}
      <div>
        <h3 className="text-lg font-semibold mb-4">SWOT Analysis - {clientName}</h3>
        <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
            {renderEditableArray("Strengths", "strengths", editedData.strengths)}
            {renderEditableArray("Weaknesses", "weaknesses", editedData.weaknesses)}
            {renderEditableArray("Opportunities", "market_gaps", editedData.market_gaps)}
            {renderEditableArray("Threats", "shared_patterns", editedData.shared_patterns)}
          </div>
        </Card>
      </div>

      {/* Market Analysis */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Market Analysis</h3>
        <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
            <div className="md:col-span-2">
              {renderEditableArray("Differentiation Strategies", "differentiation_strategies", editedData.differentiation_strategies)}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}