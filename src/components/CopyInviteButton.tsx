"use client"

import { Button } from "@/components/ui/Button"
import { Copy } from "lucide-react"
import { brutalAlert } from "@/store/alertStore"

export default function CopyInviteButton({ code }: { code: string }) {
  const handleCopy = () => {
    const shareUrl = `${window.location.origin}/league/join?code=${code}`
    const shareText = `Unisciti al mio campionato su VolleyBet! Usa il codice: ${code}`

    if (navigator.share) {
      navigator.share({
        title: "VolleyBet - Nuovo Campionato",
        text: shareText,
        url: shareUrl
      }).catch(console.error)
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText + "\n" + shareUrl)
      brutalAlert("Link copiato negli appunti!")
    }
  }

  return (
    <Button variant="outline" className="mt-2 flex items-center gap-2" onClick={handleCopy}>
      <Copy className="w-4 h-4" />
      <span>Condividi</span>
    </Button>
  )
}
