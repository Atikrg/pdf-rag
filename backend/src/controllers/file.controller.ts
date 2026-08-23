import type { Request, Response } from "express";
import { pdfQueue } from "../lib/queue.lib";
import { fileSchema } from "../types/zodSchema";

export const uploadPdfController = async (
  request: Request,
  response: Response,
) => {
  try {
    const { data, success } = fileSchema.safeParse(request.fileData);

    if (!success || !data) {
      return response.status(400).json({
        message: "No file uploaded",
      });
    }

    const job = await pdfQueue.add("process-pdf", {
      objectName: data.objectName,
      originalName: data.originalName,
      size: data.size,
      mimeType: data.mimeType,
    });

    return response.status(202).json({
      success: true,
      jobId: job.id,
      fileName: data.originalName,
      message: "File uploaded. Processing started.",
    });
  } catch (error: any) {
    console.error("Error", error);

    return response.status(500).json({
      success: "fail",
      fileName: request.file?.originalname,
      message: "File upload failed.",
      error: error.message,
    });
  }
};
