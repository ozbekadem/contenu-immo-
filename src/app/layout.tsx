import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Studio Photo Immobilier IA",
  description: "Améliorez jusqu'à 10 photos immobilières simultanément.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-studio-black bg-studio-black text-studio-white">
          <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-5 py-3">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="grid h-8 w-8 place-items-center rounded bg-studio-yellow text-sm font-black text-studio-black">
                IV
              </span>
              <span className="text-sm font-semibold tracking-wide">
                STUDIO PHOTO <span className="text-studio-yellow">IMMOBILIER IA</span>
              </span>
            </Link>
            <Link href="/" className="ml-auto text-xs font-medium text-studio-gray-200/80 hover:text-studio-yellow">
              Tous les projets
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
