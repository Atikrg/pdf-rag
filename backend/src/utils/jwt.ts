import jwt, { type SignOptions } from "jsonwebtoken";
import { AppConfig } from "../config/AppConfig";

export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (matches expiresIn)

/**
 * Resolved per call rather than at module load so the strength check in
 * AppConfig is what validates the secret, instead of `process.env` being read
 * raw and silently yielding "" when unset.
 */
function secret(): string {
  return AppConfig.getInstance().jwtSecret;
}

export interface AppTokenPayload {
  userId: string;
  email?: string | null;
  jti?: string;
}

export function signToken(payload: AppTokenPayload): string {
  const options: SignOptions = { expiresIn: TOKEN_TTL_SECONDS };
  return jwt.sign(payload, secret(), options);
}

export function verifyToken(token: string): AppTokenPayload {
  return jwt.verify(token, secret()) as AppTokenPayload;
}
