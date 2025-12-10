import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Bypass Clerk auth on localhost for development
const bypassAuthMiddleware = (request: NextRequest) => {
  return NextResponse.next()
}

// Check if running on localhost
const isLocalhost = (request: NextRequest) => {
  const host = request.headers.get("host") || ""
  return host.includes("localhost") || host.includes("127.0.0.1")
}

export default function middleware(request: NextRequest) {
  // Skip Clerk entirely on localhost
  if (isLocalhost(request)) {
    return bypassAuthMiddleware(request)
  }

  // Use Clerk for production
  return clerkMiddleware()(request, {} as any)
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
