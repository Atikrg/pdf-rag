import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../error/CustomError";
import {
  UPLOAD_CONTENT_REJECTED,
  UPLOAD_TYPE_REJECTED,
} from "../lib/multer";

export function errorHandler(
  error: Error,
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (response.headersSent) {
    return next(error);
  }

  console.error("Unhandled error:", error);

  if (error instanceof multer.MulterError || error?.name === "MulterError") {
    const code = (error as any).code;
    const message =
      code === "LIMIT_FILE_SIZE"
        ? "File is too large"
        : code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE"
          ? "Too many files"
          : "File upload rejected";
    return response.status(400).json({ success: "fail", message });
  }

  if (error instanceof AppError) {
    return response
      .status(error.statusCode)
      .json({ success: "fail", message: error.message || "Request failed" });
  }

  if (error?.message === UPLOAD_TYPE_REJECTED) {
    return response
      .status(400)
      .json({ success: "fail", message: UPLOAD_TYPE_REJECTED });
  }

  if (error?.message === UPLOAD_CONTENT_REJECTED) {
    return response
      .status(400)
      .json({ success: "fail", message: UPLOAD_CONTENT_REJECTED });
  }

  // Anything unrecognised is a bug, and its message is written for developers:
  // it can carry SQL fragments, upstream URLs, filesystem paths, or library
  // internals. The detail is already logged above, so the response stays generic.
  response.status(500).json({
    success: "fail",
    message: "Internal Server Error",
  });
}
