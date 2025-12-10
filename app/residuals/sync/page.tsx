"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle, Download, Upload, Loader2, Search, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ChangeDetail {
  field: string
  oldValue: any
  newValue: any
}

interface NewRecord {
  payoutId: string
  mid: string
  merchantName: string
  partnerName: string
  payoutMonth: string
  payoutAmount: number
  status: string
  paidStatus: string
  fields: any
}

interface ChangedRecord {
  payoutId: string
  airtableRecordId: string
  mid: string
  merchantName: string
  partnerName: string
  payoutMonth: string
  changes: ChangeDetail[]
  fields: any
}

export default function SyncPage() {
  const [isComparing, setIsComparing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [logs, setLogs] = useState<string[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Compare results
  const [compareResults, setCompareResults] = useState<{
    newRecords: NewRecord[]
    changedRecords: ChangedRecord[]
    unchangedCount: number
    totalSupabase: number
    totalAirtable: number
  } | null>(null)

  // Selection state
  const [selectedNew, setSelectedNew] = useState<Set<string>>(new Set())
  const [selectedChanged, setSelectedChanged] = useState<Set<string>>(new Set())

  // Sync result
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    message: string
    created?: number
    updated?: number
  } | null>(null)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`])
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  const getMonthOptions = () => {
    const options = [{ value: "all", label: "All Months" }]
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const label = date.toLocaleDateString("en-US", { year: "numeric", month: "long" })
      options.push({ value, label })
    }
    return options
  }

  const handleCompare = async () => {
    setIsComparing(true)
    setCompareResults(null)
    setSyncResult(null)
    setSelectedNew(new Set())
    setSelectedChanged(new Set())
    setLogs([])

    addLog("Starting comparison...")
    addLog(`Selected month: ${selectedMonth === "all" ? "All Months" : selectedMonth}`)

    try {
      const response = await fetch("/api/airtable/compare-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth === "all" ? undefined : selectedMonth,
        }),
      })

      const data = await response.json()

      if (data.success) {
        addLog(`Found ${data.totalSupabase} payouts in database`)
        addLog(`Found ${data.totalAirtable} existing records in Airtable`)
        addLog(`New records to create: ${data.newRecords.length}`)
        addLog(`Changed records to update: ${data.changedRecords.length}`)
        addLog(`Unchanged records: ${data.unchangedCount}`)
        addLog("Comparison complete!")

        setCompareResults(data)

        // Auto-select all by default
        setSelectedNew(new Set(data.newRecords.map((r: NewRecord) => r.payoutId)))
        setSelectedChanged(new Set(data.changedRecords.map((r: ChangedRecord) => r.payoutId)))
      } else {
        addLog(`ERROR: ${data.error}`)
      }
    } catch (error: any) {
      addLog(`ERROR: ${error.message}`)
    } finally {
      setIsComparing(false)
    }
  }

  const handleSync = async () => {
    if (!compareResults) return

    const newToSync = compareResults.newRecords.filter((r) => selectedNew.has(r.payoutId))
    const changedToSync = compareResults.changedRecords.filter((r) => selectedChanged.has(r.payoutId))

    if (newToSync.length === 0 && changedToSync.length === 0) {
      addLog("No records selected to sync")
      return
    }

    setIsSyncing(true)
    setSyncResult(null)

    addLog(`Syncing ${newToSync.length} new records and ${changedToSync.length} changed records...`)

    try {
      const response = await fetch("/api/airtable/sync-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRecords: newToSync,
          changedRecords: changedToSync,
        }),
      })

      const data = await response.json()

      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((err: string) => addLog(`ERROR: ${err}`))
      }

      addLog(`Created ${data.created || 0} new records`)
      addLog(`Updated ${data.updated || 0} existing records`)
      addLog("Sync complete!")

      setSyncResult({
        success: data.success,
        message: data.success
          ? `Successfully synced: ${data.created} created, ${data.updated} updated`
          : `Sync had errors: ${data.created} created, ${data.updated} updated`,
        created: data.created,
        updated: data.updated,
      })

      // Only clear results if fully successful
      if (data.success) {
        setCompareResults(null)
      }
    } catch (error: any) {
      addLog(`ERROR: ${error.message}`)
      setSyncResult({
        success: false,
        message: error.message || "Failed to sync",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleExport = async () => {
    try {
      addLog("Starting CSV export...")
      const response = await fetch("/api/payouts/export-airtable?status=all")
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `airtable-payouts-${new Date().toISOString().split("T")[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        addLog("CSV export complete!")
      } else {
        addLog("ERROR: Failed to export CSV")
      }
    } catch (error: any) {
      addLog(`ERROR: ${error.message}`)
    }
  }

  const toggleSelectAllNew = (checked: boolean) => {
    if (checked && compareResults) {
      setSelectedNew(new Set(compareResults.newRecords.map((r) => r.payoutId)))
    } else {
      setSelectedNew(new Set())
    }
  }

  const toggleSelectAllChanged = (checked: boolean) => {
    if (checked && compareResults) {
      setSelectedChanged(new Set(compareResults.changedRecords.map((r) => r.payoutId)))
    } else {
      setSelectedChanged(new Set())
    }
  }

  const formatValue = (val: any) => {
    if (val === null || val === undefined || val === "")
      return <span className="text-muted-foreground italic">empty</span>
    if (typeof val === "number") return val.toLocaleString()
    return String(val)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Airtable Sync</h1>
        <p className="text-muted-foreground">Compare and sync payouts to Airtable</p>
      </div>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Compare & Sync Payouts
          </CardTitle>
          <CardDescription>
            Compare payouts in your database with Airtable, review differences, then confirm which records to sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleCompare} disabled={isComparing} variant="outline">
              {isComparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {isComparing ? "Comparing..." : "Compare with Airtable"}
            </Button>

            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* Live Console */}
          {logs.length > 0 && (
            <div className="bg-zinc-900 text-zinc-100 rounded-md p-3 font-mono text-xs max-h-48 overflow-y-auto">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.includes("ERROR")
                      ? "text-red-400"
                      : log.includes("complete")
                        ? "text-green-400"
                        : "text-zinc-300"
                  }
                >
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          {syncResult && (
            <Alert className={syncResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              {syncResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={syncResult.success ? "text-green-800" : "text-red-800"}>
                {syncResult.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {compareResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Comparison Results</CardTitle>
                <CardDescription>
                  {compareResults.newRecords.length} new, {compareResults.changedRecords.length} changed,{" "}
                  {compareResults.unchangedCount} unchanged
                </CardDescription>
              </div>
              <Button
                onClick={handleSync}
                disabled={isSyncing || (selectedNew.size === 0 && selectedChanged.size === 0)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isSyncing ? "Syncing..." : `Sync Selected (${selectedNew.size + selectedChanged.size})`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="new">
              <TabsList>
                <TabsTrigger value="new">
                  New Records
                  <Badge variant="secondary" className="ml-2">
                    {compareResults.newRecords.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="changed">
                  Changed Records
                  <Badge variant="secondary" className="ml-2">
                    {compareResults.changedRecords.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="mt-4">
                {compareResults.newRecords.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No new records to create</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedNew.size === compareResults.newRecords.length}
                              onCheckedChange={toggleSelectAllNew}
                            />
                          </TableHead>
                          <TableHead>MID</TableHead>
                          <TableHead>Merchant</TableHead>
                          <TableHead>Partner</TableHead>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compareResults.newRecords.map((record) => (
                          <TableRow key={record.payoutId}>
                            <TableCell>
                              <Checkbox
                                checked={selectedNew.has(record.payoutId)}
                                onCheckedChange={(checked) => {
                                  const newSet = new Set(selectedNew)
                                  if (checked) {
                                    newSet.add(record.payoutId)
                                  } else {
                                    newSet.delete(record.payoutId)
                                  }
                                  setSelectedNew(newSet)
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{record.mid}</TableCell>
                            <TableCell>{record.merchantName}</TableCell>
                            <TableCell>{record.partnerName}</TableCell>
                            <TableCell>{record.payoutMonth}</TableCell>
                            <TableCell className="text-right">${(record.payoutAmount || 0).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{record.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="changed" className="mt-4">
                {compareResults.changedRecords.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No changed records to update</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedChanged.size === compareResults.changedRecords.length}
                              onCheckedChange={toggleSelectAllChanged}
                            />
                          </TableHead>
                          <TableHead>MID</TableHead>
                          <TableHead>Merchant</TableHead>
                          <TableHead>Partner</TableHead>
                          <TableHead>Changes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compareResults.changedRecords.map((record) => (
                          <TableRow key={record.payoutId}>
                            <TableCell>
                              <Checkbox
                                checked={selectedChanged.has(record.payoutId)}
                                onCheckedChange={(checked) => {
                                  const newSet = new Set(selectedChanged)
                                  if (checked) {
                                    newSet.add(record.payoutId)
                                  } else {
                                    newSet.delete(record.payoutId)
                                  }
                                  setSelectedChanged(newSet)
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{record.mid}</TableCell>
                            <TableCell>{record.merchantName}</TableCell>
                            <TableCell>{record.partnerName}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {record.changes.map((change, i) => (
                                  <div key={i} className="text-xs flex items-center gap-1">
                                    <span className="font-medium">{change.field}:</span>
                                    <span className="text-red-600 line-through">{formatValue(change.oldValue)}</span>
                                    <ArrowRight className="h-3 w-3" />
                                    <span className="text-green-600">{formatValue(change.newValue)}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
