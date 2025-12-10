import { createClient } from "@/lib/db/server"
import { logAction, logDebug } from "@/lib/utils/history"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const body = await request.json()
    const { sourceId, sourceName, targetId, targetName, targetEmail, targetRole } = body

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { success: false, error: "Source and target participant IDs are required" },
        { status: 400 },
      )
    }

    if (sourceId === targetId) {
      return NextResponse.json({ success: false, error: "Source and target cannot be the same" }, { status: 400 })
    }

    const supabase = await createClient()
    let payoutsUpdated = 0
    let dealsUpdated = 0

    // 1. Update payouts table
    const { data: payoutsToUpdate } = await supabase.from("payouts").select("id").eq("partner_airtable_id", sourceId)
    const payoutsCount = payoutsToUpdate?.length || 0

    const { error: payoutsError } = await supabase
      .from("payouts")
      .update({
        partner_airtable_id: targetId,
        partner_name: targetName,
        partner_role: targetRole || null,
      })
      .eq("partner_airtable_id", sourceId)

    if (payoutsError) {
      await logDebug(
        "error",
        "api",
        `Failed to update payouts during merge: ${payoutsError.message}`,
        { sourceId, targetId, error: payoutsError },
        requestId,
      )
      return NextResponse.json(
        { success: false, error: `Failed to update payouts: ${payoutsError.message}` },
        { status: 500 },
      )
    }

    payoutsUpdated = payoutsCount || 0

    // 2. Update deals table participants_json
    // Search for deals with source participant using both legacy and canonical field names
    const { data: affectedDeals } = await supabase
      .from("deals")
      .select("id, deal_id, participants_json")
      .filter("participants_json", "cs", `[{"partner_id":"${sourceId}"}]`)

    const { data: affectedDeals2 } = await supabase
      .from("deals")
      .select("id, deal_id, participants_json")
      .filter("participants_json", "cs", `[{"partner_airtable_id":"${sourceId}"}]`)

    const { data: affectedDeals3 } = await supabase
      .from("deals")
      .select("id, deal_id, participants_json")
      .filter("participants_json", "cs", `[{"agent_id":"${sourceId}"}]`)

    // Combine all affected deals, removing duplicates
    const allAffectedDeals = [
      ...(affectedDeals || []),
      ...(affectedDeals2 || []),
      ...(affectedDeals3 || []),
    ]
    const processedDealIds = new Set<string>()

    for (const deal of allAffectedDeals) {
      // Skip if already processed
      if (processedDealIds.has(deal.id)) continue
      processedDealIds.add(deal.id)

      const participants = deal.participants_json || []
      // Normalize all participants to canonical format and update source to target
      const updatedParticipants = participants.map((p: any) => {
        const partnerId = p.partner_airtable_id || p.partner_id || p.agent_id
        const isSourceParticipant = partnerId === sourceId

        return {
          partner_airtable_id: isSourceParticipant ? targetId : partnerId,
          partner_name: isSourceParticipant ? targetName : (p.partner_name || p.name),
          partner_email: isSourceParticipant ? (targetEmail || p.partner_email || p.email) : (p.partner_email || p.email),
          partner_role: isSourceParticipant ? (targetRole || p.partner_role || p.role) : (p.partner_role || p.role),
          split_pct: p.split_pct || 0,
        }
      })

      const { error: dealError } = await supabase
        .from("deals")
        .update({ participants_json: updatedParticipants })
        .eq("id", deal.id)

      if (!dealError) {
        dealsUpdated++
      }
    }

    const totalRecordsUpdated = payoutsUpdated + dealsUpdated

    // Log the merge action
    await logAction({
      actionType: "merge",
      entityType: "participant_merge",
      entityId: `${sourceId}->${targetId}`,
      entityName: `${sourceName} -> ${targetName}`,
      description: `Merged participant "${sourceName}" into "${targetName}" (${totalRecordsUpdated} records updated)`,
      previousData: {
        source_id: sourceId,
        source_name: sourceName,
      },
      newData: {
        target_id: targetId,
        target_name: targetName,
        target_email: targetEmail,
        payouts_updated: payoutsUpdated,
        deals_updated: dealsUpdated,
        records_updated: totalRecordsUpdated,
      },
      requestId,
    })

    await logDebug(
      "info",
      "api",
      `Successfully merged participant ${sourceName} into ${targetName}`,
      { sourceId, targetId, payoutsUpdated, dealsUpdated, totalRecordsUpdated },
      requestId,
    )

    return NextResponse.json({
      success: true,
      data: {
        payouts_updated: payoutsUpdated,
        deals_updated: dealsUpdated,
        total_records_updated: totalRecordsUpdated,
        message: `Successfully merged "${sourceName}" into "${targetName}"`,
      },
    })
  } catch (error) {
    await logDebug(
      "error",
      "api",
      `Merge error: ${error instanceof Error ? error.message : "Unknown"}`,
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
