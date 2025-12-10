/**
 * Normalizes a Merchant ID (MID) for consistent comparison.
 * - Removes whitespace
 * - Removes dashes
 * - Trims input
 *
 * @param mid The raw MID string
 * @returns The normalized MID string
 */
export function normalizeMID(mid: string | null | undefined): string {
  if (!mid) return ""

  // Remove all non-alphanumeric characters (except potentially keeping some if needed, but standard MIDs are usually numeric)
  // For now, let's just trim and remove whitespace/dashes which are common separators
  return mid.toString().trim().replace(/[\s-]/g, "")
}
