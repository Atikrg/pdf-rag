import type { QdrantClient } from "@qdrant/js-client-rest";
import { Document } from "langchain";
import { QdrantVectorStore } from "@langchain/qdrant";
import { HFEmbeddings } from "../lib/HFEmbeddings.lib";
import { XenovaEmbeddings } from "../lib/embeddings";
import { BM25Retriever } from "@langchain/community/retrievers/bm25";

export class QdrantService {
  constructor(
    private client: QdrantClient,
    private embeddings: HFEmbeddings,
  ) {
    this.client = client;
    this.embeddings = embeddings;
  }

  async collectionExists(collection_name: string): Promise<Boolean> {
    try {
      await this.client.getCollection(collection_name);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getCollectionInfo(collectionName: string) {
    try {
      return await this.client.getCollection(collectionName);
    } catch (error) {
      throw new Error("Error getting collection info");
    }
  }

  async createCollection(name: string): Promise<Boolean> {
    try {
      return await this.client.createCollection(name, {
        vectors: {
          size: 384,
          distance: "Cosine",
        },
        sparse_vectors: {
          sparse: {},
        },
      });
    } catch (error: any) {
      if (error.status === 409) {
        throw new Error("Collection already exists");
      }

      throw new Error("Something went wrong");
    }
  }

  async upsert(collection: string, points: any[]) {
    return this.client.upsert(collection, {
      points,
    });
  }

  async simpleSearch(collection: string, vector: number[]) {
    return this.client.search(collection, {
      vector,
    });
  }

  async formatPages(pages: any[]) {
    const docs = pages.map(
      (page) =>
        new Document({
          pageContent: page.content,
          metadata: {
            pageIndex: page.pageIndex,
            type: "page",
          },
        }),
    );

    return docs;
  }

  async storeInQdrant(docs: Document[], collectionName: string) {
    try {
      await QdrantVectorStore.fromDocuments(docs, this.embeddings, {
        client: this.client,
        collectionName,
      });
    } catch (error: any) {
      console.error("Error occured", error);
      throw new Error("Failed to store chunks", error);
    }
  }

  async deleteCollection() {
    try {
      await this.client.deleteCollection("pdf_pages");
    } catch (error: any) {
      throw new Error("Failed to delete collection.");
    }
  }

  async hybridSearch(question: string, collection_name: string) {
    console.time("collection");

    await this.client.getCollection(collection_name);

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      this.embeddings,
      {
        client: this.client,
        collectionName: collection_name,
      },
    );

    const vectorRetriever = vectorStore.asRetriever({
      k: 200,
    });

    const docs = await vectorRetriever.invoke(question);

    return docs;
  }
}

// async keywordSearch(collection: string, query: string)
// {
//   try {

//     const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
//       client: this.client,
//       collectionName: collection,
//     });
//     return vectorStore;
//   } catch (error) {
//     throw new Error("Failed to search using keywords");
//   }
// }
