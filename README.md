# pdf-rag


Architecture (Hexagonal / Ports & Adapters)
src/
├── config/AppConfig.ts              SINGLETON — all env access in one typed place
├── core/ports/                      PORTS — what the domain needs, nothing about how
│   ├── IFileStorage.ts                 + StoredFileMeta
│   └── IPdfProcessingQueue.ts          + PdfJobStatus/PdfProcessingResult
├── infrastructure/
│   ├── MinioFileStorage.ts          ADAPTER — IFileStorage over minio SDK
│   │                                  (bucket name & client are hidden inside; lazy FACTORY METHOD)
│   └── BullMqPdfQueue.ts            ADAPTER — IPdfProcessingQueue over BullMQ
│                                      + BullMqWorkerFactory (worker bootstrap stays infra-only)
├── services/
│   ├── rag.service.ts               decoupled from MinIO — now loadPdfFromBuffer()
│   ├── qdrant.service.ts            unchanged (already ctor-injected)
│   └── PdfProcessingPipeline.ts     FACADE — one process() call hides the 6-step workflow
├── controllers/                     class-based, deps via constructor (arrow fns → safe `this`)
├── routes/
│   ├── IRoutes.ts                   contract: { basePath, register() }
│   └── *.routes.ts                  class routers; index.ts just loops registrars (OPEN/CLOSED)
├── middleware/
│   ├── authMiddleware.ts            now sets request.userId (was never set → uploads always 400'd)
│   ├── fileUploadBucketMiddleware   FACTORY: createFileUploadMiddleware(storage port)
│   └── errorHandler.ts              central handler for AppError hierarchy + multer errors
├── container/container.ts           COMPOSITION ROOT — lazy singletons, builds app, health checks
├── index.ts                         ~10 lines: buildApp() + errorHandler + listen
└── workers/uploadFile.worker.ts     wires worker factory → pipeline facade
Key wins
- Dependency direction is correct: controllers depend on ports (IPdfProcessingQueue), not BullMQ; pipeline depends on IFileStorage, not MinIO. Swapping to S3 or another queue = one new adapter, zero app-code changes.
- No more import-time side effects: clients are created lazily via the container instead of at module load.
- Deleted: helper.ts, rag.dependencyInjection.ts (service-locator anti-pattern), old minIO.lib.ts/queue.lib.ts.
- Bugs fixed along the way: JWT auth was never wired into upload routes and userId was never populated; chatRoutes/meta.routes called express() instead of Router(); rag.controller had junk imports and never sent a response on success (now honest 501).
Note: /upload and /upload/status/:jobId now require Authorization: Bearer <jwt> where the payload contains sub, id, or userId. Tell me if your token uses a different claim.