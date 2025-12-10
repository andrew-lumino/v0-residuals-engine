// Script to update all payouts with partner_name from deals.participants_json
// Run with: npx tsx scripts/update-partner-names.ts

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function updatePartnerNames() {
  console.log("Starting partner name update...")

  // Step 1: Get all payouts that are missing partner_name
  console.log("Fetching payouts without partner_name...")
  const { data: payouts, error: payoutsError } = await supabase
    .from("payouts")
    .select("id, mid, partner_airtable_id")
    .is("partner_name", null)

  if (payoutsError) {
    console.error("Error fetching payouts:", payoutsError)
    return
  }

  console.log(`Found ${payouts.length} payouts missing partner_name`)

  if (payouts.length === 0) {
    console.log("All payouts already have partner_name!")
    return
  }

  // Step 2: Get all deals with participants_json
  console.log("Fetching deals with participants...")
  const { data: deals, error: dealsError } = await supabase
    .from("deals")
    .select("mid, participants_json")
    .not("participants_json", "is", null)

  if (dealsError) {
    console.error("Error fetching deals:", dealsError)
    return
  }

  console.log(`Found ${deals.length} deals with participants`)

  // Step 3: Create a lookup map: MID -> { partner_airtable_id -> partner_name }
  const lookupMap = new Map<string, Map<string, string>>()

  for (const deal of deals) {
    if (!deal.participants_json || !Array.isArray(deal.participants_json)) continue

    const partnerMap = new Map<string, string>()
    for (const participant of deal.participants_json) {
      if (participant.partner_airtable_id && participant.partner_name) {
        partnerMap.set(participant.partner_airtable_id, participant.partner_name)
      }
    }

    if (partnerMap.size > 0) {
      lookupMap.set(deal.mid, partnerMap)
    }
  }

  console.log(`Built lookup map for ${lookupMap.size} MIDs`)

  // Step 4: Update each payout
  let updated = 0
  let notFound = 0
  let errors = 0

  for (const payout of payouts) {
    const partnerMap = lookupMap.get(payout.mid)
    if (!partnerMap) {
      notFound++
      continue
    }

    const partnerName = partnerMap.get(payout.partner_airtable_id)
    if (!partnerName) {
      notFound++
      continue
    }

    const { error: updateError } = await supabase
      .from("payouts")
      .update({ partner_name: partnerName })
      .eq("id", payout.id)

    if (updateError) {
      console.error(`Error updating payout ${payout.id}:`, updateError)
      errors++
    } else {
      updated++
      if (updated % 100 === 0) {
        console.log(`Updated ${updated} payouts...`)
      }
    }
  }

  console.log("\n=== COMPLETE ===")
  console.log(`Updated: ${updated}`)
  console.log(`Not found in deals: ${notFound}`)
  console.log(`Errors: ${errors}`)
}

updatePartnerNames().catch(console.error)
