import type { StoredFileMeta } from "./IFileStorage";

export type QuestionJobResult = {
  questionsIndexed: number;
};

/**
 * Phase 2 of indexing. Enqueued only after a document's own text is already
 * searchable, so question generation can never delay a document becoming
 * usable. Failures here are cosmetic: the document stays retrievable through
 * its `chunk` points.
 */
export interface IQuestionQueue {
  enqueue(meta: StoredFileMeta): Promise<string>;
}
