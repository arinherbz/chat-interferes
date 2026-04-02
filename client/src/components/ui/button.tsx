import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1rem] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/90 bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(63,121,92,0.16)] hover:bg-primary/95",
        destructive:
          "border border-destructive/85 bg-destructive text-destructive-foreground shadow-[0_10px_18px_rgba(190,49,49,0.12)] hover:bg-destructive/95",
        outline:
          "border [border-color:var(--button-outline)] bg-white/95 text-foreground shadow-[0_8px_18px_rgba(24,38,31,0.04)] hover:bg-secondary/80 active:shadow-none",
        secondary:
          "border border-secondary-border bg-secondary/92 text-secondary-foreground hover:bg-secondary/80",
        ghost: "border border-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // @replit changed sizes
        default: "min-h-10 px-4 py-2.5",
        sm: "min-h-8 rounded-[0.85rem] px-3 text-xs",
        lg: "min-h-11 rounded-[1.05rem] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
