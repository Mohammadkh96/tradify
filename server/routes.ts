import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertTradeSchema,
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";

const JWT_SECRET = process.env.JWT_SECRET || "fintech_ultra_secret_2026";

// Production-grade Middleware
const requestID = (req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
};

const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing token" } });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Invalid or expired token" } });
    req.user = user;
    next();
  });
};

const logger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ID: ${req.headers['x-request-id']}`);
  });
  next();
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Increased for polling and MT5 sync
  message: { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" } }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: { code: "AUTH_RATE_LIMIT", message: "Too many attempts" } }
});

export async function registerRoutes(app: Express): Promise<void> {
  app.use(requestID);
  app.use(logger);
  app.use(generalLimiter);

  const validateSchema = (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err: any) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: err.errors[0].message } });
    }
  };

  // Auth Routes
  app.post("/api/auth/register", authLimiter, validateSchema(insertUserSchema), async (req, res) => {
    try {
      const { email, password } = req.body;
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: { code: "EMAIL_EXISTS", message: "Email already exists" } });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ email, passwordHash });
      
      const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      
      await storage.createAuditLog({
        userId: user.id,
        action: "USER_REGISTERED",
        entityType: "users",
        entityId: user.id,
        ipAddress: req.ip
      });

      res.status(201).json({ success: true, token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Registration failed" } });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ 
          success: false,
          error: { 
            code: "AUTH_INVALID_CREDENTIALS", 
            message: "Invalid email or password" 
          } 
        });
      }

      const accessToken = jwt.sign(
        { sub: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      res.json({ 
        success: true, 
        accessToken, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role 
        } 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Login failed" 
        } 
      });
    }
  });

  // User Profile
  app.get("/api/user", authenticateToken, async (req: any, res) => {
    const user = await storage.getUserById(req.user.sub);
    if (!user) return res.sendStatus(404);
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  });

  // Trades API
  app.get("/api/trades", authenticateToken, async (req: any, res) => {
    try {
      const tradeList = await storage.getTrades(req.user.sub);
      res.json(tradeList);
    } catch (err) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch trades" } });
    }
  });

  app.post("/api/trades", authenticateToken, validateSchema(insertTradeSchema), async (req: any, res) => {
    try {
      const trade = await storage.createTrade({ ...req.body, userId: req.user.sub });
      
      await storage.createAuditLog({
        userId: req.user.sub,
        action: "TRADE_CREATED",
        entityType: "trades",
        entityId: trade.id,
        ipAddress: req.ip
      });

      res.status(201).json(trade);
    } catch (err) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create trade" } });
    }
  });
}
