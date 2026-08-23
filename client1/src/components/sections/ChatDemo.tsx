// SERVER COMPONENT — this is a static visual demo, no JS needed

type Message = {
  role: "user" | "ai";
  avatar: string;
  text: string;
  cite?: string;
};

const MESSAGES: Message[] = [
  {
    role: "user",
    avatar: "AS",
    text: "What was the net revenue growth compared to Q3 last year?",
  },
  {
    role: "ai",
    avatar: "AI",
    text: "Net revenue grew 23.4% year-over-year, reaching $4.2B in Q3 2024 vs $3.4B in Q3 2023. Growth was led by SaaS subscriptions (+31%) and professional services (+18%).",
    cite: "p. 7",
  },
  {
    role: "user",
    avatar: "AS",
    text: "What were the main risk factors mentioned?",
  },
  {
    role: "ai",
    avatar: "AI",
    text: "Three primary risk factors were identified: (1) foreign exchange headwinds in EMEA, (2) increased mid-market competition, and (3) supply chain dependencies affecting hardware margins.",
    cite: "p. 14",
  },
];

export default function ChatDemo() {
  return (
    <section className="max-w-[860px] mx-auto px-10 pb-20">
      <div className="bg-[rgba(12,12,12,0.95)] border border-glass-border rounded-[18px] overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.03] border-b border-glass-border">
          <span className="text-[1.05rem]">📄</span>
          <div className="flex items-center gap-1.5 bg-rose-dim border border-rose-border rounded-md px-2.5 py-1 text-[0.75rem] text-[rgb(255,160,175)] font-medium">
            📎 Q3_Financial_Report_2024.pdf
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[0.72rem] text-muted">
            <span className="w-[5px] h-[5px] rounded-full bg-emerald-400 inline-block" />
            Ready
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-col gap-3.5 px-5 py-5">
          {MESSAGES.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 items-start max-w-[88%] ${
                msg.role === "user" ? "ml-auto flex-row-reverse" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.68rem] font-bold flex-shrink-0 mt-0.5 ${
                  msg.role === "ai"
                    ? "bg-rose text-white"
                    : "bg-white/10 border border-white/[0.15] text-silver"
                }`}
              >
                {msg.avatar}
              </div>

              {/* Bubble */}
              <div
                className={`px-3.5 py-2.5 rounded-xl text-[0.83rem] leading-[1.55] ${
                  msg.role === "ai"
                    ? "bg-[rgba(203,41,87,0.1)] border border-[rgba(203,41,87,0.2)] text-offwhite/90"
                    : "bg-white/[0.06] border border-glass-border text-silver"
                }`}
              >
                {msg.text}
                {msg.cite && (
                  <span className="inline-block bg-rose-dim text-rose text-[0.7rem] font-bold px-1.5 py-px rounded border border-rose-border ml-1.5 align-middle">
                    {msg.cite}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-t border-glass-border">
          <input
            readOnly
            placeholder="Ask something about your document…"
            className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3.5 py-2 text-[0.83rem] text-muted font-inter placeholder:text-muted outline-none"
          />
          <button
            aria-label="Send"
            className="w-9 h-9 flex items-center justify-center bg-rose hover:bg-rose-hover rounded-lg text-white text-sm transition-colors flex-shrink-0"
          >
            ➤
          </button>
        </div>
      </div>
    </section>
  );
}
