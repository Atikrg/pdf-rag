"use client";

import { useRef, type KeyboardEvent } from "react";
import { MAX_TEXTAREA_HEIGHT } from "../constants";
import Icon from "../Icon";
import styles from "../chat-workspace.module.css";

type Props = {
  input: string;
  disabled: boolean;
  sending: boolean;
  placeholder: string;
  hint: string;
  error: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onDismissError: () => void;
};

export default function Composer({
  input,
  disabled,
  sending,
  placeholder,
  hint,
  error,
  onInputChange,
  onSend,
  onDismissError,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.inpArea}>
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button className={styles.errorClose} onClick={onDismissError} aria-label="Dismiss error">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <div className={styles.inpBox}>
        <textarea
          ref={textareaRef}
          className={styles.tinp}
          rows={1}
          placeholder={placeholder}
          value={input}
          disabled={disabled}
          onChange={(e) => {
            onInputChange(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          className={styles.sndbtn}
          onClick={handleSend}
          disabled={disabled || sending || !input.trim()}
          aria-label="Send message"
        >
          <Icon name="send" size={16} />
        </button>
      </div>

      <div className={styles.inpFoot}>
        <div className={styles.inpHint}>
          Powered by retrieval-grounded answers · {hint}
        </div>
        <div>
          <span className={styles.kbd}>Enter</span>{" "}
          <span style={{ fontSize: "0.62rem", color: "var(--mt)" }}>send</span>
          {"  "}
          <span className={styles.kbd}>Shift+Enter</span>{" "}
          <span style={{ fontSize: "0.62rem", color: "var(--mt)" }}>newline</span>
        </div>
      </div>
    </div>
  );
}