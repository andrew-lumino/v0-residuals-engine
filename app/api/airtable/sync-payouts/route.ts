import { createServerClient } from "@/lib/db/server"
import { NextResponse } from "next/server"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appRygdwVIEtbUI1C"
const AIRTABLE_TABLE_ID = "tblWZlEw6pM9ytA1x"

const formatPayoutForAirtable = (payout: any) => ({
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

export async function POST(request: Request) {
  if (!AIRTABLE_API_KEY) {
    return NextResponse.json({ error: "Missing AIRTABLE_API_KEY environment variable" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { month } = body

    const supabase = await createServerClient()

    // Step 1: Fetch ALL payouts from Supabase with explicit large limit
    let query = supabase.from("payouts").select("*").order("created_at", { ascending: false }).limit(10000)

    if (month) {
      query = query.eq("payout_month", month)
    }

    const { data: allPayouts, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!allPayouts || allPayouts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No payouts to sync",
        created: 0,
        updated: 0,
        total: 0,
      })
    }

    // Step 2: Fetch existing Airtable records
    const existingRecords: Map<string, { id: string; fields: any }> = new Map()
    let offset: string | undefined

    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`)
      url.searchParams.set("pageSize", "100")
      if (offset) {
        url.searchParams.set("offset", offset)
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { error: `Failed to fetch from Airtable: ${response.status} - ${errorText}` },
          { status: 500 },
        )
      }

      const data = await response.json()

      for (const record of data.records || []) {
        const payoutId = record.fields["Payout ID"]
        if (payoutId) {
          existingRecords.set(payoutId, record)
        }
      }
      offset = data.offset
    } while (offset)

    // Step 3: Determine what to create vs update
    const recordsToCreate: any[] = []
    const recordsToUpdate: any[] = []

    for (const payout of allPayouts) {
      const airtableData = formatPayoutForAirtable(payout)
      const existingRecord = existingRecords.get(payout.id)

      if (existingRecord) {
        // Check if any fields have changed
        const existing = existingRecord.fields
        const hasChanges =
          existing["Paid Status"] !== airtableData["Paid Status"] ||
          existing["Paid At"] !== airtableData["Paid At"] ||
          existing["Status"] !== airtableData["Status"] ||
          existing["Split %"] !== airtableData["Split %"] ||
          existing["Payout Amount"] !== airtableData["Payout Amount"] ||
          existing["Partner Role"] !== airtableData["Partner Role"] ||
          existing["Partner Name"] !== airtableData["Partner Name"]

        if (hasChanges) {
          recordsToUpdate.push({
            id: existingRecord.id,
            fields: airtableData,
          })
        }
      } else {
        recordsToCreate.push({
          fields: airtableData,
        })
      }
    }

    // Step 4: Create new records in batches of 10
    let createdCount = 0
    const createErrors: string[] = []
    const batchSize = 10

    for (let i = 0; i < recordsToCreate.length; i += batchSize) {
      const batch = recordsToCreate.slice(i, i + batchSize)

      const createResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: batch }),
      })

      if (createResponse.ok) {
        createdCount += batch.length
      } else {
        const errText = await createResponse.text()
        createErrors.push(`Batch ${i / batchSize}: ${errText}`)
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 220))
    }

    // Step 5: Update existing records in batches of 10
    let updatedCount = 0
    const updateErrors: string[] = []

    for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
      const batch = recordsToUpdate.slice(i, i + batchSize)

      const updateResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: batch }),
      })

      if (updateResponse.ok) {
        updatedCount += batch.length
      } else {
        const errText = await updateResponse.text()
        updateErrors.push(`Batch ${i / batchSize}: ${errText}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 220))
    }

    return NextResponse.json({
      success: true,
      message: `Sync complete: ${createdCount} created, ${updatedCount} updated`,
      created: createdCount,
      updated: updatedCount,
      toCreate: recordsToCreate.length,
      toUpdate: recordsToUpdate.length,
      totalPayouts: allPayouts.length,
      existingAirtableRecords: existingRecords.size,
      unchanged: allPayouts.length - createdCount - updatedCount,
      tableId: AIRTABLE_TABLE_ID,
      createErrors: createErrors.length > 0 ? createErrors.slice(0, 5) : undefined,
      updateErrors: updateErrors.length > 0 ? updateErrors.slice(0, 5) : undefined,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to sync payouts to Airtable" }, { status: 500 })
  }
}
