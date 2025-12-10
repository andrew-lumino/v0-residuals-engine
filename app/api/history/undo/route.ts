import { undoAction } from "@/lib/utils/history"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { actionId } = await request.json()

    if (!actionId) {
      return NextResponse.json({ error: "actionId is required" }, { status: 400 })
    }

    const result = await undoAction(actionId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Undo error:", err)
    return NextResponse.json({ error: "Failed to undo action" }, { status: 500 })
  }
}
