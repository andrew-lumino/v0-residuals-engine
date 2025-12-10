"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { CheckCircle2 } from "lucide-react"

export function AirtableSyncConfig() {
  const [baseId, setBaseId] = useState("")
  const [tableId, setTableId] = useState("")
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load existing config
    fetch("/api/airtable/sync-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.baseId) setBaseId(data.baseId)
        if (data.tableId) setTableId(data.tableId)
        setSaved(!!data.baseId && !!data.tableId)
      })
      .catch(console.error)
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/airtable/sync-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseId, tableId }),
      })

      if (!response.ok) throw new Error("Failed to save configuration")

      setSaved(true)
      alert("Configuration saved successfully!")
    } catch (error) {
      console.error("Error saving config:", error)
      alert("Failed to save configuration")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sync Configuration</CardTitle>
            <CardDescription>Configure your Airtable base and table for automatic syncing</CardDescription>
          </div>
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Configured</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="baseId">Airtable Base ID</Label>
          <Input id="baseId" placeholder="app..." value={baseId} onChange={(e) => setBaseId(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tableId">Airtable Table ID</Label>
          <Input id="tableId" placeholder="tbl..." value={tableId} onChange={(e) => setTableId(e.target.value)} />
        </div>
        <Button onClick={handleSave} disabled={loading || !baseId || !tableId}>
          {loading ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  )
}
