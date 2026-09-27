import { container } from "../container/container";
import { BullMqQuestionWorkerFactory } from "../infrastructure/BullMqQuestionQueue";

/**
 * Phase 2 of document indexing. Runs after a document's own text is already
 * searchable and adds hypothetical questions so queries phrased differently
 * from the source still retrieve it.
 *
 * Failures are logged and swallowed: the document is already usable without
 * questions, so a rate-limited model must not surface as a processing error.
 */
const workerFactory = new BullMqQuestionWorkerFactory(
  container.getRedisConnection(),
);

const worker = workerFactory.create(async (meta, report) => {
  const result = await container.documentPipeline.enrichWithQuestions(
    meta,
    report,
  );

  console.log(
    `Enriched document ${meta.documentId} with ${result.questionsIndexed} questions`,
  );

  return result;
});

worker.on("completed", (job) => {
  console.log(`Enrichment job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(
    `Enrichment job ${job?.id ?? "unknown"} failed:`,
    error?.message ?? error,
  );
});

console.log("Question enrichment worker started");

export default worker;
