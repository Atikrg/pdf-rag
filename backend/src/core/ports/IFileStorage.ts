export interface StoredFileMeta {
  objectName: string;
  originalName: string;
  size: number;
  mimeType: string;
  /** Internal DB user id that owns this file. */
  userId: string;
  /** Internal DB document id this file maps to. */
  documentId: string;
}

export interface IFileStorage {
  ensureConnection(): Promise<boolean>;
  uploadPdf(objectName: string, buffer: Buffer): Promise<void>;
  downloadPdf(objectName: string): Promise<Buffer>;
  deletePdf(objectName: string): Promise<void>;
}