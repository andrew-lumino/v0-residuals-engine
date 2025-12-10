"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MoneyDisplay } from "@/components/residuals/shared/MoneyDisplay"
import {
  ArrowLeft,
  Search,
  Users,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ChevronUp,
  ArrowUpDown,
  GitCompare,
  X,
  Trophy,
  Percent,
  DollarSign,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EditPayoutButton } from "@/components/residuals/payouts/EditPayoutButton"
import { MarkPaidButton } from "@/components/residuals/payouts/MarkPaidButton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatPayoutMonth } from "@/lib/utils/formatters"
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

interface Participant {
  id: string
  name: string
  email: string
  role: string
  deals: any[]
  payouts: any[]
  totalDeals: number
  totalPayouts: number
  paidPayouts: number
  avgSplitPct: number
}

interface ApiResponse {
  success: boolean
  data: Participant[]
  meta: {
    totalParticipants: number
    totalDeals: number
    totalPayouts: number
    months: string[]
    roles: string[]
  }
}

type SortField =
  | "merchant_name"
  | "mid"
  | "payout_month"
  | "partner_split_pct"
  | "partner_payout_amount"
  | "paid_status"
type SortDirection = "asc" | "desc"

export default function ByParticipantPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [monthFilter, setMonthFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [payoutTypeFilter, setPayoutTypeFilter] = useState("all")
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set())
  const [sortFields, setSortFields] = useState<Record<string, SortField>>({})
  const [sortDirections, setSortDirections] = useState<Record<string, SortDirection>>({})

  const [compareMode, setCompareMode] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())
  const [openAlertDialog, setOpenAlertDialog] = useState(false)
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null)

  const isCompareCommand = search.toLowerCase().startsWith("/compare")
  const compareNames = useMemo(() => {
    if (!isCompareCommand) return []
    const namesStr = search.slice(8).trim() // Remove "/compare "
    if (!namesStr) return []
    return namesStr
      .split(",")
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean)
  }, [search, isCompareCommand])

  const filteredParticipants = useMemo(() => {
    // When using /compare command, filter to only matching participants
    if (isCompareCommand && compareNames.length > 0) {
      return participants.filter((p) => compareNames.some((name) => p.name.toLowerCase().includes(name)))
    }
    return participants
  }, [participants, isCompareCommand, compareNames])

  const comparedParticipants = useMemo(() => {
    if (isCompareCommand && compareNames.length > 0) {
      return filteredParticipants
    }
    if (compareMode && selectedForCompare.size > 0) {
      return participants.filter((p) => selectedForCompare.has(p.id))
    }
    return []
  }, [filteredParticipants, participants, isCompareCommand, compareNames, compareMode, selectedForCompare])

  const comparisonStats = useMemo(() => {
    if (comparedParticipants.length < 2) return null

    const sorted = [...comparedParticipants].sort((a, b) => b.totalPayouts - a.totalPayouts)
    const maxPayouts = Math.max(...comparedParticipants.map((p) => p.totalPayouts))
    const minPayouts = Math.min(...comparedParticipants.map((p) => p.totalPayouts))
    const avgPayouts = comparedParticipants.reduce((sum, p) => sum + p.totalPayouts, 0) / comparedParticipants.length
    const totalDeals = comparedParticipants.reduce((sum, p) => sum + p.totalDeals, 0)
    const avgSplit = comparedParticipants.reduce((sum, p) => sum + p.avgSplitPct, 0) / comparedParticipants.length

    return {
      ranked: sorted,
      maxPayouts,
      minPayouts,
      avgPayouts,
      totalDeals,
      avgSplit,
      leader: sorted[0],
      difference: maxPayouts - minPayouts,
    }
  }, [comparedParticipants])

  const toggleCompareSelection = (id: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 5) {
        // Max 5 participants
        next.add(id)
      }
      return next
    })
  }

  const exitCompareMode = () => {
    setCompareMode(false)
    setSelectedForCompare(new Set())
    if (isCompareCommand) {
      setSearch("")
    }
  }

  const fetchParticipants = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search && !search.toLowerCase().startsWith("/compare")) {
        params.set("search", search)
      }
      if (monthFilter !== "all") params.set("month", monthFilter)
      if (roleFilter !== "all") params.set("role", roleFilter)
      if (payoutTypeFilter !== "all") params.set("payoutType", payoutTypeFilter)

      const response = await fetch(`/api/residuals/participants?${params}`)
      const data: ApiResponse = await response.json()

      if (data.success) {
        setParticipants(data.data)
        setMeta(data.meta)
      }
    } catch (error) {
      console.error("[v0] Error fetching participants:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchParticipants()
  }, [monthFilter, roleFilter, payoutTypeFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchParticipants()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const toggleExpanded = (id: string) => {
    setExpandedParticipants((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const topPerformer = useMemo(() => {
    if (participants.length === 0) return null
    return participants.reduce((top, p) => (p.totalPayouts > (top?.totalPayouts || 0) ? p : top), participants[0])
  }, [participants])

  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case "company":
        return "default"
      case "agent":
        return "secondary"
      case "referrer":
        return "outline"
      default:
        return "secondary"
    }
  }

  const getSortedPayouts = (participantId: string, payouts: any[]) => {
    const field = sortFields[participantId] || "merchant_name"
    const direction = sortDirections[participantId] || "asc"

    return [...payouts].sort((a, b) => {
      let aVal: any = a[field]
      let bVal: any = b[field]

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

  const toggleSort = (participantId: string, field: SortField) => {
    const currentField = sortFields[participantId] || "merchant_name"
    const currentDirection = sortDirections[participantId] || "asc"

    if (currentField === field) {
      setSortDirections((prev) => ({ ...prev, [participantId]: currentDirection === "asc" ? "desc" : "asc" }))
    } else {
      setSortFields((prev) => ({ ...prev, [participantId]: field }))
      setSortDirections((prev) => ({ ...prev, [participantId]: "asc" }))
    }
  }

  const SortableHeader = ({
    participantId,
    field,
    label,
    className = "",
  }: {
    participantId: string
    field: SortField
    label: string
    className?: string
  }) => {
    const currentField = sortFields[participantId] || "merchant_name"
    const currentDirection = sortDirections[participantId] || "asc"

    return (
      <TableHead
        className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
        onClick={() => toggleSort(participantId, field)}
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

  const markPayoutPaid = async (id: string) => {
    try {
      const response = await fetch(`/api/residuals/payouts/${id}/mark-paid`, {
        method: "POST",
      })
      const data = await response.json()
      if (data.success) {
        fetchParticipants()
      }
    } catch (error) {
      console.error("Error marking payout as paid:", error)
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Participants</h1>
          <p className="text-muted-foreground mt-1">Manage partners and view their assigned deals</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meta?.totalParticipants || 0}</div>
            <p className="text-xs text-muted-foreground">Active partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meta?.totalDeals || 0}</div>
            <p className="text-xs text-muted-foreground">Across all participants</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Deals/Partner</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meta?.totalParticipants ? Math.round((meta.totalDeals || 0) / meta.totalParticipants) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Deals per participant</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topPerformer ? <MoneyDisplay amount={topPerformer.totalPayouts} /> : "No data"}
            </div>
            <p className="text-xs text-muted-foreground">{topPerformer?.name || "No data"}</p>
          </CardContent>
        </Card>
      </div>

      {comparedParticipants.length >= 2 && comparisonStats && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-primary" />
                <CardTitle>Comparing {comparedParticipants.length} Participants</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={exitCompareMode}>
                <X className="h-4 w-4 mr-1" />
                Exit Compare
              </Button>
            </div>
            <CardDescription>{isCompareCommand ? "Using /compare command" : "Manual selection mode"}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ranking */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Performance Ranking
                </h4>
                <div className="space-y-2">
                  {comparisonStats.ranked.map((p, index) => {
                    const percentage =
                      comparisonStats.maxPayouts > 0 ? (p.totalPayouts / comparisonStats.maxPayouts) * 100 : 0
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <span
                          className={`font-bold text-lg w-6 ${
                            index === 0
                              ? "text-yellow-500"
                              : index === 1
                                ? "text-gray-400"
                                : index === 2
                                  ? "text-amber-600"
                                  : "text-muted-foreground"
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{p.name}</span>
                            <span className="font-bold">
                              <MoneyDisplay amount={p.totalPayouts} />
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                index === 0
                                  ? "bg-yellow-500"
                                  : index === 1
                                    ? "bg-gray-400"
                                    : index === 2
                                      ? "bg-amber-600"
                                      : "bg-muted-foreground"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Comparison Stats */}
              <div className="space-y-3">
                <h4 className="font-semibold">Comparison Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <DollarSign className="h-4 w-4" />
                      Average Payout
                    </div>
                    <div className="text-xl font-bold">
                      <MoneyDisplay amount={comparisonStats.avgPayouts} />
                    </div>
                  </div>
                  <div className="bg-background rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <TrendingUp className="h-4 w-4" />
                      Gap (High - Low)
                    </div>
                    <div className="text-xl font-bold">
                      <MoneyDisplay amount={comparisonStats.difference} />
                    </div>
                  </div>
                  <div className="bg-background rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Percent className="h-4 w-4" />
                      Avg Split %
                    </div>
                    <div className="text-xl font-bold">{comparisonStats.avgSplit.toFixed(1)}%</div>
                  </div>
                  <div className="bg-background rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <FileText className="h-4 w-4" />
                      Total Deals
                    </div>
                    <div className="text-xl font-bold">{comparisonStats.totalDeals}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Comparison Table */}
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Detailed Breakdown</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Total Payouts</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Avg Split</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonStats.ranked.map((p, index) => (
                    <TableRow key={p.id} className={index === 0 ? "bg-yellow-500/10" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                          {p.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(p.role)}>{p.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        <MoneyDisplay amount={p.totalPayouts} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay amount={p.paidPayouts} />
                      </TableCell>
                      <TableCell className="text-right">{p.totalDeals}</TableCell>
                      <TableCell className="text-right">{p.avgSplitPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{p.payouts.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Participant Management</CardTitle>
          <CardDescription>Search, filter, and analyze participant performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[250px]">
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    compareMode ? "Search participants to compare..." : "Search or type /compare name1, name2..."
                  }
                  className={`pl-9 ${isCompareCommand ? "border-primary ring-1 ring-primary" : ""}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {isCompareCommand && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Badge variant="secondary" className="text-xs">
                      <GitCompare className="h-3 w-3 mr-1" />
                      Compare Mode
                    </Badge>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tip: Type <code className="bg-muted px-1 rounded">/compare john, jane</code> to compare participants
              </p>
            </div>

            <Button
              variant={compareMode ? "default" : "outline"}
              onClick={() => {
                setCompareMode(!compareMode)
                if (compareMode) {
                  setSelectedForCompare(new Set())
                }
              }}
              className="gap-2"
            >
              <GitCompare className="h-4 w-4" />
              {compareMode ? `Comparing (${selectedForCompare.size})` : "Compare"}
            </Button>

            <div className="w-[180px]">
              <label className="text-sm font-medium mb-1 block">Filter by Month</label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {meta?.months?.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <label className="text-sm font-medium mb-1 block">Filter by Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {meta?.roles?.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <label className="text-sm font-medium mb-1 block">Payout Type</label>
              <Select value={payoutTypeFilter} onValueChange={setPayoutTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="residual">Residual</SelectItem>
                  <SelectItem value="upfront">Upfront</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={fetchParticipants} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Participants List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Participants ({filteredParticipants.length})</span>
            {isCompareCommand && compareNames.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                Comparing {filteredParticipants.length} of {participants.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {compareMode
              ? `Select up to 5 participants to compare (${selectedForCompare.size} selected)`
              : "All partners and their deal assignments with performance metrics"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredParticipants.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {isCompareCommand && compareNames.length > 0
                ? `No participants found matching: ${compareNames.join(", ")}`
                : "No participants found. Assign deals to partners to see them here."}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredParticipants.map((participant) => {
                const isSelectedForCompare = selectedForCompare.has(participant.id)
                const isInCompareResults = isCompareCommand && comparedParticipants.some((p) => p.id === participant.id)

                return (
                  <Collapsible
                    key={participant.id}
                    open={expandedParticipants.has(participant.id)}
                    onOpenChange={() => toggleExpanded(participant.id)}
                  >
                    <Card
                      className={`border ${
                        isSelectedForCompare || isInCompareResults ? "border-primary ring-2 ring-primary/20" : ""
                      }`}
                    >
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {compareMode && (
                                <div
                                  className="flex items-center justify-center"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleCompareSelection(participant.id)
                                  }}
                                >
                                  <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${
                                      isSelectedForCompare
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground"
                                    }`}
                                  >
                                    {isSelectedForCompare && <span className="text-xs font-bold">✓</span>}
                                  </div>
                                </div>
                              )}
                              {expandedParticipants.has(participant.id) ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <div>
                                <CardTitle className="text-lg">{participant.name}</CardTitle>
                                <CardDescription>{participant.email}</CardDescription>
                              </div>
                              <Badge variant={getRoleBadgeVariant(participant.role)}>{participant.role}</Badge>
                              {(isSelectedForCompare || isInCompareResults) && comparisonStats && (
                                <Badge variant="outline" className="ml-2">
                                  #{comparisonStats.ranked.findIndex((p) => p.id === participant.id) + 1}
                                </Badge>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                <MoneyDisplay amount={participant.totalPayouts} />
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Paid: <MoneyDisplay amount={participant.paidPayouts} />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-6 mt-2 text-sm text-muted-foreground">
                            <span>{participant.totalDeals} deals</span>
                            <span>Avg Split: {participant.avgSplitPct.toFixed(1)}%</span>
                            <span>{participant.payouts.length} payout records</span>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          {participant.payouts.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <SortableHeader
                                    participantId={participant.id}
                                    field="merchant_name"
                                    label="Merchant"
                                  />
                                  <SortableHeader participantId={participant.id} field="mid" label="MID" />
                                  <SortableHeader participantId={participant.id} field="payout_month" label="Month" />
                                  <SortableHeader
                                    participantId={participant.id}
                                    field="partner_split_pct"
                                    label="Split %"
                                  />
                                  <SortableHeader
                                    participantId={participant.id}
                                    field="partner_payout_amount"
                                    label="Amount"
                                    className="text-right"
                                  />
                                  <SortableHeader participantId={participant.id} field="paid_status" label="Status" />
                                  <TableHead className="w-[100px]">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {getSortedPayouts(participant.id, participant.payouts).map((payout: any) => (
                                  <TableRow key={payout.id}>
                                    <TableCell className="font-medium">{payout.merchant_name}</TableCell>
                                    <TableCell className="font-mono text-sm">{payout.mid}</TableCell>
                                    <TableCell>{formatPayoutMonth(payout.payout_month)}</TableCell>
                                    <TableCell>{payout.partner_split_pct}%</TableCell>
                                    <TableCell className="text-right font-semibold">
                                      <MoneyDisplay amount={payout.partner_payout_amount} />
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={payout.paid_status === "paid" ? "default" : "secondary"}>
                                        {payout.paid_status.toUpperCase()}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <MarkPaidButton payout={payout} onUpdate={fetchParticipants} />
                                        <EditPayoutButton payout={payout} onUpdate={fetchParticipants} />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              No payout records yet. Assign and confirm deals to generate payouts.
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AlertDialog for Mark Paid */}
      <AlertDialog open={openAlertDialog} onOpenChange={setOpenAlertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Payout as Paid</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to mark this payout as paid?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedPayoutId) {
                  await markPayoutPaid(selectedPayoutId)
                  setOpenAlertDialog(false)
                }
              }}
            >
              Mark Paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
