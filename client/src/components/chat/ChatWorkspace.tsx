"use client";

import { useRouter } from "next/navigation";
import { usePdfChat } from "./hooks/usePdfChat";
import TopNav from "./components/TopNav";
import LeftSidebar from "./components/LeftSidebar";
import ChatColumn from "./components/ChatColumn";
import RightPanel from "./components/RightPanel";
import styles from "./chat-workspace.module.css";

export default function ChatWorkspace() {
  const chat = usePdfChat();
  const router = useRouter();

  const handleLogout = () => {
    chat.logout();
    localStorage.removeItem("documind.activeSessionId");
    localStorage.removeItem("documind.activeDocId");
    router.replace("/login");
  };

  const navDocName =
    chat.uploading && chat.uploadingFile
      ? chat.uploadingFile.name
      : (chat.activeDocument?.name ?? "No document loaded");

  return (
    <div className={styles.wrap}>
      <h2 className="sr-only">DocuMind — 3-panel PDF chat interface</h2>

      <TopNav
        docName={navDocName}
        docId={chat.activeDocument?.id ?? null}
        onNewChat={chat.newChat}
        user={chat.user}
        authenticated={chat.authenticated}
        mounted={chat.mounted}
        onLogout={handleLogout}
      />

      <LeftSidebar
        conversations={chat.conversations}
        docList={chat.docList}
        activeId={chat.activeId}
        uploading={chat.uploading}
        percent={chat.percent}
        onNewChat={chat.newChat}
        onSelectConversation={chat.selectConversation}
        onDeleteConversation={chat.deleteConversation}
        onRenameConversation={chat.renameConversation}
        onOpenDoc={chat.openDocConversation}
        onFiles={chat.onFiles}
      />

      <ChatColumn
        conversation={chat.activeConversation}
        document={chat.activeDocument}
        systemText={chat.systemText}
        uploading={chat.uploading}
        uploadingFile={chat.uploadingFile}
        percent={chat.percent}
        progressText={chat.progressText}
        sending={chat.sending}
        input={chat.input}
        inputHint={chat.inputHint}
        error={chat.error}
        onInputChange={chat.setInput}
        onSend={chat.sendMessage}
        onQuickPrompt={chat.sendMessage}
        onClear={chat.clearConversation}
        onFiles={chat.onFiles}
        onDismissError={() => chat.setError(null)}
      />

      <RightPanel
        conversation={chat.activeConversation}
        document={chat.activeDocument}
        summary={chat.summary}
        onRefreshSummary={chat.refreshSummary}
      />
    </div>
  );
}