import { pipeline } from "@huggingface/transformers";
import { Embeddings } from "@langchain/core/embeddings";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractor: any = null;

/**
 * Loads the feature-extraction model once and memoises it.
 *
 * `local_files_only: true` is essential here, not an optimisation. The image
 * vendors the model at
 * `node_modules/@huggingface/transformers/models/Xenova/all-MiniLM-L6-v2`, but
 * the library otherwise contacts huggingface.co on every load to check for a
 * newer revision. In an environment without egress that call fails with
 * `getaddrinfo ETIMEOUT huggingface.co` and takes the whole enrichment job down
 * with it, even though the weights are sitting on disk.
 *
 * `dtype: "q8"` pins the quantised ONNX file. Without it the library resolves
 * the unquantised `onnx/model.onnx` (~90MB) and fails with "file was not found
 * locally", because only the smaller `onnx/model_quantized.onnx` is vendored.
 */
async function getEmbeddingModel() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", MODEL_ID, {
      local_files_only: true,
      dtype: "q8",
    });
  }

  return extractor;
}

export class HFEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedQuery(text: string): Promise<number[]> {
    const model = await getEmbeddingModel();

    const output = await model(text, {
      pooling: "mean",
      normalize: true,
    });

    return Array.from(output.data);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }
}
