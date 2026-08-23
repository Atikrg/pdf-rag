import { ragDependencyInjection } from "./container/rag.dependencyInjection";
import { minio } from "./lib/minIO.lib";

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const createCollectionHandler = async (collectionName: string) => {
  const doCollectionExists =
    await ragDependencyInjection.qdrantService.collectionExists(collectionName);

  if (!doCollectionExists) {
    await ragDependencyInjection.qdrantService.createCollection(collectionName);
  }
};

export const processFileHandler = async (
  uploadPath: string,
  fileName: string,
) => {
  const docs =
    await ragDependencyInjection.ragService.loadPdfFromMinIO(uploadPath);

  const pages = await ragDependencyInjection.ragService.extractPdfPages(docs);

  const formattedPages = await ragDependencyInjection.qdrantService.formatPages(
    pages,
  );

  return { formattedPages, pages };
};

export const fileUploadHandler = async (
  file: Express.Multer.File,
  userId: string,
) => {
  const objectName = `users/${userId}/${crypto.randomUUID()}.pdf`;

  await minio.uploadPdf("documents", objectName, file.buffer);

  return {
    objectName,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
};
