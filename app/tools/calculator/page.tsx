"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calculator, Plus, Trash2, Download, RotateCcw, DollarSign, Users, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface Participant {
  id: string
  name: string
  role: "agent" | "company" | "fund" | "partner"
  splitPct: number
}

export default function CalculatorPage() {
  const [grossRevenue, setGrossRevenue] = useState<number>(0)
  const [processorCosts, setProcessorCosts] = useState<number>(0)
  const [adjustments, setAdjustments] = useState<number>(0)
  const [chargebacks, setChargebacks] = useState<number>(0)
  const [participants, setParticipants] = useState<Participant[]>([
    { id: crypto.randomUUID(), name: "", role: "agent", splitPct: 100 },
  ])

  const netRevenue = useMemo(() => {
    return grossRevenue - processorCosts - adjustments - chargebacks
  }, [grossRevenue, processorCosts, adjustments, chargebacks])

  const totalSplit = useMemo(() => {
    return participants.reduce((sum, p) => sum + (p.splitPct || 0), 0)
  }, [participants])

  const calculations = useMemo(() => {
    return participants.map((p) => ({
      ...p,
      amount: netRevenue * (p.splitPct / 100),
    }))
  }, [participants, netRevenue])

  const addParticipant = () => {
    setParticipants([...participants, { id: crypto.randomUUID(), name: "", role: "agent", splitPct: 0 }])
  }

  const removeParticipant = (id: string) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((p) => p.id !== id))
    }
  }

  const updateParticipant = (id: string, field: keyof Participant, value: string | number) => {
    setParticipants(participants.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const resetCalculator = () => {
    setGrossRevenue(0)
    setProcessorCosts(0)
    setAdjustments(0)
    setChargebacks(0)
    setParticipants([{ id: crypto.randomUUID(), name: "", role: "agent", splitPct: 100 }])
  }

  const exportCalculation = () => {
    const data = {
      dealInfo: { grossRevenue, processorCosts, adjustments, chargebacks, netRevenue },
      participants: calculations,
      totalSplit,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `residual-calculation-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Residuals Calculator</h1>
          <p className="text-muted-foreground">Calculate and compare residual scenarios for your deals</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetCalculator}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" onClick={exportCalculation}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Inputs */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Deal Information
              </CardTitle>
              <CardDescription>Enter the financial details for your deal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="grossRevenue">Gross Revenue</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="grossRevenue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={grossRevenue || ""}
                    onChange={(e) => setGrossRevenue(Number.parseFloat(e.target.value) || 0)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="processorCosts">Processor Costs</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="processorCosts"
                    type="number"
                    step="0.01"
                    min="0"
                    value={processorCosts || ""}
                    onChange={(e) => setProcessorCosts(Number.parseFloat(e.target.value) || 0)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustments">Adjustments</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="adjustments"
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustments || ""}
                    onChange={(e) => setAdjustments(Number.parseFloat(e.target.value) || 0)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="chargebacks">Chargebacks</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="chargebacks"
                    type="number"
                    step="0.01"
                    min="0"
                    value={chargebacks || ""}
                    onChange={(e) => setChargebacks(Number.parseFloat(e.target.value) || 0)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Net Revenue</span>
                  <span className={cn("text-lg font-semibold", netRevenue >= 0 ? "text-green-600" : "text-red-600")}>
                    {formatCurrency(netRevenue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Participants
                  </CardTitle>
                  <CardDescription>Define split percentages for each participant</CardDescription>
                </div>
                <Button size="sm" onClick={addParticipant}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {participants.map((participant, index) => (
                <div key={participant.id} className="flex items-end gap-3 rounded-lg border p-3">
                  <div className="flex-1 space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={participant.name}
                      onChange={(e) => updateParticipant(participant.id, "name", e.target.value)}
                      placeholder="Participant name"
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={participant.role}
                      onValueChange={(value) => updateParticipant(participant.id, "role", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="fund">Fund</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Split %</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={participant.splitPct || ""}
                        onChange={(e) =>
                          updateParticipant(participant.id, "splitPct", Number.parseFloat(e.target.value) || 0)
                        }
                        className="pr-7"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeParticipant(participant.id)}
                    disabled={participants.length === 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <span className="text-sm font-medium">Total Split:</span>
                <span
                  className={cn(
                    "font-semibold",
                    totalSplit === 100 ? "text-green-600" : totalSplit > 100 ? "text-red-600" : "text-yellow-600",
                  )}
                >
                  {totalSplit.toFixed(2)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Calculation Results
              </CardTitle>
              <CardDescription>
                {netRevenue > 0 && totalSplit > 0
                  ? "Payout breakdown based on your inputs"
                  : "Enter deal information and participant splits to see the breakdown"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {netRevenue <= 0 || totalSplit === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calculator className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium text-muted-foreground">No Calculation Yet</p>
                  <p className="text-sm text-muted-foreground">
                    Enter deal information and participant splits, then click Calculate to see the residual breakdown.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-xs text-muted-foreground">Net Revenue</p>
                      <p className="text-xl font-semibold">{formatCurrency(netRevenue)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-xs text-muted-foreground">Participants</p>
                      <p className="text-xl font-semibold">{participants.length}</p>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Payout Breakdown</h4>
                    {calculations.map((calc, index) => (
                      <div key={calc.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{calc.name || `Participant ${index + 1}`}</p>
                            <p className="text-sm text-muted-foreground capitalize">{calc.role}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-green-600">{formatCurrency(calc.amount)}</p>
                            <p className="text-sm text-muted-foreground">{calc.splitPct}%</p>
                          </div>
                        </div>
                        {/* Visual bar */}
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(calc.splitPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Validation warning */}
                  {totalSplit !== 100 && (
                    <div
                      className={cn(
                        "rounded-lg border p-3 text-sm",
                        totalSplit > 100
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-yellow-200 bg-yellow-50 text-yellow-700",
                      )}
                    >
                      {totalSplit > 100
                        ? `Warning: Total split exceeds 100% (${totalSplit.toFixed(2)}%)`
                        : `Note: Total split is less than 100% (${totalSplit.toFixed(2)}%). ${formatCurrency(netRevenue * (1 - totalSplit / 100))} unallocated.`}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
