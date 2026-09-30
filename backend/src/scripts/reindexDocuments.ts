/**
 * Bulk re-index / backfill for the document pipeline.
 *
 * Phase 1 (`pdf-ingest`) downloads, parses, chunks and indexes a document, then
 * enqueues phase 2 (`question-enrichment`). Phase 2 turns those chunks into
 * hypothetical-question vectors.
 *
 * Because the two phases are independent, an outage in either leaves a
 * document permanently half-built while Postgres still reports it as `ready`
 * with a non-zero `total_chunks`. That is the state most of the local data was
 * in, so this script decides per document which phase actually needs to re-run:
 *
 *   chunks === 0            -> re-enqueue phase 1 (phase 2 follows it itself)
 *   chunks > 0, questions 0 -> re-enqueue phase 2
 *   both > 0               -> nothing to do
 *
 * Flags:
 *   --all        rebuild every ready document from scratch via phase 1. Use
 *                after changing `chunkSize`, so vectors match the new
 *                segmentation.
 *   --dry-run    report what would happen and enqueue nothing
 *   --force      with --all, re-run phase 1 even if the document looks healthy
 *
 * Usage:
 *   docker compose exec backend bun run src/scripts/reindexDocuments.ts --dry-run
 *   docker compose exec backend bun run src/scripts/reindexDocuments.ts
 *   docker compose exec backend bun run src/scripts/reindexDocuments.ts --all
 */

import { container } from "../container/container";
import { prisma } from "../lib/prisma";
import type { StoredFileMeta } from "../core/ports/IFileStorage";

type Args = { all: boolean; dryRun: boolean; force: boolean };

type DocRow = {
  id: string;
  userId: string;
  objectName: string;
  originalName: string;
  size: number;
  mimeType: string;
};

function parseArgs(argv: string[]): Args {
  return {
    all: argv.includes("--all"),
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
  };
}

function buildMeta(doc: DocRow): StoredFileMeta {
  return {
    objectName: doc.objectName,
    originalName: doc.originalName,
    size: doc.size,
    mimeType: doc.mimeType,
    userId: doc.userId,
    documentId: doc.id,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { qdrantService } = container;

  const docs = await prisma.document.findMany({
    where: { status: "ready" },
    orderBy: { createdAt: "asc" },
  });

  console.log(`found ${docs.length} ready document(s)\n`);

  const totals = { phase1: 0, phase2: 0, skipped: 0 };

  for (const doc of docs) {
    const collectionName = qdrantService.collectionForUser(
      container.config.qdrantCollection,
      doc.userId,
    );

    const chunks = await qdrantService.countByKind(
      collectionName,
      "chunk",
      doc.id,
    );
    const questions = await qdrantService.countByKind(
      collectionName,
      "question",
      doc.id,
    );

    const meta = buildMeta(doc);
    const label = `${doc.id}  ${doc.originalName}`;

    // Force mode always rebuilds through phase 1 so that chunk vectors are
    // regenerated, which is what makes a chunkSize change take effect.
    if (args.all) {
      const verb = args.dryRun ? "would rebuild (phase 1)" : "rebuilding (phase 1)";
      if (args.force || chunks === 0 || args.all) {
        console.log(`${verb}  ${label}  [chunks=${chunks} questions=${questions}]`);
        if (!args.dryRun) await container.pdfQueue.enqueue(meta);
        totals.phase1 += 1;
        continue;
      }
    }

    if (chunks === 0) {
      console.log(`repair phase 1  ${label}  [no chunks indexed]`);
      if (!args.dryRun) await container.pdfQueue.enqueue(meta);
      totals.phase1 += 1;
    } else if (questions === 0) {
      console.log(`repair phase 2  ${label}  [chunks=${chunks} questions=0]`);
      if (!args.dryRun) await container.questionQueue.enqueue(meta);
      totals.phase2 += 1;
    } else {
      console.log(`ok              ${label}  [chunks=${chunks} questions=${questions}]`);
      totals.skipped += 1;
    }
  }

  console.log(
    `\nphase 1: ${totals.phase1}, phase 2: ${totals.phase2}, healthy: ${totals.skipped}`,
  );
  if (args.dryRun) console.log("(dry run: nothing was sent to a queue)");

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("reindex failed:", err);
    process.exit(1);
  });
