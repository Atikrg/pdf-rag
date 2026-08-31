"use client";

import type { Conversation } from "../types";
import styles from "../chat-workspace.module.css";

type Props = {
  conversation: Conversation | null;
};

export default function CitationsTab({ conversation }: Props) {
  return (
    <div className={styles.rpanel}>
      <div className={styles.citesHint} style={{ textAlign: "left", padding: "0 0 0.75rem" }}>
        Pages referenced in this conversation
      </div>
      {!conversation || conversation.cites.length === 0 ? (
        <div className={styles.citesHint}>
          No citations yet.
          <br />
          Ask a question to see referenced pages.
        </div>
      ) : (
        conversation.cites.map((c, i) => (
          <div key={i} className={styles.citeItem}>
            <div className={styles.ciPg}>Page {c.page}</div>
            <div className={styles.ciTxt}>{c.snippet}</div>
          </div>
        ))
      )}
    </div>
  );
}