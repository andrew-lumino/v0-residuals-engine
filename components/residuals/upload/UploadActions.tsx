"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Upload, Download, MoreVertical } from "lucide-react"
import { UploadModal } from "./UploadModal"

interface UploadActionsProps {
  onUploadSuccess?: () => void
}

export function UploadActions({ onUploadSuccess }: UploadActionsProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const handleDownloadTemplate = () => {
    const headers = ["Merchant ID", "Merchant Name", "Volume", "Payouts", "Date", "Processing Month"]
    const sampleRow = ["12345", "Sample Merchant LLC", "25000.00", "450.00", "2025-01-15", "2025-01"]

    const csvContent = [
      headers.join(","),
      sampleRow.join(","),
      "", // Empty row for user to fill
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", "residuals_template.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleUploadSuccess = () => {
    onUploadSuccess?.()
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button onClick={() => setUploadModalOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload CSV
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <UploadModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} onSuccess={handleUploadSuccess} />
    </>
  )
}
