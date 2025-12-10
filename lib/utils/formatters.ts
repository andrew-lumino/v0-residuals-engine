export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$0.00"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0%"
  return `${value}%`
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatMonth(dateString: string | null | undefined): string {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  })
}

export function formatPayoutMonth(month: string | null | undefined): string {
  if (!month) return "-"
  // Handle "YYYY-MM" format
  const [year, monthNum] = month.split("-")
  if (!year || !monthNum) return month
  const date = new Date(Number.parseInt(year), Number.parseInt(monthNum) - 1)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  })
}

export function formatVolume(volume: number | null | undefined): string {
  if (volume === null || volume === undefined) return "$0.00"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(volume)
}
