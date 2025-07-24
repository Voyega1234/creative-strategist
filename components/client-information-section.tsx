"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Save, X } from "lucide-react"
import { BusinessProfileForm } from "./business-profile-form"
import { TargetCommunicationForm } from "./target-communication-form"
import { RelatedNewsSection } from "./related-news-section"
import type { ClientProfile } from "@/lib/data/client-profile"
import type { Competitor } from "@/lib/data/competitors"
import { updateClientProfile } from "@/app/actions"

type ClientInformationSectionProps = {
  initialClientProfileData: ClientProfile
  clientBusinessProfile?: Competitor | null
}

export function ClientInformationSection({ initialClientProfileData, clientBusinessProfile }: ClientInformationSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState(initialClientProfileData)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    const result = await updateClientProfile(formData)
    if (result.success) {
      console.log("Client profile updated successfully!")
      setIsEditing(false)
    } else {
      console.error("Failed to save client profile:", result.message)
      // Optionally show a toast or error message to the user
    }
    setIsSaving(false)
  }

  const handleCancel = () => {
    setFormData(initialClientProfileData) // Revert to initial data
    setIsEditing(false)
  }

  return (
    <>
      {/* Header with Edit Details button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Business Profile</h2>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Details
            </Button>
          ) : (
            <>
              <Button onClick={handleSave} className="bg-black text-white hover:bg-gray-800" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
                <Save className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent"
                disabled={isSaving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
      <BusinessProfileForm isEditing={isEditing} formData={formData} setFormData={setFormData} clientBusinessProfile={clientBusinessProfile} />

      {/* Target & Communication Section */}
      <h2 className="text-lg font-semibold mb-4">Target & Communication</h2>
      <TargetCommunicationForm 
        isEditing={isEditing} 
        formData={formData} 
        setFormData={setFormData}
        clientBusinessProfile={clientBusinessProfile} 
      />

      {/* Related News Section */}
      {/* <div className="mt-6">
        <RelatedNewsSection 
          clientName={clientBusinessProfile?.name || initialClientProfileData?.clientName || "No Client Selected"} 
          productFocus={initialClientProfileData?.productFocus || ''} 
        />
      </div> */}

      {/* Action Buttons at the bottom */}
      <div className="flex justify-between items-center mt-6">
        <Button variant="outline" className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent">
          Export
        </Button>
        <Button className="bg-black text-white hover:bg-gray-800">Add Instruction</Button>
      </div>
    </>
  )
}
