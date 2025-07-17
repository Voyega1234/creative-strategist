"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import type { ClientProfile } from "@/lib/data/client-profile" // Import ClientProfile type
import type { Competitor } from "@/lib/data/competitors" // Import Competitor type
import { normalizeToArray } from "@/lib/utils"

type TargetCommunicationFormProps = {
  formData: ClientProfile
  clientBusinessProfile?: Competitor | null
}

export function TargetCommunicationForm({ formData, clientBusinessProfile }: TargetCommunicationFormProps) {

  return (
    <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
        <div>
          <p className="text-sm font-medium text-black mb-1">Target Audience</p>
          <p className="text-sm text-[#8e8e93]">{clientBusinessProfile?.targetAudience || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Target Market</p>
          <p className="text-sm text-[#8e8e93]">{formData.market || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Brand Tone</p>
          <p className="text-sm text-[#8e8e93]">{clientBusinessProfile?.brandTone || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Ad Messaging Themes</p>
          <div className="text-sm text-[#8e8e93]">
            {clientBusinessProfile?.adThemes ? 
              normalizeToArray(clientBusinessProfile.adThemes).map((theme, index) => (
                <div key={index}>• {theme}</div>
              )) : 'N/A'
            }
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Positive Brand Perception</p>
          <p className="text-sm text-[#8e8e93]">{clientBusinessProfile?.positivePercep || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Negative Brand Perception</p>
          <p className="text-sm text-[#8e8e93]">{clientBusinessProfile?.negativePercep || 'N/A'}</p>
        </div>
      </div>
    </Card>
  )
}
