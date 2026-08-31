"use client";

import { useState } from "react";
import Link from "next/link";
import { login as apiLogin } from "@/lib/api";
import { useAuth } from "@/components/chat/hooks/useAuth";

type FormErrors = {
  email?: string;
  password?: string;
};

export default function LoginForm() {
  const { login: setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!email.trim()) {
      next.email = "Please enter your email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address";
    }

    if (!password) {
      next.password = "Please enter your password";
    }

    setErrors(next);
    setServerError(null);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const data = await apiLogin(email.trim(), password);
      setSession(data.token, data.user);
      setLoggedIn(true);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loggedIn) {
    return (
      <div className="text-center py-4">
        <div className="text-[2.5rem] mb-3">🎉</div>
        <h2 className="font-sora font-bold text-[1.4rem] tracking-[-0.04em] text-offwhite mb-2">
          Welcome back
        </h2>
        <p className="text-muted text-[0.9rem] leading-relaxed mb-7">
          You&apos;re all set to chat with your documents.
        </p>
        <Link
          href="/chat"
          className="inline-block w-full bg-rose hover:bg-rose-hover text-white font-semibold text-[0.95rem] py-4 rounded-lg transition-all duration-200 hover:-translate-y-px tracking-[-0.01em]"
        >
          Open workspace
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[0.8rem] text-muted font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3.5 py-2.5 text-[0.85rem] text-offwhite placeholder:text-muted outline-none focus:border-rose-border transition-colors"
        />
        {errors.email && <p className="text-[0.75rem] text-rose">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-[0.8rem] text-muted font-medium">
            Password
          </label>
          <Link
            href="/signup"
            className="text-[0.75rem] text-rose hover:text-rose-hover transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3.5 py-2.5 pr-11 text-[0.85rem] text-offwhite placeholder:text-muted outline-none focus:border-rose-border transition-colors"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-offwhite transition-colors"
          >
            {showPassword ? (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && <p className="text-[0.75rem] text-rose">{errors.password}</p>}
      </div>

      {serverError && (
        <p className="text-[0.8rem] text-rose bg-rose/10 border border-rose/20 rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-rose hover:bg-rose-hover disabled:opacity-60 text-white font-semibold text-[0.95rem] py-3.5 rounded-lg transition-all duration-200 hover:-translate-y-px tracking-[-0.01em] mt-1"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>

      <p className="text-center text-[0.8rem] text-muted mt-2">
        New to DocuMind?{" "}
        <Link href="/signup" className="text-rose hover:text-rose-hover font-medium transition-colors">
          Create an account
        </Link>
      </p>
    </form>
  );
}