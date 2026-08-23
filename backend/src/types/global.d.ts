export type OllamaResponse = {
  embedding: number[];
  embeddings: number[][];
};

export type Page = {
  pageIndex: number;
  content: string;
  type: PageType;
};


