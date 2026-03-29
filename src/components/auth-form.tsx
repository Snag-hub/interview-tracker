"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { hasPublicSupabaseConfig } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type Mode = "sign-in" | "sign-up";

type AuthFormProps = {
  mode: Mode;
  nextPath?: string;
};

export function AuthForm({ mode, nextPath = "/dashboard" }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isSignIn = mode === "sign-in";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasPublicSupabaseConfig()) {
      setError("Supabase auth is not configured. Add environment variables from .env.example.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();

    if (isSignIn) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setBusy(false);
      return;
    }

    if (data.session) {
      router.replace(nextPath);
      router.refresh();
      return;
    }

    setMessage("Signup successful. Check your email to confirm your account before signing in.");
    setBusy(false);
  }

  async function handleGoogleSignIn() {
    if (!hasPublicSupabaseConfig()) {
      setError("Supabase auth is not configured.");
      return;
    }

    setBusy(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl shadow-black/5 md:p-12">
      <div className="flex flex-col items-center text-center mb-10">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--accent)]/10 text-[var(--accent)]">
           <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
           </svg>
        </div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--accent)]">Secure Access</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {isSignIn ? "Welcome Back" : "Get Started"}
        </h1>
        <p className="mt-2 text-sm font-medium text-black/40">
          {isSignIn ? "Enter your credentials to access your dashboard" : "Join Interview Tracker and start landing offers"}
        </p>
      </div>

      <div className="space-y-4">
        <button
          className="flex w-full items-center justify-center gap-3 rounded-full border border-[var(--border)] bg-white py-3 text-sm font-bold text-black/70 shadow-sm transition-all hover:bg-slate-50 hover:shadow active:scale-[0.98] disabled:opacity-60"
          type="button"
          disabled={busy}
          onClick={handleGoogleSignIn}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-4 py-2">
          <div className="h-px flex-1 bg-[var(--border)]/40"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-black/20">or</span>
          <div className="h-px flex-1 bg-[var(--border)]/40"></div>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Email Address</span>
          <input
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Password</span>
          <input
            className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-2 text-[11px] font-bold text-rose-700 italic">
            {error}
          </div>
        )}
        
        {message && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2 text-[11px] font-bold text-emerald-700 italic">
            {message}
          </div>
        )}

        <button
          className="mt-4 w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-strong)] hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              Authenticating...
            </span>
          ) : (
            isSignIn ? "Sign In to Account" : "Create My Account"
          )}
        </button>
      </form>

      <div className="mt-10 border-t border-[var(--border)]/40 pt-8 text-center">
        <p className="text-sm font-medium text-black/40">
          {isSignIn ? "Don't have an account yet?" : "Already a member?"}
          <Link 
            className="ml-1.5 font-bold text-[var(--accent)] hover:underline" 
            href={isSignIn ? "/auth/sign-up" : "/auth/sign-in"}
          >
            {isSignIn ? "Create one now" : "Sign in here"}
          </Link>
        </p>
      </div>
    </section>
  );
}
