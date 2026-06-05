import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VolleyBet",
  description: "Mobile-first volleyball betting application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
