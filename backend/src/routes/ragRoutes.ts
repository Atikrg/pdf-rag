import { Router } from "express";
import { ragController } from "../controllers/rag.controller";

const router = Router();

router.post("/query", ragController);

export default router;
