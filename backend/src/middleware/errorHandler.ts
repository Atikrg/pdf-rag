import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../error/CustomError";

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
        : error.message || "File upload rejected";
    return response.status(400).json({ success: "fail", message });
  }

  if (error instanceof AppError) {
    return response
      .status(error.statusCode)
      .json({ success: "fail", message: error.message || "Request failed" });
  }

  if (error?.message === "Only PDF Allowed!") {
    return response
      .status(400)
      .json({ success: "fail", message: "Only PDF files are allowed" });
  }

  response.status(500).json({
    success: "fail",
    message: error.message || "Internal Server Error",
  });
}
