"use client";

import { useState, useRef } from "react";
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
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
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
  onDeleteConversation,
  onRenameConversation,
  onOpenDoc,
  onFiles,
}: Props) {
  // Which row is being renamed, and the in-progress text for it.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  // Which row is waiting on a delete confirmation, so a stray click cannot
  // destroy a conversation outright.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const startRename = (c: Conversation) => {
    setConfirmingId(null);
    setEditingId(c.id);
    setDraftTitle(c.title);
    // Focus after the input mounts, so the caret lands where the user expects.
    requestAnimationFrame(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    });
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftTitle("");
  };

  const commitRename = (id: string) => {
    const trimmed = draftTitle.trim();
    cancelRename();
    // An empty draft cancels rather than clearing the title.
    if (trimmed) onRenameConversation(id, trimmed);
  };

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
            const isEditing = editingId === c.id;
            const isConfirming = confirmingId === c.id;

            return (
              <div
                key={c.id}
                className={`${styles.histItem} ${c.id === activeId ? styles.histItemActive : ""}`}
                onClick={() => {
                  // Row actions handle their own clicks; clicking the body while
                  // editing or confirming should not also switch conversations.
                  if (!isEditing && !isConfirming) onSelectConversation(c.id);
                }}
              >
                <div className={styles.histIco}>
                  <Icon name={historyIcon(rec?.name ?? c.title)} size={15} />
                </div>

                <div className={styles.histBody}>
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      className={styles.histRenameInput}
                      value={draftTitle}
                      maxLength={120}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename(c.id);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                      onBlur={() => commitRename(c.id)}
                    />
                  ) : isConfirming ? (
                    <div
                      style={{ fontSize: "0.68rem", color: "var(--sv)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Delete this chat?
                      <div style={{ display: "flex", gap: "0.375rem", marginTop: 4 }}>
                        <button
                          className={`${styles.histActionBtn} ${styles.danger}`}
                          style={{ width: "auto", padding: "0 8px", height: 20 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingId(null);
                            onDeleteConversation(c.id);
                          }}
                        >
                          Delete
                        </button>
                        <button
                          className={styles.histActionBtn}
                          style={{ width: "auto", padding: "0 8px", height: 20 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingId(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.histTitle}>{c.title}</div>
                      <div className={styles.histMeta}>
                        {c.id === activeId ? "Active" : c.meta}
                      </div>
                    </>
                  )}
                </div>

                {!isEditing && !isConfirming && (
                  <div className={styles.histActions}>
                    <button
                      className={styles.histActionBtn}
                      title="Rename chat"
                      aria-label={`Rename ${c.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(c);
                      }}
                    >
                      <Icon name="pencil" size={13} />
                    </button>
                    <button
                      className={`${styles.histActionBtn} ${styles.danger}`}
                      title="Delete chat"
                      aria-label={`Delete ${c.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingId(c.id);
                      }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                )}
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