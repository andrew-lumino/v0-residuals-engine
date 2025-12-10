"use client"

import { SignOutButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface UnauthorizedPageProps {
  email?: string | null
}

export function UnauthorizedPage({ email }: UnauthorizedPageProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          Only <span className="font-medium text-foreground">@golumino.com</span> email addresses are authorized to
          access this application.
        </p>
        {email && (
          <p className="text-sm text-muted-foreground mb-6">
            You are signed in as <span className="font-medium">{email}</span>
          </p>
        )}
        <SignOutButton>
          <Button variant="outline">Sign out and try another account</Button>
        </SignOutButton>
      </div>
    </div>
  )
}
