"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

interface MarkPaidButtonProps {
  payout: {
    id: string
    paid_status: string
    merchant_name?: string
    partner_name?: string
    partner_payout_amount?: number
  }
  onUpdate?: () => void
}

export function MarkPaidButton({ payout, onUpdate }: MarkPaidButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isPaid = payout.paid_status === "paid"

  const handleToggle = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payouts/${payout.id}/mark-paid`, {
        method: "POST",
      })

      const json = await res.json()

      if (json.success) {
        onUpdate?.()
      } else {
        console.error("Failed to toggle paid status:", json.error)
      }
    } catch (error) {
      console.error("Failed to toggle paid status:", error)
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className={cn(
          "h-8 w-8 p-0",
          isPaid ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-500",
        )}
        title={isPaid ? "Mark as unpaid" : "Mark as paid"}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isPaid ? "Mark as Unpaid?" : "Mark as Paid?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isPaid ? (
                <>
                  This will mark the payout for <span className="font-semibold">{payout.merchant_name}</span> to{" "}
                  <span className="font-semibold">{payout.partner_name}</span> as{" "}
                  <span className="text-yellow-600 font-semibold">unpaid</span>.
                </>
              ) : (
                <>
                  This will mark the payout for <span className="font-semibold">{payout.merchant_name}</span> to{" "}
                  <span className="font-semibold">{payout.partner_name}</span> as{" "}
                  <span className="text-green-600 font-semibold">paid</span>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
