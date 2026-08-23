import type { Request, Response } from "express";

export const healthCheck = (request: Request, response: Response) => {
  try {
    return response.status(200).json({
      message: "Backend is Healthy",
    });
  } catch (error: any) {
    response.status(500).json({
      message: "Backend is not Healthy",
    });
  }
};
