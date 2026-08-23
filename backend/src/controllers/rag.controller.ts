import { getEmbeddingModel } from "../lib/embeddings";
import type { Request, Response } from "express";
import { success } from "zod";


export const ragController = async (request: Request, response: Response) => {
  try {
      
        const { prompt, collectionName } = request.body;

        if (!prompt || !collectionName) {
            return response.status(400).json({
                success: "fail",
                message: "Invalid prompt"
            })
        }

    } catch (error) {
        console.error("Internal Server Error");


        return response.status(500).json({
            success: "fail",
            message: "Internal Server Error"
        })
    }
}





