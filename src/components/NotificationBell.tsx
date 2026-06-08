import Link from "next/link"
import { Bell } from "lucide-react"

export default function NotificationBell({ 
  leagueId, 
  notifications 
}: { 
  leagueId: string, 
  notifications: any[] 
}) {
  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <Link 
      href={`/league/${leagueId}/notifications`}
      className="absolute top-4 right-4 z-50 font-bold border-[2px] border-black bg-white shadow-[2px_2px_0_rgba(0,0,0,1)] hover:bg-gray-100 p-2 transition-all flex items-center justify-center"
    >
      <Bell className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black px-1.5 py-0.5 border-[2px] border-black rounded-full animate-bounce">
          {unreadCount}
        </span>
      )}
    </Link>
  )
}
