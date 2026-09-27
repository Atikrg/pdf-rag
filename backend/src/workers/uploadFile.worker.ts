import { container } from "../container/container";
import { BullMqWorkerFactory } from "../infrastructure/BullMqPdfQueue";

const workerFactory = new BullMqWorkerFactory(container.getRedisConnection());

const worker = workerFactory.create(async (meta, report) => {
  const result = await container.documentPipeline.process(meta, report);

  if (meta.documentId) {
    await container.documentService.markCompleted(
      meta.documentId,
      result.totalPages,
      result.totalChunks,
    );

    // Phase 2 is enqueued here, after indexing, so the enricher can never run
    // ahead of the chunks it needs to read. It stays best-effort: a rate-limited
    // or failing model must not fail an otherwise successful upload.
    container.questionQueue.enqueue(meta).catch((err) => {
      console.error("Failed to enqueue question enrichment:", err);
    });
  }

  return result;
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id ?? "unknown"} failed:`, error.message);

  const documentId = job?.data?.documentId;
  if (documentId) {
    container.documentService
      .markFailed(documentId)
      .catch((err) => console.error("Failed to mark document failed:", err));
  }
});

console.log("PDF processing worker started");

export default worker;
