// src/server/http/index.ts
// Simple entrypoint for starting the backend locally.

import { loadEnv } from "../../shared/config/env.js";
import { startHttpServer } from "./server.js";

const env = loadEnv();
startHttpServer(env.PORT);
