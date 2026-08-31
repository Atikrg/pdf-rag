import type { Request, Response } from "express";
import type { IPdfProcessingQueue } from "../core/ports/IPdfProcessingQueue";
import type { StoredFileMeta, IFileStorage } from "../core/ports/IFileStorage";
import type { DocumentService } from "../services/document.service";
import type { AppConfig } from "../config/AppConfig";
import type { QdrantService } from "../services/qdrant.service";
import type { OpenAiService } from "../services/openai.service";
import { fileSchema } from "../types/zodSchema";
import { summaryPrompt } from "../services/prompts.service";

export class FileController {
  constructor(
    private readonly pdfQueue: IPdfProcessingQueue,
    private readonly documentService: DocumentService,
    private readonly config: AppConfig,
    private readonly fileStorage: IFileStorage,
    private readonly qdrantService: QdrantService,
    private readonly openAiService: OpenAiService,
  ) {}

  public upload = async (request: Request, response: Response) => {
    try {
      const userId = request.userId;

      if (!userId) {
        return response.status(401).json({ message: "Unauthorized" });
      }

      const { data, success } = fileSchema.safeParse(request.fileData);

      if (!success || !data) {
        return response.status(400).json({ message: "No file uploaded" });
      }

      const canUpload = await this.documentService.canUpload(
        userId,
        this.config.maxDocsPerUser,
      );

      if (!canUpload) {
        return response.status(403).json({
          success: "fail",
          message: `You can upload a maximum of ${this.config.maxDocsPerUser} PDFs. Please delete one to upload another.`,
        });
      }

      const meta: StoredFileMeta = {
        objectName: data.objectName,
        originalName: data.originalName,
        size: data.size,
        mimeType: data.mimeType,
        userId,
        documentId: "",
      };

      const document = await this.documentService.create(userId, meta);
      meta.documentId = document.id;

      const jobId = await this.pdfQueue.enqueue(meta);

      return response.status(202).json({
        success: true,
        jobId,
        documentId: document.id,
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

  public list = async (request: Request, response: Response) => {
    try {
      const userId = request.userId;

      if (!userId) {
        return response.status(401).json({ message: "Unauthorized" });
      }

      const documents = await this.documentService.listByUser(userId);

      return response.status(200).json({
        success: "success",
        documents,
      });
    } catch (error: any) {
      console.error("Error", error);

      return response.status(500).json({
        success: "fail",
        message: "Failed to fetch documents.",
        error: error.message,
      });
    }
  };

  public streamFile = async (request: Request, response: Response) => {
    try {
      const userId = request.userId;

      if (!userId) {
        return response.status(401).json({ message: "Unauthorized" });
      }

      const document = await this.documentService.getOwnedDocument(
        userId,
        request.params.id,
      );

      if (!document) {
        return response.status(404).json({ message: "Document not found" });
      }

      const buffer = await this.fileStorage.downloadPdf(document.objectName);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(document.originalName)}"`,
      );
      response.send(buffer);
    } catch (error: any) {
      console.error("Error", error);

      return response.status(500).json({
        success: "fail",
        message: "Failed to stream document.",
        error: error.message,
      });
    }
  };

  public status = async (request: Request, response: Response) => {
    try {
      const { jobId } = request.params;

      if (!jobId || typeof jobId !== "string") {
        return response.status(400).json({
          message: "Job ID is required",
        });
      }

      const status = await this.pdfQueue.getStatus(jobId);

      if (!status) {
        return response.status(404).json({
          message: "Job not found",
        });
      }

      return response.status(200).json(status);
    } catch (error: any) {
      console.error("Error", error);

      return response.status(500).json({
        success: "fail",
        message: "Failed to fetch job status.",
        error: error.message,
      });
    }
  };

  public delete = async (request: Request, response: Response) => {
    try {
      const userId = request.userId;

      if (!userId) {
        return response.status(401).json({ message: "Unauthorized" });
      }

      const document = await this.documentService.getOwnedDocument(
        userId,
        request.params.id,
      );

      if (!document) {
        return response.status(404).json({ message: "Document not found" });
      }

      const collectionName = this.qdrantService.collectionForUser(
        this.config.qdrantCollection,
        userId,
      );

      // Remove vectors, the stored file, then the DB row.
      await this.qdrantService.deleteDocument(collectionName, document.id);
      await this.fileStorage.deletePdf(document.objectName).catch((err) => {
        console.error(`Failed to delete ${document.objectName} from storage:`, err);
      });
      await this.documentService.delete(userId, document.id);

      return response.status(200).json({
        success: true,
        message: "Document deleted.",
      });
    } catch (error: any) {
      console.error("Error", error);

      return response.status(500).json({
        success: "fail",
        message: "Failed to delete document.",
        error: error.message,
      });
    }
  };

  public summary = async (request: Request, response: Response) => {
    try {
      const userId = request.userId;

      if (!userId) {
        return response.status(401).json({ message: "Unauthorized" });
      }

      const document = await this.documentService.getOwnedDocument(
        userId,
        request.params.id,
      );

      if (!document) {
        return response.status(404).json({ message: "Document not found" });
      }

      const collectionName = this.qdrantService.collectionForUser(
        this.config.qdrantCollection,
        userId,
      );

      const text = await this.qdrantService.getDocumentText(
        collectionName,
        document.id,
      );

      if (!text.trim()) {
        return response.status(200).json({
          success: true,
          summary: "This document has not been indexed yet.",
        });
      }

      const summary = await this.openAiService.complete(
        summaryPrompt(document.originalName, text),
      );

      return response.status(200).json({
        success: true,
        summary,
      });
    } catch (error: any) {
      console.error("Error", error);

      return response.status(500).json({
        success: "fail",
        message: "Failed to summarize document.",
        error: error.message,
      });
    }
  };
}