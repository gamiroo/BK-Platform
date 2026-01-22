// src/frontend/site/src/app.ts
import { mountRouter } from "./router/router.js";
import { registerRoutes } from "./router/routes.js";

export function mountApp(root: HTMLElement): void {
  const router = mountRouter(root);
  registerRoutes(router);
  router.start();
}
