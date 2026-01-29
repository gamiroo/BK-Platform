// src/frontend/admin/src/main.ts
// Admin surface entrypoint

import "../../../shared/theme/globals.css";
import "../../../shared/theme/tokens.css";
import "../../../shared/theme/motion.css";

import { initTheme } from "../../shared/theme.js";
import { startAdminApp } from "./app.js";

initTheme();

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root");

startAdminApp(root);

