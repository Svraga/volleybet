import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "destructive" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap font-bold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    
    // Neo-brutalist interaction: push down and remove shadow on active
    const brutalistInteraction = "border-[3px] border-black shadow-brutal active:translate-x-[4px] active:translate-y-[4px] active:shadow-none hover:-translate-y-[2px] hover:shadow-brutal-lg"
    
    const variants = {
      default: `bg-white text-black ${brutalistInteraction}`,
      primary: `bg-primary text-black ${brutalistInteraction}`,
      secondary: `bg-secondary text-black ${brutalistInteraction}`,
      destructive: `bg-destructive text-white ${brutalistInteraction}`,
      outline: "border-[3px] border-black bg-transparent hover:bg-black hover:text-white",
      ghost: "hover:bg-black/10 text-black",
    }
    
    const sizes = {
      default: "h-12 px-6 py-2 text-base",
      sm: "h-9 px-4 text-sm",
      lg: "h-14 px-8 text-lg",
      icon: "h-12 w-12",
    }

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
