"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Chat", href: "/chat" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-10 py-5 bg-black/85 backdrop-blur-2xl border-b border-glass-border">
      {/* Logo */}
      <Link href="/" className="font-sora font-extrabold text-[1.35rem] tracking-[-0.04em] text-offwhite">
        docu<span className="text-rose">.</span>mind
      </Link>

      {/* Desktop nav links */}
      <ul className="hidden md:flex items-center gap-8">
        {NAV_LINKS.map(({ label, href }) => (
          <li key={label}>
            <Link
              href={href}
              className="text-muted text-sm hover:text-offwhite transition-colors duration-200"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="hidden md:flex items-center gap-6">
        <Link
          href="/login"
          className="text-muted text-sm hover:text-offwhite transition-colors duration-200"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="bg-rose hover:bg-rose-hover text-white text-sm font-semibold px-5 py-2 rounded-md transition-all duration-200 hover:-translate-y-px"
        >
          Get started free
        </Link>
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden text-muted hover:text-offwhite transition-colors"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle menu"
      >
        {menuOpen ? (
          // X icon
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Hamburger
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-black/95 backdrop-blur-2xl border-b border-glass-border px-6 py-4 flex flex-col gap-4 md:hidden">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-muted hover:text-offwhite text-sm transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/login"
            className="w-full text-center text-muted hover:text-offwhite text-sm transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="w-full text-center bg-rose text-white text-sm font-semibold py-2.5 rounded-md mt-2"
            onClick={() => setMenuOpen(false)}
          >
            Get started free
          </Link>
        </div>
      )}
    </nav>
  );
}
