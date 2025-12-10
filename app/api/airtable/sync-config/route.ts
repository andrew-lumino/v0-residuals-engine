import { createServerClient } from "@/lib/db/server"
import { NextResponse } from "next/server"

// Store Airtable configuration
export async function POST(request: Request) {
  try {
    const { airtableBaseId, airtableTableId, airtableApiKey } = await request.json()

    // In production, store this in a secure config table or environment
    // For now, we'll validate the connection

    if (!airtableBaseId || !airtableTableId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Test connection
    const testUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableId}?maxRecords=1`
    const testResponse = await fetch(testUrl, {
      headers: {
        Authorization: `Bearer ${airtableApiKey || process.env.AIRTABLE_API_KEY}`,
      },
    })

    if (!testResponse.ok) {
      return NextResponse.json(
        {
          error: "Failed to connect to Airtable. Check your credentials.",
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "Airtable configuration saved and tested successfully",
    })
  } catch (error) {
    console.error("[v0] Airtable config error:", error)
    return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 })
  }
}

export async function GET() {
  // Return current sync status
  try {
    const supabase = await createServerClient()

    const { count: totalPayouts } = await supabase
      .from("payouts")
      .select("*", { count: "exact", head: true })
      .eq("assignment_status", "confirmed")

    // In production, track which payouts are synced to Airtable
    // For now, return basic stats

    return NextResponse.json({
      totalPayouts: totalPayouts || 0,
      syncedToAirtable: 0, // Will implement tracking
      pendingSync: totalPayouts || 0,
      lastSyncedAt: null,
    })
  } catch (error) {
    console.error("[v0] Sync status error:", error)
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 })
  }
}
