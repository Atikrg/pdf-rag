import styles from "../chat-workspace.module.css";

export default function TypingIndicator() {
  return (
    <div className={styles.typingRow}>
      <div className={`${styles.mav} ${styles.avAi}`}>AI</div>
      <div className={styles.tdots}>
        <div className={styles.td} />
        <div className={styles.td} />
        <div className={styles.td} />
      </div>
    </div>
  );
}