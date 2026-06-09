import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import UpdateNicknameForm from "@/components/UpdateNicknameForm"

export default async function WelcomePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!user) redirect("/")

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-primary">
      <Card className="w-full max-w-md bg-white border-[4px] border-black shadow-brutal">
        <CardHeader className="text-center bg-secondary border-b-[3px] border-black">
          <CardTitle className="text-3xl uppercase font-black tracking-widest text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
            Benvenuto!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-8">
          <p className="font-bold text-lg text-center text-gray-700">
            Prima di iniziare, scegli un Nickname con cui farti riconoscere nella tua Lega!
          </p>
          <div className="bg-yellow-100 border-[3px] border-black p-4 -rotate-1 shadow-brutal-sm">
            <UpdateNicknameForm defaultName={user.name || ""} redirectTo="/" />
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
