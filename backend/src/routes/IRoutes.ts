import type { Router } from "express";

export interface IRoutes {
  readonly basePath: string;
  register(): Router;
}
