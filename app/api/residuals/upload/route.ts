import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"
import { parseCsvFile } from "@/lib/utils/csvParser"
import type { BatchImportResult } from "@/lib/types/api"
import { logActionAsync } from "@/lib/utils/history"

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const selectedMonth = formData.get("month") as string | null

    if (!file) {
      console.error("[v0] No file in formData. Keys:", [...formData.keys()])
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 })
    }

    console.log("[v0] Upload started - File:", file.name, "Selected month:", selectedMonth)

    const text = await file.text()
    console.log("[v0] CSV text preview:", text.substring(0, 500))

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: "CSV file is empty" }, { status: 400 })
    }

    const { rows, errors } = await parseCsvFile(text, {
      payoutMonth: selectedMonth || undefined,
    })
    console.log("[v0] Parsed rows:", rows.length, "Errors:", errors.length, "Using payout_month:", selectedMonth)

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            errors.length > 0
              ? errors.join("; ")
              : "No valid rows found in CSV. Make sure you have a 'Merchant ID' column.",
          errors,
          debug: { textLength: text.length, textPreview: text.substring(0, 200) },
        },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const batch_id = crypto.randomUUID()

    // Check for duplicates using row_hash
    const hashes = rows.map((r) => r.row_hash)

    // We process in chunks of 1000 to avoid query limits
    const duplicates = new Set<string>()
    const chunkSize = 1000

    for (let i = 0; i < hashes.length; i += chunkSize) {
      const chunk = hashes.slice(i, i + chunkSize)
      const { data: existing } = await supabase.from("csv_data").select("row_hash").in("row_hash", chunk)

      existing?.forEach((r) => duplicates.add(r.row_hash!))
    }

    // Filter out duplicates
    const newRows = rows.filter((r) => !duplicates.has(r.row_hash))
    const skippedCount = rows.length - newRows.length

    console.log("[v0] New rows:", newRows.length, "Skipped duplicates:", skippedCount)

    if (newRows.length > 0) {
      // Prepare insert data
      const insertData = newRows.map((row) => ({
        batch_id,
        mid: row.mid,
        merchant_name: row.merchant_name,
        volume: row.volume,
        fees: row.fees,
        date: row.date.toISOString().split("T")[0], // Only YYYY-MM-DD for date type
        payout_month: row.payout_month, // Now correctly set from user selection
        row_hash: row.row_hash,
        raw_data: row.raw_data,
        assignment_status: "unassigned",
        payout_type: "residual",
        airtable_synced: false,
        adjustments: 0,
        chargebacks: 0,
      }))

      console.log("[v0] Insert data sample:", JSON.stringify(insertData[0], null, 2))

      // Insert in chunks
      for (let i = 0; i < insertData.length; i += chunkSize) {
        const chunk = insertData.slice(i, i + chunkSize)
        const { error } = await supabase.from("csv_data").insert(chunk)

        if (error) {
          console.error("[v0] Insert error:", error)
          return NextResponse.json(
            { success: false, error: `Database insert failed: ${error.message}` },
            { status: 500 },
          )
        }
      }

      logActionAsync({
        actionType: "import",
        entityType: "event",
        entityId: batch_id,
        entityName: `CSV Upload: ${file.name}`,
        previousData: null,
        newData: {
          fileName: file.name,
          payout_month: selectedMonth,
          totalRows: rows.length,
          importedRows: newRows.length,
          duplicatesSkipped: skippedCount,
          errors: errors.length,
        },
        description: `Imported ${newRows.length} events from ${file.name} for ${selectedMonth || "current month"}${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ""}`,
        requestId,
      })
    }

    const result: BatchImportResult = {
      success: true,
      batch_id,
      imported: newRows.length,
      duplicates: skippedCount,
      errors,
    }

    console.log("[v0] Upload success:", result)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("[v0] Upload handler error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
