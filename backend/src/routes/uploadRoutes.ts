import { Router } from "express";
import type { IRoutes } from "./IRoutes";
import type { FileController } from "../controllers/file.controller";
import type { IFileStorage } from "../core/ports/IFileStorage";
import { upload } from "../lib/multer";
import { authenticateJWT } from "../middleware/authMiddleware";
import { createFileUploadMiddleware } from "../middleware/fileUploadBucketMiddleware";

export class UploadRoutes implements IRoutes {
  public readonly basePath = "/api";

  constructor(
    private readonly fileController: FileController,
    private readonly fileStorage: IFileStorage,
  ) {}

  public register(): Router {
    const router = Router();

    router.post(
      "/upload",
      authenticateJWT,
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