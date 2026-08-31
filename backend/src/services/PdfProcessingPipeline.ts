import type { StoredFileMeta } from "../core/ports/IFileStorage";
import type {
  PdfProcessingResult,
} from "../core/ports/IPdfProcessingQueue";
import { AppConfig } from "../config/AppConfig";
import type { IFileStorage } from "../core/ports/IFileStorage";
import type { RagService } from "./rag.service";
import type { QdrantService } from "./qdrant.service";

export class PdfProcessingPipeline {
  constructor(
    private readonly config: AppConfig,
    private readonly fileStorage: IFileStorage,
    private readonly ragService: RagService,
    private readonly qdrantService: QdrantService,
  ) {}

  public async process(meta: StoredFileMeta): Promise<PdfProcessingResult> {
    const collectionName = this.qdrantService.collectionForUser(
      this.config.qdrantCollection,
      meta.userId,
    );

    // Re-indexing the same document replaces (rather than duplicates) its points.
    if (meta.documentId) {
      await this.qdrantService.deleteDocument(collectionName, meta.documentId);
    }

    const pdfBuffer = await this.fileStorage.downloadPdf(meta.objectName);

    const docs = await this.ragService.loadPdfFromBuffer(pdfBuffer);

    const pages = await this.ragService.extractPdfPages(docs);

    const pageChunks = pages.map((page) => ({
      pageContent: page.content,
      metadata: {
        pageIndex: page.pageIndex,
        type: "page",
        documentId: meta.documentId,
      },
    }));

    const recursiveChunks = await this.ragService.recursiveChunking(pages);

    const chunked = recursiveChunks.map((chunk) => ({
      pageContent: chunk.pageContent,
      metadata: {
        pageIndex: chunk.metadata.pageIndex as number,
        type: "chunk",
        documentId: meta.documentId,
      },
    }));

    await this.qdrantService.indexChunks(pageChunks, collectionName);
    await this.qdrantService.indexChunks(chunked, collectionName);

    return {
      totalPages: pages.length,
      totalChunks: recursiveChunks.length,
    };
  }
}