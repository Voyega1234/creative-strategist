"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ClientProfile } from "@/lib/data/client-profile" // Import ClientProfile type
import type { Competitor } from "@/lib/data/competitors" // Import Competitor type
import { normalizeToArray } from "@/lib/utils"

type BusinessProfileFormProps = {
  isEditing: boolean
  formData: ClientProfile
  setFormData: React.Dispatch<React.SetStateAction<ClientProfile>>
  clientBusinessProfile?: Competitor | null
}

export function BusinessProfileForm({ isEditing, formData, setFormData, clientBusinessProfile }: BusinessProfileFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
        <div>
          <p className="text-sm font-medium text-black mb-1">Client Name</p>
          {isEditing ? (
            <Input
              name="clientName"
              value={formData.clientName || ""}
              onChange={handleChange}
              className="border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.clientName}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Client Website</p>
          {isEditing ? (
            <Input
              name="clientWebsite"
              value={formData.clientWebsite || ""}
              onChange={handleChange}
              className="border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.clientWebsite}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Client Facebook URL</p>
          {isEditing ? (
            <Input
              name="clientFacebookUrl"
              value={formData.clientFacebookUrl || ""}
              onChange={handleChange}
              className="border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.clientFacebookUrl}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Product Focus</p>
          {isEditing ? (
            <Textarea
              name="productFocus"
              value={formData.productFocus || ""}
              onChange={handleChange}
              className="min-h-[80px] border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.productFocus}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Services</p>
          <div className="text-sm text-[#8e8e93]">
            {clientBusinessProfile?.services ? 
              normalizeToArray(clientBusinessProfile.services).map((service, index) => (
                <span key={index} className="inline-block bg-[#f2f2f7] rounded px-2 py-1 mr-1 mb-1">
                  {service}
                </span>
              )) : 'N/A'
            }
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Pricing</p>
          <p className="text-sm text-[#8e8e93]">{clientBusinessProfile?.pricing || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">USP (Unique Selling Proposition)</p>
          <p className="text-sm text-[#8e8e93]">{clientBusinessProfile?.specialty || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Specialty</p>
          <p className="text-sm text-[#8e8e93]">{clientBusinessProfile?.specialty || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Strengths</p>
          <div className="text-sm text-[#8e8e93]">
            {clientBusinessProfile?.strengths ? 
              normalizeToArray(clientBusinessProfile.strengths).map((strength, index) => (
                <div key={index}>• {strength}</div>
              )) : 'N/A'
            }
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Weaknesses</p>
          <div className="text-sm text-[#8e8e93]">
            {clientBusinessProfile?.weaknesses ? 
              normalizeToArray(clientBusinessProfile.weaknesses).map((weakness, index) => (
                <div key={index}>• {weakness}</div>
              )) : 'N/A'
            }
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Market</p>
          {isEditing ? (
            <Input
              name="market"
              value={formData.market || ""}
              onChange={handleChange}
              className="border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.market}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-black mb-1">Ad Account ID</p>
          {isEditing ? (
            <Input
              name="ad_account_id"
              value={formData.ad_account_id || ""}
              onChange={handleChange}
              className="border-[#999999] focus:border-black focus:ring-0 text-sm text-[#000000]"
            />
          ) : (
            <p className="text-sm text-[#8e8e93]">{formData.ad_account_id}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
