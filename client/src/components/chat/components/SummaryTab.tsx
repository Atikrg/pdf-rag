"use client";

import type { Conversation, DocRecord } from "../types";
import styles from "../chat-workspace.module.css";

type Props = {
  conversation: Conversation | null;
  document: DocRecord | null;
  summary?: string | null;
  onRefresh?: () => void;
};

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className={styles.sumKv}>
      <span className={styles.sumK}>{label}</span>
      <span className={styles.sumV}>{value}</span>
    </div>
  );
}

export default function SummaryTab({ conversation, document, summary, onRefresh }: Props) {
  return (
    <div className={styles.rpanel}>
      <div className={styles.sumBlock}>
        <div className={styles.sumTitle}>Document overview</div>
        {summary == null ? (
          <div className={styles.sumTxt}>
            {document
              ? "Click Generate to produce an AI summary of this document."
              : "Upload a PDF to generate its overview."}
          </div>
        ) : (
          <div className={styles.sumTxt}>{summary}</div>
        )}
        {document && summary == null && (
          <button
            className={styles.sumBtn}
            onClick={onRefresh}
            type="button"
          >
            Generate summary
          </button>
        )}
      </div>

      <div className={styles.sumBlock}>
        <div className={styles.sumTitle}>Indexed content</div>
        <SummaryRow label="Pages" value={document ? String(document.pages) : "–"} />
        <SummaryRow label="Chunks" value={document ? String(document.chunks) : "–"} />
        <SummaryRow label="Questions asked" value={String(conversation?.qcount ?? 0)} />
        <SummaryRow label="Pages cited" value={String(conversation?.cites.length ?? 0)} />
      </div>

      <div className={styles.sumBlock}>
        <div className={styles.sumTitle}>Document info</div>
        <SummaryRow label="Type" value="PDF" />
        <SummaryRow label="Pages" value={document ? String(document.pages) : "–"} />
        <SummaryRow label="Language" value="English" />
      </div>
    </div>
  );
}