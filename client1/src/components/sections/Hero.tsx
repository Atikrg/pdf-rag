// SERVER COMPONENT
import PdfCardStack from "@/components/ui/PdfCardStack";

const STATS = [
  { num: "10M", suffix: "+", label: "Documents analyzed" },
  { num: "2.4", suffix: "s", label: "Avg response time" },
  { num: "99", suffix: "%", label: "Accuracy rate" },
];

export default function Hero() {
  return (
    <section className="relative grid grid-cols-1 md:grid-cols-2 items-center gap-12 max-w-[1160px] mx-auto px-10 pt-24 pb-20">
      {/* Radial rose glow behind visual */}
      <div className="absolute top-0 right-[-100px] w-[600px] h-[600px] bg-rose-radial pointer-events-none" />

      {/* ── LEFT: Copy ── */}
      <div className="relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-rose-border rounded-full px-4 py-1.5 text-[0.75rem] font-semibold text-rose tracking-[0.08em] uppercase mb-6 bg-rose-dim">
          <span className="w-1.5 h-1.5 rounded-full bg-rose animate-blink" />
          AI document intelligence
        </div>

        {/* Title */}
        <h1 className="font-sora font-extrabold text-[clamp(2.5rem,4.5vw,3.8rem)] leading-[1.05] tracking-[-0.045em] text-offwhite mb-5">
          Ask anything.
          <br />
          <span className="font-light text-silver">Your PDF</span>
          <br />
          <span className="text-rose">answers back.</span>
        </h1>

        {/* Subtext */}
        <p className="text-muted text-base font-light leading-[1.7] mb-9 max-w-[420px]">
          Upload any PDF and have a real conversation with it. Contracts,
          research papers, reports — no more scrolling, no more guessing.
        </p>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3.5 items-center">
          <button className="bg-rose hover:bg-rose-hover text-white text-[0.9rem] font-semibold px-7 py-3.5 rounded-lg transition-all duration-200 hover:-translate-y-px tracking-[-0.01em]">
            Upload your PDF
          </button>
          <button className="border border-glass-border text-silver text-[0.9rem] px-6 py-3.5 rounded-lg transition-all duration-200 hover:border-silver hover:text-offwhite hover:bg-white/[0.04]">
            Watch demo
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-8 mt-12 pt-8 border-t border-white/[0.08]">
          {STATS.map(({ num, suffix, label }) => (
            <div key={label}>
              <div className="font-sora font-bold text-[1.6rem] text-offwhite tracking-[-0.04em] leading-none">
                {num}
                <span className="text-rose">{suffix}</span>
              </div>
              <div className="text-muted text-[0.75rem] mt-1 tracking-[0.02em]">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: PDF Card Visual ── */}
      <div className="hidden md:flex justify-center items-center relative z-10">
        <PdfCardStack />
      </div>
    </section>
  );
}
