import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface PlainTextChunk {
  pageContent: string;
  metadata: {
    type: "chunk";
    documentId?: string;
    sectionIndex?: number;
  };
}

export async function extractPlainTextChunks(
  buffer: Buffer,
  documentId?: string,
): Promise<{ chunks: PlainTextChunk[]; chunkCount: number }> {
  const text = buffer.toString("utf-8");

  // Keep headings as separators for markdown
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1400,
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

  const splits = await splitter.splitText(text);

  const chunks: PlainTextChunk[] = splits.map((split, index) => ({
    pageContent: split,
    metadata: {
      type: "chunk",
      documentId,
      sectionIndex: index + 1,
    },
  }));

  return { chunks, chunkCount: chunks.length };
}
