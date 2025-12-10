import { createClient } from "@/lib/db/server"
import { type NextRequest, NextResponse } from "next/server"
import type { PaginatedResponse } from "@/lib/types/api"
import type { CsvData } from "@/lib/types/database"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status") || "unassigned"
    const month = searchParams.get("month")
    const search = searchParams.get("search")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const supabase = await createClient()

    let query = supabase.from("csv_data").select("*", { count: "exact" })

    // Apply filters
    if (status !== "all") {
      query = query.eq("assignment_status", status)
    }

    if (month && month !== "all") {
      query = query.eq("payout_month", month)
    }

    if (search) {
      query = query.or(`merchant_name.ilike.%${search}%,mid.ilike.%${search}%`)
    }

    // Apply pagination and sorting
    const { data, count, error } = await query.order("date", { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const response: PaginatedResponse<CsvData> = {
      success: true,
      data: (data as CsvData[]) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
