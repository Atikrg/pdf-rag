import multer from "multer";
import { AppConfig } from "../config/AppConfig";

/**
 * Rejection messages shared with the error handler, which matches on them to
 * map a thrown upload error to a 400. They are compared by value, so they live
 * here rather than being duplicated as string literals.
 */
export const UPLOAD_TYPE_REJECTED =
  "Only PDF, Excel, CSV, Word, Markdown, or Text files are allowed";

export const UPLOAD_CONTENT_REJECTED =
  "File contents do not match the declared file type";

/**
 * Extension to store under, derived from the *validated* MIME type rather than
 * the client-supplied filename.
 *
 * `Content-Type` is client-controlled, so this is a normalisation step, not a
 * security boundary on its own — `assertLooksLikeDeclaredType` is what actually
 * checks the bytes. Deriving the suffix from a lookup (instead of from
 * `originalname`) means an attacker can't smuggle path separators or a bogus
 * double extension into the MinIO object key.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/markdown": "md",
  "text/plain": "txt",
};

const ALLOWED_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

export function extensionForMimeType(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType] ?? null;
}

/** First bytes each format is required to start with. */
const MAGIC_BYTES: Record<string, (buffer: Buffer) => boolean> = {
  // "%PDF-"
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  // xlsx and docx are zip containers: "PK\x03\x04"
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
    b,
  ) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
    b,
  ) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  // Legacy OLE2 compound file, used by .xls and .doc
  "application/vnd.ms-excel": (b) =>
    b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
};

/**
 * Verifies a file's leading bytes against its declared type.
 *
 * Binary formats are checked by magic number. Plain-text formats have no
 * signature, so instead of accepting them blindly we reject anything containing
 * a NUL byte — a cheap, effective block on the disguised-executables that
 * otherwise pass as `text/plain`.
 */
export function looksLikeDeclaredType(
  mimeType: string,
  buffer: Buffer,
): boolean {
  const isText =
    mimeType === "text/csv" ||
    mimeType === "text/markdown" ||
    mimeType === "text/plain";

  if (isText) {
    return !buffer.subarray(0, 4096).includes(0);
  }

  const check = MAGIC_BYTES[mimeType];
  if (!check) return false;

  return check(buffer);
}

const fileFilter = (
  request: any,
  file: any,
  cb: (error: Error | null, accept?: boolean) => void,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(UPLOAD_TYPE_REJECTED), false);
  }
};

/**
 * Uploads are buffered fully in memory (`memoryStorage`) before being written to
 * MinIO, so `fileSize` is also the ceiling on a single request's heap use.
 * Without it one request could exhaust the container's memory.
 */
export function createUploadMiddleware() {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
      fileSize: AppConfig.getInstance().maxUploadBytes,
      files: 1,
      fields: 10,
      parts: 12,
    },
  });
}

export const upload = createUploadMiddleware();
