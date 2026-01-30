"use server"

import { getSupabase } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ClientProfile } from "@/lib/data/client-profile"
import type { Competitor } from "@/lib/data/competitors" // Import Competitor type
import { v4 as uuidv4 } from "uuid" // For generating unique IDs
import { invalidateCache } from "@/lib/utils/server-cache"

export async function updateClientProfile(profile: ClientProfile) {
  const supabase = getSupabase()

  const { id, services, pricing, usp, specialty, strengths, weaknesses, ...clientUpdates } = profile

  // Fetch the existing client so we know how to sync dependent tables
  const { data: existingClient, error: existingClientError } = await supabase
    .from("Clients")
    .select("clientName, productFocus")
    .eq("id", id)
    .maybeSingle()

  if (existingClientError) {
    console.error("Error fetching existing client profile:", existingClientError)
    return { success: false, message: existingClientError.message }
  }

  // Update Clients table (fields that belong to Clients table)
  const { data: clientData, error: clientError } = await supabase
    .from("Clients")
    .update({ ...clientUpdates, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select()

  if (clientError) {
    console.error("Error updating client profile:", clientError)
    return { success: false, message: clientError.message }
  }

  const updatedClient = clientData[0]

  // Update Competitor table (business profile fields) if any business profile fields are provided
  const businessProfileFields = { services, pricing, usp, specialty, strengths, weaknesses }
  const hasBusinessProfileUpdates = Object.values(businessProfileFields).some(value => value !== undefined && value !== null)

  if (hasBusinessProfileUpdates) {
    // Find the client's business profile in Competitor table
    const { data: competitorData, error: competitorError } = await supabase
      .from("Competitor")
      .update(businessProfileFields)
      .eq("analysisRunId", id)
      .ilike("name", `%${clientData[0].clientName}%`)
      .select()

    if (competitorError) {
      console.error("Error updating competitor business profile:", competitorError)
      // Don't fail the entire operation if competitor update fails
      console.log("Continuing with client update despite competitor update failure")
    }
  }

  // Sync client name/product focus changes with research_market table so downstream data stays aligned
  if (existingClient) {
    const researchMarketUpdates: { client_name?: string | null; product_focus?: string | null } = {}
    if (existingClient.clientName !== updatedClient.clientName) {
      researchMarketUpdates.client_name = updatedClient.clientName
    }
    if (existingClient.productFocus !== updatedClient.productFocus) {
      researchMarketUpdates.product_focus = updatedClient.productFocus
    }

    if (Object.keys(researchMarketUpdates).length > 0) {
      let researchQuery = supabase.from("research_market").update(researchMarketUpdates)

      if (existingClient.clientName) {
        researchQuery = researchQuery.eq("client_name", existingClient.clientName)
      } else if (updatedClient.clientName) {
        researchQuery = researchQuery.eq("client_name", updatedClient.clientName)
      }

      if (existingClient.productFocus) {
        researchQuery = researchQuery.eq("product_focus", existingClient.productFocus)
      } else if (updatedClient.productFocus) {
        researchQuery = researchQuery.eq("product_focus", updatedClient.productFocus)
      }

      const { error: researchMarketError } = await researchQuery

      if (researchMarketError) {
        console.error("Error syncing research market data:", researchMarketError)
      } else {
        const oldCacheKey = `research-market:${existingClient.clientName || ""}:${existingClient.productFocus || ""}`
        const newCacheKey = `research-market:${updatedClient.clientName || ""}:${updatedClient.productFocus || ""}`
        invalidateCache(oldCacheKey)
        invalidateCache(newCacheKey)
        invalidateCache(`research-market:run:${id}`)
      }
    }
  }

  revalidatePath("/configure") // Revalidate the page to show updated data
  return { success: true, message: "Client profile updated successfully!", data: clientData[0] }
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
      clientWebsiteUrl: null,
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
