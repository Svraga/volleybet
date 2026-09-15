"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { joinLeague } from "@/actions/league"
import Link from "next/link"
import { useActionState } from "react"

export default function JoinLeaguePage() {
  const [state, formAction, isPending] = useActionState(joinLeague, { error: null } as any)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-secondary">
      <div className="absolute top-6 left-6">
        <Link href="/">
          <Button variant="outline" className="bg-white">Indietro</Button>
        </Link>
      </div>

      <Card className="w-full max-w-md bg-white">
        <form action={formAction}>
          <CardHeader>
            <CardTitle className="text-center text-3xl uppercase">Unisciti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 text-center">
              <label className="font-bold text-lg">Codice Invito</label>
              <Input 
                name="inviteCode" 
                placeholder="es. VOLLEY-ABCD1234" 
                required 
                className="text-center text-xl uppercase font-mono tracking-widest"
              />
              {state?.error && (
                <p className="text-red-600 font-bold mt-2 bg-red-100 border-[2px] border-red-600 p-2">
                  {state.error}
                </p>
              )}
            </div>

            <Button type="submit" variant="primary" disabled={isPending} className="w-full text-xl h-14">
              {isPending ? "Accesso..." : "Entra nel Campionato"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </main>
  )
}
