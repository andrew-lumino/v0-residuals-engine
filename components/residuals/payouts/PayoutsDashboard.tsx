"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { UnassignedQueue } from "@/components/residuals/payouts/UnassignedQueue"
import { ConfirmedDealViewer } from "@/components/residuals/payouts/ConfirmedDealViewer"
import { UploadForm } from "@/components/residuals/upload/UploadForm"
import { Upload, AlertCircle } from "lucide-react"

export function PayoutsDashboard() {
  const [activeTab, setActiveTab] = useState("unassigned")
  const [showUpload, setShowUpload] = useState(false)

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-3">
            <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          </TabsList>

          {activeTab === "unassigned" && (
            <Dialog open={showUpload} onOpenChange={setShowUpload}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Data
                </Button>
              </DialogTrigger>
              <DialogContent style={{ width: "900px", maxWidth: "95vw" }}>
                {/* Reusing UploadForm but making sure it fits in modal */}
                <UploadForm />
              </DialogContent>
            </Dialog>
          )}

          {activeTab === "confirmed" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Legacy Payouts
                </Button>
              </DialogTrigger>
              <DialogContent style={{ width: "900px", maxWidth: "95vw" }}>
                <DialogHeader>
                  <DialogTitle>Import Legacy Payouts</DialogTitle>
                  <DialogDescription>
                    Upload historical payout data. File must match the legacy schema.
                  </DialogDescription>
                </DialogHeader>
                <UploadForm />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <TabsContent value="unassigned" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Needs Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">Events pending review</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Draft Deals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">In progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unassigned Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
                <p className="text-xs text-muted-foreground">Total volume</p>
              </CardContent>
            </Card>
          </div>

          <UnassignedQueue />
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Confirmation</CardTitle>
              <CardDescription>
                Review deals that have been assigned but not yet confirmed for payout generation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium">No Pending Deals</h3>
                <p className="max-w-sm mt-2">
                  When you assign participants to events, they will appear here for final review.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-4">
          <ConfirmedDealViewer />
        </TabsContent>
      </Tabs>
    </div>
  )
}
