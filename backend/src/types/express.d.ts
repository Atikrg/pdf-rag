import type { JwtPayload } from "jsonwebtoken";
import type { StoredFileMeta } from "../core/ports/IFileStorage";

declare global {
  namespace Express {
    interface Request {
      user?: string | JwtPayload;
      userId: string;
      clerkId?: string;
      fileData?: StoredFileMeta;
    }
  }
}

export {};
