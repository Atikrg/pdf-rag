import Router from "express";
import { healthCheck } from "../controllers/meta.controller";

const router = Router();

router.get("/healthy", healthCheck);

export default router;
