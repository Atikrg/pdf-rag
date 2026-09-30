import { Router } from "express";
import type IORedis from "ioredis";
import type { IRoutes } from "./IRoutes";
import type { FileController } from "../controllers/file.controller";
import type { IFileStorage } from "../core/ports/IFileStorage";
import { upload } from "../lib/multer";
import { authenticateJWT } from "../middleware/authMiddleware";
import { rateLimit } from "../middleware/rateLimiter";
import { createFileUploadMiddleware } from "../middleware/fileUploadBucketMiddleware";

export class UploadRoutes implements IRoutes {
  public readonly basePath = "/api";

  constructor(
    private readonly fileController: FileController,
    private readonly fileStorage: IFileStorage,
    private readonly redis: IORedis,
  ) {}

  public register(): Router {
    const router = Router();

    // Per-user, and deliberately placed after authentication but *before* multer:
    // rejecting here means a throttled client never gets its body buffered into
    // memory, which is the expensive part of this route.
    const uploadLimit = rateLimit(this.redis, {
      windowMs: 60 * 60 * 1000,
      limit: 20,
      prefix: "upload",
      message: "Too many uploads this hour. Try again later.",
    });

    router.post(
      "/upload",
      authenticateJWT,
      uploadLimit,
      upload.single("pdf"),
      createFileUploadMiddleware(this.fileStorage),
      this.fileController.upload,
    );

    router.get(
      "/upload/status/:jobId",
      authenticateJWT,
      this.fileController.status,
    );

    router.get("/documents", authenticateJWT, this.fileController.list);

    router.get(
      "/documents/:id/file",
      authenticateJWT,
      this.fileController.streamFile,
    );

    router.get(
      "/documents/:id/summary",
      authenticateJWT,
      this.fileController.summary,
    );

    router.delete(
      "/documents/:id",
      authenticateJWT,
      this.fileController.delete,
    );

    return router;
  }
}