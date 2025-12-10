"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Plus, Trash2, Save, AlertCircle, Check } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { DealParticipant, PartnerRole, CsvData, PartnerSync } from "@/lib/types/database"
import { MoneyDisplay } from "@/components/residuals/shared/MoneyDisplay"
import { cn } from "@/lib/utils"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface AssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  events: CsvData[]
  onSave: () => void
}

export function AssignmentModal({ isOpen, onClose, events, onSave }: AssignmentModalProps) {
  const [participants, setParticipants] = useState<DealParticipant[]>([])
  const [availablePartners, setAvailablePartners] = useState<PartnerSync[]>([])
  const [payoutType, setPayoutType] = useState<string>("residual")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For partner search combobox
  const [openCombobox, setOpenCombobox] = useState(false)

  const firstEvent = events[0]
  const totalVolume = events.reduce((sum, e) => sum + (e.volume || 0), 0)
  const totalFees = events.reduce((sum, e) => sum + (e.fees || 0), 0)

  // Fetch available partners on mount
  useEffect(() => {
    if (isOpen) {
      fetchPartners()
    }
  }, [isOpen])

  // Check for existing deal when events change
  useEffect(() => {
    if (isOpen && firstEvent?.mid) {
      checkExistingDeal(firstEvent.mid)
    }
  }, [isOpen, firstEvent?.mid])

  const fetchPartners = async () => {
    try {
      const res = await fetch("/api/residuals/participants?active=true")
      const json = await res.json()
      if (json.success) {
        setAvailablePartners(json.data)
      }
    } catch (err) {
      console.error("Failed to fetch partners", err)
    }
  }

  const checkExistingDeal = async (mid: string) => {
    try {
      const res = await fetch(`/api/residuals/deals?mid=${mid}`)
      const json = await res.json()

      if (json.success && json.data) {
        // Pre-populate with existing deal participants
        setParticipants(json.data.participants_json)
        setPayoutType(json.data.payout_type || "residual")
      } else {
        // Reset if no existing deal
        setParticipants([])
        setPayoutType("residual")
      }
    } catch (err) {
      console.error("Failed to check existing deal", err)
    }
  }

  const handleAddParticipant = (partner: PartnerSync) => {
    if (participants.some((p) => p.partner_id === partner.airtable_record_id)) {
      return // Already added
    }

    const newParticipant: DealParticipant = {
      partner_id: partner.airtable_record_id,
      name: partner.name,
      email: partner.email,
      role: (partner.role as PartnerRole) || "Partner",
      split_pct: partner.default_split_pct || 0,
    }

    setParticipants([...participants, newParticipant])
    setOpenCombobox(false)
  }

  const handleUpdateParticipant = (index: number, field: keyof DealParticipant, value: any) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    setParticipants(updated)
  }

  const handleRemoveParticipant = (index: number) => {
    const updated = [...participants]
    updated.splice(index, 1)
    setParticipants(updated)
  }

  const totalSplit = participants.reduce((sum, p) => sum + (Number(p.split_pct) || 0), 0)
  const isValidSplit = totalSplit >= 80 && totalSplit <= 105

  const handleSave = async () => {
    if (participants.length === 0) {
      setError("At least one participant is required")
      return
    }

    if (!isValidSplit) {
      setError(`Total split is ${totalSplit}%. It should be between 80% and 105%.`)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/residuals/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: events.map((e) => e.id),
          mid: firstEvent.mid,
          participants,
          payout_type: payoutType,
        }),
      })

      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || "Failed to save assignment")
      }

      onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (!firstEvent) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent style={{ width: "900px", maxWidth: "95vw" }} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Participants</DialogTitle>
          <DialogDescription>
            Configure revenue splits for {events.length} selected event{events.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Merchant Info */}
          <Card className="p-4 bg-muted/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Merchant</Label>
                <div className="font-medium">{firstEvent.merchant_name}</div>
                <div className="font-mono text-xs text-muted-foreground">{firstEvent.mid}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total Volume</Label>
                <div>
                  <MoneyDisplay amount={totalVolume} />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total Payout</Label>
                <div>
                  <MoneyDisplay amount={totalFees} className="text-green-600 font-bold" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Month</Label>
                <div>{firstEvent.payout_month}</div>
              </div>
            </div>
          </Card>

          {/* Payout Type */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Payout Type</Label>
              <Select value={payoutType} onValueChange={setPayoutType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residual">Residual</SelectItem>
                  <SelectItem value="upfront">Upfront</SelectItem>
                  <SelectItem value="trueup">True-Up</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="clawback">Clawback</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Participants List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Participants</Label>

              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-[200px] justify-between bg-transparent">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Participant
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[250px]" align="end">
                  <Command>
                    <CommandInput placeholder="Search partners..." />
                    <CommandList>
                      <CommandEmpty>No partner found.</CommandEmpty>
                      <CommandGroup>
                        {availablePartners.map((partner) => (
                          <CommandItem
                            key={partner.id}
                            value={partner.name}
                            onSelect={() => handleAddParticipant(partner)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                participants.some((p) => p.partner_id === partner.airtable_record_id)
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {partner.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {participants.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                No participants added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {participants.map((p, index) => (
                  <div key={index} className="flex gap-3 items-start p-3 bg-card border rounded-lg shadow-sm">
                    <div className="flex-1 space-y-1">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="flex gap-2">
                        <Select value={p.role} onValueChange={(val) => handleUpdateParticipant(index, "role", val)}>
                          <SelectTrigger className="h-7 text-xs w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Partner">Partner</SelectItem>
                            <SelectItem value="ISO">ISO</SelectItem>
                            <SelectItem value="Agent">Agent</SelectItem>
                            <SelectItem value="Investor">Investor</SelectItem>
                            <SelectItem value="Company">Company</SelectItem>
                            <SelectItem value="Fund I">Fund I</SelectItem>
                            <SelectItem value="Fund II">Fund II</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground">Split %</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={p.split_pct}
                          onChange={(e) =>
                            handleUpdateParticipant(index, "split_pct", Number.parseFloat(e.target.value))
                          }
                          className="h-8 pr-6 text-right"
                          min={0}
                          max={100}
                        />
                        <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="w-24 text-right">
                      <Label className="text-xs text-muted-foreground">Amount</Label>
                      <div className="text-sm font-mono pt-2">
                        <MoneyDisplay amount={totalFees * (p.split_pct / 100)} />
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive mt-5"
                      onClick={() => handleRemoveParticipant(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary & Validation */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">Total Split:</div>
            <div
              className={cn(
                "font-bold text-lg flex items-center gap-2",
                isValidSplit ? "text-green-600" : "text-red-600",
              )}
            >
              {totalSplit.toFixed(1)}%
              {isValidSplit ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || participants.length === 0}>
            {isLoading ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Assignment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
