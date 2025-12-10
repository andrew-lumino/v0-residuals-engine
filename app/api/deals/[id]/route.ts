import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"
import { logActionAsync } from "@/lib/utils/history"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase.from("deals").select("*").eq("id", id).single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // PARSE STRING TO ARRAY
    if (data && typeof data.participants_json === "string") {
      try {
        data.participants_json = JSON.parse(data.participants_json)
      } catch (e) {
        data.participants_json = []
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    const { data: dealBefore } = await supabase.from("deals").select("*").eq("id", id).single()

    const { data, error } = await supabase
      .from("deals")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // PARSE STRING TO ARRAY
    if (data && typeof data.participants_json === "string") {
      try {
        data.participants_json = JSON.parse(data.participants_json)
      } catch (e) {
        data.participants_json = []
      }
    }

    logActionAsync({
      actionType: "update",
      entityType: "deal",
      entityId: id,
      entityName: dealBefore?.mid || id,
      description: `Updated deal ${dealBefore?.mid || id}`,
      previousData: dealBefore,
      newData: data,
      requestId,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: dealBefore } = await supabase.from("deals").select("*").eq("id", id).single()

    const { error: payoutsError } = await supabase.from("payouts").delete().eq("deal_id", id)
    if (payoutsError) console.error("Error deleting payouts:", payoutsError)

    const { error: csvError } = await supabase
      .from("csv_data")
      .update({
        assignment_status: "unassigned",
        deal_id: null,
        assigned_agent_id: null,
        assigned_agent_name: null,
      })
      .eq("deal_id", id)

    if (csvError) console.error("Error resetting csv_data:", csvError)

    const { error } = await supabase.from("deals").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    logActionAsync({
      actionType: "delete",
      entityType: "deal",
      entityId: id,
      entityName: dealBefore?.mid || id,
      description: `Deleted deal ${dealBefore?.mid || id}`,
      previousData: dealBefore,
      newData: null,
      requestId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
