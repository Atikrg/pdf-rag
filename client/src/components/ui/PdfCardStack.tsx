// SERVER COMPONENT — animations are CSS-only, no JS needed
export default function PdfCardStack() {
  return (
    <div className="relative w-[300px] h-[360px]">
      {/* Back card */}
      <div className="absolute w-[260px] h-[300px] top-[30px] left-[30px] rounded-2xl bg-[rgba(203,41,87,0.08)] border border-rose-border rotate-[3deg] backdrop-blur-xl" />

      {/* Mid card */}
      <div className="absolute w-[260px] h-[310px] top-[15px] left-[15px] rounded-2xl bg-white/[0.05] border border-white/[0.12] rotate-[1deg] backdrop-blur-xl" />

      {/* Front card */}
      <div className="absolute w-[260px] h-[320px] top-0 left-0 rounded-2xl bg-[rgba(20,20,20,0.92)] border border-white/[0.15] p-6">
        {/* File header */}
        <div className="flex items-center gap-2 mb-5 pb-3.5 border-b border-white/[0.08]">
          <div className="w-8 h-8 flex items-center justify-center bg-rose-dim border border-rose-border rounded-lg text-sm flex-shrink-0">
            📄
          </div>
          <div>
            <div className="text-[0.78rem] font-semibold text-offwhite">
              Annual_Report_2024.pdf
            </div>
            <div className="text-[0.7rem] text-muted mt-px">
              127 pages · 4.1 MB
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex justify-between text-[0.7rem] text-muted mb-1.5">
          <span>Indexing document</span>
          <span className="text-rose font-semibold">78%</span>
        </div>
        <div className="h-[3px] bg-white/[0.08] rounded-full mb-4 overflow-hidden">
          <div className="h-full w-[78%] bg-rose rounded-full" />
        </div>

        {/* Chat lines */}
        <div className="flex gap-2 items-start mb-2.5">
          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.6rem] font-bold flex-shrink-0 mt-px bg-white/10 border border-white/[0.15] text-silver">
            U
          </div>
          <div className="flex-1 px-2.5 py-1.5 rounded-lg text-[0.72rem] leading-snug bg-white/[0.06] border border-white/10 text-silver">
            What was the net revenue growth?
          </div>
        </div>

        <div className="flex gap-2 items-start mb-2.5">
          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.6rem] font-bold flex-shrink-0 mt-px bg-rose text-white">
            AI
          </div>
          <div className="flex-1 px-2.5 py-1.5 rounded-lg text-[0.72rem] leading-snug bg-rose-dim border border-rose-border text-offwhite">
            Net revenue grew{" "}
            <strong className="text-[rgb(255,120,150)]">23.4% YoY</strong>,
            reaching $4.2B.{" "}
            <span className="inline-block bg-rose-dim text-rose text-[0.62rem] font-bold px-1 py-px rounded border border-rose-border ml-0.5">
              p.7
            </span>
          </div>
        </div>

        <div className="flex gap-2 items-start">
          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.6rem] font-bold flex-shrink-0 mt-px bg-white/10 border border-white/[0.15] text-silver">
            U
          </div>
          <div className="flex-1 px-2.5 py-1.5 rounded-lg text-[0.72rem] leading-snug bg-white/[0.06] border border-white/10 text-silver">
            What were the key risk factors?
          </div>
        </div>
      </div>

      {/* Floating chip — top right */}
      <div className="absolute top-[-18px] right-[-20px] animate-float1 bg-[rgba(10,10,10,0.92)] border border-white/[0.12] rounded-xl px-3 py-2 backdrop-blur-xl">
        <div className="text-[0.68rem] text-muted mb-0.5">Pages processed</div>
        <div className="text-[0.82rem] font-semibold text-offwhite">
          <span className="text-rose">99</span> / 127
        </div>
      </div>

      {/* Floating chip — bottom left */}
      <div className="absolute bottom-[-12px] left-[-24px] animate-float2 bg-[rgba(10,10,10,0.92)] border border-white/[0.12] rounded-xl px-3 py-2 backdrop-blur-xl">
        <div className="text-[0.68rem] text-muted mb-0.5">Citations found</div>
        <div className="text-[0.82rem] font-semibold text-offwhite">
          <span className="text-rose">42</span> references
        </div>
      </div>
    </div>
  );
}
