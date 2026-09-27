import * as mammoth from "mammoth";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface DocxChunk {
  pageContent: string;
  metadata: {
    type: "chunk";
    documentId?: string;
    paragraphIndex?: number;
  };
}

export async function extractDocxChunks(
  buffer: Buffer,
  documentId?: string,
): Promise<{ chunks: DocxChunk[]; paragraphCount: number }> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
  
  const chunks: DocxChunk[] = [];
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1400,
    chunkOverlap: 200,
  });

  let i = 0;
  for (const paragraph of paragraphs) {
    const splits = await splitter.splitText(paragraph);
    for (const split of splits) {
      chunks.push({
        pageContent: split,
        metadata: {
          type: "chunk",
          documentId,
          paragraphIndex: i + 1,
        },
      });
    }
    i++;
  }

  return { chunks, paragraphCount: paragraphs.length };
}
