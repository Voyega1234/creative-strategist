import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { getUniqueServices } from "@/lib/data/competitors"
import { getSupabase } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId query parameter is required" },
        { status: 400 },
      )
    }

    const services = await getUniqueServices(clientId)
    return NextResponse.json({ success: true, services })
  } catch (error) {
    console.error("[client-services] Failed to load services:", error)
    return NextResponse.json({ success: false, error: "Failed to load services" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { clientId, service } = await request.json()

    const trimmedService = typeof service === "string" ? service.trim() : ""

    if (!clientId || !trimmedService) {
      return NextResponse.json(
        { success: false, error: "clientId and service are required" },
        { status: 400 },
      )
    }

    const existingServices = await getUniqueServices(clientId)
    if (existingServices.some((item) => item.toLowerCase() === trimmedService.toLowerCase())) {
      return NextResponse.json({ success: true, service: trimmedService, alreadyExists: true })
    }

    const supabase = getSupabase()
    const manualServiceRecord = {
      id: uuidv4(),
      analysisRunId: clientId,
      name: `Manual Service (${trimmedService})`,
      website: null,
      facebookUrl: null,
      services: [trimmedService],
      serviceCategories: [],
      features: [],
      pricing: null,
      strengths: [],
      weaknesses: [],
      specialty: null,
      targetAudience: null,
      brandTone: null,
      positivePerception: [],
      negativePerception: [],
      usp: null,
      complaints: [],
    }

    const { error } = await supabase.from("Competitor").insert([manualServiceRecord])

    if (error) {
      console.error("[client-services] Failed to add service:", error)
      return NextResponse.json({ success: false, error: "Failed to save service" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      service: trimmedService,
      recordId: manualServiceRecord.id,
    })
  } catch (error) {
    console.error("[client-services] Error adding service:", error)
    return NextResponse.json({ success: false, error: "Failed to add service" }, { status: 500 })
  }
}
