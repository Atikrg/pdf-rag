const chunkLabel = (chunk: any, index: number) => {
  const page = chunk.metadata?.pageIndex ?? index + 1;
  return `[Page ${page}]`;
};

export const llmResponsePrompt = (
  question: string,
  context: any,
  history: string = "",
) => {
  const contextText = Array.isArray(context)
    ? context
        .map((chunk, index) => `${chunkLabel(chunk, index)}\n${chunk.pageContent}`)
        .join("\n\n")
    : String(context);

  const historyBlock = history
    ? `\nPrior conversation (for follow-up questions only — do not answer from it):\n${history}\n`
    : "";

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
7. Cite every factual statement with an inline citation using the exact page shown in the context header.
   Format: (Page N). Only cite pages that appear in the context.${historyBlock}

    Question:
${question}

Context:
${contextText}
  `;
};

export const summaryPrompt = (documentName: string, text: string) => `
You are summarizing a document called "${documentName}" for a reader who wants a quick overview.

Write a concise but informative summary (150-250 words) covering:
- The main purpose / topic of the document
- Key sections and their content
- Important numbers, dates, or names where present

Base the summary ONLY on the text provided. If the text is empty, say the document is empty.

Document text:
${text.slice(0, 24000)}
`;