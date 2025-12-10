import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"
import { logActionAsync } from "@/lib/utils/history"

async function syncPayoutsToAirtable(payoutIds: string[]) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appRygdwVIEtbUI1C"
  const AIRTABLE_TABLE_ID = "tblWZlEw6pM9ytA1x"

  if (!AIRTABLE_API_KEY || payoutIds.length === 0) return { synced: 0 }

  try {
    const supabase = await createClient()

    const { data: payouts, error } = await supabase
      .from("payouts")
      .select("*")
      .in("id", payoutIds)
      .gt("partner_split_pct", 0) // Skip 0% payouts

    if (error || !payouts || payouts.length === 0) {
      console.error("[confirm-assignment] Failed to fetch payouts for Airtable sync:", error)
      return { synced: 0 }
    }

    // Fetch existing Airtable records to check which need create vs update
    const existingRecords: Map<string, string> = new Map()
    let offset: string | undefined

    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`)
      url.searchParams.set("pageSize", "100")
      url.searchParams.set("filterByFormula", `OR(${payoutIds.map((id) => `{Payout ID}="${id}"`).join(",")})`)
      if (offset) url.searchParams.set("offset", offset)

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      })

      if (response.ok) {
        const data = await response.json()
        for (const record of data.records || []) {
          const payoutId = record.fields["Payout ID"]
          if (payoutId) existingRecords.set(payoutId, record.id)
        }
        offset = data.offset
      } else {
        break
      }
    } while (offset)

    // Format payouts for Airtable
    const formatPayout = (payout: any) => ({
      "Payout ID": payout.id,
      "Deal ID": payout.deal_id || "",
      MID: String(payout.mid || ""),
      "Merchant Name": payout.merchant_name || "",
      "Payout Month": payout.payout_month || "",
      "Payout Date": payout.payout_date || "",
      "Partner ID": payout.partner_airtable_id || "",
      "Partner Name": payout.partner_name || "",
      "Partner Role": payout.partner_role || "",
      "Split %": payout.partner_split_pct || 0,
      "Payout Amount": payout.partner_payout_amount || 0,
      Volume: payout.volume || 0,
      Fees: payout.fees || 0,
      "Net Residual": payout.net_residual || 0,
      "Payout Type": payout.payout_type || "residual",
      Status: payout.assignment_status || "",
      "Paid Status": payout.paid_status || "unpaid",
      "Paid At": payout.paid_at || "",
      "Is Legacy": payout.is_legacy_import ? "Yes" : "No",
    })

    const recordsToCreate: any[] = []
    const recordsToUpdate: any[] = []

    for (const payout of payouts) {
      const airtableRecordId = existingRecords.get(payout.id)
      const fields = formatPayout(payout)

      if (airtableRecordId) {
        recordsToUpdate.push({ id: airtableRecordId, fields })
      } else {
        recordsToCreate.push({ fields })
      }
    }

    let synced = 0
    const batchSize = 10

    // Create new records
    for (let i = 0; i < recordsToCreate.length; i += batchSize) {
      const batch = recordsToCreate.slice(i, i + batchSize)
      const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: batch }),
      })
      if (res.ok) synced += batch.length
      await new Promise((r) => setTimeout(r, 220))
    }

    // Update existing records
    for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
      const batch = recordsToUpdate.slice(i, i + batchSize)
      const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: batch }),
      })
      if (res.ok) synced += batch.length
      await new Promise((r) => setTimeout(r, 220))
    }

    console.log(`[confirm-assignment] Synced ${synced} payouts to Airtable`)
    return { synced, created: recordsToCreate.length, updated: recordsToUpdate.length }
  } catch (error) {
    console.error("[confirm-assignment] Airtable sync error:", error)
    return { synced: 0, error }
  }
}

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { event_ids } = await request.json()
    const supabase = await createClient()

    const { data: events, error: fetchError } = await supabase.from("csv_data").select("*").in("id", event_ids)

    if (fetchError) {
      console.error("[confirm-assignment] Error fetching events:", fetchError)
      throw fetchError
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ error: "No events found" }, { status: 404 })
    }

    const eventsWithoutDeals = events.filter((e) => !e.deal_id)
    if (eventsWithoutDeals.length > 0) {
      const mids = eventsWithoutDeals.map((e) => e.mid).join(", ")
      return NextResponse.json(
        {
          error: `Cannot confirm events without deals assigned. Please assign partners first for MIDs: ${mids}`,
          events_without_deals: eventsWithoutDeals.map((e) => ({ id: e.id, mid: e.mid, merchant: e.merchant_name })),
        },
        { status: 400 },
      )
    }

    const dealIds = events.map((e) => e.deal_id).filter(Boolean)
    let dealsMap: Record<string, any> = {}

    if (dealIds.length > 0) {
      const { data: deals, error: dealsError } = await supabase.from("deals").select("*").in("id", dealIds)

      if (dealsError) {
        console.error("[confirm-assignment] Error fetching deals:", dealsError)
      } else if (deals) {
        dealsMap = Object.fromEntries(deals.map((d) => [d.id, d]))
      }
    }

    const dealsWithoutParticipants = events.filter((e) => {
      const deal = dealsMap[e.deal_id]
      return !deal || !deal.participants_json || deal.participants_json.length === 0
    })

    if (dealsWithoutParticipants.length > 0) {
      const mids = dealsWithoutParticipants.map((e) => e.mid).join(", ")
      return NextResponse.json(
        {
          error: `Cannot confirm events without participants assigned. Please assign partners first for MIDs: ${mids}`,
          events_without_participants: dealsWithoutParticipants.map((e) => ({
            id: e.id,
            mid: e.mid,
            merchant: e.merchant_name,
          })),
        },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase
      .from("csv_data")
      .update({
        assignment_status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .in("id", event_ids)

    if (updateError) {
      console.error("[confirm-assignment] Error updating csv_data:", updateError)
      throw updateError
    }

    logActionAsync({
      actionType: "bulk_update",
      entityType: "assignment",
      entityId: event_ids.join(","),
      entityName: `${events.length} events`,
      description: `Confirmed ${events.length} assignment(s)`,
      previousData: { status: "pending", event_ids },
      newData: { status: "confirmed", event_ids, merchants: events.map((e) => e.merchant_name) },
      requestId,
    })

    const { error: payoutsUpdateError } = await supabase
      .from("payouts")
      .update({
        assignment_status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .in("csv_data_id", event_ids)

    if (payoutsUpdateError) {
      console.error("[confirm-assignment] Error updating payouts:", payoutsUpdateError)
    }

    const { data: existingPayouts } = await supabase
      .from("payouts")
      .select("csv_data_id, id")
      .in("csv_data_id", event_ids)

    const eventsWithPayouts = new Set(existingPayouts?.map((p) => p.csv_data_id) || [])
    const eventsNeedingPayouts = events.filter((e) => !eventsWithPayouts.has(e.id))

    const allPayoutIds: string[] = existingPayouts?.map((p) => p.id) || []

    if (eventsNeedingPayouts.length > 0) {
      console.log("[confirm-assignment] Creating missing payouts for", eventsNeedingPayouts.length, "events")

      const payoutRows = []
      for (const event of eventsNeedingPayouts) {
        const deal = dealsMap[event.deal_id]
        if (!deal || !deal.participants_json) {
          console.warn("[confirm-assignment] No deal or participants for event:", event.id)
          continue
        }

        const participants = deal.participants_json as any[]
        const fees = Number.parseFloat(event.fees) || 0
        const adjustments = Number.parseFloat(event.adjustments) || 0
        const chargebacks = Number.parseFloat(event.chargebacks) || 0
        const netResidual = fees - adjustments - chargebacks

        for (const p of participants) {
          const splitPct = p.split_pct || 0
          const amount = (netResidual * splitPct) / 100
          payoutRows.push({
            csv_data_id: event.id,
            deal_id: deal.deal_id,
            mid: event.mid,
            merchant_name: event.merchant_name,
            payout_month: event.payout_month,
            payout_type: event.payout_type || "residual",
            volume: event.volume,
            fees: fees,
            adjustments: adjustments,
            chargebacks: chargebacks,
            net_residual: netResidual,
            partner_airtable_id: p.partner_airtable_id || p.agent_id,
            partner_role: p.partner_role || p.role,
            partner_name: p.partner_name || null,
            partner_split_pct: splitPct,
            partner_payout_amount: amount,
            assignment_status: "confirmed",
            paid_status: "unpaid",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      }

      if (payoutRows.length > 0) {
        const { data: insertedPayouts, error: insertError } = await supabase
          .from("payouts")
          .insert(payoutRows)
          .select("id")

        if (insertError) {
          console.error("[confirm-assignment] Error inserting payouts:", insertError)
        } else {
          console.log("[confirm-assignment] Created", payoutRows.length, "payout records")
          if (insertedPayouts) {
            allPayoutIds.push(...insertedPayouts.map((p) => p.id))
          }
        }
      }
    }

    let airtableResult = { synced: 0 }
    if (allPayoutIds.length > 0) {
      airtableResult = await syncPayoutsToAirtable(allPayoutIds)
    }

    return NextResponse.json({
      success: true,
      confirmed: events.length,
      payouts_updated: !payoutsUpdateError,
      airtable_synced: airtableResult.synced,
    })
  } catch (error: any) {
    console.error("[confirm-assignment] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
