"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, FileUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import Papa from "papaparse"

export default function ImportLegacyPayoutsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<{ imported: number; errors: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        setError("Please upload a valid CSV file")
        return
      }
      setFile(selectedFile)
      setError(null)
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setIsUploading(true)
    setUploadProgress(10)
    setError(null)

    try {
      // Parse CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          setUploadProgress(30)

          // Transform data to match database schema
          const payouts = results.data.map((row: any) => ({
            id: row.id,
            csv_data_id: row.csv_data_id,
            deal_id: row.deal_id,
            payout_month: row.payout_month,
            payout_date: row.payout_date,
            mid: row.mid,
            merchant_name: row.merchant_name,
            payout_type: row.payout_type || "residual",
            volume: Number.parseFloat(row.volume) || 0,
            fees: Number.parseFloat(row.fees) || 0,
            adjustments: Number.parseFloat(row.adjustments) || 0,
            chargebacks: Number.parseFloat(row.chargebacks) || 0,
            net_residual: Number.parseFloat(row.net_residual) || 0,
            partner_airtable_id: row.partner_airtable_id,
            partner_role: row.partner_role,
            partner_split_pct: Number.parseFloat(row.partner_split_pct) || 0,
            partner_payout_amount: Number.parseFloat(row.partner_payout_amount) || 0,
            deal_plan: row.deal_plan,
            assignment_status: row.assignment_status || "confirmed",
            paid_status: row.paid_status || "unpaid",
            paid_at: row.paid_at || null,
            batch_id: row.batch_id || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }))

          setUploadProgress(50)

          // Send to API
          const response = await fetch("/api/payouts/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payouts }),
          })

          setUploadProgress(90)

          const data = await response.json()

          if (!data.success) {
            throw new Error(data.error || "Import failed")
          }

          setUploadProgress(100)
          setResult(data)
          setFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        },
        error: (error) => {
          setError(`Failed to parse CSV: ${error.message}`)
          setUploadProgress(0)
          setIsUploading(false)
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Legacy Payouts</h1>
        <p className="text-muted-foreground mt-2">
          Upload historical payout data from your previous system. This will populate the payouts table with existing
          records.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Payouts CSV</CardTitle>
          <CardDescription>
            The CSV should contain all payout records with columns: id, csv_data_id, deal_id, payout_month, mid,
            merchant_name, volume, fees, partner_airtable_id, partner_payout_amount, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drop Zone */}
          <div
            className={`
            border-2 border-dashed rounded-lg p-10 text-center transition-colors
            ${file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
          `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="legacy-csv-upload"
              disabled={isUploading}
            />

            <label htmlFor="legacy-csv-upload" className="cursor-pointer flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : file ? (
                  <FileUp className="h-8 w-8 text-primary" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
              </div>

              <div>
                {file ? (
                  <p className="font-medium text-lg">{file.name}</p>
                ) : (
                  <>
                    <p className="font-medium text-lg">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground mt-1">Payouts CSV file (legacy format)</p>
                  </>
                )}
              </div>
            </label>
          </div>

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Importing payouts...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success */}
          {result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Import Complete</AlertTitle>
              <AlertDescription className="text-green-700">
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    • Successfully imported: <strong>{result.imported}</strong> payout records
                  </p>
                  <p>
                    • Total processed: <strong>{result.total}</strong>
                  </p>
                  {result.errors > 0 && (
                    <p className="text-orange-700">
                      • Errors: <strong>{result.errors}</strong>
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {file && !isUploading && !result && (
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
              >
                Cancel
              </Button>
            )}
            <Button onClick={handleImport} disabled={!file || isUploading}>
              {isUploading ? "Importing..." : "Start Import"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>After importing, go to Payouts page to verify the data</li>
            <li>Export the data to Airtable format using the Export button</li>
            <li>Upload the exported CSV to Airtable to create your sync table</li>
            <li>Configure the Airtable sync on the Sync page with your table ID</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
