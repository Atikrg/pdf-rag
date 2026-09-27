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

/**
 * Asks the model for the questions a given chunk would answer. These are
 * indexed alongside the chunk so that a user query phrased differently from the
 * document still retrieves it. They are a recall aid only — they are never
 * shown to the model as context.
 */
export const questionGenerationPrompt = (chunkText: string, count: number) => `
You write search queries that would retrieve a specific passage from a document.

Read the passage below and write ${count} short questions that this passage answers.

Rules:
1. Each question must be answerable using ONLY the passage.
2. Vary the phrasing: some terse, some reworded, some using synonyms.
3. Do not number them, do not answer them, do not add commentary.
4. Return ONLY a JSON array of ${count} strings.

Passage:
"""
${chunkText.slice(0, 6000)}
"""
`;

/**
 * Extracts the question list from a model response. Tolerates markdown code
 * fences and trailing prose so a free-tier model that ignores the "JSON only"
 * instruction still produces usable output. Returns an empty array when nothing
 * parsable is present — the caller then stores the chunk without questions.
 */
export function parseQuestionList(content: string, count: number): string[] {
  if (!content) return [];

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? content).trim();

  if (!candidate) return [];

  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");

  if (start === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const cleaned = parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) =>
      item
        .replace(/^\s*(?:\d+[.)]|[-*])\s*/, "")
        .replace(/^["'\s]+|["'\s]+$/g, "")
        .trim(),
    )
    .filter((item) => item.length > 0);

  return [...new Set(cleaned)].slice(0, count);
}