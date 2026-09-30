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
  /**
   * Returns the status of a job owned by `ownerId`, or `null` when the job does
   * not exist *or* belongs to someone else.
   *
   * `ownerId` is required rather than optional: BullMQ job ids are sequential
   * integers, so a caller-supplied `jobId` is enumerable and any authenticated
   * user could otherwise read every other user's job state by incrementing it.
   * The two cases are deliberately indistinguishable to the caller so the
   * endpoint can't be used to confirm that a given job id exists.
   */
  getStatus(jobId: string, ownerId: string): Promise<PdfJobStatus | null>;
}
