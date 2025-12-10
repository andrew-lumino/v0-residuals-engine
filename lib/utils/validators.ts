import type { PayoutType } from "@/lib/types/database"

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPayoutType(type: string): type is PayoutType {
  const validTypes: PayoutType[] = ["residual", "upfront", "trueup", "bonus", "clawback", "adjustment"]
  return validTypes.includes(type as PayoutType)
}

export function validateSplitTotal(splits: number[]): boolean {
  const total = splits.reduce((sum, split) => sum + split, 0)
  // Allow small floating point errors, but generally should be 100
  // Also allow non-100 for specific business cases if documented,
  // but usually 80-105% is the warning range as per prompt
  return total >= 99.9 && total <= 100.1
}
