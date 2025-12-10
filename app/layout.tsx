import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import "./globals.css"
import { Sidebar } from "@/components/layout/Sidebar"
import { Toaster } from "@/components/ui/toaster"
import { UnauthorizedPage } from "@/components/auth/unauthorized-page"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Residuals Engine",
  description: "Processing application for merchant residuals",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress
  const isAuthorized = userEmail?.endsWith("@golumino.com")

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`font-sans antialiased flex h-screen overflow-hidden bg-background`}>
          <SignedIn>
            {isAuthorized ? (
              <>
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                  <div className="h-full p-8">{children}</div>
                </main>
              </>
            ) : (
              <UnauthorizedPage email={userEmail} />
            )}
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
          <Toaster />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
