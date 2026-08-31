import { prisma } from "../lib/prisma";

export type ClerkUserInfo = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
};

export class UserService {
  /**
   * Returns (creating if necessary) a User row synced from a Clerk user.
   * Clerk's `sub` claim is stored on `clerkId`.
   */
  async ensureUser(clerkId: string, info: ClerkUserInfo = {}) {
    const existing = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          email: info.email ?? existing.email,
          firstName: info.firstName ?? existing.firstName,
          lastName: info.lastName ?? existing.lastName,
          imageUrl: info.imageUrl ?? existing.imageUrl,
        },
      });
    }

    return prisma.user.create({
      data: {
        clerkId,
        email: info.email ?? null,
        firstName: info.firstName ?? null,
        lastName: info.lastName ?? null,
        imageUrl: info.imageUrl ?? null,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async createLocalUser(input: {
    email: string;
    passwordHash: string;
    name?: string | null;
  }) {
    const [firstName, ...rest] = (input.name ?? "").trim().split(" ");
    return prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: firstName || "",
        lastName: rest.join(" ") || "",
      },
    });
  }
}