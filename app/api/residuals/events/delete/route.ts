import { createClient } from "@/lib/db/server"
import { NextResponse } from "next/server"
import { logActionAsync } from "@/lib/utils/history"

export async function POST(request: Request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No event IDs provided" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: events, error: fetchError } = await supabase.from("csv_data").select("*").in("id", ids)

    if (fetchError) {
      console.error("Error fetching events:", fetchError)
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
    }

    // Filter to only unassigned events
    const unassignedEvents = events.filter((e) => e.assignment_status === "unassigned" || e.assignment_status === null)
    const unassignedIds = unassignedEvents.map((e) => e.id)

    if (unassignedIds.length === 0) {
      return NextResponse.json(
        { error: "No unassigned events found to delete. Only unassigned events can be deleted." },
        { status: 400 },
      )
    }

    // Delete the events
    const { error: deleteError } = await supabase.from("csv_data").delete().in("id", unassignedIds)

    if (deleteError) {
      console.error("Error deleting events:", deleteError)
      return NextResponse.json({ error: "Failed to delete events" }, { status: 500 })
    }

    logActionAsync({
      actionType: "delete",
      entityType: "event",
      entityId: unassignedIds.join(","),
      entityName: `${unassignedEvents.length} events`,
      description: `Deleted ${unassignedEvents.length} unassigned event(s)`,
      previousData: { events: unassignedEvents },
      newData: null,
      requestId,
    })

    return NextResponse.json({
      success: true,
      deleted: unassignedIds.length,
      message: `Deleted ${unassignedIds.length} event(s)`,
    })
  } catch (error) {
    console.error("Error in delete events:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
