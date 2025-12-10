"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react"

interface StepResult {
  success: boolean
  message: string
  count?: number
}

export default function CleanupDuplicatesPage() {
  const [duplicateCounts, setDuplicateCounts] = useState<{ payouts: number; deals: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [stepResults, setStepResults] = useState<Record<string, StepResult>>({})
  const [currentStep, setCurrentStep] = useState<string | null>(null)

  const fetchCounts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/cleanup-duplicates?action=count")
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDuplicateCounts(data)
    } catch (error) {
      console.error("Failed to fetch counts:", error)
    } finally {
      setLoading(false)
    }
  }

  const runStep = async (step: string, description: string) => {
    if (!confirm(`Are you sure you want to run: ${description}?`)) return

    setCurrentStep(step)
    try {
      const res = await fetch("/api/admin/cleanup-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      })
      const data = await res.json()

      setStepResults((prev) => ({
        ...prev,
        [step]: {
          success: !data.error,
          message: data.error || data.message,
          count: data.count,
        },
      }))
    } catch (error) {
      setStepResults((prev) => ({
        ...prev,
        [step]: {
          success: false,
          message: error instanceof Error ? error.message : "Failed",
        },
      }))
    } finally {
      setCurrentStep(null)
    }
  }

  const steps = [
    {
      id: "update_payouts",
      title: "Step 1: Update OLD payouts with CORRECT partner info",
      description:
        "Copy partner_name, partner_role, partner_airtable_id, split_pct, and payout_amount from NEW (non-00) payouts to OLD (00) payouts",
    },
    {
      id: "update_deals",
      title: "Step 2: Update OLD deals with CORRECT participants_json",
      description: "Copy participants_json from NEW (non-00) deals to OLD (00) deals",
    },
    {
      id: "delete_payouts",
      title: "Step 3: Delete duplicate payouts (non-00 versions)",
      description: "Remove the NEW payout records that are duplicates of OLD 00-prefixed records",
    },
    {
      id: "delete_deals",
      title: "Step 4: Delete duplicate deals (non-00 versions)",
      description: "Remove the NEW deal records that are duplicates of OLD 00-prefixed records",
    },
  ]

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cleanup Duplicate MID Records</CardTitle>
          <CardDescription>
            Fix records where the same MID exists with and without 00 prefix (e.g., 0022660744 and 22660744). The OLD
            records (00 prefix) have wrong partner data, NEW records have correct data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={fetchCounts} disabled={loading} variant="outline" className="w-full bg-transparent">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Check Duplicate Counts
          </Button>

          {duplicateCounts && (
            <Alert
              className={
                duplicateCounts.payouts > 0 || duplicateCounts.deals > 0
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-green-500 bg-green-50"
              }
            >
              <AlertDescription>
                <div className="font-mono text-sm">
                  <div>
                    Duplicate Payouts: <strong>{duplicateCounts.payouts}</strong>
                  </div>
                  <div>
                    Duplicate Deals: <strong>{duplicateCounts.deals}</strong>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {steps.map((step, index) => (
        <Card key={step.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{step.title}</CardTitle>
            <CardDescription className="text-xs">{step.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => runStep(step.id, step.title)}
              disabled={currentStep !== null}
              variant={stepResults[step.id]?.success ? "outline" : "default"}
              className="w-full"
            >
              {currentStep === step.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running...
                </>
              ) : stepResults[step.id]?.success ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  Run Again
                </>
              ) : (
                `Run Step ${index + 1}`
              )}
            </Button>

            {stepResults[step.id] && (
              <Alert
                className={stepResults[step.id].success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}
              >
                {stepResults[step.id].success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={stepResults[step.id].success ? "text-green-900" : "text-red-900"}>
                  {stepResults[step.id].message}
                  {stepResults[step.id].count !== undefined && (
                    <span className="ml-2 font-mono">({stepResults[step.id].count} rows affected)</span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
