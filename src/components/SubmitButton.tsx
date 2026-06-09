"use client"

import { useFormStatus } from "react-dom"
import { Button, ButtonProps } from "@/components/ui/Button"
import { Loader2 } from "lucide-react"

interface SubmitButtonProps extends ButtonProps {
  loadingText?: string;
  defaultText: string;
}

export default function SubmitButton({ 
  loadingText = "CARICAMENTO...", 
  defaultText, 
  className,
  ...props 
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button 
      type="submit" 
      disabled={pending || props.disabled} 
      className={`relative ${className || ""}`}
      {...props}
    >
      {pending ? (
        <span className="text-sm md:text-base uppercase font-black tracking-wider flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-brutal-spin mr-2 shrink-0" strokeWidth={3} />
          {loadingText}
        </span>
      ) : (
        defaultText
      )}
    </Button>
  )
}
