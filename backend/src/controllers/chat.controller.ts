import type { Request, Response } from "express";
import { ragDependencyInjection } from "../container/rag.dependencyInjection";
import { llmResponsePrompt } from "../services/prompts.service";
import { promptSchema } from "../types/zodSchema";

export const chatController = async (request: Request, response: Response) => {
  try {
    const { data, success } = promptSchema.safeParse({
      text: request.body.prompt,
    });

    if (!success) {
      return response.status(400).json({
        success: "fail",
        message: "Prompt is required",
      });
    }

    const prompt = data.text;

    const collectionName = process.env.QRANT_COLLECTION as string;

    const hybridSearch =
      await ragDependencyInjection.qdrantService.hybridSearch(
        prompt,
        collectionName,
      );

    const uniqueChunks = [
      ...new Map(hybridSearch.map((doc) => [doc.pageContent, doc])).values(),
    ];

    const topChunks = uniqueChunks.slice(0, 5);

    const citations = [
      ...new Map(
        topChunks
          .map((chunk) => {
            const pageIndex = chunk.metadata?.pageIndex;
            const lines = chunk.metadata?.loc?.lines;

            return {
              pageIndex,
              lines:
                lines?.from != null && lines?.to != null
                  ? { from: lines.from, to: lines.to }
                  : null,
            };
          })
          .map((citation) => [
            `${citation.pageIndex}-${citation.lines?.from ?? ""}-${citation.lines?.to ?? ""}`,
            citation,
          ]),
      ).values(),
    ];

    const responsePrompt = llmResponsePrompt(prompt, topChunks);

    const llmResponse =
      await ragDependencyInjection.openAiService.generateResponse(
        responsePrompt,
      );

    return response.status(200).json({
      success: "success",
      response: llmResponse,
      citations,
      references: hybridSearch.length,
    });
  } catch (error: any) {
    return response.status(500).json({
      success: "fail",
      message: "Internal Server Error",
      error: error,
    });
  }
};
