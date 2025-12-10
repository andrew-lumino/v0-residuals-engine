import { createServerClient } from "@/lib/db/server"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from("payouts")
      .update({
        partner_split_pct: body.partner_split_pct,
        partner_payout_amount: body.partner_payout_amount,
        paid_status: body.paid_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("[v0] Update payout error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()

    const { error } = await supabase.from("payouts").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete payout error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
