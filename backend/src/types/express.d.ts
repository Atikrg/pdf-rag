import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: string | JwtPayload;
      userId: string;
      fileData?: {
        objectName: string;
        originalName;
        size;
        mimeType;
      };
    }
  }
}

export {};
