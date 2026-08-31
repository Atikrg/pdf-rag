import type { Request, Response } from "express";
import { AppError } from "../error/CustomError";
import { UserService } from "../services/user.service";
import { signToken } from "../utils/jwt";
import { signupSchema, loginSchema } from "../types/zodSchema";

const userService = new UserService();

export class AuthController {
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