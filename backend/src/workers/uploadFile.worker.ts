import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { ragDependencyInjection } from "../container/rag.dependencyInjection";
import type { PdfProcessingJobData } from "../lib/queue.lib";

const connection = new IORedis(
  process.env.REDIS_URL || "redis://:myredissecret@redis:6379",
  {
    maxRetriesPerRequest: null,
  },
);

const worker = new Worker<PdfProcessingJobData>(
  "pdf-processing",
  async (job: Job<PdfProcessingJobData>) => {
    const { objectName } = job.data;

    const collectionName = process.env.QRANT_COLLECTION as string;

    if (
      !(await ragDependencyInjection.qdrantService.collectionExists(
        collectionName,
      ))
    ) {
      await ragDependencyInjection.qdrantService.createCollection(
        collectionName,
      );
    }

    await job.updateProgress(10);

    const docs =
      await ragDependencyInjection.ragService.loadPdfFromMinIO(objectName);

    await job.updateProgress(30);

    const pages = await ragDependencyInjection.ragService.extractPdfPages(docs);

    await job.updateProgress(40);

    const formattedPages =
      await ragDependencyInjection.qdrantService.formatPages(pages);

    await job.updateProgress(50);

    await ragDependencyInjection.qdrantService.storeInQdrant(
      formattedPages,
      collectionName,
    );

    await job.updateProgress(70);

    const recursiveChunks = await ragDependencyInjection.ragService.recursiveChunking(
      pages,
    );

    await job.updateProgress(80);

    await ragDependencyInjection.qdrantService.storeInQdrant(
      recursiveChunks,
      collectionName,
    );

    await job.updateProgress(100);

    return {
      totalPages: pages.length,
      totalChunks: recursiveChunks.length,
    };
  },
  {
    connection,
    concurrency: 1,
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id ?? "unknown"} failed:`, error.message);
});

console.log("PDF processing worker started");

export default worker;
