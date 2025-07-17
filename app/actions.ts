"use server"

import { getSupabase } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ClientProfile } from "@/lib/data/client-profile"
import { v4 as uuidv4 } from "uuid" // For generating unique IDs

export async function updateClientProfile(profile: ClientProfile) {
  const supabase = getSupabase()

  const { id, ...updates } = profile

  const { data, error } = await supabase
    .from("AnalysisRun")
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()

  if (error) {
    console.error("Error updating client profile:", error)
    return { success: false, message: error.message }
  }

  revalidatePath("/configure") // Revalidate the page to show updated data
  return { success: true, message: "Client profile updated successfully!", data: data[0] }
}

export async function createAnalysisRun(clientFacebookUrl: string) {
  const supabase = getSupabase()
  const newId = uuidv4() // Generate a unique ID

  const { data, error } = await supabase
    .from("AnalysisRun")
    .insert({
      id: newId,
      clientFacebookUrl: clientFacebookUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clientName: `New Client (${newId.substring(0, 4)})`, // Default name
      clientWebsite: null,
      productFocus: null,
      additionalInfo: null,
      userCompetitor: null,
      market: null,
      ad_account_id: null,
    })
    .select()

  if (error) {
    console.error("Error creating new analysis run:", error)
    return { success: false, message: error.message, newClientId: null }
  }

  revalidatePath("/new-client") // Revalidate the new client page
  revalidatePath("/configure") // Revalidate configure page to show new client in dropdown
  revalidatePath("/") // Revalidate home page to show new client in sidebar
  return { success: true, message: "New client created successfully!", newClientId: data[0].id }
}
