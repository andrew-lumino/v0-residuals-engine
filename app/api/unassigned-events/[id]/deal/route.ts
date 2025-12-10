import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get event to find deal_id
    const { data: event, error: eventError } = await supabase.from("csv_data").select("deal_id").eq("id", id).single()

    if (eventError || !event?.deal_id) {
      console.log("[v0] Event lookup failed:", { id, eventError, event })
      return NextResponse.json({ error: "Deal not found for event" }, { status: 404 })
    }

    const { data: deal, error: dealError } = await supabase.from("deals").select("*").eq("id", event.deal_id).single()

    if (dealError) {
      console.log("[v0] Deal lookup failed:", { deal_id: event.deal_id, dealError })
      throw dealError
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.log("[v0] Deal fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch deal" }, { status: 500 })
  }
}
