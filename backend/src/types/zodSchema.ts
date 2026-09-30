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
