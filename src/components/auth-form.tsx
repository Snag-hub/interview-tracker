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

  return (
    <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm md:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Account</p>
      <h1 className="mt-2 text-2xl font-semibold">
        {isSignIn ? "Sign in to Interview Tracker" : "Create your Interview Tracker account"}
      </h1>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="block text-sm font-medium">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--accent-strong)]">{message}</p> : null}

        <button
          className="w-full rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          {busy ? "Please wait..." : isSignIn ? "Sign in" : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-sm text-black/70">
        {isSignIn ? "Need an account? " : "Already have an account? "}
        <Link className="underline" href={isSignIn ? "/auth/sign-up" : "/auth/sign-in"}>
          {isSignIn ? "Sign up" : "Sign in"}
        </Link>
      </p>
    </section>
  );
}
