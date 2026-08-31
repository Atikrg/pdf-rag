import { prisma } from "../lib/prisma";
import type { StoredFileMeta } from "../core/ports/IFileStorage";

export class DocumentService {
  /**
   * Counts the user's active (non-failed) documents.
   */
  async countActiveByUser(userId: string): Promise<number> {
    return prisma.document.count({
      where: {
        userId,
        status: { in: ["processing", "ready"] },
      },
    });
  }

  /**
   * Returns true when the user hasn't yet reached the per-user PDF limit.
   */
  async canUpload(userId: string, maxDocs: number): Promise<boolean> {
    const count = await this.countActiveByUser(userId);
    return count < maxDocs;
  }

  /**
   * Creates a Document row (status = processing) before the PDF job runs.
   */
  async create(userId: string, meta: StoredFileMeta) {
    return prisma.document.create({
      data: {
        userId,
        objectName: meta.objectName,
        originalName: meta.originalName,
        size: meta.size,
        mimeType: meta.mimeType,
        status: "processing",
      },
    });
  }

  async markCompleted(documentId: string, totalPages: number, totalChunks: number) {
    return prisma.document.update({
      where: { id: documentId },
      data: {
        status: "ready",
        totalPages,
        totalChunks,
      },
    });
  }

  async markFailed(documentId: string) {
    return prisma.document.update({
      where: { id: documentId },
      data: { status: "failed" },
    });
  }

  async listByUser(userId: string) {
    return prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        originalName: true,
        totalPages: true,
        totalChunks: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getOwnedDocument(userId: string, documentId: string) {
    return prisma.document.findFirst({
      where: { id: documentId, userId },
    });
  }

  async delete(userId: string, documentId: string): Promise<boolean> {
    const document = await this.getOwnedDocument(userId, documentId);
    if (!document) return false;

    await prisma.document.delete({ where: { id: document.id } });
    return true;
  }
}