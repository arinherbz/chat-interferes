import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex whitespace-nowrap items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.03em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/10 bg-primary/12 text-primary",
        secondary:
          "border-border/70 bg-secondary/92 text-secondary-foreground",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-700",
        outline: "border-border/80 bg-white/92 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
