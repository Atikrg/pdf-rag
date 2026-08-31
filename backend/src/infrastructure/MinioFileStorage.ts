import { Client } from "minio";
import type { AppConfig } from "../config/AppConfig";
import type { IFileStorage } from "../core/ports/IFileStorage";

export class MinioFileStorage implements IFileStorage {
  private client: Client | null = null;

  constructor(private readonly config: AppConfig) {}

  private getClient(): Client {
    if (!this.client) {
      this.client = new Client({
        endPoint: this.config.minioEndpoint,
        port: this.config.minioPort,
        useSSL: this.config.minioUseSsl,
        accessKey: this.config.minioAccessKey,
        secretKey: this.config.minioSecretKey,
      });
    }

    return this.client;
  }

  public async ensureConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      const bucket = this.config.minioBucket;

      const exists = await client.bucketExists(bucket);

      if (!exists) {
        await client.makeBucket(bucket);
        console.log(`MinIO bucket created: ${bucket}`);
      }

      console.log("MinIO connected successfully");

      return true;
    } catch (error) {
      console.error("MinIO connection failed:", error);
      return false;
    }
  }

  public async uploadPdf(
    objectName: string,
    buffer: Buffer,
  ): Promise<void> {
    const bucket = this.config.minioBucket;

    await this.getClient().putObject(bucket, objectName, buffer, buffer.length, {
      "Content-Type": "application/pdf",
    });
  }

  public async downloadPdf(objectName: string): Promise<Buffer> {
    const bucket = this.config.minioBucket;

    const stream = await this.getClient().getObject(bucket, objectName);

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  public async deletePdf(objectName: string): Promise<void> {
    const bucket = this.config.minioBucket;

    await this.getClient().removeObject(bucket, objectName);
  }
}
