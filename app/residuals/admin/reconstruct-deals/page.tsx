"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

export default function ReconstructDealsPage() {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const handleReconstruct = async () => {
    setStatus("running")
    setMessage("Starting deal reconstruction...")
    setProgress({ current: 0, total: 0 })

    try {
      const response = await fetch("/api/admin/reconstruct-deals", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`Failed: ${response.statusText}`)
      }

      const result = await response.json()

      setStatus("success")
      setMessage(`Successfully reconstructed ${result.dealsCreated} deals from ${result.payoutsProcessed} payouts`)
      setProgress({ current: result.dealsCreated, total: result.dealsCreated })
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "An error occurred")
    }
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Reconstruct Deals from Payouts</CardTitle>
          <CardDescription>
            This will analyze all imported payout records and create corresponding deal records with participant
            configurations. Run this once after importing legacy payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "idle" && (
            <Button onClick={handleReconstruct} size="lg" className="w-full">
              Start Reconstruction
            </Button>
          )}

          {status === "running" && (
            <div className="flex items-center justify-center gap-3 p-6">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm text-muted-foreground">{message}</span>
            </div>
          )}

          {status === "success" && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">{message}</AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {progress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
