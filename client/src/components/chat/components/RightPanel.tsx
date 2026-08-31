"use client";

import { useState } from "react";
import { RIGHT_PANEL_TABS } from "../constants";
import type { Conversation, DocRecord, TabId } from "../types";
import DocumentTab from "./DocumentTab";
import CitationsTab from "./CitationsTab";
import SummaryTab from "./SummaryTab";
import styles from "../chat-workspace.module.css";

type Props = {
  conversation: Conversation | null;
  document: DocRecord | null;
  summary?: string | null;
  onRefreshSummary?: () => void;
};

function RightPanelBody({ conversation, document, summary, onRefreshSummary }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("doc");

  return (
    <div className={styles.rpan}>
      <div className={styles.rpanTabs}>
        {RIGHT_PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.rtab} ${activeTab === tab.id ? styles.rtabOn : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "doc" && <DocumentTab conversation={conversation} document={document} />}
      {activeTab === "cites" && <CitationsTab conversation={conversation} />}
      {activeTab === "sum" && (
        <SummaryTab
          conversation={conversation}
          document={document}
          summary={summary}
          onRefresh={onRefreshSummary}
        />
      )}
    </div>
  );
}

export default function RightPanel({ conversation, document, summary, onRefreshSummary }: Props) {
  return (
    <RightPanelBody
      key={conversation?.id ?? "none"}
      conversation={conversation}
      document={document}
      summary={summary}
      onRefreshSummary={onRefreshSummary}
    />
  );
}