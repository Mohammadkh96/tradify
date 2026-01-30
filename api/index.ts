import type { Request, Response } from "express";
import app, { ensureInitialized } from "../server/index";

// Vercel serverless handler that ensures app is initialized
export default async function handler(req: Request, res: Response) {
  await ensureInitialized();
  return app(req, res);
}
