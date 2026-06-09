"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Trophy, User } from "lucide-react"

export default function BottomNav({ leagueId, adminEmail }: { leagueId?: string, adminEmail?: string }) {
  const pathname = usePathname()

  const navItems = [
    { name: "Dashboard", path: leagueId ? `/league/${leagueId}` : "/", icon: <Home className="w-6 h-6 mb-1 md:hidden" /> },
    ...(leagueId ? [{ name: "Classifica", path: `/league/${leagueId}/stats`, icon: <Trophy className="w-6 h-6 mb-1 md:hidden" /> }] : []),
    { name: "Profilo", path: "/profile", icon: <User className="w-6 h-6 mb-1 md:hidden" /> },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-[3px] border-black shadow-[0_-3px_0_rgba(0,0,0,1)] flex items-center h-16 md:relative md:border-t-0 md:border-b-[3px] md:shadow-brutal md:mb-8 md:bg-secondary w-full">
      {navItems.map(item => {
        const isActive = pathname === item.path
        return (
          <Link key={item.name} id={item.name === "Classifica" ? "tour-stats" : undefined} href={item.path} className={`flex flex-col items-center justify-center flex-1 h-full font-bold ${isActive ? 'bg-primary border-x-[3px] border-black md:border-x-0' : 'hover:bg-gray-100 transition-colors'}`}>
            {item.icon}
            <span className={`text-xs md:text-lg md:uppercase ${isActive ? 'md:bg-white md:px-3 md:py-1 md:border-[2px] md:border-black md:shadow-brutal-sm md:-rotate-1' : ''}`}>{item.name}</span>
          </Link>
        )
      })}
      
    </div>
  )
}
