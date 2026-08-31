import express, { type Express } from "express";
import morgan from "morgan";
import IORedis from "ioredis";
import { QdrantClient } from "@qdrant/js-client-rest";
import { AppConfig } from "../config/AppConfig";
import { MinioFileStorage } from "../infrastructure/MinioFileStorage";
import { BullMqPdfQueue } from "../infrastructure/BullMqPdfQueue";
import type { IFileStorage } from "../core/ports/IFileStorage";
import type { IPdfProcessingQueue } from "../core/ports/IPdfProcessingQueue";
import { RagService } from "../services/rag.service";
import { QdrantService } from "../services/qdrant.service";
import { OpenAiService } from "../services/openai.service";
import { ChatService } from "../services/chat.service";
import { DocumentService } from "../services/document.service";
import { PdfProcessingPipeline } from "../services/PdfProcessingPipeline";
import { HFEmbeddings } from "../lib/HFEmbeddings.lib";
import { openaiClient } from "../lib/openai.lib";
import { FileController } from "../controllers/file.controller";
import { ChatController } from "../controllers/chat.controller";
import { MetaController } from "../controllers/meta.controller";
import { AuthController } from "../controllers/auth.controller";
import type { IRoutes } from "../routes/IRoutes";
import { UploadRoutes } from "../routes/uploadRoutes";
import { ChatRoutes } from "../routes/chatRoutes";
import { MetaRoutes } from "../routes/meta.routes";
import { AuthRoutes } from "../routes/auth.routes";

export class Container {
  private static instance: Container;

  public readonly config: AppConfig;

  private redisConnection: IORedis | null = null;
  private qdrantClientInstance: QdrantClient | null = null;
  private fileStorageInstance: IFileStorage | null = null;
  private pdfQueueInstance: IPdfProcessingQueue | null = null;
  private ragServiceInstance: RagService | null = null;
  private qdrantServiceInstance: QdrantService | null = null;
  private openAiServiceInstance: OpenAiService | null = null;
  private pdfPipelineInstance: PdfProcessingPipeline | null = null;
  private chatServiceInstance: ChatService | null = null;
  private documentServiceInstance: DocumentService | null = null;
  private routeRegistrarsCache: IRoutes[] | null = null;

  private constructor() {
    this.config = AppConfig.getInstance();
  }

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }

    return Container.instance;
  }

  public getRedisConnection(): IORedis {
    if (!this.redisConnection) {
      this.redisConnection = new IORedis(this.config.redisUrl, {
        maxRetriesPerRequest: null,
      });
    }

    return this.redisConnection;
  }

  public get fileStorage(): IFileStorage {
    if (!this.fileStorageInstance) {
      this.fileStorageInstance = new MinioFileStorage(this.config);
    }

    return this.fileStorageInstance;
  }

  public get pdfQueue(): IPdfProcessingQueue {
    if (!this.pdfQueueInstance) {
      this.pdfQueueInstance = new BullMqPdfQueue(this.getRedisConnection());
    }

    return this.pdfQueueInstance;
  }

  public get ragService(): RagService {
    if (!this.ragServiceInstance) {
      this.ragServiceInstance = new RagService();
    }

    return this.ragServiceInstance;
  }

  public get qdrantClient(): QdrantClient {
    if (!this.qdrantClientInstance) {
      this.qdrantClientInstance = new QdrantClient({
        host: this.config.qdrantHost,
        port: this.config.qdrantPort,
      });
    }

    return this.qdrantClientInstance;
  }

  public get qdrantService(): QdrantService {
    if (!this.qdrantServiceInstance) {
      this.qdrantServiceInstance = new QdrantService(
        this.qdrantClient,
        new HFEmbeddings(),
      );
    }

    return this.qdrantServiceInstance;
  }

  public get openAiService(): OpenAiService {
    if (!this.openAiServiceInstance) {
      this.openAiServiceInstance = new OpenAiService(
        openaiClient,
        this.config.aiModel,
      );
    }

    return this.openAiServiceInstance;
  }

  public get chatService(): ChatService {
    if (!this.chatServiceInstance) {
      this.chatServiceInstance = new ChatService(this.openAiService);
    }

    return this.chatServiceInstance;
  }

  public get documentService(): DocumentService {
    if (!this.documentServiceInstance) {
      this.documentServiceInstance = new DocumentService();
    }

    return this.documentServiceInstance;
  }

  public get pdfPipeline(): PdfProcessingPipeline {
    if (!this.pdfPipelineInstance) {
      this.pdfPipelineInstance = new PdfProcessingPipeline(
        this.config,
        this.fileStorage,
        this.ragService,
        this.qdrantService,
      );
    }

    return this.pdfPipelineInstance;
  }

  public get fileController(): FileController {
    return new FileController(
      this.pdfQueue,
      this.documentService,
      this.config,
      this.fileStorage,
      this.qdrantService,
      this.openAiService,
    );
  }

  public get chatController(): ChatController {
    return new ChatController(
      this.qdrantService,
      this.openAiService,
      this.config,
      this.chatService,
    );
  }

  public get metaController(): MetaController {
    return new MetaController();
  }

  public get authController(): AuthController {
    return new AuthController();
  }

  public get routeRegistrars(): IRoutes[] {
    if (!this.routeRegistrarsCache) {
      this.routeRegistrarsCache = [
        new AuthRoutes(this.authController),
        new UploadRoutes(this.fileController, this.fileStorage),
        new ChatRoutes(this.chatController),
        new MetaRoutes(this.metaController),
      ];
    }

    return this.routeRegistrarsCache;
  }

  public buildApp(): Express {
    const app = express();

    if (process.env.NODE_ENV !== "production") {
      app.use(morgan("dev"));
    }

    app.use(express.json());

    for (const registrar of this.routeRegistrars) {
      app.use(registrar.basePath, registrar.register());
    }

    return app;
  }

  public async connectInfrastructure(): Promise<void> {
    const connected = await this.fileStorage.ensureConnection();

    if (!connected) {
      throw new Error("Unable to connect to MinIO Bucket Storage");
    }

    await this.getRedisConnection().ping();
    console.log("REDIS connected");

    await this.qdrantClient.getCollections();
    console.log("QDRANT connected");
  }
}

export const container = Container.getInstance();
