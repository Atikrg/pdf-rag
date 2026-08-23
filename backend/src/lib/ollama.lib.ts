import {Ollama} from "ollama";



const OLLAMA_URL = "http://localhost:11434";
export const ollamaClient = new Ollama({
  host: OLLAMA_URL
})



export const ollamaSummarizePrompt = 
`
  You are a context compression engine for a RAG system.
  
  Convert the input into a minimal semantic representation that:
  - preserves meaning for retrieval and answering
  - removes redundancy and conversational fluff
  - keeps entities, constraints, and relationships intact
  - is optimized for embedding and LLM processing
  
  Do not answer or explain.
`

