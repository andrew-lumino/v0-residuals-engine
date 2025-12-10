import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")
    const actionType = searchParams.get("actionType")
    const requestId = searchParams.get("requestId")
    const search = searchParams.get("search")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const page = Number.parseInt(searchParams.get("page") || "0")
    const includeUndone = searchParams.get("includeUndone") === "true"

    // Calculate offset from page if provided
    const effectiveOffset = page > 0 ? (page - 1) * limit : offset

    let query = supabase
      .from("action_history")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(effectiveOffset, effectiveOffset + limit - 1)

    if (entityType) {
      query = query.eq("entity_type", entityType)
    }

    if (entityId) {
      query = query.eq("entity_id", entityId)
    }

    if (actionType) {
      query = query.eq("action_type", actionType)
    }

    if (requestId) {
      query = query.eq("request_id", requestId)
    }

    if (!includeUndone) {
      query = query.eq("is_undone", false)
    }

    if (search) {
      query = query.or(`description.ilike.%${search}%,new_data::text.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      actions: data,
      data,
      total: count,
      limit,
      offset: effectiveOffset,
      hasMore: effectiveOffset + limit < (count || 0),
    })
  } catch (err) {
    console.error("[API] History fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { action_type, entity_type, entity_id, entity_name, previous_data, new_data, description, request_id } = body

    // Validate required fields
    if (!action_type || !entity_type || !entity_id) {
      return NextResponse.json(
        { error: "Missing required fields: action_type, entity_type, entity_id" },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from("action_history")
      .insert({
        action_type,
        entity_type,
        entity_id,
        entity_name: entity_name || null,
        previous_data: previous_data || null,
        new_data: new_data || null,
        description: description || null,
        request_id: request_id || null,
        is_undone: false,
      })
      .select()
      .single()

    if (error) {
      console.error("[API] History insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: data,
    })
  } catch (err) {
    console.error("[API] History POST error:", err)
    return NextResponse.json({ error: "Failed to create history entry" }, { status: 500 })
  }
}
