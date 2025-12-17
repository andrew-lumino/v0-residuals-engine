import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"
import { logActionAsync } from "@/lib/utils/history"

// Using POST instead of DELETE because DELETE /api/unassigned-events/[id]/delete
// was being caught by the parent route /api/unassigned-events/[id] DELETE handler
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { id: eventId } = await params
    const supabase = await createClient()

    // Get the event data before deletion (for history/recovery)
    const { data: eventBefore, error: fetchError } = await supabase
      .from("csv_data")
      .select("*")
      .eq("id", eventId)
      .single()

    if (fetchError) {
      console.error("[API] Error fetching event:", fetchError)
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // If there's an associated deal, get that too
    let dealBefore = null
    if (eventBefore.deal_id) {
      const { data: deal } = await supabase.from("deals").select("*").eq("id", eventBefore.deal_id).single()
      dealBefore = deal

      // Delete associated payouts
      await supabase.from("payouts").delete().eq("csv_data_id", eventId)

      // Delete the deal
      await supabase.from("deals").delete().eq("id", eventBefore.deal_id)
    }

    // Delete the event from csv_data
    const { error: deleteError } = await supabase.from("csv_data").delete().eq("id", eventId)

    if (deleteError) {
      console.error("[API] Error deleting event:", deleteError)
      return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
    }

    // Log to history for recovery capability
    logActionAsync({
      actionType: "delete",
      entityType: "event",
      entityId: eventId,
      entityName: `${eventBefore.mid} - ${eventBefore.merchant_name}`,
      description: `Permanently deleted event ${eventBefore.mid} (${eventBefore.merchant_name})`,
      previousData: {
        event: eventBefore,
        deal: dealBefore,
      },
      newData: null,
      requestId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Delete error:", error)
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }
}
