"use client";

import type { Conversation, DocRecord } from "../types";
import { toTitle } from "../utils";
import Icon from "../Icon";
import QuickPrompts from "./QuickPrompts";
import MessagesList from "./MessagesList";
import Composer from "./Composer";
import FileUploadTrigger from "./FileUploadTrigger";
import styles from "../chat-workspace.module.css";

type Props = {
  conversation: Conversation | null;
  document: DocRecord | null;
  systemText: string;
  uploading: boolean;
  uploadingFile: File | null;
  percent: number;
  progressText: string;
  sending: boolean;
  input: string;
  inputHint: string;
  error: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onQuickPrompt: (prompt: string) => void;
  onClear: () => void;
  onFiles: (files: FileList | null) => void;
  onDismissError: () => void;
};

export default function ChatColumn({
  conversation,
  document,
  systemText,
  uploading,
  uploadingFile,
  percent,
  progressText,
  sending,
  input,
  inputHint,
  error,
  onInputChange,
  onSend,
  onQuickPrompt,
  onClear,
  onFiles,
  onDismissError,
}: Props) {
  const title = conversation?.title ?? (document ? toTitle(document.name) : "Conversation");
  const showUploadPrompt = !document && !uploading;
  const showQuick = !!document && !uploading && (conversation?.messages.length ?? 0) === 0;
  const composerDisabled = !document || uploading;
  const placeholder = document
    ? "Ask anything about your document…"
    : uploading
      ? "Indexing your document…"
      : "Upload a PDF to start…";

  return (
    <div className={styles.chatCol}>
      <div className={styles.chatBar}>
        <div className={styles.cbLeft}>
          <div className={styles.cbTitle}>{title}</div>
          {document && <div className={styles.cbBadge}>{document.pages} pages</div>}
        </div>
        <div className={styles.cbActs}>
          <button
            className={styles.icobtn}
            title="Clear conversation"
            onClick={onClear}
            aria-label="Clear conversation"
            disabled={!conversation}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      <MessagesList
        conversation={conversation}
        systemText={systemText}
        uploading={uploading}
        uploadingFile={uploadingFile}
        percent={percent}
        progressText={progressText}
        sending={sending}
      />

      {showUploadPrompt ? (
        <FileUploadTrigger className={styles.uploadPrompt} onFiles={onFiles}>
          <Icon name="upload" size={18} />
          Upload a PDF to begin
        </FileUploadTrigger>
      ) : (
        <div className={styles.quickGrid} style={showQuick ? undefined : { display: "none" }}>
          <QuickPrompts onPrompt={onQuickPrompt} />
        </div>
      )}

      <Composer
        input={input}
        disabled={composerDisabled}
        sending={sending}
        placeholder={placeholder}
        hint={inputHint}
        error={error}
        onInputChange={onInputChange}
        onSend={onSend}
        onDismissError={onDismissError}
      />
    </div>
  );
}