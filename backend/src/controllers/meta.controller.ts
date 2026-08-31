import type { Request, Response } from "express";

export class MetaController {
  public healthCheck = (request: Request, response: Response) => {
    return response.status(200).json({
      message: "Backend is Healthy",
    });
  };
}
