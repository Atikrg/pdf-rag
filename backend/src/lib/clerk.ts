import { createClerkClient, verifyToken } from "@clerk/backend";

const secretKey = process.env.CLERK_SECRET_KEY ?? "";
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? "";

export const clerkClient = createClerkClient({
  secretKey,
  publishableKey,
});

/**
 * Verifies a Clerk-issued session token and returns the parsed claims.
 * Falls back to networkless JWT verification when a PEM public key is
 * configured via CLERK_JWT_PEM.
 */
export async function verifyClerkToken(token: string) {
  const jwtKey = process.env.CLERK_JWT_PEM || undefined;
  const { data } = await verifyToken(token, { jwtKey });
  return data;
}

/**
 * Loads public profile info for a Clerk user via the Backend API.
 * Returns an empty object when the secret key is not configured.
 */
export async function getClerkUser(clerkId: string) {
  if (!secretKey) {
    return {};
  }
  const user = await clerkClient.users.getUser(clerkId);
  const email = user.emailAddresses?.[0]?.emailAddress ?? null;
  return {
    email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    imageUrl: user.imageUrl ?? null,
  };
}
