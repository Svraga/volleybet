"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { markNotificationsAsRead } from "@/actions/notifications"
import Link from "next/link"

export default function NotificationBell({ 
  leagueId, 
  notifications 
}: { 
  leagueId: string, 
  notifications: any[] 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.isRead).length

  const toggleOpen = async () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)

    if (nextOpen && unreadCount > 0) {
      // Mark as read in DB
      await markNotificationsAsRead(leagueId)
    }
  }

  return (
    <div className="relative">
      <button 
        onClick={toggleOpen}
        className="relative font-bold border-[2px] border-black bg-white shadow-[2px_2px_0_rgba(0,0,0,1)] hover:bg-gray-100 p-2 transition-all flex items-center justify-center"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black px-1.5 py-0.5 border-[2px] border-black rounded-full animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white border-[3px] border-black shadow-brutal z-50 overflow-hidden flex flex-col">
          <div className="bg-gray-100 border-b-[3px] border-black p-3 font-black uppercase text-sm">
            Notifiche
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 font-bold text-sm">
                Nessuna notifica.
              </div>
            ) : (
              <div className="divide-y-[2px] divide-black">
                {notifications.map(n => (
                  <div key={n.id} className={`p-3 text-sm ${!n.isRead ? 'bg-yellow-50' : 'bg-white'}`}>
                    <p className="font-bold">{n.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(n.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href={`/league/${leagueId}/audit`} onClick={() => setIsOpen(false)}>
            <div className="bg-blue-100 hover:bg-blue-200 border-t-[3px] border-black p-3 text-center font-black uppercase text-xs transition-colors">
              Registro Admin Completo →
            </div>
          </Link>
        </div>
      )}

      {/* Invisible overlay to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
