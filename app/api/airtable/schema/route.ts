import { NextResponse } from "next/server"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

export async function GET() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return NextResponse.json({ error: "Missing Airtable API key or Base ID" }, { status: 500 })
  }

  try {
    // Fetch base schema
    const schemaResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    })

    if (!schemaResponse.ok) {
      const errorText = await schemaResponse.text()
      console.error("[airtable-schema] Schema fetch error:", errorText)
      return NextResponse.json(
        { error: `Failed to fetch Airtable schema: ${schemaResponse.status}`, details: errorText },
        { status: 500 },
      )
    }

    const schemaData = await schemaResponse.json()

    // Find the "All Payouts" table
    const payoutsTable = schemaData.tables?.find(
      (t: any) => t.name === "All Payouts" || t.name.toLowerCase().includes("payout"),
    )

    // Get sample records from All Payouts table
    let sampleRecords = null
    if (payoutsTable) {
      const recordsResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(payoutsTable.name)}?maxRecords=5`,
        {
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          },
        },
      )

      if (recordsResponse.ok) {
        const recordsData = await recordsResponse.json()
        sampleRecords = recordsData.records
      }
    }

    return NextResponse.json({
      success: true,
      baseId: AIRTABLE_BASE_ID,
      tables: schemaData.tables?.map((t: any) => ({
        id: t.id,
        name: t.name,
        fields: t.fields?.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          options: f.options,
        })),
      })),
      payoutsTable: payoutsTable
        ? {
            id: payoutsTable.id,
            name: payoutsTable.name,
            fields: payoutsTable.fields?.map((f: any) => ({
              name: f.name,
              type: f.type,
            })),
            sampleRecords,
          }
        : null,
    })
  } catch (error: any) {
    console.error("[airtable-schema] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch Airtable schema" }, { status: 500 })
  }
}
