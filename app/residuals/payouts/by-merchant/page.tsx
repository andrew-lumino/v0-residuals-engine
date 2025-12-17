"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MoneyDisplay } from "@/components/residuals/shared/MoneyDisplay"
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Store,
  Pencil,
  Users,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EditPayoutButton } from "@/components/residuals/payouts/EditPayoutButton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { formatPayoutMonth } from "@/lib/utils/formatters"
import { toast } from "@/components/ui/use-toast"

interface PayoutTypeGroup {
  payoutType: string
  groupKey: string // Unique key: mid_payoutType
  payouts: any[]
  totalAmount: number
  paidAmount: number
  participantCount: number
  dealId: string | null
  availableForPurchase: boolean
}

interface MerchantGroup {
  mid: string
  merchantName: string
  payoutTypeGroups: PayoutTypeGroup[] // Nested groups by payout type
  totalAmount: number
  paidAmount: number
  participantCount: number
  payoutCount: number
}

type SortField =
  | "partner_name"
  | "partner_role"
  | "payout_month"
  | "partner_split_pct"
  | "partner_payout_amount"
  | "paid_status"
type SortDirection = "asc" | "desc"

export default function ByMerchantPage() {
  const [merchants, setMerchants] = useState<MerchantGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [monthFilter, setMonthFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedMerchants, setExpandedMerchants] = useState<Set<string>>(new Set()) // Parent merchant dropdowns
  const [expandedPayoutTypes, setExpandedPayoutTypes] = useState<Set<string>>(new Set()) // Nested payout type dropdowns
  const [months, setMonths] = useState<string[]>([])
  const [partnersMap, setPartnersMap] = useState<Map<string, any>>(new Map())
  const [editingPayoutGroup, setEditingPayoutGroup] = useState<{ merchant: MerchantGroup; payoutGroup: PayoutTypeGroup } | null>(null)
  const [savingAvailability, setSavingAvailability] = useState(false)
  const [editMid, setEditMid] = useState("")
  const [editMerchantName, setEditMerchantName] = useState("")
  const [savingMerchant, setSavingMerchant] = useState(false)

  const [sortFields, setSortFields] = useState<Record<string, SortField>>({})
  const [sortDirections, setSortDirections] = useState<Record<string, SortDirection>>({})

  useEffect(() => {
    async function fetchPartners() {
      try {
        const response = await fetch("/api/airtable-partners")
        const data = await response.json()
        if (data.partners) {
          const map = new Map<string, any>()
          data.partners.forEach((p: any) => {
            map.set(p.id, p)
          })
          // Add Lumino company
          map.set("lumino-company", { id: "lumino-company", name: "Lumino", role: "Company" })
          setPartnersMap(map)
        }
      } catch (error) {
        console.error("[v0] Error fetching partners:", error)
      }
    }
    fetchPartners()
  }, [])

  const fetchMerchants = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/residuals/payouts?format=raw")
      const data = await response.json()

      console.log("[v0] Raw payouts response:", data)

      if (data.success) {
        const payouts = data.data || []
        console.log("[v0] Total payouts received:", payouts.length)

        const uniqueMonths = [...new Set(payouts.map((p: any) => p.payout_month).filter(Boolean))] as string[]
        setMonths(uniqueMonths.sort().reverse())

        let filteredPayouts = payouts
        if (monthFilter !== "all") {
          filteredPayouts = filteredPayouts.filter((p: any) => p.payout_month === monthFilter)
        }
        if (statusFilter !== "all") {
          filteredPayouts = filteredPayouts.filter((p: any) => p.paid_status === statusFilter)
        }
        if (search) {
          const searchLower = search.toLowerCase()
          filteredPayouts = filteredPayouts.filter(
            (p: any) =>
              p.merchant_name?.toLowerCase().includes(searchLower) || p.mid?.toLowerCase().includes(searchLower),
          )
        }

        console.log("[v0] Filtered payouts:", filteredPayouts.length)

        // Step 1: Group by MID first (parent level)
        const groupedByMid = new Map<string, any[]>()
        filteredPayouts.forEach((payout: any) => {
          const mid = payout.mid || "Unknown"
          if (!groupedByMid.has(mid)) {
            groupedByMid.set(mid, [])
          }
          groupedByMid.get(mid)!.push(payout)
        })

        console.log("[v0] Grouped by MID:", groupedByMid.size)

        // Step 2: For each MID, create nested payout type groups
        const merchantGroups: MerchantGroup[] = Array.from(groupedByMid.entries()).map(([mid, midPayouts]) => {
          // Group this MID's payouts by payout_type
          const groupedByType = new Map<string, any[]>()
          midPayouts.forEach((payout: any) => {
            const payoutType = payout.payout_type || "residual"
            if (!groupedByType.has(payoutType)) {
              groupedByType.set(payoutType, [])
            }
            groupedByType.get(payoutType)!.push(payout)
          })

          // Create PayoutTypeGroup for each payout type
          const payoutTypeGroups: PayoutTypeGroup[] = Array.from(groupedByType.entries()).map(([payoutType, payouts]) => ({
            payoutType,
            groupKey: `${mid}_${payoutType}`,
            payouts,
            totalAmount: payouts.reduce((sum, p) => sum + (Number.parseFloat(p.partner_payout_amount) || 0), 0),
            paidAmount: payouts
              .filter((p) => p.paid_status === "paid")
              .reduce((sum, p) => sum + (Number.parseFloat(p.partner_payout_amount) || 0), 0),
            participantCount: new Set(payouts.map((p) => p.partner_airtable_id)).size,
            dealId: payouts[0]?.deal_id_from_deals || null,
            availableForPurchase: payouts[0]?.available_to_purchase || false,
          }))

          // Sort payout types: residual first, then alphabetically
          payoutTypeGroups.sort((a, b) => {
            if (a.payoutType === "residual") return -1
            if (b.payoutType === "residual") return 1
            return a.payoutType.localeCompare(b.payoutType)
          })

          return {
            mid,
            merchantName: midPayouts[0]?.merchant_name || "Unknown Merchant",
            payoutTypeGroups,
            totalAmount: midPayouts.reduce((sum, p) => sum + (Number.parseFloat(p.partner_payout_amount) || 0), 0),
            paidAmount: midPayouts
              .filter((p) => p.paid_status === "paid")
              .reduce((sum, p) => sum + (Number.parseFloat(p.partner_payout_amount) || 0), 0),
            participantCount: new Set(midPayouts.map((p) => p.partner_airtable_id)).size,
            payoutCount: midPayouts.length,
          }
        })

        merchantGroups.sort((a, b) => b.totalAmount - a.totalAmount)
        setMerchants(merchantGroups)
      }
    } catch (error) {
      console.error("[v0] Error fetching merchants:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMerchants()
  }, [monthFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMerchants()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const toggleMerchantExpanded = (mid: string) => {
    setExpandedMerchants((prev) => {
      const next = new Set(prev)
      if (next.has(mid)) {
        next.delete(mid)
      } else {
        next.add(mid)
      }
      return next
    })
  }

  const togglePayoutTypeExpanded = (groupKey: string) => {
    setExpandedPayoutTypes((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const getPartnerName = (payout: any) => {
    const partner = partnersMap.get(payout.partner_airtable_id)
    return partner?.name || payout.partner_role || payout.partner_airtable_id || "Unknown"
  }

  const handleEditPayoutGroup = (merchant: MerchantGroup, payoutGroup: PayoutTypeGroup, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent collapsible from toggling
    setEditingPayoutGroup({ merchant, payoutGroup })
    setEditMid(merchant.mid)
    setEditMerchantName(merchant.merchantName)
  }

  const toggleAvailableForPurchase = async (newValue: boolean) => {
    if (!editingPayoutGroup?.payoutGroup.dealId) {
      console.error("[v0] No deal ID found for payout group")
      return
    }

    setSavingAvailability(true)
    try {
      const response = await fetch(`/api/residuals/deals/${editingPayoutGroup.payoutGroup.dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available_to_purchase: newValue }),
      })

      const data = await response.json()
      if (data.success) {
        // Update local state - update the specific payout group's availability
        setMerchants((prev) =>
          prev.map((m) => {
            if (m.mid === editingPayoutGroup.merchant.mid) {
              return {
                ...m,
                payoutTypeGroups: m.payoutTypeGroups.map((ptg) =>
                  ptg.groupKey === editingPayoutGroup.payoutGroup.groupKey
                    ? { ...ptg, availableForPurchase: newValue }
                    : ptg
                ),
              }
            }
            return m
          }),
        )
        setEditingPayoutGroup((prev) =>
          prev ? { ...prev, payoutGroup: { ...prev.payoutGroup, availableForPurchase: newValue } } : null,
        )
      } else {
        console.error("[v0] Failed to update availability:", data.error)
      }
    } catch (error) {
      console.error("[v0] Error updating availability:", error)
    } finally {
      setSavingAvailability(false)
    }
  }

  const handleSaveMerchantDetails = async () => {
    if (!editingPayoutGroup) return

    setSavingMerchant(true)
    try {
      const res = await fetch("/api/payouts/update-merchant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldMid: editingPayoutGroup.merchant.mid,
          newMid: editMid,
          newMerchantName: editMerchantName,
        }),
      })

      if (!res.ok) throw new Error("Failed to update")

      const result = await res.json()
      toast({
        title: "Merchant updated",
        description: `Updated ${result.payoutsUpdated} payout records`,
      })
      setEditingPayoutGroup(null)
      fetchMerchants()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update merchant details",
        variant: "destructive",
      })
    } finally {
      setSavingMerchant(false)
    }
  }

  const totalMerchants = merchants.length
  const totalPayouts = merchants.reduce((sum, m) => sum + m.totalAmount, 0)
  const totalPaid = merchants.reduce((sum, m) => sum + m.paidAmount, 0)

  const getSortedPayouts = (merchantMid: string, payouts: any[]) => {
    const field = sortFields[merchantMid] || "partner_payout_amount"
    const direction = sortDirections[merchantMid] || "desc"

    return [...payouts].sort((a, b) => {
      let aVal: any
      let bVal: any

      if (field === "partner_name") {
        aVal = getPartnerName(a)
        bVal = getPartnerName(b)
      } else {
        aVal = a[field]
        bVal = b[field]
      }

      if (aVal === null || aVal === undefined) aVal = ""
      if (bVal === null || bVal === undefined) bVal = ""

      if (field === "partner_split_pct" || field === "partner_payout_amount") {
        aVal = Number(aVal) || 0
        bVal = Number(bVal) || 0
      } else {
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
      }

      if (aVal < bVal) return direction === "asc" ? -1 : 1
      if (aVal > bVal) return direction === "asc" ? 1 : -1
      return 0
    })
  }

  const toggleSort = (merchantMid: string, field: SortField) => {
    const currentField = sortFields[merchantMid] || "partner_payout_amount"
    const currentDirection = sortDirections[merchantMid] || "desc"

    if (currentField === field) {
      setSortDirections((prev) => ({ ...prev, [merchantMid]: currentDirection === "asc" ? "desc" : "asc" }))
    } else {
      setSortFields((prev) => ({ ...prev, [merchantMid]: field }))
      setSortDirections((prev) => ({ ...prev, [merchantMid]: "asc" }))
    }
  }

  const SortableHeader = ({
    merchantMid,
    field,
    label,
    className = "",
  }: {
    merchantMid: string
    field: SortField
    label: string
    className?: string
  }) => {
    const currentField = sortFields[merchantMid] || "partner_payout_amount"
    const currentDirection = sortDirections[merchantMid] || "desc"

    return (
      <TableHead
        className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
        onClick={() => toggleSort(merchantMid, field)}
      >
        <div className="flex items-center gap-1">
          {label}
          {currentField === field ? (
            currentDirection === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
      </TableHead>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/residuals/payouts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payouts by Merchant</h1>
          <p className="text-muted-foreground mt-1">View and edit all payouts grouped by merchant (MID)</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Merchants</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMerchants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <MoneyDisplay amount={totalPayouts} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              <MoneyDisplay amount={totalPaid} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by merchant name or MID..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-[180px]">
              <label className="text-sm font-medium mb-1 block">Month</label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={fetchMerchants} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Merchants List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : merchants.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No merchants found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {merchants.map((merchant) => (
            <Collapsible
              key={merchant.mid}
              open={expandedMerchants.has(merchant.mid)}
              onOpenChange={() => toggleMerchantExpanded(merchant.mid)}
            >
              <Card>
                {/* Parent Level: Merchant Card */}
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedMerchants.has(merchant.mid) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle>{merchant.merchantName}</CardTitle>
                            {merchant.payoutTypeGroups.length > 1 && (
                              <Badge variant="secondary">
                                {merchant.payoutTypeGroups.length} deal types
                              </Badge>
                            )}
                            {merchant.payoutTypeGroups.length === 1 && (
                              <Badge variant="outline" className="capitalize">
                                {merchant.payoutTypeGroups[0].payoutType}
                              </Badge>
                            )}
                          </div>
                          <CardDescription>MID: {merchant.mid}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${merchant.totalAmount < 0 ? "text-red-500" : ""}`}>
                          <MoneyDisplay amount={merchant.totalAmount} />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Paid: <MoneyDisplay amount={merchant.paidAmount} />
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {merchant.payoutCount} payout records • {merchant.participantCount} participants
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Nested Level: Payout Type Groups */}
                    {merchant.payoutTypeGroups.map((payoutGroup) => (
                      <Collapsible
                        key={payoutGroup.groupKey}
                        open={expandedPayoutTypes.has(payoutGroup.groupKey)}
                        onOpenChange={() => togglePayoutTypeExpanded(payoutGroup.groupKey)}
                      >
                        <div className="border rounded-lg">
                          <CollapsibleTrigger asChild>
                            <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {expandedPayoutTypes.has(payoutGroup.groupKey) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold capitalize">{payoutGroup.payoutType}</span>
                                    {payoutGroup.availableForPurchase && (
                                      <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                                        Available
                                      </Badge>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => handleEditPayoutGroup(merchant, payoutGroup, e)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`font-bold ${payoutGroup.totalAmount < 0 ? "text-red-500" : ""}`}>
                                    <MoneyDisplay amount={payoutGroup.totalAmount} />
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {payoutGroup.payouts.length} payouts • {payoutGroup.participantCount} participants
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <SortableHeader merchantMid={payoutGroup.groupKey} field="partner_name" label="Partner" />
                                    <SortableHeader merchantMid={payoutGroup.groupKey} field="partner_role" label="Role" />
                                    <SortableHeader merchantMid={payoutGroup.groupKey} field="payout_month" label="Month" />
                                    <SortableHeader merchantMid={payoutGroup.groupKey} field="partner_split_pct" label="Split %" />
                                    <SortableHeader
                                      merchantMid={payoutGroup.groupKey}
                                      field="partner_payout_amount"
                                      label="Amount"
                                      className="text-right"
                                    />
                                    <SortableHeader merchantMid={payoutGroup.groupKey} field="paid_status" label="Status" />
                                    <TableHead className="w-[100px]">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {getSortedPayouts(payoutGroup.groupKey, payoutGroup.payouts).map((payout) => (
                                    <TableRow key={payout.id}>
                                      <TableCell className="font-medium">{getPartnerName(payout)}</TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">{payout.partner_role || "Agent"}</Badge>
                                      </TableCell>
                                      <TableCell>{formatPayoutMonth(payout.payout_month)}</TableCell>
                                      <TableCell>{payout.partner_split_pct}%</TableCell>
                                      <TableCell className="text-right font-semibold">
                                        <MoneyDisplay amount={payout.partner_payout_amount} />
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={payout.paid_status === "paid" ? "default" : "secondary"}>
                                          {payout.paid_status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <EditPayoutButton payout={payout} onUpdate={fetchMerchants} />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      <Dialog open={editingPayoutGroup !== null} onOpenChange={(open) => !open && setEditingPayoutGroup(null)}>
        <DialogContent style={{ width: "900px", maxWidth: "95vw" }} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-muted-foreground" />
              <DialogTitle className="text-lg">{editingPayoutGroup?.merchant.merchantName}</DialogTitle>
              <Badge variant="outline" className="capitalize">
                {editingPayoutGroup?.payoutGroup.payoutType}
              </Badge>
            </div>
            <DialogDescription>Merchant details and deal information</DialogDescription>
          </DialogHeader>

          {/* Merchant Information Card */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-base">Merchant Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-merchant-name">Merchant Name</Label>
                <Input
                  id="edit-merchant-name"
                  value={editMerchantName}
                  onChange={(e) => setEditMerchantName(e.target.value)}
                  placeholder="Enter merchant name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mid">MID</Label>
                <Input
                  id="edit-mid"
                  value={editMid}
                  onChange={(e) => setEditMid(e.target.value)}
                  placeholder="Enter MID"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-sm text-muted-foreground">Deal Total</p>
                <p className="font-medium text-sm">
                  <MoneyDisplay amount={editingPayoutGroup?.payoutGroup.totalAmount || 0} />
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="default" className="mt-1">
                  active
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">{editingPayoutGroup?.payoutGroup.participantCount} participants</span>
              </div>
              {editingPayoutGroup?.payoutGroup.dealId ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="available-purchase"
                    checked={editingPayoutGroup.payoutGroup.availableForPurchase}
                    onCheckedChange={(checked) => toggleAvailableForPurchase(checked as boolean)}
                    disabled={savingAvailability}
                  />
                  <Label htmlFor="available-purchase" className="text-sm cursor-pointer">
                    Available to purchase
                  </Label>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No deal associated</p>
              )}
            </div>
          </div>

          {/* Deal Summary Card */}
          <div className="border rounded-lg p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-base">Deal Summary</h3>
              <p className="text-sm text-muted-foreground">Deal information for this payout type</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal ID</TableHead>
                  <TableHead>Payout Type</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Payouts</TableHead>
                  <TableHead>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editingPayoutGroup?.payoutGroup.dealId ? (
                  <TableRow>
                    <TableCell className="font-mono text-sm">{editingPayoutGroup.payoutGroup.dealId.substring(0, 12)}...</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{editingPayoutGroup.payoutGroup.payoutType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {editingPayoutGroup.payoutGroup.participantCount}
                      </div>
                    </TableCell>
                    <TableCell>{editingPayoutGroup.payoutGroup.payouts.length}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={editingPayoutGroup.payoutGroup.availableForPurchase}
                        onCheckedChange={(checked) => toggleAvailableForPurchase(checked as boolean)}
                        disabled={savingAvailability}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      No deal found for this payout type
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayoutGroup(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMerchantDetails} disabled={savingMerchant}>
              {savingMerchant ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
