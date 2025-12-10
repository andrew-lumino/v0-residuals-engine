import { createClient } from "@/lib/db/server"
import { NextResponse } from "next/server"

function getQuarter(month: string): string {
  // month format: "2025-10"
  const [year, monthNum] = month.split("-")
  const m = Number.parseInt(monthNum)
  const q = Math.ceil(m / 3)
  return `${year}-Q${q}`
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: payouts, error } = await supabase.from("payouts").select("payout_month, partner_payout_amount")

    if (error) throw error

    // Aggregate by quarter
    const quarterMap = new Map<
      string,
      {
        quarter: string
        total_amount: number
        total_payouts: number
      }
    >()

    for (const payout of payouts || []) {
      const month = payout.payout_month
      if (!month) continue

      const quarter = getQuarter(month)

      if (!quarterMap.has(quarter)) {
        quarterMap.set(quarter, {
          quarter,
          total_amount: 0,
          total_payouts: 0,
        })
      }

      const data = quarterMap.get(quarter)!
      data.total_amount += Number(payout.partner_payout_amount) || 0
      data.total_payouts += 1
    }

    // Convert to array and sort by quarter descending
    const summary = Array.from(quarterMap.values())
      .map(({ quarter, total_amount, total_payouts }) => ({
        quarter,
        total_amount,
        total_payouts,
        average_payout: total_payouts > 0 ? total_amount / total_payouts : 0,
      }))
      .sort((a, b) => b.quarter.localeCompare(a.quarter))

    return NextResponse.json({ summary })
  } catch (error) {
    console.error("Error fetching quarterly summary:", error)
    return NextResponse.json({ error: "Failed to fetch quarterly summary" }, { status: 500 })
  }
}
