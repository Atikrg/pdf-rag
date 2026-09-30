import type { Request, Response } from "express";
import type { AppConfig } from "../config/AppConfig";
import type { QdrantService } from "../services/qdrant.service";
import type { OpenAiService } from "../services/openai.service";
import type { ChatService } from "../services/chat.service";
import { llmResponsePrompt } from "../services/prompts.service";
import { chatStreamSchema } from "../types/zodSchema";

/**
 * Transport-agnostic event sink. The chat turn emits the same `delta` /
 * `session` / `title` / `done` / `error` events regardless of whether they are
 * delivered over a WebSocket frame or an HTTP stream, so the turn logic has no
 * knowledge of the transport.
 */
export type EventSink = {
  send: (event: string, data: unknown) => void;
};

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
      console.error("Failed to create session:", error);
      return response.status(500).json({
        success: "fail",
        message: "Failed to create session",
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
      console.error("Failed to fetch sessions:", error);
      return response.status(500).json({
        success: "fail",
        message: "Failed to fetch sessions",
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
      console.error("Failed to fetch session:", error);
      return response.status(500).json({
        success: "fail",
        message: "Failed to fetch session",
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
      console.error("Failed to delete session:", error);
      return response.status(500).json({
        success: "fail",
        message: "Failed to delete session",
      });
    }
  };

  // ---- Streaming chat ----

  /**
   * Runs one chat turn for an already-authenticated user, emitting progress
   * through `sink`. Takes the user id directly rather than an Express request so
   * the WebSocket transport can reuse it.
   */
  public streamTurn = async (
    rawInput: unknown,
    userId: string,
    sink: EventSink,
    signal?: AbortSignal,
  ) => {
    const { data, success } = chatStreamSchema.safeParse(rawInput);
    if (!success || !data) {
      sink.send("error", { message: "Prompt is required", code: 400 });
      return;
    }

    const sendError = (message: string, code = 500) => {
      sink.send("error", { message, code });
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
        sink.send("session", { sessionId, title, isNewSession: true });
        titlePromise = this.chatService
          .ensureTitle(sessionId, data.prompt)
          .then((updated) => {
            if (updated && updated.title) {
              title = updated.title;
              sink.send("title", { title: updated.title });
            }
          })
          .catch(() => {});
      }

      // Send the whole prior conversation for this document-scoped session.
      const history = await this.chatService.formatHistory(
        sessionId,
        data.prompt,
        this.config.chatMaxHistoryChars,
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

      // Relevance gate. Retrieval returning *something* is not evidence that it
      // is relevant; without this check a near-zero match is handed to the model
      // as context and it will answer from it confidently. Score the top hit
      // against the configured floor and abstain below it.
      const bestScore = topChunks.reduce(
        (best, chunk) => Math.max(best, chunk.score ?? 0),
        0,
      );
      const isRelevant = bestScore >= this.config.minRelevantScore;

      console.log(
        `[chat] topScore=${bestScore.toFixed(3)} threshold=${this.config.minRelevantScore} ` +
          `hits=${hybridSearch.length} relevant=${isRelevant}`,
      );

      const citations = [
        ...new Map(
          topChunks
            .map((chunk) => {
              const meta = chunk.metadata as any;
              return {
                pageIndex: typeof meta?.pageIndex === "number" ? meta.pageIndex : undefined,
                sheetName: typeof meta?.sheetName === "string" ? meta.sheetName : undefined,
                rowIndex: typeof meta?.rowIndex === "number" ? meta.rowIndex : undefined,
                paragraphIndex: typeof meta?.paragraphIndex === "number" ? meta.paragraphIndex : undefined,
                sectionIndex: typeof meta?.sectionIndex === "number" ? meta.sectionIndex : undefined,
              };
            })
            .filter(
              (c) =>
                c.pageIndex != null ||
                (c.sheetName != null && c.rowIndex != null) ||
                c.paragraphIndex != null ||
                c.sectionIndex != null
            )
            .map((citation) => {
              const key = citation.pageIndex != null
                ? `page-${citation.pageIndex}`
                : citation.sheetName != null
                ? `sheet-${citation.sheetName}-row-${citation.rowIndex}`
                : citation.paragraphIndex != null
                ? `paragraph-${citation.paragraphIndex}`
                : `section-${citation.sectionIndex}`;
              return [key, citation];
            }),
        ).values(),
      ];

      const responsePrompt = llmResponsePrompt(data.prompt, topChunks, history);

      // Citation verification can remove entries, so the `done` event and the
      // persisted message both read this rather than the raw list.
      let verifiedCitations: typeof citations = citations;

      if (topChunks.length === 0 || !isRelevant) {
        const reason =
          topChunks.length === 0
            ? "no matching content"
            : `best match scored ${bestScore.toFixed(2)}, below the ${this.config.minRelevantScore} relevance threshold`;

        const abstention = `I couldn't find relevant content for that question in the document (${reason}). Try rephrasing or asking about the indexed pages.`;

        sink.send("delta", { text: abstention });

        // Persist the abstention so the stored transcript has no dangling
        // unanswered user turn.
        await this.chatService.addMessage(sessionId, "ai", abstention, []);

        console.log(`[chat] abstained: ${reason}`);
      } else {
        const { stream } =
          await this.openAiService.generateResponseStream(
            responsePrompt,
            signal,
          );

        let fullText = "";

        for await (const delta of stream) {
          if (signal?.aborted) throw new Error("Client disconnected");
          fullText += delta;
          sink.send("delta", { text: delta });
        }

        // The prompt asks for inline "(Page N)" markers, but nothing verified
        // them, so a model could cite a page that was never in its context.
        // Cross-check cited pages against what was actually retrieved, drop the
        // citations we cannot substantiate, and tell the reader when they
        // disagree.
        const retrievedPages = new Set<number>(
          topChunks
            .map((chunk) => (chunk.metadata as any)?.pageIndex)
            .filter((page): page is number => typeof page === "number"),
        );

        const citedPages = new Set<number>();
        for (const match of fullText.matchAll(/\(?\s*Page\s+(\d+)\s*\)?/gi)) {
          citedPages.add(Number(match[1]));
        }

        const unverifiedPages = [...citedPages].filter(
          (page) => !retrievedPages.has(page),
        );

        if (unverifiedPages.length > 0) {
          verifiedCitations = citations.filter(
            (citation) =>
              citation.pageIndex == null ||
              !unverifiedPages.includes(citation.pageIndex),
          );

          const note =
            `\n\n_Note: cited page(s) ${unverifiedPages.join(", ")} were not in the ` +
            `retrieved context, so ${unverifiedPages.length === 1 ? "that reference has" : "those references have"} ` +
            `been omitted from the source list._`;

          fullText += note;
          sink.send("delta", { text: note });

          console.warn(
            `[chat] dropped unverified citation page(s): ${unverifiedPages.join(", ")}`,
          );
        }

        await this.chatService.addMessage(
          sessionId,
          "ai",
          fullText,
          verifiedCitations,
        );
      }

      // Wait for title generation (if any) to settle so the `done` event can
      // carry the final title to the client.
      if (titlePromise) await titlePromise;

      sink.send("done", {
        text: "",
        citations: verifiedCitations,
        references: hybridSearch.length,
        sessionId,
        documentId,
        title,
      });
    } catch (error: any) {
      // A client disconnect is a normal cancellation, not a failure: don't roll
      // back state or try to report an error to a socket that is already gone.
      if (signal?.aborted) {
        console.log("Chat turn aborted by client");
        return;
      }

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