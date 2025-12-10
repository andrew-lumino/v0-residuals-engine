import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Update the event's assignment_status back to pending
    const { error } = await supabase
      .from("csv_data")
      .update({
        assignment_status: "pending",
        deal_id: null,
      })
      .eq("id", id)

    if (error) {
      console.error("Error resetting event:", error)
      return NextResponse.json({ error: "Failed to reset event" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in reset endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
