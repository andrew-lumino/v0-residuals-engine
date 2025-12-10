import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"
import { logActionAsync } from "@/lib/utils/history"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { id: dealId } = await params
    const body = await request.json().catch(() => ({}))
    const eventId = body.eventId
    const supabase = await createClient()

    // Get the deal before we make changes (for history)
    const { data: dealBefore, error: dealError } = await supabase.from("deals").select("*").eq("id", dealId).single()

    if (dealError) {
      console.error("[API] Error fetching deal:", dealError)
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    // Get the csv_data event(s) linked to this deal
    const { data: eventsBefore } = await supabase.from("csv_data").select("*").eq("deal_id", dealId)

    if (eventsBefore && eventsBefore.length > 0) {
      for (const event of eventsBefore) {
        await supabase.from("payouts").delete().eq("csv_data_id", event.id)
      }
    }

    // Reset csv_data to unassigned status
    const { error: csvError } = await supabase
      .from("csv_data")
      .update({
        assignment_status: "unassigned",
        deal_id: null,
        assigned_agent_id: null,
        assigned_agent_name: null,
      })
      .eq("deal_id", dealId)

    if (csvError) {
      console.error("[API] Error resetting csv_data:", csvError)
      return NextResponse.json({ error: "Failed to reset event" }, { status: 500 })
    }

    // Delete the deal
    const { error: deleteError } = await supabase.from("deals").delete().eq("id", dealId)

    if (deleteError) {
      console.error("[API] Error deleting deal:", deleteError)
      return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 })
    }

    // Log to history for undo capability
    logActionAsync({
      actionType: "reject",
      entityType: "deal",
      entityId: dealId,
      entityName: dealBefore?.mid || dealId,
      description: `Rejected assignment for ${dealBefore?.mid || "unknown MID"} - returned to unassigned queue`,
      previousData: {
        deal: dealBefore,
        events: eventsBefore,
      },
      newData: null,
      requestId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Reject error:", error)
    return NextResponse.json({ error: "Failed to reject assignment" }, { status: 500 })
  }
}
