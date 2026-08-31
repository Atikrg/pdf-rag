"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login as apiLogin, type User } from "@/lib/api";
import { useAuth } from "@/components/chat/hooks/useAuth";

type FormErrors = {
  email?: string;
  password?: string;
};

function GoogleIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function LoginFormInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login: setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Handle the Google OAuth callback: the backend redirects here with the JWT
  // and user payload in the query string. Persist the session (external system
  // write) and navigate to the workspace.
  const handledOAuthRef = useRef(false);
  useEffect(() => {
    const token = searchParams?.get("token");
    const userRaw = searchParams?.get("user");
    if (!token || handledOAuthRef.current) return;
    handledOAuthRef.current = true;
    try {
      const user: User = userRaw ? JSON.parse(decodeURIComponent(userRaw)) : null;
      if (user) {
        setSession(token, user);
        router.replace("/chat");
      }
    } catch {
      router.replace("/login?error=1");
    }
  }, [searchParams, router, setSession]);

  const oauthError = searchParams?.get("error");

  const googleLogin = () => {
    setServerError(null);
    window.location.href = "/api/auth/google";
  };

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
      <button
        type="button"
        onClick={googleLogin}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 disabled:opacity-60 text-offwhite font-medium text-[0.9rem] py-3 rounded-lg transition-all duration-200"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {oauthError && (
        <p className="text-[0.8rem] text-rose bg-rose/10 border border-rose/20 rounded-lg px-3 py-2">
          Google login failed. Please try again.
        </p>
      )}

      <div className="flex items-center gap-3 my-1">
        <span className="flex-1 h-px bg-white/10" />
        <span className="text-[0.7rem] text-muted">or</span>
        <span className="flex-1 h-px bg-white/10" />
      </div>

      {serverError && (
        <p className="text-[0.8rem] text-rose bg-rose/10 border border-rose/20 rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}

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

export default function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}