// src/frontend/site/src/router/routes.ts
import type { Router } from "./router.js";

import { renderHomePage } from "../views/pages/home.page.js";
import { renderRequestAccessPage } from "../views/pages/request-access.page.js"
import { renderNotFoundPage } from "../views/pages/not-found.page.js"

export function registerRoutes(router: Router): void {
  router.add({ path: "/", render: renderHomePage });
  router.add({ path: "/request-access", render: renderRequestAccessPage });
  router.add({ path: "/404", render: renderNotFoundPage });
}
