import { createServerClient } from "@/lib/db/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createServerClient()

    // Get all deals
    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, deal_id, participants_json")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let updatedCount = 0
    const updates: { id: string; deal_id: string }[] = []

    for (const deal of deals || []) {
      if (!deal.participants_json || !Array.isArray(deal.participants_json)) continue

      let needsUpdate = false
      const updatedParticipants = deal.participants_json.map((p: any) => {
        // Fix Lumino Income Fund LP role
        if (p.partner_name?.toLowerCase().includes("lumino income fund") && p.partner_role !== "Fund I") {
          needsUpdate = true
          return { ...p, partner_role: "Fund I", role: "Fund I" }
        }
        // Fix Lumino (Company) role
        if ((p.partner_name?.toLowerCase().includes("lumino (company)") || p.partner_name?.toLowerCase() === "lumino") && p.partner_role !== "Company") {
          needsUpdate = true
          return { ...p, partner_role: "Company", role: "Company" }
        }
        return p
      })

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from("deals")
          .update({ participants_json: updatedParticipants })
          .eq("id", deal.id)

        if (!updateError) {
          updatedCount++
          updates.push({ id: deal.id, deal_id: deal.deal_id })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} deals`,
      updatedDeals: updates.slice(0, 20), // Show first 20
      totalUpdated: updatedCount,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

