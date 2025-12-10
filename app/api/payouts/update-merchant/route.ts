import { createClient } from "@/lib/db/server"
import { NextResponse } from "next/server"

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { oldMid, newMid, newMerchantName } = body

    if (!oldMid) {
      return NextResponse.json({ error: "Old MID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const updateData: Record<string, string> = {}
    if (newMid !== undefined) updateData.mid = newMid
    if (newMerchantName !== undefined) updateData.merchant_name = newMerchantName

    // Update payouts table
    const { data: payoutsUpdated, error: payoutsError } = await supabase
      .from("payouts")
      .update(updateData)
      .eq("mid", oldMid)
      .select()

    if (payoutsError) {
      console.error("Error updating payouts:", payoutsError)
      throw payoutsError
    }

    // Also update csv_data table
    const { data: csvUpdated, error: csvError } = await supabase
      .from("csv_data")
      .update(updateData)
      .eq("mid", oldMid)
      .select()

    if (csvError) {
      console.error("Error updating csv_data:", csvError)
      // Don't throw - csv_data update is secondary
    }

    // Update deals table if it has the mid
    const { error: dealsError } = await supabase.from("deals").update(updateData).eq("mid", oldMid)

    if (dealsError) {
      console.error("Error updating deals:", dealsError)
      // Don't throw - deals update is secondary
    }

    return NextResponse.json({
      success: true,
      payoutsUpdated: payoutsUpdated?.length || 0,
      csvUpdated: csvUpdated?.length || 0,
    })
  } catch (error) {
    console.error("Failed to update merchant:", error)
    return NextResponse.json({ error: "Failed to update merchant" }, { status: 500 })
  }
}
