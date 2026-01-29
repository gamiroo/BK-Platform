import "../../../shared/theme/globals.css";
import "../../../shared/theme/tokens.css";
import "../../../shared/theme/motion.css";

import { startClientApp } from "./app.js";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root");

startClientApp(root);

