import { createHash } from "crypto";
import type { QdrantClient } from "@qdrant/js-client-rest";
import type { HFEmbeddings } from "../lib/HFEmbeddings.lib";

export interface IndexedChunk {
  pageContent: string;
  metadata: {
    type: string;
    documentId?: string;
    pageIndex?: number;
    sheetName?: string;
    rowIndex?: number;
    paragraphIndex?: number;
    sectionIndex?: number;
  };
}

/** Payload marker distinguishing the canonical chunk point from its questions. */
export const CHUNK_KIND = "chunk";
export const QUESTION_KIND = "question";

const SPARSE_NAME = "sparse";
const DENSE_NAME = "dense";

/**
 * Qdrant point ids must be an unsigned integer or a UUID. Deriving the id from
 * stable inputs (rather than a random UUID) makes re-indexing idempotent: the
 * same document re-uploaded, or re-enriched by the question job, overwrites its
 * own points instead of appending duplicates.
 */
function pointId(...parts: (string | number)[]): string {
  const hex = createHash("sha1").update(parts.join("\u0000")).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export const chunkPointId = (documentId: string, chunkIndex: number) =>
  pointId(documentId, CHUNK_KIND, chunkIndex);

export const questionPointId = (
  documentId: string,
  chunkIndex: number,
  questionIndex: number,
) => pointId(documentId, CHUNK_KIND, chunkIndex, QUESTION_KIND, questionIndex);

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
   *
   * Each chunk becomes exactly one point of kind `chunk`. Companion points of
   * kind `question` are added separately by `upsertQuestionPoints`.
   */
  async indexChunks(
    chunks: IndexedChunk[],
    collectionName: string,
    documentId: string,
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    await this.ensureCollection(collectionName);

    const points = await Promise.all(
      chunks.map(async (chunk, index) => ({
        id: chunkPointId(documentId, index),
        vector: await this.buildVectors(chunk.pageContent),
        payload: {
          kind: CHUNK_KIND,
          documentId,
          chunkIndex: index,
          pageIndex: chunk.metadata.pageIndex,
          sheetName: chunk.metadata.sheetName,
          rowIndex: chunk.metadata.rowIndex,
          paragraphIndex: chunk.metadata.paragraphIndex,
          sectionIndex: chunk.metadata.sectionIndex,
          type: chunk.metadata.type,
          text: chunk.pageContent,
        },
      })),
    );

    await this.upsertPoints(collectionName, points, onProgress);
  }

  /**
   * Adds generated question points for already-indexed chunks. Each question
   * becomes its own point so a user query can match the *phrasing* they used
   * rather than the document's wording. The parent chunk's text travels in the
   * payload so retrieval can hand real context to the LLM.
   */
  async upsertQuestionPoints(
    questionsByChunk: Array<{
      chunkIndex: number;
      chunkText: string;
      questions: string[];
    }>,
    collectionName: string,
    documentId: string,
    onProgress?: (done: number, total: number) => void,
  ): Promise<number> {
    const total = questionsByChunk.reduce(
      (sum, entry) => sum + entry.questions.length,
      0,
    );

    if (total === 0) return 0;

    const points = await Promise.all(
      questionsByChunk.flatMap((entry) =>
        entry.questions.map(async (question, questionIndex) => ({
          id: questionPointId(documentId, entry.chunkIndex, questionIndex),
          vector: await this.buildVectors(question),
          payload: {
            kind: QUESTION_KIND,
            documentId,
            chunkIndex: entry.chunkIndex,
            question,
            // Denormalised parent text: hybridSearch returns this as the
            // context so the model never sees a bare generated question.
            text: entry.chunkText,
          },
        })),
      ),
    );

    await this.upsertPoints(collectionName, points, onProgress);

    return points.length;
  }

  /**
   * Reads back the canonical chunk points for a document. Used by the
   * enrichment job, which needs the chunk text to generate questions without
   * re-parsing the source file.
   */
  async getChunksForDocument(
    collectionName: string,
    documentId: string,
  ): Promise<Array<{ chunkIndex: number; text: string }>> {
    if (!(await this.collectionExists(collectionName))) return [];

    const result = await this.client.scroll(collectionName, {
      limit: 10_000,
      filter: {
        must: [
          { key: "documentId", match: { value: documentId } },
          { key: "kind", match: { value: CHUNK_KIND } },
        ],
      },
      with_payload: true,
      with_vector: false,
    });

    return (result.points ?? [])
      .map((point) => {
        const payload = (point.payload ?? {}) as {
          chunkIndex?: number;
          text?: string;
        };
        return {
          chunkIndex:
            typeof payload.chunkIndex === "number" ? payload.chunkIndex : 0,
          text: typeof payload.text === "string" ? payload.text : "",
        };
      })
      .filter((entry) => entry.text.length > 0)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  private async buildVectors(text: string) {
    const dense = await this.embeddings.embedQuery(text);
    return { [DENSE_NAME]: dense, [SPARSE_NAME]: sparseVector(text) };
  }

  private async upsertPoints(
    collectionName: string,
    points: Array<{ id: string; vector: any; payload: Record<string, any> }>,
    onProgress?: (done: number, total: number) => void,
  ) {
    for (let i = 0; i < points.length; i += 64) {
      await this.client.upsert(collectionName, {
        wait: true,
        points: points.slice(i, i + 64),
      });
      onProgress?.(Math.min(i + 64, points.length), points.length);
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
   *
   * Each result also carries `score`, the raw dense cosine similarity. RRF is a
   * rank-fusion score and is not comparable across queries, so the caller uses
   * `score` as the relevance signal for deciding whether to answer at all.
   */
  async hybridSearch(
    question: string,
    collectionName: string,
    topK = 5,
    documentId?: string,
  ): Promise<
    Array<{
      id: string;
      pageContent: string;
      metadata: Record<string, any>;
      score: number;
    }>
  > {
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
      { rrf: number; score: number; payload: Record<string, any> }
    >();

    // Dense leg: records the RRF contribution and the only trustworthy
    // relevance number, the cosine similarity.
    denseRes.points.forEach((point, i) => {
      const id = String(point.id);
      const prev = scores.get(id);

      scores.set(id, {
        rrf: (prev?.rrf ?? 0) + 1 / (60 + i + 1),
        score: typeof point.score === "number" ? point.score : 0,
        payload: (point.payload ?? {}) as Record<string, any>,
      });
    });

    // Sparse leg: contributes rank only. Its `score` is a sparse dot product,
    // not a cosine, so it is deliberately discarded — mixing the two made
    // results exceed 1.0 and rendered the relevance threshold meaningless.
    sparseRes.points.forEach((point, i) => {
      const id = String(point.id);
      const prev = scores.get(id);

      scores.set(id, {
        rrf: (prev?.rrf ?? 0) + 1 / (60 + i + 1),
        // A point only the sparse leg found has no dense evidence at all, so it
        // scores 0 and the caller treats it as unverified.
        score: prev?.score ?? 0,
        payload: (point.payload ?? {}) as Record<string, any>,
      });
    });

    return [...scores.entries()]
      .sort((a, b) => b[1].rrf - a[1].rrf)
      .slice(0, topK)
      .map(([id, value]) => {
        const { text, chunkText, question: generatedQuestion, ...metadata } =
          value.payload;

        // Question points keep the parent chunk's text in `text`; using it here
        // is what stops a generated question from reaching the LLM as context.
        return {
          id,
          pageContent: typeof text === "string" ? text : "",
          metadata: {
            ...metadata,
            source: "hybrid",
            ...(typeof generatedQuestion === "string"
              ? { matchedQuestion: generatedQuestion }
              : {}),
            ...(typeof chunkText === "string" ? { chunkText } : {}),
          },
          score: Number.isFinite(value.score) ? value.score : 0,
        };
      });
  }

  /**
   * True when a result carries enough dense evidence to answer from. Results
   * that only the sparse leg found score 0 and fail this.
   */
  static isRelevant(score: number, threshold: number): boolean {
    return Number.isFinite(score) && score >= threshold;
  }

  /**
   * Pulls the full indexed body of a document (all chunks, oldest first) so the
   * summary endpoint can summarize it without re-reading the PDF.
   *
   * Restricted to `chunk` points: a document also carries generated question
   * points, and including them would repeat the same text once per question.
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
        must: [
          { key: "documentId", match: { value: documentId } },
          { key: "kind", match: { value: CHUNK_KIND } },
        ],
      },
      with_payload: true,
    });

    return (points.points ?? [])
      .sort((a, b) => {
        const indexOf = (p: any) =>
          typeof p?.payload?.chunkIndex === "number" ? p.payload.chunkIndex : 0;
        return indexOf(a) - indexOf(b);
      })
      .map((point) =>
        typeof (point.payload as any)?.text === "string"
          ? (point.payload as any).text
          : "",
      )
      .join("\n\n");
  }
}