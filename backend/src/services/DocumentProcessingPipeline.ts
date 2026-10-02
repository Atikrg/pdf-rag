import type { StoredFileMeta } from "../core/ports/IFileStorage";
import type {
  PdfProcessingResult,
} from "../core/ports/IPdfProcessingQueue";
import { AppConfig } from "../config/AppConfig";
import type { IFileStorage } from "../core/ports/IFileStorage";
import type { RagService } from "./rag.service";
import type { QdrantService } from "./qdrant.service";
import type { OpenAiService } from "./openai.service";
import { extractSpreadsheetChunks } from "./spreadsheet.service";
import { extractDocxChunks } from "./docx.service";
import { extractPlainTextChunks } from "./plaintext.service";
import { generateQuestionsForChunks } from "./question.service";

/** Reports 0-100 progress for the in-flight job. */
export type ProgressReporter = (percent: number) => void;

/** A document with less text than this has nothing worth indexing. */
const MIN_INDEXABLE_CHARS = 200;

export class DocumentProcessingPipeline {
  constructor(
    private readonly config: AppConfig,
    private readonly fileStorage: IFileStorage,
    private readonly ragService: RagService,
    private readonly qdrantService: QdrantService,
    private readonly openAiService?: OpenAiService,
  ) {}

  public async process(
    meta: StoredFileMeta,
    report?: ProgressReporter,
  ): Promise<PdfProcessingResult> {
    const collectionName = this.qdrantService.collectionForUser(
      this.config.qdrantCollection,
      meta.userId,
    );

    // Re-indexing the same document replaces (rather than duplicates) its points.
    if (meta.documentId) {
      await this.qdrantService.deleteDocument(collectionName, meta.documentId);
    }

    report?.(10);

    const fileBuffer = await this.fileStorage.downloadPdf(meta.objectName);

    report?.(20);

    let chunked: { pageContent: string; metadata: any }[] = [];
    let totalPages = 0;

    if (meta.mimeType === "application/pdf") {
      // extractPdfText falls back to OCR for scans, so this is the only place
      // that needs to know about it. OCR progress occupies 20-40%, the same
      // window the rasterisation used to.
      const { pages, characterCount } = await this.ragService.extractPdfText(
        fileBuffer,
        (done, total) => report?.(20 + Math.round((done / total) * 20)),
      );

      if (characterCount < MIN_INDEXABLE_CHARS) {
        throw new Error(
          "No usable text could be read from this PDF. It may be a scan that " +
            "needs OCR, or a file with no text layer.",
        );
      }

      const recursiveChunks = await this.ragService.recursiveChunking(pages);

      chunked = recursiveChunks.map((chunk) => ({
        pageContent: chunk.pageContent,
        metadata: {
          pageIndex: chunk.metadata.pageIndex as number,
          type: "chunk",
          documentId: meta.documentId,
        },
      }));
      totalPages = pages.length;
    } else if (
      meta.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      meta.mimeType === "application/vnd.ms-excel" ||
      meta.mimeType === "text/csv"
    ) {
      const result = await extractSpreadsheetChunks(fileBuffer, meta.documentId);
      chunked = result.chunks;
      totalPages = result.sheetCount;
    } else if (meta.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await extractDocxChunks(fileBuffer, meta.documentId);
      chunked = result.chunks;
      totalPages = 0;
    } else if (meta.mimeType === "text/markdown" || meta.mimeType === "text/plain") {
      const result = await extractPlainTextChunks(fileBuffer, meta.documentId);
      chunked = result.chunks;
      totalPages = 0;
    } else {
      throw new Error(`Unsupported mime type: ${meta.mimeType}`);
    }

    report?.(40);

    if (chunked.length === 0) {
      throw new Error("No content could be extracted from the document");
    }

    // The document is only marked ready once its own text is searchable.
    // Hypothetical questions are added afterwards by `enrichWithQuestions` so a
    // slow or rate-limited model never delays the user getting a usable doc.
    await this.qdrantService.indexChunks(
      chunked,
      collectionName,
      meta.documentId,
      (done, total) => report?.(40 + Math.round((done / total) * 55)),
    );

    return {
      totalPages,
      totalChunks: chunked.length,
    };
  }

  /**
   * Phase 2 of indexing: adds hypothetical questions for an already-indexed
   * document so queries phrased differently from the source still retrieve it.
   *
   * Reads the chunk text back out of Qdrant rather than re-parsing the file, and
   * is safe to re-run — question point ids are derived from the document id and
   * chunk index, so a repeat run overwrites rather than duplicates.
   */
  public async enrichWithQuestions(
    meta: StoredFileMeta,
    report?: ProgressReporter,
  ): Promise<{ questionsIndexed: number }> {
    if (!this.openAiService) {
      throw new Error("Question enrichment requires an LLM service");
    }

    if (!meta.documentId) {
      throw new Error("Question enrichment requires a documentId");
    }

    const collectionName = this.qdrantService.collectionForUser(
      this.config.qdrantCollection,
      meta.userId,
    );

    // Chunks may not be visible yet even though phase 1 reported success (Qdrant
    // indexing is eventually consistent), so poll briefly before giving up.
    // Giving up permanently would silently lose enrichment for a ready document.
    let chunks = await this.qdrantService.getChunksForDocument(
      collectionName,
      meta.documentId,
    );

    for (let attempt = 1; attempt <= 5 && chunks.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      chunks = await this.qdrantService.getChunksForDocument(
        collectionName,
        meta.documentId,
      );
    }

    if (chunks.length === 0) {
      throw new Error(
        `No indexed chunks found for document ${meta.documentId}`,
      );
    }

    report?.(10);

    const entries = await generateQuestionsForChunks(
      chunks,
      this.openAiService,
      {
        perChunk: this.config.questionsPerChunk,
        onProgress: (done, total) =>
          report?.(10 + Math.round((done / total) * 60)),
      },
    );

    report?.(75);

    const questionsIndexed = await this.qdrantService.upsertQuestionPoints(
      entries,
      collectionName,
      meta.documentId,
      (done, total) => report?.(75 + Math.round((done / total) * 25)),
    );

    // A document with zero questions still looks healthy from the outside: the
    // job succeeds and status stays `ready`, but hypothetical-question
    // retrieval can never match it. This happens whenever the LLM refuses or
    // rate-limits every chunk, so treat an empty result as a failure and let
    // BullMQ retry it instead of silently losing the document's questions.
    if (questionsIndexed === 0) {
      throw new Error(
        `Question enrichment produced 0 questions for document ${meta.documentId} ` +
          `(${chunks.length} chunks attempted); treating as failure so the job retries`,
      );
    }

    return { questionsIndexed };
  }
}
