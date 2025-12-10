"use client"
import type { JSX } from "react/jsx-runtime"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  History,
  Search,
  RotateCcw,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  Undo2,
  Filter,
  X,
  Loader2,
  CalendarIcon,
  Trash2,
  CheckSquare,
} from "lucide-react"
import { formatDistanceToNow, format, isWithinInterval, startOfDay, endOfDay } from "date-fns"

// Define ActionHistory and DebugLog interfaces
interface ActionHistory {
  id: string
  action_type: string
  entity_type: string
  entity_name?: string
  entity_id?: string
  description: string
  created_at: string
  request_id?: string
  is_undone: boolean
  previous_data?: any
  new_data?: any
}

interface DebugLog {
  id: string
  level: string
  source: string
  message: string
  created_at: string
  request_id?: string
  metadata?: any
}

// Define actionTypeColors and logLevelColors maps
const actionTypeColors: { [key: string]: string } = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  bulk_update: "bg-yellow-100 text-yellow-800",
  import: "bg-purple-100 text-purple-800",
  sync: "bg-gray-100 text-gray-800",
}

const logLevelColors: { [key: string]: string } = {
  debug: "text-blue-600",
  info: "text-green-600",
  warn: "text-yellow-600",
  error: "text-red-600",
  fatal: "text-black",
}

// Define logLevelIcons map
const logLevelIcons: { [key: string]: JSX.Element } = {
  debug: <Info className="h-4 w-4" />,
  info: <AlertCircle className="h-4 w-4" />,
  warn: <AlertTriangle className="h-4 w-4" />,
  error: <Bug className="h-4 w-4" />,
  fatal: <Trash2 className="h-4 w-4" />,
}

const PAGE_SIZE = 50

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState("actions")

  // Action History state
  const [actions, setActions] = useState<ActionHistory[]>([])
  const [actionsLoading, setActionsLoading] = useState(true)
  const [actionsLoadingMore, setActionsLoadingMore] = useState(false)
  const [actionsHasMore, setActionsHasMore] = useState(true)
  const [actionsPage, setActionsPage] = useState(1)
  const [actionSearch, setActionSearch] = useState("")
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all")
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all")
  const [selectedAction, setSelectedAction] = useState<ActionHistory | null>(null)
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set())
  const [actionDateFrom, setActionDateFrom] = useState<Date | undefined>(undefined)
  const [actionDateTo, setActionDateTo] = useState<Date | undefined>(undefined)

  // Debug Logs state
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsLoadingMore, setLogsLoadingMore] = useState(false)
  const [logsHasMore, setLogsHasMore] = useState(true)
  const [logsPage, setLogsPage] = useState(1)
  const [logSearch, setLogSearch] = useState("")
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all")
  const [logSourceFilter, setLogSourceFilter] = useState<string>("all")
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set())
  const [logDateFrom, setLogDateFrom] = useState<Date | undefined>(undefined)
  const [logDateTo, setLogDateTo] = useState<Date | undefined>(undefined)

  // Request correlation
  const [requestIdFilter, setRequestIdFilter] = useState<string | null>(null)

  // Undo state
  const [undoing, setUndoing] = useState<string | null>(null)

  // Refs for infinite scroll
  const actionsLoaderRef = useRef<HTMLDivElement>(null)
  const logsLoaderRef = useRef<HTMLDivElement>(null)

  const filteredActions = actions.filter((action) => {
    // Text search
    const matchesSearch =
      !actionSearch ||
      action.description?.toLowerCase().includes(actionSearch.toLowerCase()) ||
      action.entity_name?.toLowerCase().includes(actionSearch.toLowerCase()) ||
      action.entity_id?.toLowerCase().includes(actionSearch.toLowerCase())

    // Type filters
    const matchesType = actionTypeFilter === "all" || action.action_type === actionTypeFilter
    const matchesEntity = entityTypeFilter === "all" || action.entity_type === entityTypeFilter
    const matchesRequest = !requestIdFilter || action.request_id === requestIdFilter

    // Date range filter
    let matchesDate = true
    if (actionDateFrom || actionDateTo) {
      const actionDate = new Date(action.created_at)
      if (actionDateFrom && actionDateTo) {
        matchesDate = isWithinInterval(actionDate, {
          start: startOfDay(actionDateFrom),
          end: endOfDay(actionDateTo),
        })
      } else if (actionDateFrom) {
        matchesDate = actionDate >= startOfDay(actionDateFrom)
      } else if (actionDateTo) {
        matchesDate = actionDate <= endOfDay(actionDateTo)
      }
    }

    return matchesSearch && matchesType && matchesEntity && matchesRequest && matchesDate
  })

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !logSearch ||
      log.message?.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.source?.toLowerCase().includes(logSearch.toLowerCase())

    const matchesLevel = logLevelFilter === "all" || log.level === logLevelFilter
    const matchesSource = logSourceFilter === "all" || log.source === logSourceFilter
    const matchesRequest = !requestIdFilter || log.request_id === requestIdFilter

    // Date range filter
    let matchesDate = true
    if (logDateFrom || logDateTo) {
      const logDate = new Date(log.created_at)
      if (logDateFrom && logDateTo) {
        matchesDate = isWithinInterval(logDate, {
          start: startOfDay(logDateFrom),
          end: endOfDay(logDateTo),
        })
      } else if (logDateFrom) {
        matchesDate = logDate >= startOfDay(logDateFrom)
      } else if (logDateTo) {
        matchesDate = logDate <= endOfDay(logDateTo)
      }
    }

    return matchesSearch && matchesLevel && matchesSource && matchesRequest && matchesDate
  })

  const toggleActionSelection = (id: string) => {
    setSelectedActionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAllActions = () => {
    if (selectedActionIds.size === filteredActions.length) {
      setSelectedActionIds(new Set())
    } else {
      setSelectedActionIds(new Set(filteredActions.map((a) => a.id)))
    }
  }

  const toggleLogSelection = (id: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAllLogs = () => {
    if (selectedLogIds.size === filteredLogs.length) {
      setSelectedLogIds(new Set())
    } else {
      setSelectedLogIds(new Set(filteredLogs.map((l) => l.id)))
    }
  }

  const clearActionDateFilters = () => {
    setActionDateFrom(undefined)
    setActionDateTo(undefined)
  }

  const clearLogDateFilters = () => {
    setLogDateFrom(undefined)
    setLogDateTo(undefined)
  }

  // Fetch actions
  const fetchActions = useCallback(
    async (page: number, reset = false) => {
      if (page === 1) setActionsLoading(true)
      else setActionsLoadingMore(true)

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: PAGE_SIZE.toString(),
        })
        if (requestIdFilter) params.set("requestId", requestIdFilter)

        const res = await fetch(`/api/history?${params}`)
        const data = await res.json()

        if (data.actions) {
          setActions((prev) => (reset ? data.actions : [...prev, ...data.actions]))
          setActionsHasMore(data.actions.length === PAGE_SIZE)
        }
      } catch (error) {
        console.error("Failed to fetch actions:", error)
      } finally {
        setActionsLoading(false)
        setActionsLoadingMore(false)
      }
    },
    [requestIdFilter],
  )

  // Fetch logs
  const fetchLogs = useCallback(
    async (page: number, reset = false) => {
      if (page === 1) setLogsLoading(true)
      else setLogsLoadingMore(true)

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: PAGE_SIZE.toString(),
        })
        if (requestIdFilter) params.set("requestId", requestIdFilter)

        const res = await fetch(`/api/debug-logs?${params}`)
        const data = await res.json()

        if (data.logs) {
          setLogs((prev) => (reset ? data.logs : [...prev, ...data.logs]))
          setLogsHasMore(data.logs.length === PAGE_SIZE)
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error)
      } finally {
        setLogsLoading(false)
        setLogsLoadingMore(false)
      }
    },
    [requestIdFilter],
  )

  // Initial load
  useEffect(() => {
    fetchActions(1, true)
    fetchLogs(1, true)
  }, [fetchActions, fetchLogs])

  // Infinite scroll for actions
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && actionsHasMore && !actionsLoading && !actionsLoadingMore) {
          setActionsPage((prev) => prev + 1)
        }
      },
      { threshold: 0.1 },
    )

    if (actionsLoaderRef.current) {
      observer.observe(actionsLoaderRef.current)
    }

    return () => observer.disconnect()
  }, [actionsHasMore, actionsLoading, actionsLoadingMore])

  // Infinite scroll for logs
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && logsHasMore && !logsLoading && !logsLoadingMore) {
          setLogsPage((prev) => prev + 1)
        }
      },
      { threshold: 0.1 },
    )

    if (logsLoaderRef.current) {
      observer.observe(logsLoaderRef.current)
    }

    return () => observer.disconnect()
  }, [logsHasMore, logsLoading, logsLoadingMore])

  // Load more when page changes
  useEffect(() => {
    if (actionsPage > 1) {
      fetchActions(actionsPage)
    }
  }, [actionsPage, fetchActions])

  useEffect(() => {
    if (logsPage > 1) {
      fetchLogs(logsPage)
    }
  }, [logsPage, fetchLogs])

  // Refresh
  const handleRefresh = () => {
    setActionsPage(1)
    setLogsPage(1)
    setSelectedActionIds(new Set())
    setSelectedLogIds(new Set())
    fetchActions(1, true)
    fetchLogs(1, true)
  }

  // Undo action
  const handleUndo = async (actionId: string) => {
    setUndoing(actionId)
    try {
      const res = await fetch("/api/history/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId }),
      })

      if (res.ok) {
        fetchActions(1, true)
      }
    } catch (error) {
      console.error("Failed to undo:", error)
    } finally {
      setUndoing(null)
    }
  }

  // Filter by request ID
  const handleRequestIdClick = (requestId: string | null) => {
    setRequestIdFilter(requestId)
    setActionsPage(1)
    setLogsPage(1)
    fetchActions(1, true)
    fetchLogs(1, true)
  }

  const toggleLogExpanded = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">History & Logs</h1>
            <p className="text-muted-foreground">View action history, debug logs, and trace issues across requests</p>
          </div>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {requestIdFilter && (
        <Card className="bg-muted/50">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm">
                Filtering by request:{" "}
                <code className="bg-background px-2 py-0.5 rounded text-xs">{requestIdFilter}</code>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleRequestIdClick(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="actions" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Action History
            {selectedActionIds.size > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedActionIds.size}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Bug className="h-4 w-4" />
            Debug Logs
            {selectedLogIds.size > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedLogIds.size}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search actions..."
                      value={actionSearch}
                      onChange={(e) => setActionSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Action Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="bulk_update">Bulk Update</SelectItem>
                      <SelectItem value="import">Import</SelectItem>
                      <SelectItem value="sync">Sync</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Entity Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entities</SelectItem>
                      <SelectItem value="deal">Deal</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="payout">Payout</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="participant">Participant</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2 bg-transparent">
                        <CalendarIcon className="h-4 w-4" />
                        {actionDateFrom ? format(actionDateFrom, "MMM d") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={actionDateFrom} onSelect={setActionDateFrom} initialFocus />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2 bg-transparent">
                        <CalendarIcon className="h-4 w-4" />
                        {actionDateTo ? format(actionDateTo, "MMM d") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={actionDateTo} onSelect={setActionDateTo} initialFocus />
                    </PopoverContent>
                  </Popover>

                  {(actionDateFrom || actionDateTo) && (
                    <Button variant="ghost" size="sm" onClick={clearActionDateFilters}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {selectedActionIds.size > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <CheckSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">{selectedActionIds.size} selected</span>
                    <div className="flex-1" />
                    <Button variant="outline" size="sm" onClick={() => setSelectedActionIds(new Set())}>
                      Clear Selection
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedActionIds.size === filteredActions.length && filteredActions.length > 0}
                      onCheckedChange={toggleAllActions}
                    />
                  </TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredActions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RotateCcw className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No actions recorded yet</p>
                      <p className="text-sm text-muted-foreground">Actions will appear here as events occur</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActions.map((action) => (
                    <TableRow key={action.id} className={action.is_undone ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedActionIds.has(action.id)}
                          onCheckedChange={() => toggleActionSelection(action.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className={actionTypeColors[action.action_type] || "bg-gray-100"}>
                          {action.action_type}
                        </Badge>
                        {action.is_undone && (
                          <Badge variant="outline" className="ml-2">
                            Undone
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{action.entity_type}</span>
                          {action.entity_name && (
                            <span className="text-xs text-muted-foreground">{action.entity_name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate">{action.description}</p>
                        {action.request_id && (
                          <button
                            onClick={() => handleRequestIdClick(action.request_id)}
                            className="text-xs text-primary hover:underline"
                          >
                            {action.request_id.substring(0, 16)}...
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedAction(action)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {action.previous_data && !action.is_undone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUndo(action.id)}
                              disabled={undoing === action.id}
                            >
                              {undoing === action.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Undo2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Infinite scroll loader */}
            <div ref={actionsLoaderRef} className="py-4 text-center">
              {actionsLoadingMore && <Loader2 className="h-6 w-6 animate-spin mx-auto" />}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={logLevelFilter} onValueChange={setLogLevelFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warn</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="fatal">Fatal</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={logSourceFilter} onValueChange={setLogSourceFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="sync">Sync</SelectItem>
                      <SelectItem value="import">Import</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2 bg-transparent">
                        <CalendarIcon className="h-4 w-4" />
                        {logDateFrom ? format(logDateFrom, "MMM d") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={logDateFrom} onSelect={setLogDateFrom} initialFocus />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2 bg-transparent">
                        <CalendarIcon className="h-4 w-4" />
                        {logDateTo ? format(logDateTo, "MMM d") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={logDateTo} onSelect={setLogDateTo} initialFocus />
                    </PopoverContent>
                  </Popover>

                  {(logDateFrom || logDateTo) && (
                    <Button variant="ghost" size="sm" onClick={clearLogDateFilters}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {selectedLogIds.size > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <CheckSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">{selectedLogIds.size} selected</span>
                    <div className="flex-1" />
                    <Button variant="outline" size="sm" onClick={() => setSelectedLogIds(new Set())}>
                      Clear Selection
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedLogIds.size === filteredLogs.length && filteredLogs.length > 0}
                      onCheckedChange={toggleAllLogs}
                    />
                  </TableHead>
                  <TableHead className="w-[80px]">Level</TableHead>
                  <TableHead className="w-[100px]">Source</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[150px]">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Bug className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No logs recorded yet</p>
                      <p className="text-sm text-muted-foreground">Debug logs will appear here as events occur</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <>
                      <TableRow key={log.id} className="cursor-pointer" onClick={() => toggleLogExpanded(log.id)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedLogIds.has(log.id)}
                            onCheckedChange={() => toggleLogSelection(log.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {logLevelIcons[log.level]}
                            <span className={logLevelColors[log.level]}>{log.level}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.source}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {log.metadata &&
                              (expandedLogs.has(log.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              ))}
                            <span className="truncate max-w-[400px]">{log.message}</span>
                          </div>
                          {log.request_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRequestIdClick(log.request_id)
                              }}
                              className="text-xs text-primary hover:underline"
                            >
                              {log.request_id.substring(0, 16)}...
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                        </TableCell>
                      </TableRow>
                      {expandedLogs.has(log.id) && log.metadata && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/50">
                            <pre className="text-xs overflow-x-auto p-2 rounded bg-background">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Infinite scroll loader */}
            <div ref={logsLoaderRef} className="py-4 text-center">
              {logsLoadingMore && <Loader2 className="h-6 w-6 animate-spin mx-auto" />}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Detail Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className={actionTypeColors[selectedAction?.action_type || ""] || ""}>
                {selectedAction?.action_type}
              </Badge>
              {selectedAction?.entity_type} - {selectedAction?.entity_name || selectedAction?.entity_id}
            </DialogTitle>
            <DialogDescription>{selectedAction?.description}</DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p>{format(new Date(selectedAction.created_at), "PPpp")}</p>
                </div>
                {selectedAction.request_id && (
                  <div>
                    <span className="text-muted-foreground">Request ID:</span>
                    <p className="font-mono text-xs">{selectedAction.request_id}</p>
                  </div>
                )}
              </div>

              {selectedAction.previous_data && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">Previous Data</h4>
                  <pre className="text-xs bg-red-50 dark:bg-red-950 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedAction.previous_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAction.new_data && (
                <div>
                  <h4 className="font-medium mb-2 text-green-600">New Data</h4>
                  <pre className="text-xs bg-green-50 dark:bg-green-950 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedAction.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
