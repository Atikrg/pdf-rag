import { OpenAI } from "openai";
import {
  parseQuestionList,
  questionGenerationPrompt,
} from "./prompts.service";

export class OpenAiService {
  constructor(
    private readonly openaiClient: OpenAI,
    private readonly model: string,
  ) {}

  /**
   * Generates hypothetical questions a chunk would answer, for retrieval-side
   * query expansion. Returns up to `count` questions, or fewer if the model
   * produced fewer valid ones.
   */
  async generateQuestions(
    chunkText: string,
    count = 6,
  ): Promise<string[]> {
    const response = await this.openaiClient.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      messages: [
        { role: "user", content: questionGenerationPrompt(chunkText, count) },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? "";

    return parseQuestionList(content, count);
  }

  async generateResponseStream(
    prompt: string,
    signal?: AbortSignal,
  ): Promise<{
    stream: AsyncIterable<string>;
  }> {
    const response = await this.openaiClient.chat.completions.create(
      {
        model: this.model,
        // Deterministic answers: the response must be grounded in the retrieved
        // context, and sampling adds unsupported detail.
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      },
      { signal },
    );

    return {
      stream: {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of response) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          }
        },
      },
    };
  }

  /** Non-streaming completion, used for summaries and titles. */
  async complete(prompt: string): Promise<string> {
    const response = await this.openaiClient.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices?.[0]?.message?.content ?? "";
  }

  /**
   * Generates a short title for a conversation. Falls back to a truncated
   * version of the first message when the LLM call fails.
   */
  async generateTitle(firstMessage: string): Promise<string> {
    const fallback = firstMessage.trim().slice(0, 40);
    if (!firstMessage.trim()) return "New chat";

    try {
      const titlePrompt = `You generate short, descriptive titles for chat conversations.

Given the user's first message, return ONLY a title of at most 6 words.
Do not use quotes, punctuation at the end, or markdown. Just the title.

First message:
"${firstMessage.slice(0, 300)}"`;

      const response = await this.openaiClient.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: titlePrompt }],
      });

      const title = response.choices?.[0]?.message?.content?.trim();

      if (!title) return fallback;

      return title.replace(/^["']|["']$/g, "").slice(0, 60) || fallback;
    } catch (error) {
      console.error("Title generation failed:", error);
      return fallback;
    }
  }
}
