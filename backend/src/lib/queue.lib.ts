import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(
  process.env.REDIS_URL || "redis://:myredissecret@redis:6379",
  {
    maxRetriesPerRequest: null,
  },
);

export interface PdfProcessingJobData {
  objectName: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export const pdfQueue = new Queue<PdfProcessingJobData>("pdf-processing", {
  connection,
});
