import { Badge } from "@/components/ui/badge"
import type { AssignmentStatus, PaidStatus } from "@/lib/types/database"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: AssignmentStatus | PaidStatus | string
  type?: "assignment" | "payment"
  className?: string
}

export function StatusBadge({ status, type = "assignment", className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase()

  if (type === "payment") {
    const styles = {
      unpaid: "bg-red-100 text-red-800 hover:bg-red-100 border-red-200",
      pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200",
      paid: "bg-green-100 text-green-800 hover:bg-green-100 border-green-200",
    }

    return (
      <Badge
        variant="outline"
        className={cn(styles[normalizedStatus as keyof typeof styles] || "bg-gray-100", className)}
      >
        {status}
      </Badge>
    )
  }

  // Assignment status
  const styles = {
    unassigned: "bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200",
    pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 hover:bg-green-100 border-green-200",
  }

  return (
    <Badge
      variant="outline"
      className={cn(styles[normalizedStatus as keyof typeof styles] || "bg-gray-100", className)}
    >
      {status}
    </Badge>
  )
}
