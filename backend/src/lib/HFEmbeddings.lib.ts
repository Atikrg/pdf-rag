import { Embeddings } from "@langchain/core/embeddings";
import { getEmbeddingModel } from "./embeddings";

export class HFEmbeddings extends Embeddings {

  constructor() {
    super({});
  }
  async embedQuery(text: string): Promise<number[]> {
    const extractor = await getEmbeddingModel();

    const output = await extractor(text, {
      pooling: "mean",
      normalize: true,
    });

    return Array.from(output.data);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }
}
