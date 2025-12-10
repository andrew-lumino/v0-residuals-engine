import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const mid = searchParams.get("mid")

  if (!mid) {
    return NextResponse.json({ error: "MID is required" }, { status: 400 })
  }

  try {
    // Get all confirmed payouts for this MID, grouped by payout_month
    // This shows how the deal was assigned in previous months
    const { data: payouts, error } = await supabase
      .from("payouts")
      .select("*")
      .eq("mid", mid)
      .order("payout_month", { ascending: false })

    if (error) {
      console.error("[deals/history] Error fetching payouts:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group payouts by payout_month
    const groupedByMonth: Record<string, any[]> = {}
    for (const payout of payouts || []) {
      const month = payout.payout_month || "unknown"
      if (!groupedByMonth[month]) {
        groupedByMonth[month] = []
      }
      groupedByMonth[month].push(payout)
    }

    // Convert to array format with participants consolidated
    const history = Object.entries(groupedByMonth).map(([month, monthPayouts]) => {
      // Get unique participants for this month
      const participantsMap = new Map<string, any>()
      let totalFees = 0
      let payoutType = "residual"
      let merchantName = ""

      for (const payout of monthPayouts) {
        const key = payout.partner_airtable_id || payout.partner_name
        if (!participantsMap.has(key)) {
          participantsMap.set(key, {
            partner_airtable_id: payout.partner_airtable_id,
            partner_name: payout.partner_name,
            partner_role: payout.partner_role,
            split_pct: payout.partner_split_pct,
          })
        }
        totalFees += payout.partner_payout_amount || 0
        payoutType = payout.payout_type || payoutType
        merchantName = payout.merchant_name || merchantName
      }

      return {
        payout_month: month,
        merchant_name: merchantName,
        payout_type: payoutType,
        total_fees: totalFees,
        participants: Array.from(participantsMap.values()),
      }
    })

    // Sort by month descending (most recent first)
    history.sort((a, b) => {
      if (a.payout_month === "unknown") return 1
      if (b.payout_month === "unknown") return -1
      return b.payout_month.localeCompare(a.payout_month)
    })

    return NextResponse.json({
      success: true,
      mid,
      history,
      total_months: history.length,
    })
  } catch (err) {
    console.error("[deals/history] Error:", err)
    return NextResponse.json({ error: "Failed to fetch deal history" }, { status: 500 })
  }
}
