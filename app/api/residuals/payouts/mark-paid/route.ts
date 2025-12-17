import { createClient } from "@/lib/db/server"
import { logAction, logDebug } from "@/lib/utils/history"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const body = await request.json()
    const { partnerId, month } = body

    if (!partnerId || !month) {
      return NextResponse.json({ success: false, error: "Partner ID and month are required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: payoutsBefore } = await supabase
      .from("payouts")
      .select("id, paid_status")
      .eq("partner_airtable_id", partnerId)
      .eq("payout_month", month)
      .eq("paid_status", "unpaid")

    // Update payouts for this partner and month
    const { error, count } = await supabase
      .from("payouts")
      .update({
        paid_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("partner_airtable_id", partnerId)
      .eq("payout_month", month)
      .eq("paid_status", "unpaid")
      .select("*", { count: "exact", head: true })

    if (error) {
      await logDebug(
        "error",
        "api",
        `Failed to mark payouts as paid: ${error.message}`,
        { partnerId, month, error },
        requestId,
      )
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (count && count > 0) {
      await logAction({
        actionType: "bulk_update",
        entityType: "payout",
        entityId: partnerId,
        entityName: `Partner ${partnerId} - ${month}`,
        description: `Marked ${count} payouts as paid for partner ${partnerId} in ${month}`,
        previousData: { payouts: payoutsBefore, paid_status: "unpaid" },
        newData: { paid_status: "paid", count },
        requestId,
      })
    }

    await logDebug("info", "api", `Marked ${count} payouts as paid`, { partnerId, month, count }, requestId)

    return NextResponse.json({
      success: true,
      data: {
        updated_count: count,
        message: `Marked ${count} payouts as paid`,
      },
    })
  } catch (error) {
    await logDebug(
      "error",
      "api",
      `Mark paid error: ${error instanceof Error ? error.message : "Unknown"}`,
      { error },
      requestId,
    )
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
