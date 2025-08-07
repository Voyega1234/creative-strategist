"use server"

import { getSupabase } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ClientProfile } from "@/lib/data/client-profile"
import type { Competitor } from "@/lib/data/competitors" // Import Competitor type
import { v4 as uuidv4 } from "uuid" // For generating unique IDs

export async function updateClientProfile(profile: ClientProfile) {
  const supabase = getSupabase()

  const { id, ...updates } = profile

  const { data, error } = await supabase
    .from("Clients")
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

export async function createClients(clientFacebookUrl: string) {
  const supabase = getSupabase()
  const newId = uuidv4() // Generate a unique ID

  const { data, error } = await supabase
    .from("Clients")
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

export async function updateCompetitor(competitor: Competitor) {
  const supabase = getSupabase()

  const { id, ...updates } = competitor

  // Ensure array fields are correctly formatted if they are coming from string inputs
  // (e.g., "item1, item2" -> ["item1", "item2"])
  // However, since we're using normalizeToArray for display, and inputs will likely be strings,
  // we need to convert them back to arrays of strings for Supabase TEXT[] columns.
  // For simplicity, assuming the incoming `competitor` object already has these as `string[]`
  // if they were edited via a multi-select or tag input. If they are single strings,
  // you might need to re-normalize them here.
  // Given the current `Competitor` type has `string | null` for these, we'll ensure they are arrays.
  const updatedFields = {
    ...updates,
    services: updates.services
      ? Array.isArray(updates.services)
        ? updates.services
        : updates.services.split(",").map((s) => s.trim())
      : [],
    pricing: updates.pricing
      ? Array.isArray(updates.pricing)
        ? updates.pricing
        : updates.pricing.split(",").map((s) => s.trim())
      : [],
    strengths: updates.strengths
      ? Array.isArray(updates.strengths)
        ? updates.strengths
        : updates.strengths.split(",").map((s) => s.trim())
      : [],
    weaknesses: updates.weaknesses
      ? Array.isArray(updates.weaknesses)
        ? updates.weaknesses
        : updates.weaknesses.split(",").map((s) => s.trim())
      : [],
  }

  const { data, error } = await supabase.from("Competitor").update(updatedFields).eq("id", id).select()

  if (error) {
    console.error("Error updating competitor:", error)
    return { success: false, message: error.message }
  }

  revalidatePath("/configure") // Revalidate the page to show updated data
  return { success: true, message: "Competitor updated successfully!", data: data[0] }
}
