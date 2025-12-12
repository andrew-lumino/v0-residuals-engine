/**
 * Normalize participant data to use consistent field naming
 * Handles both old format (partner_id, partner_name) and new format (partner_airtable_id, etc.)
 */

export interface NormalizedParticipant {
  partner_airtable_id: string
  partner_name: string
  partner_role: string
  split_pct: number
  name?: string
  role?: string
}

export interface RawParticipant {
  partner_id?: string
  partner_airtable_id?: string
  partner_name?: string
  name?: string
  partner_role?: string
  role?: string
  split_pct?: number
  split?: number
}

/**
 * Normalizes an array of participants to use consistent field naming
 * Maps various input formats to a standardized structure
 */
export function normalizeParticipants(rawParticipants: RawParticipant[]): NormalizedParticipant[] {
  return rawParticipants.map((p) => normalizeParticipant(p))
}

/**
 * Normalizes a single participant to use consistent field naming
 */
export function normalizeParticipant(p: RawParticipant | Record<string, unknown>): NormalizedParticipant {
  return {
    partner_airtable_id: (p.partner_airtable_id as string) || (p.partner_id as string) || "",
    partner_name: (p.partner_name as string) || (p.name as string) || "",
    partner_role: (p.partner_role as string) || (p.role as string) || "Partner",
    split_pct: (p.split_pct as number) ?? (p.split as number) ?? 0,
    // Keep legacy fields for backwards compatibility
    name: (p.partner_name as string) || (p.name as string) || "",
    role: (p.partner_role as string) || (p.role as string) || "Partner",
  }
}

