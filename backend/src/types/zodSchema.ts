import z from "zod";

export const fileSchema = z.object({
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  objectName: z.string(),
});

export const promptSchema = z.object({
  text: z.string().trim().min(1, "Text is required"),
});
