"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MoneyDisplay } from "@/components/residuals/shared/MoneyDisplay"
import { ArrowLeft, Search, ChevronDown, ChevronRight, RefreshCw, Calendar, ChevronUp, ArrowUpDown } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EditPayoutButton } from "@/components/residuals/payouts/EditPayoutButton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface MonthGroup {
  month: string
  payouts: any[]
  totalAmount: number
  paidAmount: number
  merchantCount: number
  participantCount: number
}

type SortField =
  | "merchant_name"
  | "mid"
  | "partner_name"
  | "partner_split_pct"
  | "partner_payout_amount"
  | "paid_status"
type SortDirection = "asc" | "desc"

export default function ByMonthPage() {
  const [months, setMonths] = useState<MonthGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [partnersMap, setPartnersMap] = useState<Map<string, any>>(new Map())
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
          map.set("lumino-company", { id: "lumino-company", name: "Lumino", role: "Company" })
          setPartnersMap(map)
        }
      } catch (error) {
        console.error("[v0] Error fetching partners:", error)
      }
    }
    fetchPartners()
  }, [])

  const fetchMonths = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/residuals/payouts?format=raw")
      const data = await response.json()

      if (data.success) {
        let payouts = data.data || []

        if (statusFilter !== "all") {
          payouts = payouts.filter((p: any) => p.paid_status === statusFilter)
        }

        if (search) {
          const searchLower = search.toLowerCase()
          payouts = payouts.filter(
            (p: any) =>
              p.merchant_name?.toLowerCase().includes(searchLower) ||
              p.mid?.toLowerCase().includes(searchLower) ||
              p.payout_month?.toLowerCase().includes(searchLower),
          )
        }

        const grouped = new Map<string, any[]>()
        payouts.forEach((payout: any) => {
          const key = payout.payout_month || "Unknown"
          if (!grouped.has(key)) {
            grouped.set(key, [])
          }
          grouped.get(key)!.push(payout)
        })

        const monthGroups: MonthGroup[] = Array.from(grouped.entries()).map(([month, payouts]) => ({
          month,
          payouts,
          totalAmount: payouts.reduce((sum, p) => sum + (Number.parseFloat(p.partner_payout_amount) || 0), 0),
          paidAmount: payouts
            .filter((p) => p.paid_status === "paid")
            .reduce((sum, p) => sum + (Number.parseFloat(p.partner_payout_amount) || 0), 0),
          merchantCount: new Set(payouts.map((p) => p.mid)).size,
          participantCount: new Set(payouts.map((p) => p.partner_airtable_id)).size,
        }))

        monthGroups.sort((a, b) => b.month.localeCompare(a.month))
        setMonths(monthGroups)
      }
    } catch (error) {
      console.error("[v0] Error fetching months:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMonths()
  }, [statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMonths()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const toggleExpanded = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(month)) {
        next.delete(month)
      } else {
        next.add(month)
      }
      return next
    })
  }

  const getPartnerName = (payout: any) => {
    const partner = partnersMap.get(payout.partner_airtable_id)
    return partner?.name || payout.partner_role || payout.partner_airtable_id || "Unknown"
  }

  const getSortedPayouts = (monthKey: string, payouts: any[]) => {
    const field = sortFields[monthKey] || "merchant_name"
    const direction = sortDirections[monthKey] || "asc"

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

  const toggleSort = (monthKey: string, field: SortField) => {
    const currentField = sortFields[monthKey] || "merchant_name"
    const currentDirection = sortDirections[monthKey] || "asc"

    if (currentField === field) {
      setSortDirections((prev) => ({ ...prev, [monthKey]: currentDirection === "asc" ? "desc" : "asc" }))
    } else {
      setSortFields((prev) => ({ ...prev, [monthKey]: field }))
      setSortDirections((prev) => ({ ...prev, [monthKey]: "asc" }))
    }
  }

  const SortableHeader = ({
    monthKey,
    field,
    label,
    className = "",
  }: {
    monthKey: string
    field: SortField
    label: string
    className?: string
  }) => {
    const currentField = sortFields[monthKey] || "merchant_name"
    const currentDirection = sortDirections[monthKey] || "asc"

    return (
      <TableHead
        className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
        onClick={() => toggleSort(monthKey, field)}
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

  const totalPayouts = months.reduce((sum, m) => sum + m.totalAmount, 0)
  const totalPaid = months.reduce((sum, m) => sum + m.paidAmount, 0)

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
          <h1 className="text-3xl font-bold tracking-tight">Payouts by Month</h1>
          <p className="text-muted-foreground mt-1">View and edit all payouts organized by payout month</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Months</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{months.length}</div>
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
                  placeholder="Search by merchant, MID, or month..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
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
            <Button variant="outline" onClick={fetchMonths} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Months List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : months.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No payout records found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {months.map((monthData) => (
            <Collapsible
              key={monthData.month}
              open={expandedMonths.has(monthData.month)}
              onOpenChange={() => toggleExpanded(monthData.month)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedMonths.has(monthData.month) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle>{monthData.month}</CardTitle>
                          <CardDescription>
                            {monthData.merchantCount} merchants • {monthData.participantCount} participants
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          <MoneyDisplay amount={monthData.totalAmount} />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Paid: <MoneyDisplay amount={monthData.paidAmount} />
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">{monthData.payouts.length} payout records</div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableHeader monthKey={monthData.month} field="merchant_name" label="Merchant" />
                          <SortableHeader monthKey={monthData.month} field="mid" label="MID" />
                          <SortableHeader monthKey={monthData.month} field="partner_name" label="Partner" />
                          <SortableHeader monthKey={monthData.month} field="partner_split_pct" label="Split %" />
                          <SortableHeader
                            monthKey={monthData.month}
                            field="partner_payout_amount"
                            label="Amount"
                            className="text-right"
                          />
                          <SortableHeader monthKey={monthData.month} field="paid_status" label="Status" />
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getSortedPayouts(monthData.month, monthData.payouts).map((payout) => (
                          <TableRow key={payout.id}>
                            <TableCell className="font-medium">{payout.merchant_name}</TableCell>
                            <TableCell className="font-mono text-sm">{payout.mid}</TableCell>
                            <TableCell>{getPartnerName(payout)}</TableCell>
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
                              <EditPayoutButton payout={payout} onUpdate={fetchMonths} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  )
}
