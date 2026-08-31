import type { NextFunction, Request, Response } from "express";
import type { IFileStorage } from "../core/ports/IFileStorage";

export const createFileUploadMiddleware = (fileStorage: IFileStorage) => {
  return async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
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
          message: "PDF is required",
        });
      }

      const objectName = `users/${userId}/${crypto.randomUUID()}.pdf`;

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
