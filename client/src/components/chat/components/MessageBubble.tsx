"use client";

import { Fragment } from "react";
import type { Message } from "../types";
import { citationLabel } from "../utils";
import styles from "../chat-workspace.module.css";

type Props = {
  message: Message;
};

function MessageText({ text }: { text: string }) {
  const parts = text.split(/(\[p\.\d+\])/g);

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[p\.(\d+)\]$/);
        if (match) {
          return (
            <span key={i} className={styles.ctag}>
              p.{match[1]}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const time = message.createdAt ? formatTime(message.createdAt) : "";

  return (
    <div className={`${styles.mrow} ${isUser ? styles.urow : styles.airow}`}>
      <div className={`${styles.mav} ${isUser ? styles.avU : styles.avAi}`}>
        {isUser ? "ME" : "AI"}
      </div>
      <div className={`${styles.mbbl} ${isUser ? styles.bu : styles.bai}`}>
        {time && <div className={styles.msgTime}>{time}</div>}
        <p className={styles.msgText}>
          <MessageText text={message.text} />
        </p>
        {message.citations && message.citations.length > 0 && (
          <div className={styles.citeChips}>
            {message.citations.map((ct, j) => {
              const label = citationLabel(ct);
              if (!label) return null;
              return (
                <span key={j} className={styles.ctag}>
                  📎 {label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}