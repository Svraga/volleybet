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
      {pending && (
        <Loader2 className="w-5 h-5 animate-brutal-spin mr-2" strokeWidth={3} />
      )}
      {pending ? loadingText : defaultText}
    </Button>
  )
}
