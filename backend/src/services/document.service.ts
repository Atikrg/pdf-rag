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

  /**
   * Prisma raises P2025 when an `update` targets a row that no longer exists.
   * That happens legitimately here: a document can be deleted (by the user, or
   * replaced by a same-name re-upload) while its processing job is still
   * in flight. The job has nothing left to report against, so treat it as a
   * no-op rather than failing the whole job.
   */
  private static isMissingRecord(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "P2025"
    );
  }

  async markCompleted(documentId: string, totalPages: number, totalChunks: number) {
    try {
      return await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "ready",
          totalPages,
          totalChunks,
        },
      });
    } catch (error) {
      if (DocumentService.isMissingRecord(error)) {
        console.warn(
          `markCompleted: document ${documentId} was deleted while processing; skipping.`,
        );
        return null;
      }
      throw error;
    }
  }

  async markFailed(documentId: string) {
    try {
      return await prisma.document.update({
        where: { id: documentId },
        data: { status: "failed" },
      });
    } catch (error) {
      if (DocumentService.isMissingRecord(error)) {
        console.warn(
          `markFailed: document ${documentId} was deleted while processing; skipping.`,
        );
        return null;
      }
      throw error;
    }
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

  /**
   * Finds all of a user's documents that share a given original file name.
   * Used to detect re-uploads so the previous version can be replaced.
   *
   * `statuses` deliberately excludes `processing` by default: replacing a
   * still-processing document would delete the MinIO object and DB row that its
   * in-flight job still needs, killing that job. Such a job is left to finish
   * and simply becomes a second same-named document.
   */
  async findByName(
    userId: string,
    originalName: string,
    statuses: string[] = ["ready", "failed"],
  ) {
    return prisma.document.findMany({
      where: { userId, originalName, status: { in: statuses } },
    });
  }

  async delete(userId: string, documentId: string): Promise<boolean> {
    const document = await this.getOwnedDocument(userId, documentId);
    if (!document) return false;

    await prisma.document.delete({ where: { id: document.id } });
    return true;
  }
}