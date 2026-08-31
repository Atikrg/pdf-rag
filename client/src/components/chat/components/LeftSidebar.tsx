"use client";

import type { Conversation, DocRecord } from "../types";
import { historyIcon } from "../utils";
import Icon from "../Icon";
import FileUploadTrigger from "./FileUploadTrigger";
import styles from "../chat-workspace.module.css";

type Props = {
  conversations: Conversation[];
  docList: DocRecord[];
  activeId: string | null;
  uploading: boolean;
  percent: number;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onOpenDoc: (record: DocRecord) => void;
  onFiles: (files: FileList | null) => void;
};

export default function LeftSidebar({
  conversations,
  docList,
  activeId,
  uploading,
  percent,
  onNewChat,
  onSelectConversation,
  onOpenDoc,
  onFiles,
}: Props) {
  return (
    <div className={styles.lsb}>
      <div className={styles.lsbHead}>
        <div className={styles.lsbLabel}>Chats</div>
        <button className={styles.newChatBtn} onClick={onNewChat}>
          <Icon name="plus" size={16} />
          New conversation
        </button>
      </div>

      <div className={styles.lsbSection}>Recent</div>
      <div className={styles.chatHist}>
        {conversations.length === 0 ? (
          <div className={styles.histEmpty}>
            No conversations yet — upload a PDF or start a new chat.
          </div>
        ) : (
          conversations.map((c) => {
            const rec = docList.find((d) => d.id === c.docId);
            return (
              <div
                key={c.id}
                className={`${styles.histItem} ${c.id === activeId ? styles.histItemActive : ""}`}
                onClick={() => onSelectConversation(c.id)}
              >
                <div className={styles.histIco}>
                  <Icon name={historyIcon(rec?.name ?? c.title)} size={15} />
                </div>
                <div>
                  <div className={styles.histTitle}>{c.title}</div>
                  <div className={styles.histMeta}>
                    {c.id === activeId ? "Active" : c.meta}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.lsbSection}>Documents</div>
      <div className={styles.lsbDocs}>
        {docList.map((d) => (
          <div
            key={d.id}
            className={styles.docRow}
            onClick={() => onOpenDoc(d)}
            title={`Start a new conversation with ${d.name}`}
          >
            <div className={styles.docIco}>
              <Icon name="pdf" size={15} />
            </div>
            <div>
              <div className={styles.docName}>{d.name}</div>
              <div className={styles.docPages}>{d.pages} pages</div>
            </div>
          </div>
        ))}
        <FileUploadTrigger className={styles.uploadRow} onFiles={onFiles}>
          <Icon name="upload" size={16} />
          <span>{uploading ? "Uploading…" : "Upload PDF"}</span>
          {uploading && <span className={styles.uploadMini}>{Math.round(percent)}%</span>}
        </FileUploadTrigger>
      </div>
    </div>
  );
}