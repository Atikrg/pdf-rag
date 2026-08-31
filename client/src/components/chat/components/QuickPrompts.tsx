import { QUICK_PROMPTS } from "../constants";
import Icon from "../Icon";
import styles from "../chat-workspace.module.css";

type Props = {
  onPrompt: (prompt: string) => void;
};

export default function QuickPrompts({ onPrompt }: Props) {
  return (
    <>
      {QUICK_PROMPTS.map((q) => (
        <button key={q.label} className={styles.qchip} onClick={() => onPrompt(q.label)}>
          <span className={styles.qchipIcon}>
            <Icon name={q.icon} size={15} />
          </span>
          {q.label}
        </button>
      ))}
    </>
  );
}