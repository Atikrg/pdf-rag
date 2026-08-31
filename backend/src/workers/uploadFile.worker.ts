import { container } from "../container/container";
import { BullMqWorkerFactory } from "../infrastructure/BullMqPdfQueue";

const workerFactory = new BullMqWorkerFactory(container.getRedisConnection());

const worker = workerFactory.create(async (meta) => {
  const result = await container.pdfPipeline.process(meta);

  if (meta.documentId) {
    await container.documentService.markCompleted(
      meta.documentId,
      result.totalPages,
      result.totalChunks,
    );
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
