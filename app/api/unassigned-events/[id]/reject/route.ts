import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Reset to unassigned, clear deal_id
    const { error } = await supabase
      .from("csv_data")
      .update({
        assignment_status: "unassigned",
      })
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to reject assignment" }, { status: 500 })
  }
}
