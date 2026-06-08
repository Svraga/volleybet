export default function LeagueDashboardLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 pb-28 md:pb-12 bg-primary pt-12 relative overflow-hidden">
      
      {/* HEADER SKELETON */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8 gap-4 flex-wrap">
        <div className="h-16 w-64 bg-gray-200 border-[4px] border-black shadow-brutal -rotate-1 animate-brutal-pulse"></div>
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-full bg-gray-200 border-[3px] border-black shadow-brutal animate-brutal-pulse"></div>
          <div className="h-12 w-32 bg-gray-200 border-[3px] border-black shadow-brutal animate-brutal-pulse"></div>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-4xl">
        {/* COIN BOX SKELETON */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="h-16 flex-1 bg-gray-200 border-[4px] border-black shadow-brutal animate-brutal-pulse"></div>
        </div>

        <div className="w-full space-y-8">
          {/* MATCHDAYS BOX SKELETON */}
          <div className="h-48 w-full bg-gray-200 border-[4px] border-black shadow-brutal animate-brutal-pulse"></div>

          {/* TOP 3 BOX SKELETON */}
          <div className="h-64 w-full bg-gray-200 border-[4px] border-black shadow-brutal animate-brutal-pulse"></div>

          {/* INVITE CODE SKELETON */}
          <div className="h-32 w-full bg-gray-200 border-[4px] border-black shadow-brutal animate-brutal-pulse"></div>
        </div>
      </div>
    </main>
  )
}
