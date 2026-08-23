import { Ollama } from "ollama"

export class OllamaService {

  constructor(private client: Ollama) { }
  
  async chatWithOllama(metaPrompt: string,prompt: string) {

    try {
      
    const response = await this.client.chat({
      model: "llama3.2",
      messages: [
        {
          role: "user",
          content:  metaPrompt + " prompt is -> " + prompt
        }
      ]
    })

  
    return response;
    }

    catch (error)
    {

      throw new Error("Failed to chat with Ollama");
      
    }
  }

}