import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get unique batches with stats
    const { data, error } = await supabase
      .from("csv_data")
      .select("batch_id, payout_month, created_at, assignment_status")
      .order("created_at", { ascending: false })

    if (error) throw error

    // Group by batch_id
    const batchMap = new Map()

    data.forEach((row) => {
      if (!row.batch_id) return

      if (!batchMap.has(row.batch_id)) {
        batchMap.set(row.batch_id, {
          id: row.batch_id,
          batch_id: row.batch_id,
          payout_month: row.payout_month,
          file_names: ["Import"],
          total_rows: 0,
          unassigned_rows: 0,
          status: "processed",
          created_at: row.created_at,
        })
      }

      const batch = batchMap.get(row.batch_id)
      batch.total_rows++
      if (row.assignment_status === "unassigned") {
        batch.unassigned_rows++
      }
    })

    const batches = Array.from(batchMap.values())

    return NextResponse.json({ success: true, batches })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 })
  }
}
