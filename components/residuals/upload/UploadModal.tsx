"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UploadForm } from "./UploadForm"

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function UploadModal({ open, onOpenChange, onSuccess }: UploadModalProps) {
  const handleSuccess = () => {
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" style={{ maxWidth: "1200px", width: "95vw" }}>
        <DialogHeader>
          <DialogTitle>Upload CSV Files</DialogTitle>
          <DialogDescription>Upload monthly revenue data for processing</DialogDescription>
        </DialogHeader>
        <UploadForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  )
}
