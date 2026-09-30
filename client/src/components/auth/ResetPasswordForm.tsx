"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";

const inputClass =
  "w-full bg-white/[0.05] border border-white/10 rounded-lg px-3.5 py-2.5 text-[0.85rem] text-offwhite placeholder:text-muted outline-none focus:border-rose-border transition-colors";

type FormErrors = {
  password?: string;
  confirm?: string;
};

function ResetPasswordFormInner() {
  // The token arrives in the query string, matching how the Google OAuth
  // callback is already read in LoginForm.
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!password) {
      next.password = "Please enter a new password";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters";
    }

    if (!confirm) {
      next.confirm = "Please confirm your new password";
    } else if (confirm !== password) {
      next.confirm = "Passwords do not match";
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
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Reached by opening /reset-password directly, or after a token expired.
  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-[1.6rem]">🔗</div>
        <p className="text-muted text-[0.88rem] leading-relaxed">
          This page needs a reset link. Open the link from your email, or
          request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="w-full bg-rose hover:bg-rose-hover text-white font-semibold text-[0.95rem] py-3.5 rounded-lg transition-all duration-200 hover:-translate-y-px tracking-[-0.01em]"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center py-2">
          <div className="text-[2.5rem] mb-3">🔐</div>
          <h2 className="font-sora font-bold text-[1.4rem] tracking-[-0.04em] text-offwhite mb-2">
            Password updated
          </h2>
          <p className="text-muted text-[0.9rem] leading-relaxed mb-6">
            Sign in with your new password.
          </p>
        </div>
        <Link
          href="/login"
          className="w-full bg-rose hover:bg-rose-hover text-white font-semibold text-[0.95rem] py-4 rounded-lg transition-all duration-200 hover:-translate-y-px tracking-[-0.01em]"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[0.8rem] text-muted font-medium"
        >
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={`${inputClass} pr-11`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-offwhite transition-colors"
          >
            {showPassword ? (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.543 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-[0.75rem] text-rose">{errors.password}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirm"
          className="text-[0.8rem] text-muted font-medium"
        >
          Confirm new password
        </label>
        <input
          id="confirm"
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your new password"
          className={inputClass}
          autoComplete="new-password"
        />
        {errors.confirm && (
          <p className="text-[0.75rem] text-rose">{errors.confirm}</p>
        )}
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
        {submitting ? "Updating…" : "Set new password"}
      </button>

      <p className="text-center text-[0.8rem] text-muted mt-2">
        Link expired?{" "}
        <Link
          href="/forgot-password"
          className="text-rose hover:text-rose-hover font-medium transition-colors"
        >
          Request a new one
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordForm() {
  // useSearchParams requires a Suspense boundary, the same reason LoginForm
  // wraps its inner component.
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}
