import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import { getSessionUser } from "@/lib/auth/session-user";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interview Tracker",
  description: "Personal candidate SaaS for Gmail-based interview tracking",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3 text-sm">
            <div className="flex items-center gap-3">
              <Link className="font-semibold" href="/">
                Interview Tracker
              </Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/calendar">Calendar</Link>
              <Link href="/settings">Settings</Link>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <span className="hidden text-black/65 sm:inline">{user.email}</span>
                  <Link className="underline" href="/auth/sign-out">
                    Sign out
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/sign-in">Sign in</Link>
                  <Link className="underline" href="/auth/sign-up">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}
