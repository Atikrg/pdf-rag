"use client";

import { useState, useRef } from "react";

export default function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setFileName(file.name);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-xl px-8 py-9 mb-5 cursor-pointer transition-all duration-250 ${
        isDragging
          ? "border-rose bg-[rgba(203,41,87,0.18)]"
          : "border-rose-border bg-rose-dim hover:border-rose hover:bg-[rgba(203,41,87,0.18)]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleChange}
      />

      <div className="text-[2rem] text-center mb-2.5">📂</div>

      {fileName ? (
        <div className="text-center">
          <p className="text-[0.875rem] text-offwhite font-semibold">{fileName}</p>
          <p className="text-[0.75rem] text-rose mt-1">Ready to upload</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-[0.875rem] text-silver">
            <strong className="text-rose font-semibold">Drop your PDF here</strong>{" "}
            or click to browse
          </p>
          <p className="text-[0.72rem] text-muted mt-1.5">
            PDF up to 100 MB · 500 pages max
          </p>
        </div>
      )}
    </div>
  );
}
