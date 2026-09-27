import { prisma } from "../lib/prisma";
import type { OpenAiService } from "./openai.service";

const DEFAULT_TITLE = "New chat";

export class ChatService {
  constructor(private readonly openAiService: OpenAiService) {}

  async createSession(userId: string, documentId?: string) {
    if (documentId) {
      const doc = await prisma.document.findFirst({
        where: { id: documentId, userId },
      });
      if (!doc) {
        throw new Error("Document not found");
      }
    }

    const session = await prisma.chatSession.create({
      data: {
        userId,
        documentId: documentId ?? null,
        title: DEFAULT_TITLE,
      },
    });

    return session;
  }

  async listSessions(userId: string) {
    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        documentId: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true, role: true },
        },
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      documentId: s.documentId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      preview: s.messages[0]?.content ?? "",
    }));
  }

  async getSession(userId: string, sessionId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        document: { select: { id: true, originalName: true } },
      },
    });

    if (!session) return null;

    return {
      id: session.id,
      title: session.title,
      documentId: session.documentId,
      document: session.document,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
    };
  }

  async deleteSession(userId: string, sessionId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) return false;

    await prisma.chatSession.delete({ where: { id: session.id } });
    return true;
  }

  async deleteMessage(messageId: string) {
    return prisma.message.delete({ where: { id: messageId } });
  }

  /**
   * Formats the full prior conversation (excluding the message currently being
   * answered) so the model has the whole thread for a document-scoped session.
   *
   * Bounded by a character budget rather than a turn count: the caller wants the
   * entire conversation, but a long session would otherwise grow the prompt
   * without limit. When the budget is exceeded the oldest turns are dropped, and
   * the truncation is stated in the prompt so the model knows earlier context is
   * missing rather than assuming it was never said.
   */
  async formatHistory(
    sessionId: string,
    currentPrompt: string,
    maxChars = 12_000,
  ) {
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    const lines = messages
      .filter((m) => m.content !== currentPrompt)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`);

    if (lines.length === 0) return "";

    let kept = lines;
    let truncated = false;

    let total = lines.reduce((sum, line) => sum + line.length + 1, 0);
    while (total > maxChars && kept.length > 1) {
      kept = kept.slice(1);
      total = kept.reduce((sum, line) => sum + line.length + 1, 0);
      truncated = true;
    }

    const body = kept.join("\n");

    return truncated
      ? `[earlier turns omitted to fit the context window]\n${body}`
      : body;
  }

  async addMessage(
    sessionId: string,
    role: "user" | "ai",
    content: string,
    citations?: unknown,
  ) {
    return prisma.message.create({
      data: {
        sessionId,
        role,
        content,
        citations: citations ? JSON.parse(JSON.stringify(citations)) : undefined,
      },
    });
  }

  /**
   * Assigns a generated title (derived from the first user message) when the
   * session still uses the default title.
   */
  async ensureTitle(sessionId: string, firstUserMessage: string) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.title !== DEFAULT_TITLE) return session;

    const title = await this.openAiService.generateTitle(firstUserMessage);

    return prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });
  }
}
