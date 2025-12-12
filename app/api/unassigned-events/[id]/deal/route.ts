import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] Deal endpoint called with event id:", id)
    const supabase = await createClient()

    // Get event to find deal_id
    const { data: event, error: eventError } = await supabase.from("csv_data").select("deal_id").eq("id", id).single()

    console.log("[v0] Event lookup result:", { id, event, eventError: eventError?.message })

    if (eventError || !event?.deal_id) {
      console.log("[v0] Event lookup failed - no deal_id:", { id, eventError: eventError?.message, event })
      return NextResponse.json({ error: "Deal not found for event", details: eventError?.message }, { status: 404 })
    }

    const { data: deal, error: dealError } = await supabase.from("deals").select("*").eq("id", event.deal_id).single()

    console.log("[v0] Deal lookup result:", { deal_id: event.deal_id, found: !!deal, dealError: dealError?.message })

    if (dealError) {
      console.log("[v0] Deal lookup failed:", { deal_id: event.deal_id, dealError: dealError?.message, code: dealError?.code })
      // Return 404 if deal not found, not 500
      if (dealError.code === "PGRST116") {
        return NextResponse.json({ error: "Deal not found", deal_id: event.deal_id }, { status: 404 })
      }
      return NextResponse.json({ error: "Failed to fetch deal", details: dealError.message }, { status: 500 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.log("[v0] Deal fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch deal", details: String(error) }, { status: 500 })
  }
}
