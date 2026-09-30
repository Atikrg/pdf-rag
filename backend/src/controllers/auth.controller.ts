import type { Request, Response } from "express";
import crypto from "node:crypto";
import { AppError } from "../error/CustomError";
import { UserService } from "../services/user.service";
import { signToken } from "../utils/jwt";
import type { AppConfig } from "../config/AppConfig";
import { signupSchema, loginSchema } from "../types/zodSchema";

const userService = new UserService();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export class AuthController {
  constructor(private readonly config: AppConfig) {}

  public googleAuth = async (request: Request, response: Response) => {
    const clientId = this.config.googleClientId;
    const redirectUri = this.config.googleRedirectUri;

    if (!clientId || !redirectUri) {
      return response
        .status(400)
        .json({ message: "Google OAuth is not configured" });
    }

    const state = crypto.randomBytes(16).toString("hex");
    response.cookie("google_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.protocol === "https",
      // State is single-use and only needed during the redirect round-trip; 5
      // minutes is more than enough for the OAuth provider to return a code.
      maxAge: 5 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account",
      state,
      access_type: "online",
    });

    return response.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  };

  public googleCallback = async (request: Request, response: Response) => {
    const clientId = this.config.googleClientId;
    const clientSecret = this.config.googleClientSecret;
    const redirectUri = this.config.googleRedirectUri;

    if (!clientId || !clientSecret || !redirectUri) {
      return response
        .status(400)
        .json({ message: "Google OAuth is not configured" });
    }

    const code = typeof request.query.code === "string" ? request.query.code : null;
    const state = typeof request.query.state === "string" ? request.query.state : null;
    const savedState =
      typeof request.cookies?.google_oauth_state === "string"
        ? request.cookies.google_oauth_state
        : null;

    if (!code) {
      return response.status(400).json({ message: "Missing authorization code" });
    }
    if (!state || !savedState || state !== savedState) {
      response.clearCookie("google_oauth_state", {
        httpOnly: true,
        sameSite: "lax",
        secure: request.protocol === "https",
      });
      return response.status(400).json({ message: "Invalid OAuth state" });
    }

    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens: any = await tokenRes.json();
      if (!tokens.access_token) {
        console.error("Google token error:", tokens);
        return response.status(502).json({ message: "Failed to authenticate with Google" });
      }

      const userRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userRes.ok) {
        return response.status(502).json({ message: "Failed to fetch Google profile" });
      }

      const profile: any = await userRes.json();
      const email: string | null = typeof profile.email === "string" ? profile.email : null;

      if (!email) {
        return response.status(400).json({ message: "Google account has no email" });
      }

      // Create the user if they don't exist, otherwise log them in.
      const user = await userService.upsertGoogleUser({
        email,
        firstName: typeof profile.given_name === "string" ? profile.given_name : null,
        lastName: typeof profile.family_name === "string" ? profile.family_name : null,
        imageUrl: typeof profile.picture === "string" ? profile.picture : null,
      });

      const token = signToken({ userId: user.id, email: user.email });

      const origin = new URL(redirectUri).origin;
      const userPayload = encodeURIComponent(
        JSON.stringify(this.safeUser(user)),
      );
      response.clearCookie("google_oauth_state", {
        httpOnly: true,
        sameSite: "lax",
        secure: request.protocol === "https",
      });
      return response.redirect(
        `${origin}/login?token=${encodeURIComponent(token)}&user=${userPayload}`,
      );
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      return response.status(500).json({ message: "Google login failed" });
    }
  };

  public signup = async (request: Request, response: Response) => {
    try {
      const { data, success } = signupSchema.safeParse(request.body);
      if (!success || !data) {
        throw new AppError(400, "Invalid signup details");
      }

      const email = data.email.toLowerCase().trim();
      const existing = await userService.findByEmail(email);
      if (existing) {
        throw new AppError(409, "An account with this email already exists");
      }

      const passwordHash = await Bun.password.hash(data.password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      const user = await userService.createLocalUser({
        email,
        passwordHash,
        name: data.name,
      });

      const token = signToken({ userId: user.id, email: user.email });

      return response.status(201).json({
        success: true,
        token,
        user: this.safeUser(user),
      });
    } catch (error) {
      return this.handleError(error, response, "Signup failed");
    }
  };

  public login = async (request: Request, response: Response) => {
    try {
      const { data, success } = loginSchema.safeParse(request.body);
      if (!success || !data) {
        throw new AppError(400, "Invalid login details");
      }

      const email = data.email.toLowerCase().trim();
      const user = await userService.findByEmail(email);
      if (!user || !user.passwordHash) {
        throw new AppError(401, "Invalid email or password");
      }

      const valid = await Bun.password.verify(data.password, user.passwordHash);
      if (!valid) {
        throw new AppError(401, "Invalid email or password");
      }

      const token = signToken({ userId: user.id, email: user.email });

      return response.status(200).json({
        success: true,
        token,
        user: this.safeUser(user),
      });
    } catch (error) {
      return this.handleError(error, response, "Login failed");
    }
  };

  public me = async (request: Request, response: Response) => {
    try {
      const userId = request.userId;
      const user = await userService.findById(userId);
      if (!user) {
        throw new AppError(401, "Unauthorized");
      }
      return response.status(200).json({ success: true, user: this.safeUser(user) });
    } catch (error) {
      return this.handleError(error, response, "Failed to load user");
    }
  };

  private safeUser(user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    };
  }

  private handleError(error: any, response: Response, fallback: string) {
    if (error instanceof AppError) {
      return response.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    return response.status(500).json({ message: fallback });
  }
}