import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import type {
  IPdfProcessingQueue,
  PdfJobState,
  PdfJobStatus,
  PdfProcessingResult,
} from "../core/ports/IPdfProcessingQueue";
import type { StoredFileMeta } from "../core/ports/IFileStorage";

export const PDF_QUEUE_NAME = "pdf-processing";

export class BullMqPdfQueue implements IPdfProcessingQueue {
  private queue: Queue<StoredFileMeta> | null = null;

  constructor(private readonly connection: IORedis) {}

  private getQueue(): Queue<StoredFileMeta> {
    if (!this.queue) {
      this.queue = new Queue<StoredFileMeta>(PDF_QUEUE_NAME, {
        connection: this.connection,
      });
    }

    return this.queue;
  }

  public async enqueue(meta: StoredFileMeta): Promise<string> {
    const job = await this.getQueue().add("process-pdf", meta);

    return job.id ?? "";
  }

  public async getStatus(jobId: string): Promise<PdfJobStatus | null> {
    const job = await this.getQueue().getJob(jobId);

    if (!job) {
      return null;
    }

    const state = (await job.getState()) as PdfJobState;

    return {
      jobId: job.id ?? jobId,
      state,
      progress: Number(job.progress) || 0,
      result: (job.returnvalue as PdfProcessingResult | undefined) ?? null,
      failedReason: job.failedReason ?? null,
    };
  }
}

export class BullMqWorkerFactory {
  constructor(private readonly connection: IORedis) {}

  public create(
    processor: (
      meta: StoredFileMeta,
      report: (progress: number) => void,
    ) => Promise<PdfProcessingResult>,
  ): Worker<StoredFileMeta> {
    return new Worker<StoredFileMeta>(
      PDF_QUEUE_NAME,
      async (job) => {
        // BullMQ only keeps the latest value, so the pipeline pushes progress
        // at each stage instead of leaving the job pinned at 5%.
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
        concurrency: 1,
      },
    );
  }
}
