export class AppConfig {
  private static instance: AppConfig;

  private constructor(
    public readonly serverPort: string,
    public readonly jwtSecret: string,
    public readonly minioEndpoint: string,
    public readonly minioPort: number,
    public readonly minioUseSsl: boolean,
    public readonly minioAccessKey: string,
    public readonly minioSecretKey: string,
    public readonly minioBucket: string,
    public readonly redisUrl: string,
    public readonly qdrantHost: string,
    public readonly qdrantPort: number,
    public readonly qdrantCollection: string,
    public readonly databaseUrl: string,
    public readonly clerkSecretKey: string,
    public readonly clerkPublishableKey: string,
    public readonly clerkJwtPem: string,
    public readonly maxDocsPerUser: number,
    public readonly aiModel: string,
    public readonly googleClientId: string,
    public readonly googleClientSecret: string,
    public readonly googleRedirectUri: string,
  ) {}

  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig(
        process.env.SERVER_PORT ?? "5000",
        process.env.JWT_SECRET ?? "",
        process.env.MINIO_ENDPOINT ?? "minio",
        Number(process.env.MINIO_PORT ?? 9000),
        process.env.MINIO_USE_SSL === "true",
        process.env.MINIO_ACCESS_KEY ?? "",
        process.env.MINIO_SECRET_KEY ?? "",
        process.env.MINIO_BUCKET ?? "documents",
        process.env.REDIS_URL ?? "redis://:myredissecret@redis:6379",
        process.env.QDRANT_HOST ?? "qdrant",
        Number(process.env.QDRANT_PORT ?? 6333),
        process.env.QDRANT_COLLECTION ?? "pdf_pages",
        process.env.DATABASE_URL ?? "",
        process.env.CLERK_SECRET_KEY ?? "",
        process.env.CLERK_PUBLISHABLE_KEY ?? "",
        process.env.CLERK_JWT_PEM ?? "",
        Number(process.env.MAX_DOCS_PER_USER ?? 5),
        process.env.AI_MODEL ?? "openrouter/free",
        process.env.GOOGLE_CLIENT_ID ?? "",
        process.env.GOOGLE_CLIENT_SECRET ?? "",
        process.env.GOOGLE_REDIRECT_URI ?? "",
      );
    }

    return AppConfig.instance;
  }
}
