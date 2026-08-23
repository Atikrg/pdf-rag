import express, { Router } from "express";
import { uploadPdfController } from "../controllers/file.controller";
import { upload } from "../lib/multer";
import { fileUploadMinIOMiddleware } from "../middleware/fileUploadBucketMiddleware";
import { pdfQueue } from "../lib/queue.lib";
const router = Router();

router.post(
  "/upload",
  upload.single("pdf"),
  fileUploadMinIOMiddleware,
  uploadPdfController,
);

router.get("/upload/status/:jobId", async (request, response) => {
  const { jobId } = request.params;

  const job = await pdfQueue.getJob(jobId);

  if (!job) {
    return response.status(404).json({
      message: "Job not found",
    });
  }

  const state = await job.getState();

  return response.status(200).json({
    jobId: job.id,
    state,
    progress: job.progress,
    result: job.returnvalue,
    failedReason: job.failedReason,
  });
});

export default router;
