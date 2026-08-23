import type { NextFunction, Request, Response } from "express";

import { fileUploadHandler } from "../helper";

export const fileUploadMinIOMiddleware = async (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
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

  const { originalName, size, mimeType, objectName } = await fileUploadHandler(
    file,
    userId,
  );

  request.fileData = {
    objectName: objectName,
    originalName: originalName,
    size: size,
    mimeType: mimeType,
  };

  next();
};
