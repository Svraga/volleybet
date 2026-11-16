import JoinLeagueForm from "@/components/JoinLeagueForm"

export default async function JoinLeaguePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  const initialCode = typeof code === "string" && /^VOLLEY-[0-9A-F]{32}$/.test(code) ? code : ""
  return <JoinLeagueForm initialCode={initialCode} />
}
