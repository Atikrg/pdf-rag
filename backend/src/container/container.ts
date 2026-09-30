import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import IORedis from "ioredis";
import { QdrantClient } from "@qdrant/js-client-rest";
import { AppConfig } from "../config/AppConfig";
import { MinioFileStorage } from "../infrastructure/MinioFileStorage";
import { BullMqPdfQueue } from "../infrastructure/BullMqPdfQueue";
import { BullMqQuestionQueue } from "../infrastructure/BullMqQuestionQueue";
import { RedisCache } from "../infrastructure/RedisCache";
import { TokenSessionStore } from "../infrastructure/TokenSessionStore";
import type { IFileStorage } from "../core/ports/IFileStorage";
import type { IPdfProcessingQueue } from "../core/ports/IPdfProcessingQueue";
import type { IQuestionQueue } from "../core/ports/IQuestionQueue";
import { RagService } from "../services/rag.service";
import { QdrantService } from "../services/qdrant.service";
import { OpenAiService } from "../services/openai.service";
import { ChatService } from "../services/chat.service";
import { DocumentService } from "../services/document.service";
import { DocumentProcessingPipeline } from "../services/DocumentProcessingPipeline";
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

/**
 * Normalises the TRUST_PROXY env var into a value `app.set("trust proxy")`
 * understands.
 *
 * Express distinguishes a *number* (hop count) from a *string* (comma-separated
 * IP addresses, subnets, or names like "loopback"). Env vars are always strings,
 * so passing `process.env.TRUST_PROXY` through untouched would make "1" mean a
 * network named "1" instead of one hop. Anything else is passed through so
 * subnet/CIDR lists still work.
 */
function parseTrustProxy(value: string | undefined): boolean | number | string {
  const raw = (value ?? "1").trim().toLowerCase();

  if (raw === "false" || raw === "off" || raw === "0") return false;
  if (raw === "true" || raw === "on") return true;

  const hops = Number(raw);
  if (Number.isInteger(hops) && hops >= 0) return hops;

  return raw;
}

export class Container {
  private static instance: Container;

  public readonly config: AppConfig;

  private redisConnection: IORedis | null = null;
  private qdrantClientInstance: QdrantClient | null = null;
  private fileStorageInstance: IFileStorage | null = null;
  private pdfQueueInstance: IPdfProcessingQueue | null = null;
  private questionQueueInstance: IQuestionQueue | null = null;
  private ragServiceInstance: RagService | null = null;
  private qdrantServiceInstance: QdrantService | null = null;
  private openAiServiceInstance: OpenAiService | null = null;
  private documentPipelineInstance: DocumentProcessingPipeline | null = null;
  private chatServiceInstance: ChatService | null = null;
  private documentServiceInstance: DocumentService | null = null;
  private routeRegistrarsCache: IRoutes[] | null = null;
  private redisCacheInstance: RedisCache | null = null;
  private tokenSessionStoreInstance: TokenSessionStore | null = null;

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

  public get questionQueue(): IQuestionQueue {
    if (!this.questionQueueInstance) {
      this.questionQueueInstance = new BullMqQuestionQueue(
        this.getRedisConnection(),
      );
    }

    return this.questionQueueInstance;
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

  public get documentPipeline(): DocumentProcessingPipeline {
    if (!this.documentPipelineInstance) {
      this.documentPipelineInstance = new DocumentProcessingPipeline(
        this.config,
        this.fileStorage,
        this.ragService,
        this.qdrantService,
        this.openAiService,
      );
    }

    return this.documentPipelineInstance;
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
    return new AuthController(this.config);
  }

  public get redisCache(): RedisCache {
    if (!this.redisCacheInstance) {
      this.redisCacheInstance = new RedisCache(this.getRedisConnection());
    }
    return this.redisCacheInstance;
  }

  public get tokenSessionStore(): TokenSessionStore {
    if (!this.tokenSessionStoreInstance) {
      this.tokenSessionStoreInstance = new TokenSessionStore(
        this.getRedisConnection(),
      );
    }
    return this.tokenSessionStoreInstance;
  }

  public get routeRegistrars(): IRoutes[] {
    if (!this.routeRegistrarsCache) {
      this.routeRegistrarsCache = [
        new AuthRoutes(this.authController, this.getRedisConnection()),
        new UploadRoutes(
          this.fileController,
          this.fileStorage,
          this.getRedisConnection(),
        ),
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

    // Trust exactly one proxy hop (the Docker bridge / reverse proxy in front of
    // this container) so `request.ip` is the real client address. The rate
    // limiter keys unauthenticated routes on that IP, and without this every
    // request would appear to come from the same gateway and share one bucket.
    // Set TRUST_PROXY=false when running with no proxy at all, so a client can't
    // forge its own address via `X-Forwarded-For`.
    app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

    app.use(express.json({ limit: "1mb" }));
    app.use(cookieParser());

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

  /**
   * Releases infrastructure connections on shutdown. Safe to call multiple
   * times (idempotent) and resilient when a resource was never connected.
   */
  public async disconnect(): Promise<void> {
    if (this.redisConnection) {
      try {
        this.redisConnection.disconnect();
        console.log("REDIS disconnected");
      } catch (error) {
        console.error("REDIS disconnect error:", error);
      }
      this.redisConnection = null;
    }
  }
}

export const container = Container.getInstance();
