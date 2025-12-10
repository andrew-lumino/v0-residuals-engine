import { PayoutsDetailedView } from "@/components/residuals/payouts/PayoutsDetailedView"
import { createClient } from "@/lib/db/server"

async function getInitialPayouts() {
  const supabase = await createClient()

  const { data: payouts, count } = await supabase
    .from("payouts")
    .select("*", { count: "exact" })
    .order("payout_month", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, 49)

  return { payouts: payouts || [], total: count || 0 }
}

async function getPayoutsStats() {
  const supabase = await createClient()

  const { data: payouts } = await supabase.from("payouts").select("partner_payout_amount, paid_status")

  const totalAmount = payouts?.reduce((sum, p) => sum + (Number.parseFloat(p.partner_payout_amount) || 0), 0) || 0
  const paidAmount =
    payouts
      ?.filter((p) => p.paid_status === "paid")
      .reduce((sum, p) => sum + (Number.parseFloat(p.partner_payout_amount) || 0), 0) || 0
  const paidCount = payouts?.filter((p) => p.paid_status === "paid").length || 0

  return {
    totalAmount,
    paidAmount,
    paidCount,
    totalCount: payouts?.length || 0,
  }
}

export default async function PayoutsDetailedPage() {
  const { payouts, total } = await getInitialPayouts()
  const stats = await getPayoutsStats()

  return <PayoutsDetailedView initialPayouts={payouts} total={total} stats={stats} />
}
