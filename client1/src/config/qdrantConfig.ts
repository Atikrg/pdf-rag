import { QdrantClient } from "@qdrant/js-client-rest";

export const client = new QdrantClient({ host: "localhost", port: 6333 });



async function testQdrantConnection() {
    try {
        const collections = await client.getCollections();

        console.log("✅ Connected to Qdrant");
        console.log(collections);
    } catch (err: any) {
        console.error("❌ Connection to Qdrant failed");
        console.error(err.message);
    }
}

testQdrantConnection();