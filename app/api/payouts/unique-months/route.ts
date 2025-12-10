import { createServerClient } from "@/lib/db/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Fetch all unique payout months from the database
    const { data, error } = await supabase
      .from("payouts")
      .select("payout_month")
      .order("payout_month", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching unique months:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Extract unique months
    const uniqueMonths = Array.from(new Set(data?.map((p) => p.payout_month).filter(Boolean) || []))

    return NextResponse.json({ months: uniqueMonths })
  } catch (error) {
    console.error("[v0] Error in unique-months route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
