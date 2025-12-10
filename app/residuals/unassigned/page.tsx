"use client"

import { UnassignedQueue } from "@/components/residuals/payouts/UnassignedQueue"
import { UploadActions } from "@/components/residuals/upload/UploadActions"
import { useRef } from "react"

export default function UnassignedEventsPage() {
  const queueRef = useRef<{ refresh: () => void }>(null)

  const handleUploadSuccess = () => {
    // Refresh the unassigned queue after successful upload
    queueRef.current?.refresh()
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unassigned Events</h1>
          <p className="text-muted-foreground mt-2">Review and assign revenue events to participants</p>
        </div>
        <UploadActions onUploadSuccess={handleUploadSuccess} />
      </div>

      <UnassignedQueue ref={queueRef} />
    </div>
  )
}
