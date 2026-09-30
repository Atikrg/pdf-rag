"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api";

const inputClass =
  "w-full bg-white/[0.05] border border-white/10 rounded-lg px-3.5 py-2.5 text-[0.85rem] text-offwhite placeholder:text-muted outline-none focus:border-rose-border transition-colors";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: { email?: string } = {};

    if (!email.trim()) {
      next.email = "Please enter your email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address";
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
      const data = await requestPasswordReset(email.trim());
      setDevResetUrl(data.devResetUrl ?? null);
      setSent(true);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-[1.6rem]">📧</div>
        <p className="text-muted text-[0.88rem] leading-relaxed">
          If an account exists for that email, a reset link is on its way. The
          link expires in one hour.
        </p>

        {devResetUrl && (
          <div className="bg-white/[0.03] border border-amber-400/25 rounded-lg p-3.5">
            <p className="text-[0.75rem] text-amber-300/90 font-semibold mb-1.5">
              Dev mode: no mailer configured
            </p>
            <p className="text-[0.75rem] text-muted leading-relaxed mb-2.5">
              The backend returned the reset link directly because
              <span className="text-offwhite font-mono"> DEV_PASSWORD_RESET</span> is
              enabled. This is exactly what the email would have contained.
            </p>
            <Link
              href={devResetUrl}
              className="text-[0.8rem] text-rose hover:text-rose-hover font-medium break-all transition-colors"
            >
              Open the reset link
            </Link>
          </div>
        )}

        <Link
          href="/login"
          className="w-full bg-rose hover:bg-rose-hover text-white font-semibold text-[0.95rem] py-3.5 rounded-lg transition-all duration-200 hover:-translate-y-px tracking-[-0.01em]"
        >
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[0.8rem] text-muted font-medium"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
          autoComplete="email"
        />
        {errors.email && <p className="text-[0.75rem] text-rose">{errors.email}</p>}
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
        {submitting ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-[0.8rem] text-muted mt-2">
        Remembered it?{" "}
        <Link
          href="/login"
          className="text-rose hover:text-rose-hover font-medium transition-colors"
        >
          Back to log in
        </Link>
      </p>
    </form>
  );
}
