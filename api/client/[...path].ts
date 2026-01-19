import { makeVercelHandler } from "../../src/server/http/vercel-app.js";
export const config = { runtime: "nodejs" };
export default makeVercelHandler("client");
