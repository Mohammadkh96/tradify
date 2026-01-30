import type { Request, Response } from "express";

// Vercel serverless handler with error handling
export default async function handler(req: Request, res: Response) {
  try {
    // Dynamic import to catch initialization errors
    const { default: app, ensureInitialized } = await import("../server/index");
    await ensureInitialized();
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel function error:", error);
    return res.status(500).json({ 
      message: "Server initialization failed",
      error: error.message || "Unknown error"
    });
  }
}
