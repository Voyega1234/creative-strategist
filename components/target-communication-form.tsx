"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ClientProfile } from "@/lib/data/client-profile" // Import ClientProfile type
import type { Competitor } from "@/lib/data/competitors" // Import Competitor type
import { normalizeToArray } from "@/lib/utils"

type TargetCommunicationFormProps = {
  isEditing?: boolean
  formData: ClientProfile
  setFormData?: React.Dispatch<React.SetStateAction<ClientProfile>>
  clientBusinessProfile?: Competitor | null
}

export function TargetCommunicationForm({ isEditing = false, formData, setFormData, clientBusinessProfile }: TargetCommunicationFormProps) {
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (setFormData) {
      const { name, value } = e.target
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  return (
    <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
        <div>
          <p className="text-sm font-medium text-black mb-1">Target Audience</p>
          {isEditing ? (
            <Textarea
              name="targetAudience"
              value={formData.targetAudience || clientBusinessProfile?.targetAudience || ""}
              onChange={handleChange}
              className="min-h-[60px] border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.targetAudience || clientBusinessProfile?.targetAudience || 'N/A'}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Target Market</p>
          {isEditing ? (
            <Input
              name="market"
              value={formData.market || ""}
              onChange={handleChange}
              className="border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.market || 'N/A'}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Brand Tone</p>
          {isEditing ? (
            <Input
              name="brandTone"
              value={formData.brandTone || clientBusinessProfile?.brandTone || ""}
              onChange={handleChange}
              className="border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.brandTone || clientBusinessProfile?.brandTone || 'N/A'}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Ad Messaging Themes</p>
          {isEditing ? (
            <Textarea
              name="adThemes"
              value={formData.adThemes || (clientBusinessProfile?.adThemes ? normalizeToArray(clientBusinessProfile.adThemes).join(', ') : "")}
              onChange={handleChange}
              placeholder="Enter themes separated by commas"
              className="min-h-[60px] border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <div className="text-sm text-[#8e8e93]">
              {formData.adThemes ? 
                formData.adThemes.split(',').map((theme, index) => (
                  <div key={index}>• {theme.trim()}</div>
                )) : clientBusinessProfile?.adThemes ? 
                normalizeToArray(clientBusinessProfile.adThemes).map((theme, index) => (
                  <div key={index}>• {theme}</div>
                )) : 'N/A'
              }
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Positive Brand Perception</p>
          {isEditing ? (
            <Textarea
              name="positivePerception"
              value={formData.positivePerception || clientBusinessProfile?.positivePercep || ""}
              onChange={handleChange}
              className="min-h-[60px] border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.positivePerception || clientBusinessProfile?.positivePercep || 'N/A'}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Negative Brand Perception</p>
          {isEditing ? (
            <Textarea
              name="negativePerception"
              value={formData.negativePerception || clientBusinessProfile?.negativePercep || ""}
              onChange={handleChange}
              className="min-h-[60px] border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.negativePerception || clientBusinessProfile?.negativePercep || 'N/A'}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
