"use client"

import { Button } from "@/components/ui/Button"
import { Copy } from "lucide-react"

export default function CopyInviteButton({ code }: { code: string }) {
  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code)
      alert("Codice copiato negli appunti: " + code)
    }
  }

  return (
    <Button variant="outline" className="mt-2 flex items-center gap-2" onClick={handleCopy}>
      <Copy className="w-4 h-4" />
      <span>Condividi</span>
    </Button>
  )
}
