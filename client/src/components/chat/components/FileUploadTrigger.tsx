"use client";

import { useRef, useState, type ReactNode } from "react";
import styles from "../chat-workspace.module.css";

type Props = {
  className: string;
  onFiles: (files: FileList | null) => void;
  children: ReactNode;
};

export default function FileUploadTrigger({ className, onFiles, children }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = () => inputRef.current?.click();

  return (
    <div
      className={`${className} ${isDragging ? styles.uploadRowActive : ""}`}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        onFiles(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,.xls,.xlsx,.csv,.docx,.md,.txt"
        className={styles.hiddenInput}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}