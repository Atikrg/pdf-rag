const chunkLabel = (chunk: any, index: number) => {
  const page = chunk.metadata?.pageIndex ?? index + 1;
  const lines = chunk.metadata?.loc?.lines;
  const lineRange =
    lines && lines.from != null && lines.to != null
      ? `, lines ${lines.from}-${lines.to}`
      : "";

  return `[Page ${page}${lineRange}]`;
};

export const llmResponsePrompt = (question: string, context: any) => {
  const contextText = Array.isArray(context)
    ? context
        .map(
          (chunk, index) =>
            `${chunkLabel(chunk, index)}\n${chunk.pageContent}`,
        )
        .join("\n\n")
    : String(context);

  return `
    You are an expert document question-answering assistant.

Use ONLY the retrieved document context to answer the user's question.

Rules:
1. Never invent information.
2. If the answer is not in the context, say so clearly.
3. Combine information from multiple chunks when necessary.
4. Ignore irrelevant chunks.
5. Do not mention "chunks" or "embeddings" in your response.
6. Keep the answer natural and well-structured.
7. Cite every factual statement with an inline citation using the exact page and line range shown in the context header.
   Format: (Page N, lines A-B). Only cite pages and line ranges that appear in the context.

Question:
${question}

Context:
${contextText}
  `;
};
