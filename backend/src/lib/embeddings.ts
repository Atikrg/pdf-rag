// import "dotenv/config";
// import type { OllamaResponse } from "../global";
// import { OllamaEmbeddings }  from "@langchain/ollama";

// const OLLAMA_URL = process.env.OLLAMA_URL;

// export const embeddings = new OllamaEmbeddings({
//   model: "nomic-embed-text",
//   baseUrl: OLLAMA_URL,
// });

// export async function createTextEmbedding(pages: any[]): Promise<number[][]> {
//   const res = await fetch(`${OLLAMA_URL}/embeddings`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       model: "nomic-embed-text",
//       input: pages.map((page) => page.content),
//     }),
//   });

//   if (!res.ok) {
//     throw new Error("Failed to create text embedding");
//   }

//   const data = (await res.json()) as OllamaResponse;

//   return data.embeddings;
// }

// export async function createPdfEmbeddings(pages: any[]) {
//   Promise.all(
//     pages.map(async (page, index) => {
//       console.log("page.content", page);

//       const response = await fetch(`${OLLAMA_URL}/embeddings`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           model: "nomic-embed-text",
//           prompt: page, // IMPORTANT FIX
//         }),
//       });

//       const data = (await response.json()) as OllamaResponse;
//       console.log("data is", data);

//       return {
//         page: page.page ?? index,
//         content: page.content,
//         vector: data.embedding, // Ollama returns { embedding: [] }
//       };
//     }),
//   );
// }

// embeddings.ts
import { pipeline } from "@huggingface/transformers";
import { Pool } from "pg";
import { normalize } from "zod";
import { Embeddings } from "@langchain/core/embeddings";

let extractor: any = null;

export async function getEmbeddingModel() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }

  return extractor;
}

export async function generateTextEmbedding(text: string): Promise<number[]> {
  const model = await getEmbeddingModel();

  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
}

export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const extractor = await getEmbeddingModel();

    const output = await extractor(text, {
      pooling: "mean",
      normalize: true,
    });

    return Array.from(output.data);
  } catch (error: any) {
    console.error("Error", error);
    throw new Error("Qdrant embedding error");
  }
}


export class XenovaEmbeddings extends Embeddings {
  async embedQuery(text: string): Promise<number[]> {
    return generateEmbeddings(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(
      texts.map((text) => generateEmbeddings(text))
    );
  }
}
