import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import PostgresStore from "connect-pg-simple";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

// Extend session type
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const db = drizzle(pool, { schema });

// Create Express app
const app = express();

// Trust proxy for Vercel
app.set("trust proxy", 1);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Session setup
const PgSession = PostgresStore(session);
app.use(session({
  store: new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || "tradify_secret_2026",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: "lax"
  }
}));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get current user
app.get("/api/user", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, req.session.userId)).limit(1);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (error: any) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    
    const normalizedEmail = email.toLowerCase();
    const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, normalizedEmail)).limit(1);
    
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    if (!user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Set session
    req.session.userId = user.userId;
    
    res.json({ 
      message: "Login successful",
      user: {
        userId: user.userId,
        role: user.role,
        tier: user.subscriptionTier || "FREE"
      }
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error - please try again" });
  }
});

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, country, phoneNumber, timezone } = req.body;
    
    if (!email || !password || !country || !timezone) {
      return res.status(400).json({ message: "Required fields missing" });
    }
    
    const normalizedEmail = email.toLowerCase();
    const [existing] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, normalizedEmail)).limit(1);
    
    if (existing) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await db.insert(schema.userRole).values({
      userId: normalizedEmail,
      role: "TRADER",
      password: passwordHash,
      country,
      phoneNumber: phoneNumber || null,
      timezone,
      termsAccepted: false,
      riskAcknowledged: false,
      subscriptionTier: "FREE",
    });
    
    // Set session
    req.session.userId = normalizedEmail;
    
    res.json({ message: "Registration successful" });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error - please try again" });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Express error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Export handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
