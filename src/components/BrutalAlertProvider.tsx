"use client"
import { useAlertStore } from "@/store/alertStore"
import { Button } from "./ui/Button"

export default function BrutalAlertProvider() {
  const { isOpen, message, closeAlert } = useAlertStore()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border-[4px] border-black shadow-[8px_8px_0_rgba(0,0,0,1)] max-w-sm w-full p-6 space-y-6 animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-black uppercase border-b-[3px] border-black pb-2 -rotate-2 inline-block bg-yellow-300 px-3">VolleyBet Dice</h3>
        <p className="text-lg font-bold text-gray-800">{message}</p>
        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={closeAlert} className="w-full text-xl h-14 uppercase font-black tracking-wider">
            OK
          </Button>
        </div>
      </div>
    </div>
  )
}
