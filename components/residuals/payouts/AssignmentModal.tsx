"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Check, ChevronsUpDown, Loader2, History, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "@/components/ui/use-toast"

interface UnassignedEvent {
  id: string
  mid: string
  merchant_name: string
  volume: number
  fees: number
  date: string
  payout_month: string
  adjustments: number
  chargebacks: number
  batch_id: string
  payout_type?: string
}

interface Partner {
  id: string // Airtable record ID
  name: string
  email: string
}

interface Participant {
  agent_id: string
  agent_name: string
  agent_email: string
  airtable_record_id: string
  role: string
  split_pct: number
}

interface ExistingDeal {
  deal_id: string
  mid: string
  merchant_name: string
  payout_type: string
  participants_json: Participant[]
}

interface AssignmentModalProps {
  event: UnassignedEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
  bulkEventIds?: number[]
}

interface NewDealState {
  participants: Participant[]
  payout_type: string
}

interface AssignmentHistory {
  payout_month: string
  merchant_name: string
  payout_type: string
  total_fees: number
  participants: {
    partner_airtable_id: string
    partner_name: string
    partner_role: string
    split_pct: number
  }[]
}

const PAYOUT_TYPES = [
  { value: "residual", label: "Residual" },
  { value: "upfront", label: "Upfront" },
  { value: "trueup", label: "True-Up" },
  { value: "bonus", label: "Bonus" },
  { value: "clawback", label: "Clawback" },
  { value: "adjustment", label: "Adjustment" },
]

export function AssignmentModal({ event, open, onOpenChange, onComplete, bulkEventIds }: AssignmentModalProps) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [existingDeals, setExistingDeals] = useState<ExistingDeal[]>([])
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([])
  const [historyOpen, setHistoryOpen] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [companyEnabled, setCompanyEnabled] = useState(true)
  const [companySplitPct, setCompanySplitPct] = useState(0)
  const [newDeal, setNewDeal] = useState<NewDealState>({
    participants: [],
    payout_type: event?.payout_type || "residual",
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (event && open) {
      console.log("[AssignmentModal] Event loaded:", event.id)
      setCompanyEnabled(true)
      setCompanySplitPct(0)
      setNewDeal({
        participants: [],
        payout_type: event.payout_type || "residual",
      })
      setError(null)
      setAssignmentHistory([])
      setHistoryOpen(false)
      fetchData()
      if (event.mid) {
        fetchAssignmentHistory(event.mid)
      }
    }
  }, [event, open])

  const fetchAssignmentHistory = async (mid: string) => {
    setHistoryLoading(true)
    console.log("[v0] fetchAssignmentHistory called with MID:", mid)
    try {
      const response = await fetch(`/api/deals/history?mid=${encodeURIComponent(mid)}`)
      console.log("[v0] History API response status:", response.status)
      const data = await response.json()
      console.log("[v0] History API response data:", data)
      if (data.success && data.history) {
        setAssignmentHistory(data.history)
        console.log("[AssignmentModal] Assignment history loaded:", data.history.length, "months")
      } else {
        console.log("[v0] History API returned no history or success=false")
      }
    } catch (err) {
      console.error("[AssignmentModal] Error fetching history:", err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const applyPreviousAssignment = (historyItem: AssignmentHistory) => {
    // Find company participant
    const companyParticipant = historyItem.participants.find(
      (p) => p.partner_airtable_id === "lumino-company" || p.partner_role === "Company",
    )
    const otherParticipants = historyItem.participants.filter(
      (p) => p.partner_airtable_id !== "lumino-company" && p.partner_role !== "Company",
    )

    if (companyParticipant) {
      setCompanyEnabled(true)
      setCompanySplitPct(Number(companyParticipant.split_pct) || 0)
    } else {
      setCompanyEnabled(false)
      setCompanySplitPct(0)
    }

    // Map participants to the expected format
    const mappedParticipants = otherParticipants.map((p) => {
      // Try to find the partner in our partners list to get email
      const partner = partners.find((pt) => pt.id === p.partner_airtable_id)
      return {
        agent_id: p.partner_airtable_id || "",
        agent_name: partner?.name || p.partner_name || "",
        agent_email: partner?.email || "",
        airtable_record_id: p.partner_airtable_id || "",
        role: p.partner_role || "Partner",
        split_pct: Number(p.split_pct) || 0,
      }
    })

    setNewDeal({
      participants: mappedParticipants,
      payout_type: historyItem.payout_type || "residual",
    })

    toast({
      title: "Assignment Applied",
      description: `Applied assignment from ${historyItem.payout_month}`,
    })
  }

  const fetchData = async () => {
    if (!event) return
    setLoading(true)
    try {
      const [partnersRes, dealsRes, payoutsRes] = await Promise.all([
        fetch("/api/airtable-partners"),
        fetch(`/api/deals?mid=${event.mid}`),
        fetch(`/api/residuals/payouts?csv_data_id=${event.id}&format=raw`),
      ])

      const partnersData = await partnersRes.json()
      const dealsData = await dealsRes.json()
      const payoutsData = await payoutsRes.json()

      console.log("[AssignmentModal] Partners loaded:", partnersData.partners?.length)
      console.log("[AssignmentModal] Deals loaded:", dealsData.deals?.length)
      console.log("[AssignmentModal] Payouts loaded:", payoutsData.payouts?.length)

      if (partnersData.partners) {
        setPartners(partnersData.partners)
      }

      if (payoutsData.payouts && payoutsData.payouts.length > 0) {
        console.log("[AssignmentModal] Found existing payouts, loading participants from payouts")

        const companyPayout = payoutsData.payouts.find(
          (p: any) => p.partner_airtable_id === "lumino-company" || p.partner_role === "Company",
        )
        const otherPayouts = payoutsData.payouts.filter(
          (p: any) => p.partner_airtable_id !== "lumino-company" && p.partner_role !== "Company",
        )

        if (companyPayout) {
          setCompanyEnabled(true)
          setCompanySplitPct(Number(companyPayout.partner_split_pct) || 0)
        } else {
          setCompanyEnabled(false)
          setCompanySplitPct(0)
        }

        const participantsFromPayouts = otherPayouts.map((p: any) => ({
          agent_id: p.partner_airtable_id || "",
          agent_name:
            partnersData.partners?.find((partner: Partner) => partner.id === p.partner_airtable_id)?.name ||
            p.partner_name ||
            p.partner_airtable_id ||
            "",
          agent_email:
            partnersData.partners?.find((partner: Partner) => partner.id === p.partner_airtable_id)?.email || "",
          airtable_record_id: p.partner_airtable_id || "",
          role: p.partner_role || "Partner",
          split_pct: Number(p.partner_split_pct) || 0,
        }))

        const payoutType = payoutsData.payouts[0]?.payout_type || event.payout_type || "residual"

        setNewDeal({
          participants: participantsFromPayouts,
          payout_type: payoutType,
        })
      } else if (dealsData.deals && dealsData.deals.length > 0) {
        const existingDeal = dealsData.deals[0]
        if (existingDeal.participants_json && existingDeal.participants_json.length > 0) {
          console.log("[AssignmentModal] Loading participants from deal")

          const companyParticipant = existingDeal.participants_json.find(
            (p: any) => p.partner_airtable_id === "lumino-company" || p.partner_role === "Company",
          )
          const otherParticipants = existingDeal.participants_json.filter(
            (p: any) => p.partner_airtable_id !== "lumino-company" && p.partner_role !== "Company",
          )

          if (companyParticipant) {
            setCompanyEnabled(true)
            setCompanySplitPct(Number(companyParticipant.split_pct) || 0)
          } else {
            setCompanyEnabled(false)
            setCompanySplitPct(0)
          }

          const participantsFromDeal = otherParticipants.map((p: any) => ({
            agent_id: p.partner_airtable_id || p.agent_id || "",
            agent_name: p.partner_name || p.agent_name || "",
            agent_email: p.partner_email || p.agent_email || "",
            airtable_record_id: p.partner_airtable_id || p.agent_id || "",
            role: p.partner_role || p.role || "Partner",
            split_pct: Number(p.split_pct) || 0,
          }))

          setNewDeal({
            participants: participantsFromDeal,
            payout_type: existingDeal.payout_type || event.payout_type || "residual",
          })
        }
        setExistingDeals(dealsData.deals)
      }
    } catch (err) {
      console.error("[AssignmentModal] Error fetching data:", err)
      setError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const addParticipant = () => {
    setNewDeal((prev) => ({
      ...prev,
      participants: [
        ...prev.participants,
        {
          agent_id: "",
          agent_name: "",
          agent_email: "",
          airtable_record_id: "",
          role: "Partner",
          split_pct: 0,
        },
      ],
    }))
  }

  const removeParticipant = (index: number) => {
    setNewDeal((prev) => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index),
    }))
  }

  const updateParticipant = (index: number, field: keyof Participant, value: string | number) => {
    setNewDeal((prev) => {
      const updatedParticipants = prev.participants.map((p, i) => (i === index ? { ...p, [field]: value } : p))
      return { ...prev, participants: updatedParticipants }
    })

    // Auto-calculate company split when split_pct changes
    if (field === "split_pct" && companyEnabled) {
      // Use timeout to ensure state is updated first
      setTimeout(() => {
        setNewDeal((prev) => {
          const partnerTotal = prev.participants.reduce((sum, p) => sum + (p.split_pct || 0), 0)
          const newCompanySplit = Math.max(0, 100 - partnerTotal)
          setCompanySplitPct(newCompanySplit)
          return prev
        })
      }, 0)
    }
  }

  const selectPartner = (index: number, partner: Partner) => {
    setNewDeal((prev) => ({
      ...prev,
      participants: prev.participants.map((p, i) =>
        i === index
          ? {
              ...p,
              agent_id: partner.id,
              agent_name: partner.name,
              agent_email: partner.email,
              airtable_record_id: partner.id,
            }
          : p,
      ),
    }))
    setOpenPopovers((prev) => ({ ...prev, [index]: false }))
  }

  const calculateAmount = (splitPct: number) => {
    if (!event) return 0
    const fees = event.fees || 0
    const adjustments = event.adjustments || 0
    const chargebacks = event.chargebacks || 0
    const netResidual = fees - adjustments - chargebacks
    return (netResidual * splitPct) / 100
  }

  const totalSplit =
    newDeal.participants.reduce((sum, p) => sum + (p.split_pct || 0), 0) + (companyEnabled ? companySplitPct : 0)

  const handleAssign = async () => {
    if (!event) return

    const allParticipants: Participant[] = []

    if (companyEnabled) {
      allParticipants.push({
        agent_id: "lumino-company",
        agent_name: "Lumino (Company)",
        agent_email: "",
        airtable_record_id: "lumino-company",
        role: "Company",
        split_pct: companySplitPct,
      })
    }

    allParticipants.push(...newDeal.participants.filter((p) => p.agent_id))

    const validParticipants = allParticipants.filter((p) => p.split_pct > 0)

    if (validParticipants.length === 0) {
      setError("At least one participant with a split percentage is required")
      return
    }

    if (totalSplit !== 100) {
      setError(`Total split must equal 100% (currently ${totalSplit}%)`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/assign-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          assignment_type: "new_deal",
          status: "pending_confirmation",
          new_deal: {
            mid: event.mid,
            merchant_name: event.merchant_name,
            payout_type: newDeal.payout_type || "residual",
            participants: allParticipants.map((p) => ({
              agent_id: p.agent_id,
              agent_name: p.agent_name,
              agent_email: p.agent_email,
              role: p.role,
              split_pct: p.split_pct,
            })),
          },
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to assign event")
      }

      console.log("[AssignmentModal] Assignment successful:", data)
      onComplete?.()
      onOpenChange(false)
    } catch (err) {
      console.error("[AssignmentModal] Error:", err)
      setError(err instanceof Error ? err.message : "Failed to assign event")
    } finally {
      setSaving(false)
    }
  }

  if (!event) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ width: "900px", maxWidth: "95vw" }}
        className="max-h-[90vh] overflow-y-auto"
        data-wide-modal="true"
      >
        <DialogHeader>
          <DialogTitle>Assign Revenue Event</DialogTitle>
          <DialogDescription>Assign participants and split percentages for this revenue event</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading partners...</span>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Event Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">MID</Label>
                    <div className="font-mono">{event.mid}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Merchant</Label>
                    <div>{event.merchant_name}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Volume</Label>
                    <div>${event.volume?.toLocaleString()}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Fees (Payout Amount)</Label>
                    <div className="font-semibold text-green-600">${event.fees?.toLocaleString()}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {assignmentHistory.length > 0 && (
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-2 px-3 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <History className="h-3.5 w-3.5 text-blue-600" />
                          <CardTitle className="text-sm text-blue-700 dark:text-blue-400">
                            Previous Assignments ({assignmentHistory.length})
                          </CardTitle>
                        </div>
                        {historyOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-2 px-3">
                      <ScrollArea className="max-h-[100px]">
                        <div className="space-y-1">
                          {assignmentHistory.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between py-1.5 px-2 rounded border bg-background hover:bg-muted/50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-xs">{item.payout_month}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {item.payout_type}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {item.participants.map((p) => `${p.partner_name} (${p.split_pct}%)`).join(" • ")}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => applyPreviousAssignment(item)}
                                className="ml-2 h-6 text-xs px-2"
                              >
                                Use This
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {historyLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading assignment history...
              </div>
            )}

            <div className="space-y-2">
              <Label>Payout Type</Label>
              <Select
                value={newDeal.payout_type}
                onValueChange={(value) => setNewDeal((prev) => ({ ...prev, payout_type: value }))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select payout type" />
                </SelectTrigger>
                <SelectContent>
                  {PAYOUT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="border-2 border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch id="company-toggle" checked={companyEnabled} onCheckedChange={setCompanyEnabled} />
                    <div>
                      <Label htmlFor="company-toggle" className="font-semibold cursor-pointer">
                        Lumino (Company)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Company split is {companyEnabled ? "enabled" : "disabled"}
                      </p>
                    </div>
                  </div>
                  {companyEnabled && (
                    <div className="flex items-center gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Split %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={companySplitPct}
                          onChange={(e) => setCompanySplitPct(Number(e.target.value))}
                          className="h-10 w-24"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Amount</Label>
                        <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center font-mono text-sm w-28">
                          ${calculateAmount(companySplitPct).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Partners ({newDeal.participants.length})</Label>
                <Button variant="outline" size="sm" onClick={addParticipant}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Partner
                </Button>
              </div>

              <div className="space-y-3">
                {newDeal.participants.map((participant, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-12 gap-3 items-start">
                      <div className="col-span-5 space-y-1">
                        <Label className="text-xs">Partner</Label>
                        <Popover
                          open={openPopovers[index] || false}
                          onOpenChange={(isOpen) => setOpenPopovers((prev) => ({ ...prev, [index]: isOpen }))}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between h-10 font-normal bg-transparent"
                            >
                              {participant.agent_name
                                ? `${participant.agent_name}${participant.agent_email ? ` (${participant.agent_email})` : ""}`
                                : "Select partner..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search partners..." />
                              <CommandList>
                                <CommandEmpty>No partners found.</CommandEmpty>
                                <CommandGroup>
                                  {partners.map((partner) => (
                                    <CommandItem
                                      key={partner.id}
                                      value={`${partner.name} ${partner.email}`}
                                      onSelect={() => selectPartner(index, partner)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          participant.agent_id === partner.id ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{partner.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {partner.email || "No email"} • ID: {partner.id.slice(0, 10)}...
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {participant.airtable_record_id && (
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            Airtable ID: {participant.airtable_record_id}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Role</Label>
                        <Select
                          value={participant.role}
                          onValueChange={(value) => updateParticipant(index, "role", value)}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Partner">Partner</SelectItem>
                            <SelectItem value="Sales Rep">Sales Rep</SelectItem>
                            <SelectItem value="Referral">Referral</SelectItem>
                            <SelectItem value="ISO">ISO</SelectItem>
                            <SelectItem value="Agent">Agent</SelectItem>
                            <SelectItem value="Investor">Investor</SelectItem>
                            <SelectItem value="Fund I">Fund I</SelectItem>
                            <SelectItem value="Fund II">Fund II</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Split %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={participant.split_pct}
                          onChange={(e) => updateParticipant(index, "split_pct", Number(e.target.value))}
                          className="h-10"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Amount</Label>
                        <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center font-mono text-sm">
                          ${calculateAmount(participant.split_pct).toFixed(2)}
                        </div>
                      </div>

                      <div className="col-span-1 flex items-end justify-end pb-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeParticipant(index)}
                          className="h-10 w-10 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {newDeal.participants.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>No partners added yet</p>
                    <p className="text-sm">Click "Add Partner" to add participants</p>
                  </div>
                )}
              </div>
            </div>

            <Card className={cn("mt-4", totalSplit === 100 ? "border-green-500" : "border-destructive")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Total Split</Label>
                    <p className="text-xs text-muted-foreground">Must equal 100%</p>
                  </div>
                  <div className={cn("text-2xl font-bold", totalSplit === 100 ? "text-green-600" : "text-destructive")}>
                    {totalSplit}%
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={saving || totalSplit !== 100}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign Event"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
