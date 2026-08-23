import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type { Page } from "../types/global";
import { Document } from "langchain";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { EnsembleRetriever } from "@langchain/classic/retrievers/ensemble";
import { BM25Retriever } from "@langchain/community/retrievers/bm25";
import path from "path";
import { minio } from "../lib/minIO.lib";
import os from "os";
import fs from "fs/promises";
// import { embeddings } from "../lib/embeddings";
export enum PageType {
  Page = "page",
  Chunk = "chunk",
}

export class RagService {
  async loadPdf(upload_path: string) {
    try {
      const folderPath = path.join(process.cwd(), upload_path);

      console.log("folder path", folderPath);

      const loader = new PDFLoader(folderPath, {
        splitPages: true,
      });

      const docs = await loader.load();

      return docs;
    } catch (error) {
      throw new Error("Error occured while loading pdf");
    }
  }

  async loadPdfFromMinIO(objectName: string) {
    let tempFilePath: string | null = null;

    try {
      // Get PDF from MinIO

      const bucket = process.env.MINIO_BUCKET as string;

      const stream = await minio.download(bucket, objectName);

      // Convert MinIO stream -> Buffer
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const pdfBuffer = Buffer.concat(chunks);

      // Create temporary PDF file
      tempFilePath = path.join(
        os.tmpdir(),
        `pdf-${Date.now()}-${path.basename(objectName)}`,
      );

      await fs.writeFile(tempFilePath, pdfBuffer);
      
      // Load PDF using LangChain
      const loader = new PDFLoader(tempFilePath, {
        splitPages: true,
      });

      const docs = await loader.load();

      return docs;
    } catch (error) {
      console.error("PDF loading error:", error);
      throw new Error("Error occurred while loading PDF");
    } finally {
      // Delete temporary file
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
    }
  }

  async extractPdfPages(docs: Document[]): Promise<Page[]> {
    return docs.map((doc) => ({
      pageIndex: doc.metadata.loc?.pageNumber ?? 0,
      content: doc.pageContent,
      type: PageType.Page,
      currentDate: new Date().toISOString(),
    }));
  }

  async recursiveChunking(pages: Page[]) {
    const currentDate = new Date().toISOString();
    const docs = pages.map(
      (page) =>
        new Document({
          pageContent: page.content,
          metadata: {
            pageIndex: page.pageIndex,
            type: PageType.Chunk,
            currentDate: currentDate,
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
        ...chunk.metadata,
        type: "chunk",
      },
    }));
  }

  // async retrieveChunkDocuments(pdf_path:string){
  //   try{

  //     const documents = this.loadPdf(pdf_path);

  //     const splitter = await this.recursiveChunking(documents);

  //     return splitter;
  //   }catch(error)
  //   {
  //     throw new Error("Error retrieving chunk documents");
  //   }
  // }

  async retriveUsingKeywords(query: string, pages: Page[]) {
    const docs = pages.map(
      (p) =>
        new Document({
          pageContent: p.content,
          metadata: {
            pageIndex: p.pageIndex,
          },
        }),
    );
    const retriever = BM25Retriever.fromDocuments(docs, {
      k: 10,
    });

    const retrieval = retriever.invoke(query);

    return retrieval;
  }
}
