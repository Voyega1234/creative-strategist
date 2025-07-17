"use client"

import { EditableStrategicInsights } from "./editable-strategic-insights"

interface StrategicInsightsData {
  summary?: string
  strengths?: string[]
  weaknesses?: string[]
  market_gaps?: string[]
  shared_patterns?: string[]
  differentiation_strategies?: string[]
}

interface StrategicInsightsWrapperProps {
  data: StrategicInsightsData
  clientName: string
  productFocus?: string
}

export function StrategicInsightsWrapper({ 
  data, 
  clientName, 
  productFocus 
}: StrategicInsightsWrapperProps) {
  
  const handleSave = async (updatedData: StrategicInsightsData) => {
    console.log('Saving strategic insights:', {
      clientName,
      productFocus,
      strategicInsights: updatedData
    })

    const response = await fetch('/api/save-strategic-insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientName: clientName,
        productFocus: productFocus || "default",
        strategicInsights: updatedData
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('API Error:', errorData)
      throw new Error(`Failed to save strategic insights: ${errorData.error || response.statusText}`)
    }

    const result = await response.json()
    console.log('Save successful:', result)

    // Refresh the page to show updated data
    window.location.reload()
  }

  return (
    <EditableStrategicInsights
      data={data}
      clientName={clientName}
      productFocus={productFocus}
      onSave={handleSave}
    />
  )
}