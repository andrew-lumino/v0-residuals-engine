"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MoneyDisplay } from "@/components/residuals/shared/MoneyDisplay"
import { StatusBadge } from "@/components/residuals/shared/StatusBadge"
import { Loader2, Check, Download, ChevronUp, ChevronDown, ArrowUpDown, DollarSign } from "lucide-react"
import type { PayoutSummary } from "@/lib/types/database"
import { toast } from "sonner"

type SortField = "partner_name" | "role" | "merchant_count" | "total_payout" | "status"
type SortDirection = "asc" | "desc"

export function PayoutsTable() {
  const [data, setData] = useState<PayoutSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState("September 2025")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>("partner_name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const availableMonths = ["September 2025", "August 2025", "July 2025"]

  useEffect(() => {
    fetchPayouts()
  }, [month, statusFilter])

  const fetchPayouts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        month,
        status: statusFilter,
      })

      const res = await fetch(`/api/residuals/payouts?${params}`)
      const json = await res.json()

      if (json.success) {
        setData(json.data)
      }
    } catch (error) {
      console.error("Failed to fetch payouts", error)
      toast.error("Failed to load payouts")
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = async (partnerId: string) => {
    try {
      const res = await fetch("/api/residuals/payouts/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, month }),
      })

      const json = await res.json()

      if (json.success) {
        toast.success(json.data.message)
        fetchPayouts()
      } else {
        throw new Error(json.error)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark as paid")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    let aVal: any
    let bVal: any

    switch (sortField) {
      case "partner_name":
        aVal = a.partner_name || ""
        bVal = b.partner_name || ""
        break
      case "role":
        aVal = "Partner"
        bVal = "Partner"
        break
      case "merchant_count":
        aVal = a.merchant_count
        bVal = b.merchant_count
        break
      case "total_payout":
        aVal = a.total_payout
        bVal = b.total_payout
        break
      case "status":
        aVal = a.unpaid_count === 0 ? "paid" : a.paid_count > 0 ? "pending" : "unpaid"
        bVal = b.unpaid_count === 0 ? "paid" : b.paid_count > 0 ? "pending" : "unpaid"
        break
      default:
        aVal = ""
        bVal = ""
    }

    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase()
      bVal = (bVal as string).toLowerCase()
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortableHeader = ({
    field,
    label,
    className = "",
  }: {
    field: SortField
    label: string
    className?: string
  }) => (
    <TableHead
      className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field ? (
          sortDirection === "asc" ? (
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

  const totalPayout = data.reduce((sum, row) => sum + row.total_payout, 0)
  const totalMerchants = data.reduce((sum, row) => sum + row.merchant_count, 0)
  const totalPaid = data.filter((r) => r.unpaid_count === 0).length

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <MoneyDisplay amount={totalPayout} showZero />
            </div>
            <p className="text-xs text-muted-foreground">For {month}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Partners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground">{totalPaid} fully paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMerchants}</div>
            <p className="text-xs text-muted-foreground">Processed this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Main Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="partner_name" label="Partner Name" />
              <SortableHeader field="role" label="Role" />
              <SortableHeader field="merchant_count" label="Merchants" className="text-right" />
              <SortableHeader field="total_payout" label="Total Payout" className="text-right" />
              <SortableHeader field="status" label="Mark as Paid" className="text-center" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex justify-center items-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No payouts found for this month.
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row) => {
                const isFullyPaid = row.unpaid_count === 0
                const isPartiallyPaid = row.paid_count > 0 && row.unpaid_count > 0
                const status = isFullyPaid ? "paid" : isPartiallyPaid ? "pending" : "unpaid"

                return (
                  <TableRow key={row.partner_airtable_id}>
                    <TableCell className="font-medium">{row.partner_name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.partner_role || "Partner"}</TableCell>
                    <TableCell className="text-right font-mono">{row.merchant_count}</TableCell>
                    <TableCell className="text-right font-bold">
                      <MoneyDisplay amount={row.total_payout} />
                    </TableCell>
                    <TableCell className="text-center">
                      {isFullyPaid ? (
                        <div className="inline-flex items-center gap-1.5 text-green-600">
                          <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium">Paid</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkPaid(row.partner_airtable_id)}
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
