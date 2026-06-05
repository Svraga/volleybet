"use client"

import { signIn, signOut } from "next-auth/react"
import { Button } from "./ui/Button"
import { useState } from "react"
import { Input } from "./ui/Input"

export function LoginButton() {
  const [name, setName] = useState("")

  const handleLogin = () => {
    if (name.trim()) {
      signIn("credentials", { name, callbackUrl: "/" })
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
      />
      <Button variant="primary" onClick={handleLogin} className="w-full text-lg h-14">
        Accedi con Mock Auth
      </Button>
      
      <div className="relative flex items-center py-4">
        <div className="flex-grow border-t-[3px] border-black"></div>
        <span className="flex-shrink-0 mx-4 text-black font-bold">OPPURE</span>
        <div className="flex-grow border-t-[3px] border-black"></div>
      </div>
      
      <Button variant="default" onClick={() => signIn("google", { callbackUrl: "/" })} className="w-full text-lg h-14">
        Accedi con Google
      </Button>
    </div>
  )
}

export function LogoutButton() {
  return (
    <Button variant="destructive" onClick={() => signOut({ callbackUrl: "/" })}>
      Esci
    </Button>
  )
}
