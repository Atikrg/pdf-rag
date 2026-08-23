import { OpenAI } from "openai";



const aiModel = process.env.AI_MODEL;
export class OpenAiService {
  constructor(private readonly openaiClient: OpenAI) { }

  async generateResponse(prompt: string) {
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: aiModel!,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const content = response.choices?.[0]?.message?.content;

      return content;
    } catch (error: any) {
      throw new Error(
        `Failed to generate chat response: ${error?.message ?? error}`,
      );
    }
  }
}
