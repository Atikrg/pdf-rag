import { Client } from "minio";

class MinioService {
  private static instance: MinioService;
  private client: Client;

  private constructor() {
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
  }

  public static getInstance(): MinioService {
    if (!MinioService.instance) {
      MinioService.instance = new MinioService();
    }

    return MinioService.instance;
  }

  public getClient(): Client {
    return this.client;
  }

  public async uploadPdf(
    bucket: string,
    objectName: string,
    buffer: Buffer,
  ): Promise<void> {
    await this.client.putObject(bucket, objectName, buffer, buffer.length, {
      "Content-Type": "application/pdf",
    });
  }

  public async download(bucket: string, objectName: string) {
    return this.client.getObject(bucket, objectName);
  }

  public async ensureConnection(): Promise<boolean> {
    try {
      const bucket = process.env.MINIO_BUCKET!;

      const exists = await this.client.bucketExists(bucket);

      if (!exists) {
        await this.client.makeBucket(bucket);
        console.log(`MinIO bucket created: ${bucket}`);
      }

      console.log("MinIO connected successfully");

      return true;
    } catch (error) {
      console.error("MinIO connection failed:", error);
      return false;
    }
  }
}

export const minio = MinioService.getInstance();

export default MinioService.getInstance();