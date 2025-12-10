import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/db/server"
import { MoneyDisplay } from "@/components/residuals/shared/MoneyDisplay"
import Link from "next/link"
import { DollarSign, CheckCircle2, Users, Upload, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DealsManagement } from "@/components/residuals/deals/DealsManagement"

async function getPayoutsStats() {
  const supabase = await createClient()

  // Get total count
  const { count: totalPayouts } = await supabase.from("payouts").select("*", { count: "exact", head: true })

  // Use pagination to get all records
  let allPayouts: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data: payouts } = await supabase
      .from("payouts")
      .select("partner_payout_amount, paid_status, mid, partner_airtable_id")
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (payouts && payouts.length > 0) {
      allPayouts = [...allPayouts, ...payouts]
      hasMore = payouts.length === pageSize
      page++
    } else {
      hasMore = false
    }
  }

  const totalAmount = allPayouts.reduce((sum, p) => sum + (p.partner_payout_amount || 0), 0)
  const paidAmount = allPayouts
    .filter((p) => p.paid_status === "paid")
    .reduce((sum, p) => sum + (p.partner_payout_amount || 0), 0)
  const unpaidAmount = totalAmount - paidAmount

  // Count unique merchants (MIDs)
  const uniqueMerchants = new Set(allPayouts.map((p) => p.mid).filter(Boolean)).size

  // Count unique partners
  const uniquePartners = new Set(allPayouts.map((p) => p.partner_airtable_id).filter(Boolean)).size

  return {
    totalAmount,
    paidAmount,
    unpaidAmount,
    uniqueMerchants,
    uniquePartners,
    totalPayouts: totalPayouts || 0,
  }
}

export default async function PayoutsPage() {
  const stats = await getPayoutsStats()

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deals Management</h1>
          <p className="text-muted-foreground mt-2">View and manage all merchant deals with participant assignments</p>
        </div>
        <div className="flex gap-2">
          <Link href="/residuals/payouts/import">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import Legacy Data
            </Button>
          </Link>
          <a href="/api/payouts/export-airtable?status=all" download>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export for Airtable
            </Button>
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <MoneyDisplay amount={stats.totalAmount} />
            </div>
            <p className="text-xs text-muted-foreground">{stats.totalPayouts} payout records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              <MoneyDisplay amount={stats.paidAmount} />
            </div>
            <p className="text-xs text-muted-foreground">Completed payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              <MoneyDisplay amount={stats.unpaidAmount} />
            </div>
            <p className="text-xs text-muted-foreground">Pending payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniquePartners}</div>
            <p className="text-xs text-muted-foreground">{stats.uniqueMerchants} merchants</p>
          </CardContent>
        </Card>
      </div>

      {/* Deals Management Section */}
      <DealsManagement />
    </div>
  )
}
