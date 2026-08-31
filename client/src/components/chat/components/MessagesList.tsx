"use client";

import { useEffect, useRef } from "react";
import type { Conversation } from "../types";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import styles from "../chat-workspace.module.css";

type Props = {
  conversation: Conversation | null;
  systemText: string;
  uploading: boolean;
  uploadingFile: File | null;
  percent: number;
  progressText: string;
  sending: boolean;
};

export default function MessagesList({
  conversation,
  systemText,
  uploading,
  uploadingFile,
  percent,
  progressText,
  sending,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation?.id, conversation?.messages, sending]);

  return (
    <div className={styles.msgs} ref={scrollRef}>
      <div className={styles.sysMsg}>
        <div className={styles.smHead}>
          <div className={styles.smAv}>AI</div>
          <div className={styles.smName}>DocuMind</div>
        </div>
        <div className={styles.smTxt}>{systemText}</div>
      </div>

      {uploading && (
        <div className={styles.uploadingRow}>
          <div className={styles.uploadHead}>
            <span className={styles.uploadDot} />
            <span className={styles.uploadText}>{uploadingFile?.name ?? "Your PDF"}</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <div className={styles.uploadMeta}>{progressText}</div>
        </div>
      )}

      {conversation?.messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}

      {sending && <TypingIndicator />}
    </div>
  );
}