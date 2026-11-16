import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/Providers";
import GlobalFooter from "@/components/GlobalFooter";
import BrutalAlertProvider from "@/components/BrutalAlertProvider";
import "./globals.css";
import { connection } from "next/server";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VolleyBet",
  description: "Mobile-first volleyball betting application",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection(); // Per-request CSP nonces must not be statically cached.
  return (
    <html
      lang="it"
      className={`${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <GlobalFooter />
        <BrutalAlertProvider />
      </body>
    </html>
  );
}
