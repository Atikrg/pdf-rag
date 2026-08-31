import type { Request, Response } from "express";
import type { AppConfig } from "../config/AppConfig";
import type { QdrantService } from "../services/qdrant.service";
import type { OpenAiService } from "../services/openai.service";
import type { ChatService } from "../services/chat.service";
import { llmResponsePrompt } from "../services/prompts.service";
import { chatStreamSchema } from "../types/zodSchema";

function sse(response: Response, event: string, data: unknown) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

export class ChatController {
  constructor(
    private readonly qdrantService: QdrantService,
    private readonly openAiService: OpenAiService,
    private readonly config: AppConfig,
    private readonly chatService: ChatService,
  ) {}

  // ---- Session management ----

  public createSession = async (request: Request, response: Response) => {
    try {
      const userId = request.userId;
      if (!userId) return response.status(401).json({ message: "Unauthorized" });

      const documentId = request.body?.documentId;

      const session = await this.chatService.createSession(userId, documentId);

      return response.status(201).json({ success: true, session });
    } catch (error: any) {
      return response.status(500).json({
        success: "fail",
        message: "Failed to create session",
        error: error.message,
      });
    }
  };

  public listSessions = async (request: Request, response: Response) => {
    const userId = request.userId;
    if (!userId) return response.status(401).json({ message: "Unauthorized" });

    try {
      const sessions = await this.chatService.listSessions(userId);
      return response.status(200).json({ success: true, sessions });
    } catch (error: any) {
      return response.status(500).json({
        success: "fail",
        message: "Failed to fetch sessions",
        error: error.message,
      });
    }
  };

  public getSession = async (request: Request, response: Response) => {
    const userId = request.userId;
    if (!userId) return response.status(401).json({ message: "Unauthorized" });

    try {
      const session = await this.chatService.getSession(
        userId,
        String(request.params.id),
      );

      if (!session) {
        return response.status(404).json({ message: "Session not found" });
      }

      return response.status(200).json({ success: true, session });
    } catch (error: any) {
      return response.status(500).json({
        success: "fail",
        message: "Failed to fetch session",
        error: error.message,
      });
    }
  };

  public deleteSession = async (request: Request, response: Response) => {
    const userId = request.userId;
    if (!userId) return response.status(401).json({ message: "Unauthorized" });

    try {
      const deleted = await this.chatService.deleteSession(
        userId,
        String(request.params.id),
      );

      if (!deleted) {
        return response.status(404).json({ message: "Session not found" });
      }

      return response.status(200).json({ success: true });
    } catch (error: any) {
      return response.status(500).json({
        success: "fail",
        message: "Failed to delete session",
        error: error.message,
      });
    }
  };

  // ---- Streaming chat ----

  public chat = async (request: Request, response: Response) => {
    const userId = request.userId;
    if (!userId) {
      return response.status(401).json({ message: "Unauthorized" });
    }

    const { data, success } = chatStreamSchema.safeParse(request.body);
    if (!success || !data) {
      return response.status(400).json({ message: "Prompt is required" });
    }

    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const sendError = (message: string, code = 500) => {
      sse(response, "error", { message, code });
      response.end();
    };

    let sessionId = data.sessionId;
    let documentId = data.documentId;
    let isNewSession = false;
    let title = "New chat";
    let userMessageId: string | null = null;

    try {
      if (sessionId) {
        const existing = await this.chatService.getSession(userId, sessionId);
        if (!existing) return sendError("Session not found", 404);
        title = existing.title;
        documentId = existing.documentId ?? undefined;
      } else {
        const created = await this.chatService.createSession(
          userId,
          documentId,
        );
        sessionId = created.id;
        isNewSession = true;
      }

      const collectionName = this.qdrantService.collectionForUser(
        this.config.qdrantCollection,
        userId,
      );

      const docsExist = await this.qdrantService.collectionExists(collectionName);
      if (!docsExist) {
        return sendError(
          "No documents uploaded yet. Upload a PDF before chatting.",
          400,
        );
      }

      // Persist the user message; track it so we can roll back if generation fails.
      const userMessage = await this.chatService.addMessage(
        sessionId,
        "user",
        data.prompt,
      );
      userMessageId = userMessage.id;

      // For a brand-new session, kick off title generation immediately from the
      // first user message. It runs in parallel with the streaming response and
      // emits a `title` event as soon as it's ready, so the sidebar shows a real
      // title in real time instead of waiting for the full answer.
      let titlePromise: Promise<void> | null = null;
      if (isNewSession) {
        title = data.prompt.trim().slice(0, 40) || "New chat";
        sse(response, "session", { sessionId, title, isNewSession: true });
        titlePromise = this.chatService
          .ensureTitle(sessionId, data.prompt)
          .then((updated) => {
            if (updated && updated.title) {
              title = updated.title;
              sse(response, "title", { title: updated.title });
            }
          })
          .catch(() => {});
      }

      // Include a short slice of prior turns for follow-up questions.
      const history = await this.chatService.formatHistory(
        sessionId,
        data.prompt,
      );

      const hybridSearch = await this.qdrantService.hybridSearch(
        data.prompt,
        collectionName,
        8,
        documentId,
      );

      const uniqueChunks = [
        ...new Map(
          hybridSearch.map((doc) => [doc.pageContent, doc]),
        ).values(),
      ];

      const topChunks = uniqueChunks.slice(0, 5);

      const citations = [
        ...new Map(
          topChunks
            .map((chunk) => {
              const pageIndex = chunk.metadata?.pageIndex;
              return {
                pageIndex:
                  typeof pageIndex === "number" && Number.isFinite(pageIndex)
                    ? pageIndex
                    : undefined,
              };
            })
            .filter((citation) => citation.pageIndex != null)
            .map((citation) => [
              `page-${citation.pageIndex}`,
              citation,
            ]),
        ).values(),
      ];

      const responsePrompt = llmResponsePrompt(data.prompt, topChunks, history);

      if (topChunks.length === 0) {
        sse(response, "delta", {
          text: "I couldn't find relevant content for that question in the document. Try rephrasing or asking about the indexed pages.",
        });
      } else {
        const { stream } =
          await this.openAiService.generateResponseStream(responsePrompt);

        let fullText = "";

        for await (const delta of stream) {
          fullText += delta;
          sse(response, "delta", { text: delta });
        }

        await this.chatService.addMessage(sessionId, "ai", fullText, citations);
      }

      // Wait for title generation (if any) to settle so the `done` event can
      // carry the final title to the client.
      if (titlePromise) await titlePromise;

      sse(response, "done", {
        text: "",
        citations,
        references: hybridSearch.length,
        sessionId,
        documentId,
        title,
      });

      response.end();
    } catch (error: any) {
      console.error("Chat error:", error);

      // Roll back the persisted user message (and session) so a failed turn
      // doesn't leave orphaned/partial state behind.
      try {
        if (userMessageId) {
          await this.chatService.deleteMessage(userMessageId);
        }
        if (isNewSession && sessionId) {
          await this.chatService.deleteSession(userId, sessionId);
        }
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }

      sendError(error.message ?? "Internal Server Error");
    }
  };
}