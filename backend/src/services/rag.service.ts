import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { IOcrEngine } from "../core/ports/IOcrEngine";
import type { Page } from "../types/global";
import { Document } from "langchain";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import path from "path";
import os from "os";
import fs from "fs/promises";

export enum PageType {
  Page = "page",
  Chunk = "chunk",
}

/**
 * Text extracted from a document, and whether a usable amount of it was found.
 * `pages` is empty when the text layer was absent or negligible.
 */
export type PdfText = {
  pages: Page[];
  /** Characters of real text, excluding the page-number banners extractors add. */
  characterCount: number;
};

/** Below this a document counts as having no text layer and needs OCR. */
const MIN_USABLE_CHARS = 200;

export const NO_TEXT_LAYER_MESSAGE =
  "This PDF has no extractable text and no OCR engine is configured, so there is " +
  "nothing to index. It is most likely a scanned document. Install Tesseract " +
  "(tesseract-ocr, poppler-utils) or upload a version with a text layer.";

export const OCR_UNAVAILABLE_MESSAGE =
  "This PDF looks like a scan, but OCR is not installed in this environment, so " +
  "its pages cannot be read. Install tesseract-ocr and poppler-utils in the " +
  "worker image, or upload a version that has a text layer.";

export const OCR_FOUND_NOTHING_MESSAGE =
  "This PDF looks like a scan, but OCR could not read any text from it. The " +
  "pages may be blank, or the scan may be too low-resolution to read.";

/** Per-page banners like "-- 3 of 37 --" that some extractors prepend. */
const PAGE_BANNER = /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm;

export class RagService {
  constructor(private readonly ocrEngine?: IOcrEngine) {}

  /**
   * Loads a PDF's text, falling back to OCR when the document turns out to be a
   * scan. A 37-page scan yields 37 pages of pure whitespace plus page banners,
   * so text presence is judged on character count rather than page count.
   */
  async extractPdfText(
    pdfBuffer: Buffer,
    onOcrPage?: (done: number, total: number) => void,
  ): Promise<PdfText> {
    const docs = await this.loadPdfFromBuffer(pdfBuffer);
    const pages = await this.extractPdfPages(docs);

    const characterCount = pages.reduce(
      (total, page) => total + this.countUsableChars(page.content),
      0,
    );

    if (characterCount >= MIN_USABLE_CHARS) {
      return { pages, characterCount };
    }

    if (!this.ocrEngine) {
      throw new Error(NO_TEXT_LAYER_MESSAGE);
    }

    if (!(await this.ocrEngine.isAvailable())) {
      throw new Error(OCR_UNAVAILABLE_MESSAGE);
    }

    const recognised = await this.ocrEngine.recognisePages(
      pdfBuffer,
      pages.length,
      onOcrPage,
    );

    const ocrPages: Page[] = pages.map((page, index) => ({
      pageIndex: page.pageIndex,
      content: recognised[index] ?? "",
    }));

    const ocrCharacterCount = ocrPages.reduce(
      (total, page) => total + page.content.trim().length,
      0,
    );

    if (ocrCharacterCount < MIN_USABLE_CHARS) {
      throw new Error(OCR_FOUND_NOTHING_MESSAGE);
    }

    return { pages: ocrPages, characterCount: ocrCharacterCount };
  }

  /** Strips extractors' page banners and whitespace so they cannot inflate the count. */
  private countUsableChars(content: string): number {
    return content.replace(PAGE_BANNER, "").replace(/\s+/g, " ").trim().length;
  }

  async loadPdfFromBuffer(pdfBuffer: Buffer) {
    let tempFilePath: string | null = null;

    try {
      tempFilePath = path.join(os.tmpdir(), `pdf-${Date.now()}.pdf`);

      await fs.writeFile(tempFilePath, pdfBuffer);

      const loader = new PDFLoader(tempFilePath, {
        splitPages: true,
      });

      const docs = await loader.load();

      return docs;
    } catch (error) {
      console.error("PDF loading error:", error);
      throw new Error("Error occurred while loading PDF");
    } finally {
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
    }
  }

  async extractPdfPages(docs: Document[]): Promise<Page[]> {
    return docs.map((doc) => ({
      pageIndex: doc.metadata.loc?.pageNumber ?? 0,
      content: doc.pageContent,
    }));
  }

  async recursiveChunking(pages: Page[]) {
    const docs = pages.map(
      (page) =>
        new Document({
          pageContent: page.content,
          metadata: {
            pageIndex: page.pageIndex,
            type: PageType.Page,
          },
        }),
    );

    // Paper-friendly splitter. Splitting on headings and paragraph breaks first
    // keeps sections intact, then drops down to sentences. ~350 tokens keeps
    // chunks far below the embedding model's 256-token context limit so the
    // dense vectors stay faithful, while the overlap preserves continuity
    // across split boundaries.
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1400, // ~350 tokens for this tokenizer
      chunkOverlap: 200,
      separators: [
        "\n\n## ",
        "\n\n# ",
        "\n\n### ",
        "\n\n",
        "\n",
        ". ",
        " ",
        "",
      ],
    });

    const chunks = await splitter.splitDocuments(docs);

    return chunks.map((chunk) => ({
      ...chunk,
      metadata: {
        pageIndex: chunk.metadata.pageIndex,
        type: "chunk",
      },
    }));
  }
}