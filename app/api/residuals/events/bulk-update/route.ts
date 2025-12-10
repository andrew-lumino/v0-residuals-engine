import { createClient } from "@/lib/db/server"
import { logActionAsync } from "@/lib/utils/history"
import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
  const requestId = uuidv4()

  try {
    const supabase = await createClient()
    const body = await request.json()
    const { eventIds, payout_month } = body

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ error: "No events specified" }, { status: 400 })
    }

    if (!payout_month || !/^\d{4}-\d{2}$/.test(payout_month)) {
      return NextResponse.json({ error: "Invalid payout_month format. Use YYYY-MM" }, { status: 400 })
    }

    // Fetch current data for history logging
    const { data: previousData, error: fetchError } = await supabase
      .from("csv_data")
      .select("id, payout_month, merchant_name, mid")
      .in("id", eventIds)

    if (fetchError) {
      console.error("[v0] Error fetching events for bulk update:", fetchError)
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
    }

    // Perform bulk update
    const { data: updatedData, error: updateError } = await supabase
      .from("csv_data")
      .update({ payout_month })
      .in("id", eventIds)
      .select("id, payout_month, merchant_name, mid")

    if (updateError) {
      console.error("[v0] Error bulk updating events:", updateError)
      return NextResponse.json({ error: "Failed to update events" }, { status: 500 })
    }

    // Log the bulk action
    const batchId = uuidv4()
    logActionAsync({
      actionType: "bulk_update",
      entityType: "event",
      entityId: batchId,
      entityName: `Bulk update ${eventIds.length} events`,
      previousData: { events: previousData },
      newData: { events: updatedData, payout_month },
      description: `Changed payout_month to ${payout_month} for ${eventIds.length} events`,
      requestId,
      batchId,
    })

    return NextResponse.json({
      success: true,
      updated: eventIds.length,
      payout_month,
    })
  } catch (error) {
    console.error("[v0] Bulk update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
