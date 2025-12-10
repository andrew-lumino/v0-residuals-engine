import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const batchId = searchParams.get("batch") || searchParams.get("batch_id")
    const status = searchParams.get("status") || "unassigned"
    const search = searchParams.get("search") || ""

    const supabase = await createClient()

    // Build query for events
    let query = supabase.from("csv_data").select("*")

    if (batchId && batchId !== "all") {
      query = query.eq("batch_id", batchId)
    }

    if (status === "pending_confirmation") {
      query = query.in("assignment_status", ["pending", "pending_confirmation"])
    } else {
      query = query.eq("assignment_status", status)
    }

    // Add search filter
    if (search) {
      query = query.or(`mid.ilike.%${search}%,merchant_name.ilike.%${search}%`)
    }

    const { data: events, error: eventsError } = await query.order("created_at", { ascending: false })

    if (eventsError) {
      console.error("[v0] Error fetching events:", eventsError)
      throw eventsError
    }

    const [unassignedStats, pendingStats, confirmedStats] = await Promise.all([
      supabase.from("csv_data").select("volume, fees").eq("assignment_status", "unassigned"),
      supabase.from("csv_data").select("volume, fees").in("assignment_status", ["pending", "pending_confirmation"]),
      supabase.from("csv_data").select("volume, fees").eq("assignment_status", "confirmed"),
    ])

    const calcStats = (data: any[] | null) => {
      if (!data) return { count: 0, volume: 0, payouts: 0 }
      return {
        count: data.length,
        volume: data.reduce((sum, row) => sum + (Number.parseFloat(row.volume) || 0), 0),
        payouts: data.reduce((sum, row) => sum + (Number.parseFloat(row.fees) || 0), 0),
      }
    }

    const stats = {
      unassigned: calcStats(unassignedStats.data),
      pending: calcStats(pendingStats.data),
      confirmed: calcStats(confirmedStats.data),
    }

    console.log("[v0] Unassigned events query:", { status, batchId, search, eventCount: events?.length })

    return NextResponse.json({
      success: true,
      events: events || [],
      stats,
    })
  } catch (error) {
    console.error("[v0] Unassigned events error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch events",
        events: [],
        stats: {
          unassigned: { count: 0, volume: 0, payouts: 0 },
          pending: { count: 0, volume: 0, payouts: 0 },
          confirmed: { count: 0, volume: 0, payouts: 0 },
        },
      },
      { status: 500 },
    )
  }
}
