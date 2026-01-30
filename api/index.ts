import type { VercelRequest, VercelResponse } from "@vercel/node";

// Simple test handler to diagnose issues
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check environment variables
  const envCheck = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL
  };

  try {
    // Try to import and initialize the app
    const { default: app, ensureInitialized } = await import("../server/index");
    await ensureInitialized();
    
    // Forward the request to Express
    return app(req as any, res as any);
  } catch (error: any) {
    console.error("Vercel function error:", error);
    return res.status(500).json({ 
      message: "Server initialization failed",
      error: error.message || "Unknown error",
      stack: error.stack,
      envCheck
    });
  }
}
