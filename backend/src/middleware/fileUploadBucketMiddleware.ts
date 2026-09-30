import type { NextFunction, Request, Response } from "express";
import type { IFileStorage } from "../core/ports/IFileStorage";
import {
  extensionForMimeType,
  looksLikeDeclaredType,
  UPLOAD_CONTENT_REJECTED,
  UPLOAD_TYPE_REJECTED,
} from "../lib/multer";

export const createFileUploadMiddleware = (fileStorage: IFileStorage) => {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const userId = request.userId;

      if (!userId) {
        return response.status(400).json({
          message: "Invalid User",
        });
      }

      const file = request.file;

      if (!file) {
        return response.status(400).json({
          message: "File is required",
        });
      }

      // The suffix comes from the validated MIME type, not from `originalname`.
      // The filename is fully client-controlled, so using it for the object key
      // let a caller influence the stored key (separators, odd extensions).
      // `originalName` is still persisted separately for display.
      const extension = extensionForMimeType(file.mimetype);

      if (!extension) {
        return response.status(400).json({ message: UPLOAD_TYPE_REJECTED });
      }

      // `Content-Type` is client-controlled too, so confirm the bytes agree
      // before anything is persisted. Otherwise a renamed executable is stored
      // and later served back from /documents/:id/file as application/pdf.
      if (!looksLikeDeclaredType(file.mimetype, file.buffer)) {
        return response.status(400).json({ message: UPLOAD_CONTENT_REJECTED });
      }

      const objectName = `users/${userId}/${crypto.randomUUID()}.${extension}`;

      await fileStorage.uploadPdf(objectName, file.buffer);

      request.fileData = {
        objectName,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        userId,
        documentId: "",
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
