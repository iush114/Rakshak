import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'outline' | 'success'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: "bg-neonPurple/20 text-neonPurple border-neonPurple/30",
    critical: "bg-danger/20 text-danger border-danger/40 glow-danger font-semibold",
    high: "bg-pinkAccent/20 text-pinkAccent border-pinkAccent/30 font-semibold",
    medium: "bg-warning/20 text-warning border-warning/30",
    low: "bg-neonPurple/20 text-neonPurple border-neonPurple/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    success: "bg-success/20 text-success border-success/30",
    outline: "border border-border text-textSecondary bg-transparent"
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
