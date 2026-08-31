import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
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

export class RagService {
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

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
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