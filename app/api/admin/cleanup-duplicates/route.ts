import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    // Count duplicate payouts
    const { data: payoutDupes, error: payoutError } = await supabase.rpc("exec_sql", {
      query: `
        SELECT COUNT(*) as count
        FROM payouts p1
        WHERE EXISTS (
          SELECT 1 FROM payouts p2 
          WHERE p2.mid = '00' || p1.mid
        )
        AND p1.mid NOT LIKE '00%'
      `,
    })

    // Count duplicate deals
    const { data: dealDupes, error: dealError } = await supabase.rpc("exec_sql", {
      query: `
        SELECT COUNT(*) as count
        FROM deals d1
        WHERE EXISTS (
          SELECT 1 FROM deals d2 
          WHERE d2.mid = '00' || d1.mid
        )
        AND d1.mid NOT LIKE '00%'
      `,
    })

    if (payoutError || dealError) {
      // Fallback: use direct queries
      const { count: payoutCount } = await supabase
        .from("payouts")
        .select("*", { count: "exact", head: true })
        .not("mid", "like", "00%")

      const { count: dealCount } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .not("mid", "like", "00%")

      return NextResponse.json({
        payouts: payoutCount || 0,
        deals: dealCount || 0,
        note: "Approximate counts - RPC not available",
      })
    }

    return NextResponse.json({
      payouts: payoutDupes?.[0]?.count || 0,
      deals: dealDupes?.[0]?.count || 0,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to count duplicates" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { step } = await request.json()

  try {
    switch (step) {
      case "update_payouts": {
        // Get all duplicate pairs and update
        const { data: duplicates, error: fetchError } = await supabase
          .from("payouts")
          .select(
            "id, mid, partner_name, partner_role, partner_airtable_id, partner_split_pct, partner_payout_amount, payout_month",
          )
          .not("mid", "like", "00%")

        if (fetchError) throw fetchError

        let updatedCount = 0
        for (const newPayout of duplicates || []) {
          const oldMid = "00" + newPayout.mid

          // Find matching old payout
          const { data: oldPayouts } = await supabase
            .from("payouts")
            .select("id")
            .eq("mid", oldMid)
            .eq("payout_month", newPayout.payout_month)
            .eq("partner_split_pct", newPayout.partner_split_pct)

          for (const oldPayout of oldPayouts || []) {
            const { error: updateError } = await supabase
              .from("payouts")
              .update({
                partner_name: newPayout.partner_name,
                partner_role: newPayout.partner_role,
                partner_airtable_id: newPayout.partner_airtable_id,
                partner_split_pct: newPayout.partner_split_pct,
                partner_payout_amount: newPayout.partner_payout_amount,
              })
              .eq("id", oldPayout.id)

            if (!updateError) updatedCount++
          }
        }

        return NextResponse.json({
          message: `Updated ${updatedCount} old payout records with correct partner info`,
          count: updatedCount,
        })
      }

      case "update_deals": {
        // Get all duplicate deal pairs and update
        const { data: newDeals, error: fetchError } = await supabase
          .from("deals")
          .select("id, mid, participants_json")
          .not("mid", "like", "00%")

        if (fetchError) throw fetchError

        let updatedCount = 0
        for (const newDeal of newDeals || []) {
          const oldMid = "00" + newDeal.mid

          const { data: oldDeals } = await supabase.from("deals").select("id").eq("mid", oldMid)

          for (const oldDeal of oldDeals || []) {
            const { error: updateError } = await supabase
              .from("deals")
              .update({ participants_json: newDeal.participants_json })
              .eq("id", oldDeal.id)

            if (!updateError) updatedCount++
          }
        }

        return NextResponse.json({
          message: `Updated ${updatedCount} old deal records with correct participants_json`,
          count: updatedCount,
        })
      }

      case "delete_payouts": {
        // Get IDs of payouts to delete (non-00 that have 00 duplicates)
        const { data: toDelete, error: fetchError } = await supabase
          .from("payouts")
          .select("id, mid")
          .not("mid", "like", "00%")

        if (fetchError) throw fetchError

        let deletedCount = 0
        for (const payout of toDelete || []) {
          const oldMid = "00" + payout.mid

          // Check if 00 version exists
          const { data: exists } = await supabase.from("payouts").select("id").eq("mid", oldMid).limit(1)

          if (exists && exists.length > 0) {
            const { error: deleteError } = await supabase.from("payouts").delete().eq("id", payout.id)

            if (!deleteError) deletedCount++
          }
        }

        return NextResponse.json({
          message: `Deleted ${deletedCount} duplicate payout records`,
          count: deletedCount,
        })
      }

      case "delete_deals": {
        // Get IDs of deals to delete (non-00 that have 00 duplicates)
        const { data: toDelete, error: fetchError } = await supabase
          .from("deals")
          .select("id, mid")
          .not("mid", "like", "00%")

        if (fetchError) throw fetchError

        let deletedCount = 0
        for (const deal of toDelete || []) {
          const oldMid = "00" + deal.mid

          // Check if 00 version exists
          const { data: exists } = await supabase.from("deals").select("id").eq("mid", oldMid).limit(1)

          if (exists && exists.length > 0) {
            // Reset csv_data to prevent orphaned references BEFORE deleting
            await supabase
              .from("csv_data")
              .update({
                assignment_status: "unassigned",
                deal_id: null,
                assigned_agent_id: null,
                assigned_agent_name: null,
              })
              .eq("deal_id", deal.id)

            // Delete associated payouts
            await supabase.from("payouts").delete().eq("deal_id", deal.id)

            const { error: deleteError } = await supabase.from("deals").delete().eq("id", deal.id)

            if (!deleteError) deletedCount++
          }
        }

        return NextResponse.json({
          message: `Deleted ${deletedCount} duplicate deal records`,
          count: deletedCount,
        })
      }

      default:
        return NextResponse.json({ error: "Invalid step" }, { status: 400 })
    }
  } catch (error) {
    console.error("Cleanup error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cleanup failed",
      },
      { status: 500 },
    )
  }
}
