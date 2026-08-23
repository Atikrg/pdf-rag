import { qdrant_client } from "../lib/qdrant";
import { QdrantService } from "../services/qdrant.service";
import { RagService } from "../services/rag.service";
import { OllamaService } from "../services/ollama.service";
import { ollamaClient } from "../lib/ollama.lib";
import { openaiClient } from "../lib/openai.lib";
import { OpenAiService } from "../services/openai.service";
import { HFEmbeddings } from "../lib/HFEmbeddings.lib";

class RagContainer {
  qdrantService: QdrantService;
  ragService: RagService;
  ollamaService: OllamaService;
  openAiService: OpenAiService;

  constructor() {
    const embeddings = new HFEmbeddings();

    this.qdrantService = new QdrantService(qdrant_client, embeddings);
  
    this.ragService = new RagService();
    this.ollamaService = new OllamaService(ollamaClient);
    this.openAiService = new OpenAiService(openaiClient);
  }
}

export const ragDependencyInjection = new RagContainer();
