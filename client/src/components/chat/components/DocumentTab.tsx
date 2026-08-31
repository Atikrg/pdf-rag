"use client";

import type { Conversation, DocRecord } from "../types";
import Icon from "../Icon";
import styles from "../chat-workspace.module.css";

type Props = {
  conversation: Conversation | null;
  document: DocRecord | null;
};

export default function DocumentTab({ conversation, document }: Props) {
  const citedPages = new Set((conversation?.cites ?? []).map((c) => c.page));
  const thumbCount = Math.min(document?.pages ?? 0, 6);
  const thumbs = Array.from({ length: thumbCount }, (_, i) => i + 1);
  const sizeLine = document
    ? `${document.pages} pages · ${document.chunks} chunks · Indexed`
    : "No document loaded";

  return (
    <div className={styles.rpanel}>
      <div className={styles.docInfoCard}>
        <div className={styles.dicHead}>
          <div className={styles.dicIco}>
            <Icon name="pdf" size={18} />
          </div>
          <div className={styles.dicMeta}>
            <div className={styles.dicFn}>{document ? document.name : "No document"}</div>
            <div className={styles.dicSz}>{sizeLine}</div>
          </div>
        </div>
        <div className={styles.dicStats}>
          <div className={styles.dstat}>
            <div className={styles.dstatN}>{document ? document.pages : "–"}</div>
            <div className={styles.dstatL}>Total pages</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatN}>
              <span>{conversation?.qcount ?? 0}</span>
            </div>
            <div className={styles.dstatL}>Questions asked</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatN}>
              <span>{conversation?.cites.length ?? 0}</span>
            </div>
            <div className={styles.dstatL}>Pages cited</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatN} style={{ fontSize: "0.8rem", color: "#22c55e" }}>
              ●&thinsp;Live
            </div>
            <div className={styles.dstatL}>AI status</div>
          </div>
        </div>
      </div>

      <div className={styles.pageLabel}>Page previews</div>
      {!document ? (
        <div className={styles.citesHint}>Upload a PDF to see page previews here.</div>
      ) : (
        thumbs.map((p) => (
          <div key={p} className={`${styles.pageThumb} ${citedPages.has(p) ? styles.pageThumbCited : ""}`}>
            <div className={styles.ptHead}>
              <span className={styles.ptPnum}>Page {p}</span>
              {citedPages.has(p) && <span className={styles.ptBadge}>Cited</span>}
            </div>
            <div className={styles.ptLines}>
              <div className={`${styles.ptl} ${styles.ptlH}`} />
              <div className={`${styles.ptl} ${styles.ptlM}`} />
              <div className={`${styles.ptl} ${styles.ptlS}`} />
              {p % 2 === 0 ? <div className={`${styles.ptl} ${styles.ptlXs}`} /> : <div className={`${styles.ptl} ${styles.ptlM}`} />}
            </div>
          </div>
        ))
      )}
    </div>
  );
}