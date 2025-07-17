"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Loader2, Sparkles } from "lucide-react"

interface CompetitorSummaryProps {
  clientId: string
  productFocus?: string
  clientName?: string
  initialSummary?: string
}

export function CompetitorSummary({ clientId, productFocus, clientName, initialSummary }: CompetitorSummaryProps) {
  const [summary, setSummary] = useState(initialSummary || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const handleGenerateSummary = async () => {
    setIsGenerating(true)
    setError('')
    
    try {
      const response = await fetch('/api/generate-competitor-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          productFocus,
          clientName
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate summary')
      }

      const data = await response.json()
      setSummary(data.summary)
    } catch (err) {
      setError('Failed to generate summary. Please try again.')
      console.error('Error generating summary:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Summary Information</h2>
        <Button
          onClick={handleGenerateSummary}
          disabled={isGenerating}
          className="bg-black text-white hover:bg-gray-800"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Summary
            </>
          )}
        </Button>
      </div>
      
      <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={isGenerating ? "กำลังสร้างสรุปข้อมูลคู่แข่ง..." : "กดปุ่ม 'Generate Summary' เพื่อสร้างสรุปข้อมูลคู่แข่งจากตารางข้างล่าง หรือสามารถเขียนข้อมูลเพิ่มเติมได้ที่นี่"}
          className="min-h-[120px] border-[#999999] focus:border-black focus:ring-0 text-sm resize-none"
          disabled={isGenerating}
        />
        
        {summary && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSummary('')}
              className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
            >
              Clear
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}