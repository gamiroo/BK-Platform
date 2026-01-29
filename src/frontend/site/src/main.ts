// src/frontend/site/src/main.ts
import "../../../shared/theme/tokens.css";
import "../../../shared/theme/globals.css";

import { mountApp } from "./app.js";

const appSite = document.querySelector<HTMLDivElement>("#app");
if (!appSite) throw new Error("Missing #app element.");

mountApp(appSite);
