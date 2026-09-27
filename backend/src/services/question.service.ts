import type { OpenAiService } from "./openai.service";

export type QuestionEntry = {
  chunkIndex: number;
  chunkText: string;
  questions: string[];
};

export type GenerateQuestionsOptions = {
  /** How many questions to request per chunk. */
  perChunk?: number;
  /** How many chunks to send to the model in one call. */
  batchSize?: number;
  onProgress?: (done: number, total: number) => void;
};

/**
 * Generates hypothetical questions for already-indexed chunks so that user
 * queries phrased differently from the document still retrieve them.
 *
 * This is a recall aid, not a grounding mechanism: the questions are indexed
 * as separate points whose payload carries the parent chunk's text, and
 * retrieval returns that text rather than the question.
 *
 * Resilience matters more than completeness here. The model is a free-tier
 * route that rate-limits and occasionally returns malformed output, so a
 * failed batch is logged and skipped rather than failing the document. A chunk
 * that yields no questions is simply indexed without them.
 */
export async function generateQuestionsForChunks(
  chunks: Array<{ chunkIndex: number; text: string }>,
  openAiService: OpenAiService,
  options: GenerateQuestionsOptions = {},
): Promise<QuestionEntry[]> {
  const {
    perChunk = 6,
    batchSize = 4,
    onProgress,
  } = options;

  const total = chunks.length;
  const entries: QuestionEntry[] = [];
  let done = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (chunk) => {
        try {
          const questions = await openAiService.generateQuestions(
            chunk.text,
            perChunk,
          );

          if (questions.length > 0) {
            entries.push({
              chunkIndex: chunk.chunkIndex,
              chunkText: chunk.text,
              questions,
            });
          }
        } catch (error: any) {
          // Rate limits and transient upstream errors land here. The chunk stays
          // retrievable through its own `chunk` point.
          console.warn(
            `Question generation failed for chunk ${chunk.chunkIndex}: ${error?.message ?? error}`,
          );
        } finally {
          done += 1;
          onProgress?.(done, total);
        }
      }),
    );
  }

  return entries;
}
