import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"
import { logActionAsync } from "@/lib/utils/history"

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { event_ids, hold_reason } = await request.json()
    const supabase = await createClient()

    const { data: eventsBefore } = await supabase
      .from("csv_data")
      .select("id, mid, merchant_name, is_held, hold_reason")
      .in("id", event_ids)

    const { error } = await supabase
      .from("csv_data")
      .update({
        is_held: true,
        hold_reason: hold_reason,
      })
      .in("id", event_ids)

    if (error) throw error

    logActionAsync({
      actionType: "update",
      entityType: "event",
      entityId: event_ids.join(","),
      entityName: `${event_ids.length} events`,
      description: `Put ${event_ids.length} event(s) on hold: ${hold_reason || "No reason specified"}`,
      previousData: { events: eventsBefore },
      newData: { is_held: true, hold_reason, event_ids },
      requestId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to hold assignment" }, { status: 500 })
  }
}
