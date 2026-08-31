import Link from "next/link";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen bg-black text-offwhite flex flex-col overflow-hidden">
      <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-rose-radial pointer-events-none" />

      <header className="relative flex justify-center items-center py-7">
        <Link
          href="/"
          className="font-sora font-extrabold text-[1.35rem] tracking-[-0.04em] text-offwhite"
        >
          docu<span className="text-rose">.</span>mind
        </Link>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[400px] bg-white/[0.03] border border-glass-border rounded-[20px] p-8">
          <div className="absolute top-0 left-0 right-0 h-[2px] border-top-rose rounded-t-[20px]" />

          <h1 className="font-sora font-bold text-[1.65rem] tracking-[-0.04em] text-offwhite mb-2">
            {title}
          </h1>
          <p className="text-muted text-[0.88rem] leading-relaxed mb-7">{subtitle}</p>

          {children}
        </div>
      </main>

      <footer className="relative text-center text-[0.75rem] text-white/20 pb-8">
        © 2026 DocuMind. All rights reserved.
      </footer>
    </div>
  );
}