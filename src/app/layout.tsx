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
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interview Tracker | Professional Career Assistant",
  description: "Personal candidate SaaS for Gmail-based interview tracking and career organization",
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
      <body className="min-h-full flex flex-col selection:bg-[var(--accent)] selection:text-white">
        <header className="sticky top-0 z-[100] border-b border-[var(--border)]/40 bg-[var(--surface)]/80 backdrop-blur-xl">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-8">
              <Link className="flex items-center gap-2 group" href="/">
                <div className="h-8 w-8 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center shadow-lg shadow-[var(--accent)]/20 group-hover:scale-110 transition-transform">
                   <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                </div>
                <span className="font-extrabold tracking-tight text-lg hidden sm:inline">Interview<span className="text-[var(--accent)]">Tracker</span></span>
              </Link>
              
              {user && (
                <div className="hidden md:flex items-center gap-1">
                  {[
                    { label: "Dashboard", href: "/dashboard" },
                    { label: "Calendar", href: "/calendar" },
                    { label: "Settings", href: "/settings" },
                  ].map((item) => (
                    <Link 
                      key={item.href} 
                      href={item.href}
                      className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-black/40 hover:text-[var(--accent)] transition-colors rounded-full hover:bg-[var(--accent)]/5"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <div className="hidden lg:flex flex-col items-end mr-2">
                     <span className="text-[10px] font-bold uppercase tracking-wider text-black/30">Candidate</span>
                     <span className="text-xs font-bold text-black/60 truncate max-w-[150px]">{user.email}</span>
                  </div>
                  <form action="/auth/sign-out" method="post">
                    <button
                      className="rounded-full bg-slate-100 px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all border border-slate-200"
                      type="submit"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link className="text-xs font-bold uppercase tracking-widest text-black/40 hover:text-black/60 transition-colors" href="/auth/sign-in">Sign in</Link>
                  <Link 
                    className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-[var(--accent)]/20 hover:bg-[var(--accent-strong)] transition-all" 
                    href="/auth/sign-up"
                  >
                    Join Now
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        <div className="flex-1 flex flex-col">
          {children}
        </div>

        <footer className="border-t border-[var(--border)]/30 bg-[var(--surface)] py-12 px-6">
           <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-2 opacity-40 grayscale">
                <div className="h-6 w-6 rounded-lg bg-black text-white flex items-center justify-center">
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                </div>
                <span className="font-bold tracking-tight text-sm">InterviewTracker</span>
              </div>
              <div className="flex gap-8">
                 <Link href="/dashboard" className="text-xs font-bold text-black/30 hover:text-[var(--accent)] uppercase tracking-widest transition-colors">Dashboard</Link>
                 <Link href="/calendar" className="text-xs font-bold text-black/30 hover:text-[var(--accent)] uppercase tracking-widest transition-colors">Calendar</Link>
                 <Link href="/settings" className="text-xs font-bold text-black/30 hover:text-[var(--accent)] uppercase tracking-widest transition-colors">Settings</Link>
              </div>
              <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">© 2026 Professional Career Assistant</p>
           </div>
        </footer>
      </body>
    </html>
  );
}
