import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")?.toLowerCase()
    const month = searchParams.get("month")
    const role = searchParams.get("role")
    const payoutType = searchParams.get("payoutType")

    const supabase = await createClient()

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"

    const partnersMap = new Map<string, any>()

    try {
      const partnersResponse = await fetch(`${baseUrl}/api/airtable-partners`, {
        cache: "no-store",
      })

      if (partnersResponse.ok) {
        const partnersData = await partnersResponse.json()
        const partners = partnersData.partners || []
        partners.forEach((p: any) => {
          partnersMap.set(p.id, p)
        })
      }
    } catch (e) {
      console.error("[v0] Error fetching partners from Airtable:", e)
    }

    // Add Lumino company as default
    partnersMap.set("lumino-company", {
      id: "lumino-company",
      name: "Lumino",
      email: "company@lumino.com",
      role: "Company",
    })

    let query = supabase.from("payouts").select("*", { count: "exact" }).gt("partner_split_pct", 0) // Only get payouts with split > 0

    if (month && month !== "all") {
      query = query.eq("payout_month", month)
    }
    if (payoutType && payoutType !== "all") {
      query = query.eq("payout_type", payoutType)
    }

    // Fetch in batches to get ALL records (Supabase limits to 1000 per query)
    const allPayouts: any[] = []
    let from = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: batch, error: batchError } = await query.range(from, from + batchSize - 1)

      if (batchError) {
        console.error("[v0] Error fetching payouts batch:", batchError)
        break
      }

      if (batch && batch.length > 0) {
        allPayouts.push(...batch)
        from += batchSize
        hasMore = batch.length === batchSize
      } else {
        hasMore = false
      }
    }

    const participantMap = new Map<string, any>()

    allPayouts.forEach((payout) => {
      const partnerId = payout.partner_airtable_id || `name:${payout.partner_name}`
      if (!partnerId) return

      // Apply role filter
      if (role && role !== "all" && payout.partner_role?.toLowerCase() !== role.toLowerCase()) {
        return
      }

      const partner = payout.partner_airtable_id ? partnersMap.get(payout.partner_airtable_id) : null
      const partnerName = payout.partner_name || partner?.name || partnerId

      if (!participantMap.has(partnerId)) {
        participantMap.set(partnerId, {
          id: payout.partner_airtable_id || partnerId,
          name: partnerName,
          email: payout.partner_email || partner?.email || "",
          role: payout.partner_role || partner?.role || "Agent",
          payouts: [],
          totalPayouts: 0,
          paidPayouts: 0,
          totalDeals: 0,
          avgSplitPct: 0,
          totalSplitPct: 0,
        })
      }

      const participantData = participantMap.get(partnerId)
      participantData.payouts.push(payout)
      participantData.totalPayouts += Number.parseFloat(payout.partner_payout_amount) || 0
      participantData.totalDeals += 1
      participantData.totalSplitPct += Number.parseFloat(payout.partner_split_pct) || 0

      if (payout.paid_status === "paid") {
        participantData.paidPayouts += Number.parseFloat(payout.partner_payout_amount) || 0
      }
    })

    // Calculate averages
    participantMap.forEach((participant) => {
      participant.avgSplitPct = participant.totalDeals > 0 ? participant.totalSplitPct / participant.totalDeals : 0
    })

    let participants = Array.from(participantMap.values())

    // Apply search filter
    if (search) {
      participants = participants.filter(
        (p) =>
          p.name?.toLowerCase().includes(search) ||
          p.email?.toLowerCase().includes(search) ||
          p.id?.toLowerCase().includes(search),
      )
    }

    // Sort by total payouts descending
    participants.sort((a, b) => b.totalPayouts - a.totalPayouts)

    // Get unique months and roles for filter dropdowns
    const uniqueMonths = [...new Set(allPayouts?.map((p) => p.payout_month).filter(Boolean))]
    const uniqueRoles = [...new Set(participants.map((p) => p.role).filter(Boolean))]

    return NextResponse.json({
      success: true,
      data: participants,
      meta: {
        totalParticipants: participants.length,
        totalDeals: participants.reduce((sum, p) => sum + p.totalDeals, 0),
        totalPayouts: participants.reduce((sum, p) => sum + p.totalPayouts, 0),
        months: uniqueMonths.sort().reverse(),
        roles: uniqueRoles.sort(),
      },
    })
  } catch (error) {
    console.error("[v0] Error in participants API:", error)
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
