import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

// Update all deals with the same MID
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ mid: string }> }) {
  try {
    const { mid } = await params
    const body = await request.json()
    const supabase = await createClient()

    // Update ALL deals with this MID
    const { data, error } = await supabase
      .from("deals")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("mid", mid)
      .select()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data, count: data?.length || 0 })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
