/**
 * Calibration helper: prints the raw dense cosine score for a set of queries
 * against one user's collection, so MIN_RELEVANT_SCORE can be set from data
 * rather than guessed. Not part of the app; run manually.
 *
 *   bun run src/scripts/calibrate.ts <userId> ["query one" "query two"]
 */
import { container } from "../container/container";
import { QdrantService } from "../services/qdrant.service";

const [userId, ...queries] = process.argv.slice(2);

if (!userId || queries.length === 0) {
  console.error('usage: bun run src/scripts/calibrate.ts <userId> ["q1" "q2"]');
  process.exit(1);
}

const qdrant: QdrantService = container.qdrantService;
const collection = qdrant.collectionForUser(container.config.qdrantCollection, userId);

if (!(await qdrant.collectionExists(collection))) {
  console.error(`no collection for user ${userId}`);
  process.exit(1);
}

const chunks = await qdrant.getChunksForDocument(collection, process.argv[3] ?? "").catch(() => []);
if (chunks.length > 0) {
  console.log("--- document text (for writing in-domain queries) ---");
  chunks.forEach((c) => console.log(`[chunk ${c.chunkIndex}] ${c.text.slice(0, 300)}`));
}

for (const query of queries) {
  const results = await qdrant.hybridSearch(query, collection, 3);
  const top = results[0];
  console.log(
    `score=${top?.score?.toFixed(3) ?? "none"}  hits=${results.length}  "${query}"`,
  );
}

process.exit(0);
