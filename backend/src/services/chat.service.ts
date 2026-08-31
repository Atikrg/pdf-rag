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
   * Formats the most recent prior turns (excluding the current prompt) so the
   * model can answer follow-ups without answering from history.
   */
  async formatHistory(sessionId: string, currentPrompt: string, limit = 5) {
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      select: { role: true, content: true, createdAt: true },
    });

    const prior = messages
      .slice()
      .reverse()
      .filter((m) => m.content !== currentPrompt)
      .slice(-limit * 2);

    return prior
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");
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
