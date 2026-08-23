import express, { Router } from "express";
import {
  uploadPdfController,
  uploadStatusController,
} from "../controllers/file.controller";
import { upload } from "../lib/multer";
import { fileUploadMinIOMiddleware } from "../middleware/fileUploadBucketMiddleware";
const router = Router();

router.post(
  "/upload",
  upload.single("pdf"),
  fileUploadMinIOMiddleware,
  uploadPdfController,
);

router.get("/upload/status/:jobId", uploadStatusController);

export default router;
