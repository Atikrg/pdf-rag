import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import type { IQuestionQueue, QuestionJobResult } from "../core/ports/IQuestionQueue";
import type { StoredFileMeta } from "../core/ports/IFileStorage";

export const QUESTION_QUEUE_NAME = "question-enrichment";

/** Attempts per job. Enrichment is best-effort, so it retries briefly. */
const ENRICHMENT_ATTEMPTS = 2;

export class BullMqQuestionQueue implements IQuestionQueue {
  private queue: Queue<StoredFileMeta> | null = null;

  constructor(private readonly connection: IORedis) {}

  private getQueue(): Queue<StoredFileMeta> {
    if (!this.queue) {
      this.queue = new Queue<StoredFileMeta>(QUESTION_QUEUE_NAME, {
        connection: this.connection,
      });
    }

    return this.queue;
  }

  public async enqueue(meta: StoredFileMeta): Promise<string> {
    const job = await this.getQueue().add(
      "enrich-questions",
      meta,
      {
        attempts: ENRICHMENT_ATTEMPTS,
        backoff: { type: "exponential", delay: 5_000 },
        // Re-uploading a document that is still being enriched should not stack
        // duplicate jobs for the same document.
        jobId: meta.documentId ? `enrich-${meta.documentId}` : undefined,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return job.id ?? "";
  }
}

export class BullMqQuestionWorkerFactory {
  constructor(private readonly connection: IORedis) {}

  public create(
    processor: (
      meta: StoredFileMeta,
      report: (progress: number) => void,
    ) => Promise<QuestionJobResult>,
  ): Worker<StoredFileMeta> {
    return new Worker<StoredFileMeta>(
      QUESTION_QUEUE_NAME,
      async (job) => {
        const report = (progress: number) => {
          void job.updateProgress(progress);
        };

        report(5);

        const result = await processor(job.data, report);

        report(100);

        return result;
      },
      {
        connection: this.connection,
        // Generation is dominated by model latency, so several documents can be
        // enriched in flight without competing for CPU.
        concurrency: 2,
      },
    );
  }
}
