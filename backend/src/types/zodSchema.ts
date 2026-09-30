import z from "zod";

export const fileSchema = z.object({
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  objectName: z.string(),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  // 43 chars for a base64url-encoded 32-byte token. Bounded so a caller cannot
  // push an unbounded string through the SHA-256 on every guess.
  token: z.string().trim().min(20).max(200, "Reset link is invalid"),
  // Same rule as signup, so a reset cannot set a password the signup form
  // would have rejected.
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const renameSessionSchema = z.object({
  // Trimmed to a printable length so a rename cannot inject newlines into the
  // sidebar or store an unbounded blob per session.
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title must be 120 characters or fewer"),
});

export const chatStreamSchema = z.object({
  sessionId: z.string().min(1).optional(),
  // Bounded because the prompt is concatenated with retrieved document context
  // and forwarded to the model on every turn; an unbounded string lets one
  // message drive an arbitrarily large request (and bill).
  prompt: z.string().trim().min(1).max(8000, "Prompt is too long"),
  documentId: z.string().min(1).optional(),
});


export const createSessionSchema = z.object({
  documentId: z.string().min(1).optional(),
});
