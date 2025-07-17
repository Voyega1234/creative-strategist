"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Save, X } from "lucide-react"
import { BusinessProfileForm } from "./business-profile-form"
import { TargetCommunicationForm } from "./target-communication-form"
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
      {/* Business Profile Section */}
      <h2 className="text-lg font-semibold mb-4">Business Profile</h2>
      <BusinessProfileForm isEditing={isEditing} formData={formData} setFormData={setFormData} clientBusinessProfile={clientBusinessProfile} />

      {/* Target & Communication Section */}
      <h2 className="text-lg font-semibold mb-4">Target & Communication</h2>
      <TargetCommunicationForm formData={formData} clientBusinessProfile={clientBusinessProfile} />

      {/* Related News Section */}
      <h2 className="text-lg font-semibold mb-4 mt-6">Related News</h2>
      <Card className="p-6 border border-[#d1d1d6] shadow-sm bg-white mb-6">
        <ul className="list-disc pl-5 text-sm text-[#000000] space-y-1">
          <li>{"Lorem ipsum dolor sit amet consectetur. Velit faucibus scelerisque aliquam fermentum tortor."}</li>
          <li>{"Porttitor aliquam augue non eros sit."}</li>
          <li>{"Ultrices scelerisque adipiscing condimentum dictum aenean nulla dictumst volutpat proin."}</li>
          <li>{"Morbi egestas adipiscing dui porttitor tellus senectus vitae nam ullamcorper."}</li>
        </ul>
      </Card>

      {/* Action Buttons at the bottom */}
      <div className="flex justify-between items-center mt-6">
        <Button variant="outline" className="border-[#999999] text-[#000000] hover:bg-[#eeeeee] bg-transparent">
          Export
        </Button>
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
          <Button className="bg-black text-white hover:bg-gray-800">Add Instruction</Button>
        </div>
      </div>
    </>
  )
}
