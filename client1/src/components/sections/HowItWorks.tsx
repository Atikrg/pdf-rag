// SERVER COMPONENT
const STEPS = [
  {
    num: "01",
    title: "Upload your PDF",
    desc: "Drag and drop any PDF — research papers, contracts, financial reports, or textbooks up to 500 pages.",
  },
  {
    num: "02",
    title: "AI reads and indexes it",
    desc: "The document is parsed and embedded into a vector store for precise, fast retrieval in seconds.",
  },
  {
    num: "03",
    title: "Ask anything",
    desc: "Chat naturally. Summaries, comparisons, key clauses, data extraction — whatever you need.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-white/[0.07] py-20">
      <div className="max-w-[1160px] mx-auto px-10">
        {/* Section header */}
        <p className="text-[0.72rem] font-semibold text-rose uppercase tracking-[0.12em] text-center mb-2">
          How it works
        </p>
        <h2 className="font-sora font-bold text-[clamp(1.8rem,3vw,2.4rem)] tracking-[-0.04em] text-offwhite text-center mb-2">
          Three steps. That&apos;s it.
        </h2>
        <p className="text-muted text-[0.9rem] text-center leading-[1.7] mb-12">
          From upload to insight in under 30 seconds.
        </p>

        {/* Steps — relative for connector line */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-7 left-[18%] right-[18%] h-px connector-line" />

          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="flex flex-col items-center text-center relative">
              {/* Step number circle */}
              <div className="relative z-10 w-14 h-14 flex items-center justify-center rounded-full border border-rose-border bg-rose-dim font-sora font-bold text-[1.1rem] text-rose mb-4">
                {num}
              </div>
              <h3 className="font-sora font-semibold text-[0.95rem] text-offwhite mb-2">
                {title}
              </h3>
              <p className="text-muted text-[0.83rem] leading-relaxed max-w-[240px]">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
