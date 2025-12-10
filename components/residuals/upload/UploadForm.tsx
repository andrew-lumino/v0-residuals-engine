"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, FileText, AlertCircle, CheckCircle, X, RotateCcw, Download, Table, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface TableRow {
  mid: string
  merchant_name: string
  volume: string
  fees: string
  date: string
  payout_month: string
}

const emptyRow: TableRow = {
  mid: "",
  merchant_name: "",
  volume: "",
  fees: "",
  date: "",
  payout_month: "",
}

interface UploadFormProps {
  onSuccess?: () => void
}

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [mode, setMode] = useState<"file" | "manual">("file")
  const [tableRows, setTableRows] = useState<TableRow[]>([{ ...emptyRow }])
  const [files, setFiles] = useState<File[]>([])
  const [processingMonth, setProcessingMonth] = useState("")
  const [analysisResults, setAnalysisResults] = useState<any>(null)
  const [uploadStatus, setUploadStatus] = useState<string>("idle")
  const [uploadResults, setUploadResults] = useState<any>(null)
  const [errors, setErrors] = useState<string[]>([])

  const fieldMappings: Record<string, string[]> = {
    mid: ["mid", "MID", "Merchant ID", "merchant_id", "merchantid", "merchant_identifier"],
    merchant_name: ["merchant_name", "Merchant Name", "merchantname", "company_name", "business_name", "name"],
    volume: ["volume", "Volume", "transaction_volume", "monthly_volume", "total_volume", "sales"],
    fees: ["fees", "Fees", "payout_amount", "Payout Amount", "Payout", "Payouts", "net_payout", "residual_amount"],
    date: ["date", "Date", "txn_date", "Transaction Date", "payment_date", "process_date"],
    payout_month: ["payout_month", "Payout Month", "month", "processing_month", "period"],
    adjustments: ["adjustments", "Adjustments", "adjustment"],
    chargebacks: ["chargebacks", "Chargebacks", "chargeback"],
  }

  const requiredFields = ["mid"]

  const addRow = () => {
    setTableRows([...tableRows, { ...emptyRow }])
  }

  const removeRow = (index: number) => {
    if (tableRows.length > 1) {
      setTableRows(tableRows.filter((_, i) => i !== index))
    }
  }

  const updateCell = (rowIndex: number, field: keyof TableRow, value: string) => {
    const newRows = [...tableRows]
    newRows[rowIndex] = { ...newRows[rowIndex], [field]: value }
    setTableRows(newRows)
  }

  const escapeCSVField = (field: string): string => {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }

  const tableRowsToCSV = (): string => {
    const headers = ["Merchant ID", "Merchant Name", "Volume", "Fees", "Date", "Payout Month"]
    const dataRows = tableRows
      .filter((row) => row.mid.trim() !== "") // Only include rows with MID
      .map((row) => {
        // Use the processing month as fallback for payout_month if not specified
        const payoutMonth = row.payout_month || processingMonth
        const merchantName = row.merchant_name || `Merchant ${row.mid}`
        return [
          escapeCSVField(row.mid),
          escapeCSVField(merchantName),
          escapeCSVField(row.volume || "0"),
          escapeCSVField(row.fees || "0"),
          escapeCSVField(row.date || new Date().toISOString().split("T")[0]),
          escapeCSVField(payoutMonth),
        ].join(",")
      })
    return [headers.join(","), ...dataRows].join("\n")
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "text/csv" || file.name.endsWith(".csv"),
    )
    setFiles((prev) => [...prev, ...droppedFiles])
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      (file) => file.type === "text/csv" || file.name.endsWith(".csv"),
    )
    setFiles((prev) => [...prev, ...selectedFiles])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const reset = () => {
    setFiles([])
    setTableRows([{ ...emptyRow }])
    setAnalysisResults(null)
    setUploadStatus("idle")
    setUploadResults(null)
    setErrors([])
    setProcessingMonth("")
  }

  const findMatchingHeader = (headers: string[], fieldKey: string) => {
    const possibleNames = fieldMappings[fieldKey]
    return headers.find((header) =>
      possibleNames.some((name) => header.toLowerCase().trim() === name.toLowerCase().trim()),
    )
  }

  const analyzeFiles = async () => {
    if (mode === "file" && files.length === 0) {
      setErrors(["Please select at least one CSV file"])
      return
    }

    if (mode === "manual") {
      const validRows = tableRows.filter((row) => row.mid.trim() !== "")
      if (validRows.length === 0) {
        setErrors(["Please enter at least one row with a Merchant ID"])
        return
      }
    }

    if (!processingMonth) {
      setErrors(["Please select a processing month"])
      return
    }

    setUploadStatus("analyzing")
    setErrors([])

    try {
      const Papa = (await import("papaparse")).default

      let analysisPromises: Promise<any>[]

      if (mode === "manual") {
        const validRows = tableRows.filter((row) => row.mid.trim() !== "")
        const headers = ["Merchant ID", "Merchant Name", "Volume", "Fees", "Date", "Payout Month"]
        const fieldMapping: Record<string, string> = {
          mid: "Merchant ID",
          merchant_name: "Merchant Name",
          volume: "Volume",
          fees: "Fees",
          date: "Date",
          payout_month: "Payout Month",
        }

        const dataQuality: Record<string, any> = {}
        Object.keys(fieldMapping).forEach((fieldKey) => {
          const nonEmptyCount = validRows.filter((row) => {
            const value = row[fieldKey as keyof TableRow]
            return value !== null && value !== undefined && value !== ""
          }).length
          dataQuality[fieldKey] = {
            total: validRows.length,
            populated: nonEmptyCount,
            percentage: validRows.length > 0 ? (nonEmptyCount / validRows.length) * 100 : 0,
          }
        })

        analysisPromises = [
          Promise.resolve({
            fileName: "Manual Entry",
            rowCount: validRows.length,
            headers,
            fieldMapping,
            missingRequired: [],
            optionalFound: ["merchant_name", "volume", "fees", "date", "payout_month"],
            dataQuality,
            hasErrors: false,
          }),
        ]
      } else {
        // Original file parsing logic
        analysisPromises = files.map(async (file) => {
          const text = await file.text()
          const parsed = Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
          })

          const headers = parsed.meta.fields || []
          const fieldMapping: Record<string, string> = {}
          const missingRequired: string[] = []
          const optionalFound: string[] = []

          Object.keys(fieldMappings).forEach((fieldKey) => {
            const matchedHeader = findMatchingHeader(headers, fieldKey)
            if (matchedHeader) {
              fieldMapping[fieldKey] = matchedHeader
              if (!requiredFields.includes(fieldKey)) {
                optionalFound.push(fieldKey)
              }
            } else if (requiredFields.includes(fieldKey)) {
              missingRequired.push(fieldKey)
            }
          })

          const dataQuality: Record<string, any> = {}
          Object.keys(fieldMapping).forEach((fieldKey) => {
            const headerName = fieldMapping[fieldKey]
            const nonEmptyCount = parsed.data.filter(
              (row: any) => row[headerName] !== null && row[headerName] !== undefined && row[headerName] !== "",
            ).length
            dataQuality[fieldKey] = {
              total: parsed.data.length,
              populated: nonEmptyCount,
              percentage: (nonEmptyCount / parsed.data.length) * 100,
            }
          })

          return {
            fileName: file.name,
            rowCount: parsed.data.length,
            headers,
            fieldMapping,
            missingRequired,
            optionalFound,
            dataQuality,
            hasErrors: missingRequired.length > 0,
          }
        })
      }

      const results = await Promise.all(analysisPromises)
      setAnalysisResults(results)

      const hasAnyErrors = results.some((result) => result.hasErrors)
      if (hasAnyErrors) {
        setUploadStatus("error")
        setErrors(
          results.flatMap((result) =>
            result.missingRequired.map((field: string) => `${result.fileName}: Missing required field "${field}"`),
          ),
        )
      } else {
        setUploadStatus("confirmed")
      }
    } catch (error: any) {
      setUploadStatus("error")
      setErrors([`Analysis failed: ${error.message}`])
    }
  }

  const confirmAndUpload = async () => {
    if (!analysisResults) return

    setUploadStatus("uploading")
    setErrors([])

    try {
      if (mode === "manual") {
        const csvContent = tableRowsToCSV()
        console.log("[v0] Manual entry CSV content:", csvContent)

        const blob = new Blob([csvContent], { type: "text/csv" })
        const file = new File([blob], "manual-entry.csv", { type: "text/csv" })

        const formData = new FormData()
        formData.append("month", processingMonth)
        formData.append("file", file)

        const response = await fetch("/api/residuals/upload", {
          method: "POST",
          body: formData,
        })

        const contentType = response.headers.get("content-type")
        let result: any

        if (contentType?.includes("application/json")) {
          result = await response.json()
        } else {
          const text = await response.text()
          throw new Error(`Server error: ${text || response.statusText || "Unknown error"}`)
        }

        if (!response.ok || !result.success) {
          const errorMessage = result.error || result.message || "Upload failed"
          throw new Error(errorMessage)
        }

        setUploadResults({
          success: result.success,
          imported: result.data?.imported || 0,
          duplicates: result.data?.duplicates || 0,
          message: result.message,
        })

        setUploadStatus("complete")
        onSuccess?.()
      } else {
        let totalImported = 0
        let totalDuplicates = 0

        for (const file of files) {
          const formData = new FormData()
          formData.append("month", processingMonth)
          formData.append("file", file)

          const response = await fetch("/api/residuals/upload", {
            method: "POST",
            body: formData,
          })

          const contentType = response.headers.get("content-type")
          let result: any

          if (contentType?.includes("application/json")) {
            result = await response.json()
          } else {
            const text = await response.text()
            throw new Error(`Server error: ${text || response.statusText || "Unknown error"}`)
          }

          if (!response.ok || !result.success) {
            throw new Error(result.error || `Upload failed: ${response.statusText}`)
          }

          totalImported += result.data?.imported || 0
          totalDuplicates += result.data?.duplicates || 0
        }

        setUploadResults({
          success: true,
          imported: totalImported,
          duplicates: totalDuplicates,
          message: `Successfully processed ${files.length} file(s)`,
        })

        setUploadStatus("complete")
        onSuccess?.()
      }
    } catch (error: any) {
      console.error("[v0] Upload error:", error)
      setUploadStatus("error")
      setErrors([error.message || "Unknown error occurred"])
    }
  }

  const downloadTemplate = () => {
    const csvContent = [
      "Merchant ID,Merchant Name,Volume,Fees,Date,Payout Month",
      "1234567890,Example Store Inc,125000.00,5000.00,2024-01-15,2024-01",
      "0987654321,Sample Business LLC,87500.50,3200.25,2024-01-15,2024-01",
      "5555555555,Demo Merchant Corp,250000.00,8500.00,2024-01-15,2024-01",
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "csv-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const validRowCount = tableRows.filter((row) => row.mid.trim() !== "").length

  return (
    <div className="bg-white rounded-lg">
      <div className="px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Upload CSV Files</h1>
            <p className="text-sm text-gray-600 mt-1">Upload monthly revenue data for processing</p>
          </div>
          <Button onClick={reset} variant="ghost" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "file" | "manual")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="file">
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Table className="h-4 w-4 mr-2" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-6 mt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900 mb-2">CSV Upload Instructions</h3>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>
                      <strong>Required field:</strong> Merchant ID (or MID)
                    </li>
                    <li>
                      <strong>Recommended fields:</strong> Merchant Name, Volume, Payouts (or Fees)
                    </li>
                    <li>Supports various column names - system will attempt to auto-detect and map fields</li>
                    <li>Accepts currency formats: $1,234.56 or 1234.56</li>
                    <li>Multiple files can be uploaded at once for the same month</li>
                  </ul>
                </div>
                <Button onClick={downloadTemplate} variant="outline" size="sm" className="whitespace-nowrap bg-white">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg text-gray-600 mb-2">Drag & drop CSV files here, or click to select</p>
              <p className="text-sm text-gray-500 mb-4">Supports multiple files</p>
              <input type="file" multiple accept=".csv" onChange={handleFileInput} className="hidden" id="file-input" />
              <label
                htmlFor="file-input"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
              >
                Select Files
              </label>
            </div>

            {files.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Files</h3>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-6 mt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-medium text-blue-900 mb-2">Manual Entry Instructions</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Type directly into the table cells below</li>
                <li>
                  <strong>Required:</strong> Merchant ID is required for each row
                </li>
                <li>Add more rows using the "Add Row" button</li>
                <li>Great for small batches, testing, or quick data entry</li>
              </ul>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Merchant ID *</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Merchant Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Volume</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Fees</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Payout Month</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700 border-b w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b hover:bg-gray-50">
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.mid}
                          onChange={(e) => updateCell(rowIndex, "mid", e.target.value)}
                          placeholder="123456789"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.merchant_name}
                          onChange={(e) => updateCell(rowIndex, "merchant_name", e.target.value)}
                          placeholder="Business Name"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.volume}
                          onChange={(e) => updateCell(rowIndex, "volume", e.target.value)}
                          placeholder="10000.00"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.fees}
                          onChange={(e) => updateCell(rowIndex, "fees", e.target.value)}
                          placeholder="100.00"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.date}
                          onChange={(e) => updateCell(rowIndex, "date", e.target.value)}
                          placeholder="2024-01-15"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.payout_month}
                          onChange={(e) => updateCell(rowIndex, "payout_month", e.target.value)}
                          placeholder="2024-01"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          onClick={() => removeRow(rowIndex)}
                          disabled={tableRows.length === 1}
                          className="p-1 text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button onClick={addRow} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
              <p className="text-sm text-gray-500">
                {validRowCount} valid {validRowCount === 1 ? "row" : "rows"} (with Merchant ID)
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Processing Month <span className="text-red-500">*</span>
          </label>
          <input
            type="month"
            value={processingMonth}
            onChange={(e) => setProcessingMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="font-medium text-red-800">Errors Found</h3>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {analysisResults && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-medium text-blue-800 mb-3">Analysis Results</h3>
            <div className="space-y-4">
              {analysisResults.map((analysis: any, index: number) => (
                <div key={index} className="bg-white rounded-md p-4 border">
                  <h4 className="font-medium text-gray-900 mb-2">{analysis.fileName}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p>
                        <strong>Rows:</strong> {analysis.rowCount}
                      </p>
                      <p>
                        <strong>Status:</strong>
                        <span className={analysis.hasErrors ? "text-red-600" : "text-green-600"}>
                          {analysis.hasErrors ? " Has Errors" : " Ready"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Required Fields:</strong> {requiredFields.length - analysis.missingRequired.length}/
                        {requiredFields.length}
                      </p>
                      <p>
                        <strong>Optional Fields:</strong> {analysis.optionalFound.length}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadResults && (
          <div
            className={`rounded-md p-4 ${uploadResults.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {uploadResults.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <h3 className={`font-medium ${uploadResults.success ? "text-green-800" : "text-red-800"}`}>
                {uploadResults.success ? "Upload Complete" : "Upload Failed"}
              </h3>
            </div>
            <p className={`text-sm ${uploadResults.success ? "text-green-700" : "text-red-700"}`}>
              {uploadResults.message}
            </p>
            {uploadResults.success && (
              <div className="mt-2 text-sm text-green-700">
                <p>Imported: {uploadResults.imported} rows</p>
                {uploadResults.duplicates > 0 && <p>Duplicates skipped: {uploadResults.duplicates}</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          {uploadStatus === "idle" || uploadStatus === "error" ? (
            <Button onClick={analyzeFiles} className="flex-1">
              Analyze {mode === "file" ? "Files" : "Data"}
            </Button>
          ) : uploadStatus === "confirmed" ? (
            <>
              <Button onClick={reset} variant="outline" className="flex-1 bg-transparent">
                Cancel
              </Button>
              <Button onClick={confirmAndUpload} className="flex-1">
                Confirm & Upload
              </Button>
            </>
          ) : uploadStatus === "complete" ? (
            <Button onClick={reset} className="flex-1">
              Upload More
            </Button>
          ) : (
            <Button disabled className="flex-1">
              {uploadStatus === "analyzing" ? "Analyzing..." : "Uploading..."}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
