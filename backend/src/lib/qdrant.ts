import "dotenv/config";

import { QdrantClient } from "@qdrant/js-client-rest";


const QDRANT_PORT = Number(process.env.QDRANT_PORT);
const QDRANT_HOST = process.env.QDRANT_HOST;



export const qdrant_client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT });



