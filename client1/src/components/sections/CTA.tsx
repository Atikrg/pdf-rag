// SERVER COMPONENT
// Only the DropZone inside is a Client Component (drag state needs JS)
import DropZone from "@/components/ui/DropZone";

export default function CTA() {
  return (
    <section className="relative border-t border-white/[0.07] py-20 px-10 text-center">
      {/* Background glow */}
      <div className="absolute inset-0 bg-cta-glow pointer-events-none" />

      <div className="relative bg-white/[0.03] border border-glass-border rounded-[20px] p-12 max-w-[580px] mx-auto">
        {/* Top rose line accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] border-top-rose rounded-t-[20px]" />

        <h2 className="font-sora font-bold text-[clamp(1.6rem,2.5vw,2rem)] tracking-[-0.04em] text-offwhite mb-3">
          Start chatting with your PDF now
        </h2>
        <p className="text-muted text-[0.9rem] leading-relaxed mb-8">
          No signup required for your first document. Drop it in and start
          asking.
        </p>

        {/* Client component — needs drag/drop state */}
        <DropZone />

        <button className="w-full bg-rose hover:bg-rose-hover text-white font-semibold text-[0.95rem] py-4 rounded-lg transition-all duration-200 hover:-translate-y-px tracking-[-0.01em]">
          ✨ Create free account
        </button>
      </div>
    </section>
  );
}
