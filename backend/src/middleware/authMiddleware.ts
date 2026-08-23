import type { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";
import { verifyToken } from "../utils/jwt";

export function authenticateJWT(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer")) {
    return response.status(401).json({
      message: "Unauthorized",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!token) {
      return response.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const decoded = verifyToken(token);


    request.user = decoded;

    next();
  } catch (error) {
    return response.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
