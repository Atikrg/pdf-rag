// SERVER COMPONENT
import Link from "next/link";

const FOOTER_LINKS = ["Privacy", "Terms", "Security", "Status"];

export default function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 px-10 py-7 border-t border-white/[0.06]">
      <div className="font-sora font-extrabold text-[0.95rem] tracking-[-0.03em] text-offwhite">
        docu<span className="text-rose">.</span>mind
      </div>

      <ul className="flex gap-6 flex-wrap">
        {FOOTER_LINKS.map((link) => (
          <li key={link}>
            <Link
              href="#"
              className="text-muted text-[0.78rem] hover:text-silver transition-colors duration-200"
            >
              {link}
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-[0.75rem] text-white/20">© 2026 DocuMind</p>
    </footer>
  );
}
