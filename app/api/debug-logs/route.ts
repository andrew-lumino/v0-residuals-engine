import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const level = searchParams.get("level")
    const source = searchParams.get("source")
    const requestId = searchParams.get("requestId")
    const limit = Number.parseInt(searchParams.get("limit") || "100")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("debug_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (level) {
      query = query.eq("level", level)
    }

    if (source) {
      query = query.eq("source", source)
    }

    if (requestId) {
      query = query.eq("request_id", requestId)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      logs: data,
      total: count,
      limit,
      offset,
    })
  } catch (err) {
    console.error("[API] Debug logs fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch debug logs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { error } = await supabase.from("debug_logs").insert({
      level: body.level || "info",
      source: body.source || "client",
      message: body.message,
      metadata: body.metadata || null,
      request_id: body.requestId || null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Debug log insert error:", err)
    return NextResponse.json({ error: "Failed to insert debug log" }, { status: 500 })
  }
}
