import type { StoredFileMeta } from "./IFileStorage";

export type PdfJobState =
  | "completed"
  | "failed"
  | "active"
  | "waiting"
  | "delayed"
  | "paused"
  | "unknown";

export interface PdfProcessingResult {
  totalPages: number;
  totalChunks: number;
}

export interface PdfJobStatus {
  jobId: string;
  state: PdfJobState;
  progress: number;
  result: PdfProcessingResult | null;
  failedReason: string | null;
}

export interface IPdfProcessingQueue {
  enqueue(meta: StoredFileMeta): Promise<string>;
  getStatus(jobId: string): Promise<PdfJobStatus | null>;
}
