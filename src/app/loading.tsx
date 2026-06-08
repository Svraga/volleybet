import { Loader2 } from "lucide-react"

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="border-[4px] border-black bg-yellow-300 shadow-brutal p-6 flex flex-col items-center gap-4 -rotate-2">
        <Loader2 className="w-16 h-16 animate-brutal-spin text-black" strokeWidth={3} />
        <h2 className="text-2xl font-black uppercase tracking-widest">Caricamento</h2>
      </div>
    </div>
  )
}
