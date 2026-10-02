export class AppConfig {
  private static instance: AppConfig;

  /**
   * Minimum length for `JWT_SECRET`. Anything shorter makes tokens forgeable by
   * brute force, and the historical default in `backend/.env` was a 16-char
   * placeholder that shipped with the template. Signing and verifying both use
   * this value, so a weak secret is a full account-takeover primitive: anyone
   * can mint a token for an arbitrary `userId`.
   */
  private static readonly MIN_JWT_SECRET_LENGTH = 32;

  /**
   * Rejects a missing or weak JWT secret before the server starts listening.
   * Failing here is deliberate: `jsonwebtoken` accepts any string, so an empty
   * secret silently degrades to "tokens signed with an empty key" rather than
   * erroring, which is how a forgeable deployment looks healthy.
   */
  private static assertUsableJwtSecret(secret: string): string {
    if (!secret) {
      throw new Error(
        "JWT_SECRET is not set. Generate one with `openssl rand -hex 32` and " +
          "add it to backend/.env.",
      );
    }

    if (secret.length < AppConfig.MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET is too short (${secret.length} chars; ` +
          `${AppConfig.MIN_JWT_SECRET_LENGTH} required). Generate one with ` +
          "`openssl rand -hex 32` and replace it in backend/.env.",
      );
    }

    return secret;
  }

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
    public readonly questionsPerChunk: number,
    public readonly chatMaxHistoryChars: number,
    /** Origins allowed to open the chat WebSocket. Empty means allow any. */
    public readonly allowedWsOrigins: string[],
    public readonly googleClientId: string,
    public readonly googleClientSecret: string,
    public readonly googleRedirectUri: string,
    /**
     * Opt-in switch for the implicit dev identity. Must be set explicitly:
     * inferring it from `NODE_ENV` meant every `docker compose up` run served
     * requests as a single shared "dev-user" with no credentials, because the
     * backend container sets `NODE_ENV=development`.
     */
    public readonly allowDevAuth: boolean,
    /** Hard ceiling for a single upload, enforced by multer before buffering completes. */
    public readonly maxUploadBytes: number,
    /** Base URL of the Next.js client, used to build password-reset links. */
    public readonly clientBaseUrl: string,
    /**
     * Opt-in switch that returns the password-reset link in the API response
     * and echoes it to the server log, standing in for the email delivery that
     * is not implemented yet.
     *
     * Off by default and never derived from NODE_ENV: the compose backend sets
     * NODE_ENV=development, so inferring it would publish a working
     * account-takeover link on every non-production stack. When a mailer lands,
     * this flag and the logging branch should both be deleted.
     */
    public readonly devPasswordReset: boolean,
  ) {}

  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig(
        process.env.SERVER_PORT ?? "5000",
        AppConfig.assertUsableJwtSecret(process.env.JWT_SECRET ?? ""),
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
        // Hypothetical questions generated per chunk during phase-2 enrichment.
        Number(process.env.QUESTIONS_PER_CHUNK ?? 6),
        // Character budget for the prior conversation sent with each request.
        // ~4 chars per token, so the default is roughly a 3k-token history.
        Number(process.env.CHAT_MAX_HISTORY_CHARS ?? 12000),
        // Comma-separated allowlist for the chat WebSocket origin, e.g.
        // "http://localhost:3001,https://app.example.com".
        (process.env.ALLOWED_WS_ORIGINS ?? "")
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
        process.env.GOOGLE_CLIENT_ID ?? "",
        process.env.GOOGLE_CLIENT_SECRET ?? "",
        process.env.GOOGLE_REDIRECT_URI ?? "",
        // Deliberately NOT derived from NODE_ENV. The compose backend service
        // runs with NODE_ENV=development, so any NODE_ENV-based default would
        // re-open the unauthenticated dev-user path in Docker. Opt in only.
        process.env.ALLOW_DEV_AUTH === "true",
        // Uploads are buffered fully in memory before being written to MinIO, so
        // this doubles as the ceiling on a single request's heap usage.
        // Must stay below the client's MAX_PROXY_BODY_BYTES: if the proxy
        // ceiling is lower it truncates the body first, and this limit's
        // readable "File is too large" 400 never reaches the user.
        Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024),
        process.env.CLIENT_BASE_URL ?? "http://localhost:3001",
        process.env.DEV_PASSWORD_RESET === "true",
      );
    }

    return AppConfig.instance;
  }
}
