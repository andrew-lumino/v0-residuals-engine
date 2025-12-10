import { formatCurrency } from "@/lib/utils/formatters"
import { cn } from "@/lib/utils"

interface MoneyDisplayProps {
  amount: number | null | undefined
  className?: string
  showZero?: boolean
}

export function MoneyDisplay({ amount, className, showZero = true }: MoneyDisplayProps) {
  if ((amount === 0 || amount === null || amount === undefined) && !showZero) {
    return <span className={cn("text-muted-foreground", className)}>-</span>
  }

  const value = amount || 0
  const isNegative = value < 0

  return (
    <span className={cn("font-mono tabular-nums", isNegative && "text-red-600", className)}>
      {formatCurrency(value)}
    </span>
  )
}
