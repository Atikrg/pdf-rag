import type { QdrantClient } from "@qdrant/js-client-rest";
import type { HFEmbeddings } from "../lib/HFEmbeddings.lib";

export interface IndexedChunk {
  pageContent: string;
  metadata: {
    pageIndex: number;
    type: string;
    documentId?: string;
  };
}

const SPARSE_NAME = "sparse";
const DENSE_NAME = "dense";

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "was", "were", "with", "that", "this", "from",
  "have", "has", "had", "not", "but", "you", "your", "will", "they", "them",
  "their", "there", "what", "when", "where", "which", "who", "whom", "than",
  "then", "also", "into", "over", "under", "about", "after", "before",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function hashIndex(word: string): number {
  let hash = 2166136261;
  for (let i = 0; i < word.length; i++) {
    hash ^= word.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Builds a deterministic term-frequency sparse vector for a text. No external
 * model is required, which keeps indexing self-contained.
 */
function sparseVector(text: string): { indices: number[]; values: number[] } {
  const freq = new Map<string, number>();
  for (const word of tokenize(text)) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300);

  const indices: number[] = [];
  const values: number[] = [];
  for (const [word, count] of ranked) {
    indices.push(hashIndex(word));
    values.push(Math.sqrt(count));
  }

  return { indices, values };
}

export class QdrantService {
  constructor(
    private readonly client: QdrantClient,
    private readonly embeddings: HFEmbeddings,
  ) {}

  collectionForUser(baseName: string, userId?: string): string {
    return userId ? `${baseName}_${userId}` : baseName;
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      await this.client.getCollection(collectionName);
      return true;
    } catch {
      return false;
    }
  }

  private async isSchemaCurrent(collectionName: string): Promise<boolean> {
    try {
      const info = await this.client.getCollection(collectionName);
      const vectors = info.config?.params?.vectors;
      const hasNamedDense =
        !!vectors && typeof vectors === "object" && DENSE_NAME in vectors;
      const sparseVectors = info.config?.params?.sparse_vectors as
        | Record<string, unknown>
        | undefined;
      const hasSparse = !!sparseVectors?.[SPARSE_NAME];
      return hasNamedDense && hasSparse;
    } catch {
      return false;
    }
  }

  private async ensureCollection(collectionName: string): Promise<void> {
    if (!(await this.collectionExists(collectionName))) {
      await this.createCollection(collectionName);
      return;
    }

    // Re-create collections built with the old (unnamed dense + no sparse) layout.
    if (!(await this.isSchemaCurrent(collectionName))) {
      await this.client.deleteCollection(collectionName);
      await this.createCollection(collectionName);
    }
  }

  async createCollection(name: string): Promise<void> {
    await this.client.createCollection(name, {
      vectors: {
        dense: { size: 384, distance: "Cosine" },
      },
      sparse_vectors: {
        sparse: {},
      },
    });
  }

  /**
   * Embeds chunks and upserts them with both a dense vector (`dense`) and a
   * term-frequency sparse vector (`sparse`) so queries can run true hybrid.
   */
  async indexChunks(
    chunks: IndexedChunk[],
    collectionName: string,
  ): Promise<void> {
    await this.ensureCollection(collectionName);

    const points = await Promise.all(
      chunks.map(async (chunk) => {
        const dense = await this.embeddings.embedQuery(chunk.pageContent);
        const sparse = sparseVector(chunk.pageContent);

        return {
          id: crypto.randomUUID(),
          vector: {
            [DENSE_NAME]: dense,
            [SPARSE_NAME]: sparse,
          },
          payload: {
            pageIndex: chunk.metadata.pageIndex,
            type: chunk.metadata.type,
            documentId: chunk.metadata.documentId,
            text: chunk.pageContent,
          },
        };
      }),
    );

    for (let i = 0; i < points.length; i += 64) {
      await this.client.upsert(collectionName, {
        wait: true,
        points: points.slice(i, i + 64),
      });
    }
  }

  /** Deletes every stored chunk that belongs to a document id. */
  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    if (!(await this.collectionExists(collectionName))) return;

    await this.client.delete(collectionName, {
      wait: true,
      filter: {
        must: [{ key: "documentId", match: { value: documentId } }],
      },
    });
  }

  /**
   * Runs a real hybrid search: a dense semantic query plus a sparse/keyword
   * query, merged with Reciprocal Rank Fusion. Returns up to `topK` results.
   */
  async hybridSearch(
    question: string,
    collectionName: string,
    topK = 5,
    documentId?: string,
  ): Promise<Array<{ id: string; pageContent: string; metadata: Record<string, any> }>> {
    if (!(await this.collectionExists(collectionName))) return [];

    const dense = await this.embeddings.embedQuery(question);
    const sparse = sparseVector(question);

    const prefetchLimit = Math.max(topK * 20, 40);

    const filter = documentId
      ? {
          must: [{ key: "documentId", match: { value: documentId } }],
        }
      : undefined;

    const denseRes = await this.client.query(collectionName, {
      filter,
      using: DENSE_NAME,
      query: dense,
      limit: prefetchLimit,
      with_payload: true,
    });

    const sparseRes = await this.client.query(collectionName, {
      filter,
      using: SPARSE_NAME,
      query: sparse,
      limit: prefetchLimit,
      with_payload: true,
    });

    const scores = new Map<
      string,
      { rrf: number; payload: Record<string, any> }
    >();

    for (const [i, point] of denseRes.points.entries()) {
      const prev = scores.get(point.id);
      scores.set(point.id, {
        rrf: (prev?.rrf ?? 0) + 1 / (60 + i + 1),
        payload: (point.payload ?? {}) as Record<string, any>,
      });
    }
    for (const [i, point] of sparseRes.points.entries()) {
      const prev = scores.get(point.id);
      scores.set(point.id, {
        rrf: (prev?.rrf ?? 0) + 1 / (60 + i + 1),
        payload: (point.payload ?? {}) as Record<string, any>,
      });
    }

    return [...scores.entries()]
      .sort((a, b) => b[1].rrf - a[1].rrf)
      .slice(0, topK)
      .map(([id, value]) => {
        const { text, ...metadata } = value.payload;
        return {
          id,
          pageContent: typeof text === "string" ? text : "",
          metadata: { ...metadata, source: "hybrid" },
        };
      });
  }

  /**
   * Pulls the full indexed body of a document (all chunks, oldest first) so the
   * summary endpoint can summarize it without re-reading the PDF.
   */
  async getDocumentText(
    collectionName: string,
    documentId: string,
    limit = 200,
  ): Promise<string> {
    if (!(await this.collectionExists(collectionName))) return "";

    const points = await this.client.scroll(collectionName, {
      limit,
      filter: {
        must: [{ key: "documentId", match: { value: documentId } }],
      },
      with_payload: true,
    });

    return (points.points ?? [])
      .map((point) =>
        typeof (point.payload as any)?.text === "string"
          ? (point.payload as any).text
          : "",
      )
      .join("\n\n");
  }
}