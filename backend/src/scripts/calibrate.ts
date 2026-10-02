/**
 * Retrieval inspector: prints the ranked hybrid results and their raw dense
 * cosine for a set of queries against one user's collection. Use it to see what
 * a query actually retrieves before assuming the ranking is wrong. Not part of
 * the app; run manually.
 *
 *   bun run src/scripts/calibrate.ts <userId> <documentId> ["query one" "query two"]
 *
 * Note that cosine magnitude is not a relevance verdict — a legitimate question
 * phrased in vocabulary the document never uses scores low. Compare queries
 * against each other rather than reading any single value as pass/fail.
 */
import { container } from "../container/container";
import { QdrantService } from "../services/qdrant.service";

const [userId, documentId, ...queries] = process.argv.slice(2);

if (!userId || queries.length === 0) {
  console.error(
    'usage: bun run src/scripts/calibrate.ts <userId> <documentId> ["q1" "q2"]',
  );
  process.exit(1);
}

const qdrant: QdrantService = container.qdrantService;
const collection = qdrant.collectionForUser(container.config.qdrantCollection, userId);

if (!(await qdrant.collectionExists(collection))) {
  console.error(`no collection for user ${userId}`);
  process.exit(1);
}

const chunks = documentId
  ? await qdrant.getChunksForDocument(collection, documentId).catch(() => [])
  : [];
if (chunks.length > 0) {
  console.log("--- document text (for writing in-domain queries) ---");
  chunks.forEach((c) => console.log(`[chunk ${c.chunkIndex}] ${c.text.slice(0, 300)}`));
}

for (const query of queries) {
  const results = await qdrant.hybridSearch(query, collection, 3, documentId);
  console.log(`\n"${query}"`);
  if (results.length === 0) console.log("  (no results)");
  for (const r of results) {
    console.log(
      `  cos=${r.score.toFixed(3)}  ${r.pageContent.slice(0, 90).replace(/\s+/g, " ")}`,
    );
  }
}

process.exit(0);
