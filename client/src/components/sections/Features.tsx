// SERVER COMPONENT
const FEATURES = [
  {
    icon: "🧠",
    title: "Semantic understanding",
    desc: "Goes beyond keyword search. Understands context, inference, and the intent behind your questions.",
  },
  {
    icon: "💬",
    title: "Multi-turn conversations",
    desc: "Ask follow-ups naturally. Context is carried across your entire session with the document.",
  },
  {
    icon: "🔍",
    title: "Exact page citations",
    desc: "Every answer comes with page references and extracted excerpts. No hallucinations.",
  },
  {
    icon: "⚡",
    title: "Instant summaries",
    desc: "Full executive summary in seconds. Then drill into any section with a single question.",
  },
  {
    icon: "🔒",
    title: "End-to-end encrypted",
    desc: "Your files are encrypted at rest and in transit. Never used for training. Deleted on request.",
  },
  {
    icon: "📚",
    title: "Multi-document mode",
    desc: "Upload multiple PDFs and ask questions that span across all of them at once.",
  },
];

export default function Features() {
  return (
    <section id="features" className="border-t border-white/[0.07] py-20">
      <div className="max-w-[1160px] mx-auto px-10">
        {/* Section header */}
        <p className="text-[0.72rem] font-semibold text-rose uppercase tracking-[0.12em] text-center mb-2">
          Features
        </p>
        <h2 className="font-sora font-bold text-[clamp(1.8rem,3vw,2.4rem)] tracking-[-0.04em] text-offwhite text-center mb-2">
          Built for deep document work
        </h2>
        <p className="text-muted text-[0.9rem] text-center max-w-[440px] mx-auto leading-[1.7] mb-12">
          Everything you need to extract meaning from dense PDFs — without
          reading them end to end.
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="group bg-glass-bg border border-glass-border rounded-2xl p-6 transition-all duration-300 hover:border-rose-border hover:bg-[rgba(203,41,87,0.05)]"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-rose-dim border border-rose-border rounded-xl text-lg mb-4">
                {icon}
              </div>
              <h3 className="font-sora font-semibold text-[0.95rem] text-offwhite tracking-[-0.02em] mb-2">
                {title}
              </h3>
              <p className="text-muted text-[0.83rem] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
