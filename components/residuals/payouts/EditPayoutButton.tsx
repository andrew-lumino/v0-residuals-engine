"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit2 } from "lucide-react"
import { useState, useEffect } from "react"

interface EditPayoutButtonProps {
  payout: any
  onUpdate?: () => void
}

export function EditPayoutButton({ payout, onUpdate }: EditPayoutButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    partner_split_pct: "",
    partner_payout_amount: "",
    paid_status: "unpaid",
  })

  useEffect(() => {
    if (open && payout) {
      setFormData({
        partner_split_pct: payout.partner_split_pct?.toString() || "",
        partner_payout_amount: payout.partner_payout_amount?.toString() || "",
        paid_status: payout.paid_status || "unpaid",
      })
    }
  }, [open, payout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_split_pct: Number.parseFloat(formData.partner_split_pct) || 0,
          partner_payout_amount: Number.parseFloat(formData.partner_payout_amount) || 0,
          paid_status: formData.paid_status,
        }),
      })

      if (!response.ok) throw new Error("Failed to update payout")

      setOpen(false)
      if (onUpdate) {
        onUpdate()
      }
    } catch (error) {
      console.error("Error updating payout:", error)
      alert("Failed to update payout")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent style={{ width: "600px", maxWidth: "95vw" }}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Payout</DialogTitle>
            <DialogDescription>
              Update payout details for {payout?.merchant_name || "Unknown"} - {payout?.payout_month || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="split">Split Percentage</Label>
              <Input
                id="split"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 35.00"
                value={formData.partner_split_pct}
                onChange={(e) => setFormData({ ...formData, partner_split_pct: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Payout Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 125.50"
                value={formData.partner_payout_amount}
                onChange={(e) => setFormData({ ...formData, partner_payout_amount: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Payment Status</Label>
              <Select
                value={formData.paid_status}
                onValueChange={(value) => setFormData({ ...formData, paid_status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
