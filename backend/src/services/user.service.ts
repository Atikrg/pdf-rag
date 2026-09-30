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

  /**
   * Issues a password-reset token, replacing any the user already holds.
   *
   * Only the hash is persisted, and the previous rows are deleted first so a
   * user can only ever have one live reset link: a link mailed earlier must not
   * keep working after a newer one is requested.
   */
  async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: input.userId },
    });

    return prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  /** Resolves a presented token to its user, or null if unknown or expired. */
  async findUserByValidResetToken(tokenHash: string) {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      return null;
    }

    // Expiry is checked here rather than in a deleteMany sweep alone, so an
    // expired row is unusable even if the sweep has not run yet.
    if (record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return record.user;
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  /** Consumes the used token and clears any sibling tokens for the same user. */
  async consumePasswordResetToken(tokenHash: string, userId: string) {
    await prisma.passwordResetToken.deleteMany({
      where: { userId },
    });
  }

  /** Housekeeping: drops tokens that can no longer be redeemed. */
  async purgeExpiredResetTokens() {
    return prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }

  /**
   * Creates a user from a Google account if they do not exist, otherwise
   * returns the existing user (log in). Keyed on the verified Google email.
   */
  async upsertGoogleUser(info: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
  }) {
    const email = info.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName: info.firstName ?? existing.firstName,
          lastName: info.lastName ?? existing.lastName,
          imageUrl: info.imageUrl ?? existing.imageUrl,
        },
      });
    }

    return prisma.user.create({
      data: {
        email,
        firstName: info.firstName ?? "",
        lastName: info.lastName ?? "",
        imageUrl: info.imageUrl ?? null,
      },
    });
  }
}