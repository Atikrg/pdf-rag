import { Router } from "express";
import type { IRoutes } from "./IRoutes";
import type { MetaController } from "../controllers/meta.controller";

export class MetaRoutes implements IRoutes {
  public readonly basePath = "/api";

  constructor(private readonly metaController: MetaController) {}

  public register(): Router {
    const router = Router();

    router.get("/healthy", this.metaController.healthCheck);

    return router;
  }
}
