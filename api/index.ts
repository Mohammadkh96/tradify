import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: true
});

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'tradify-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
});

function runSession(req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    sessionMiddleware(req, res, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await runSession(req, res);
  } catch (err) {
    console.error('Session error:', err);
    return res.status(500).json({ message: 'Session initialization failed' });
  }

  const url = req.url || '';
  const path = url.split('?')[0];

  try {
    // GET /api/auth/user - Get current user
    if (path === '/api/auth/user' && req.method === 'GET') {
      const sess = (req as any).session;
      if (!sess?.visitorId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const result = await pool.query(
        `SELECT id, user_id as "userId", role, subscription_tier as "subscriptionTier", 
                subscription_status as "subscriptionStatus", country, phone_number as "phoneNumber", 
                timezone, created_at as "createdAt"
         FROM user_role WHERE id = $1`,
        [sess.visitorId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      const user = result.rows[0];
      return res.json({
        id: user.id,
        visitorId: user.id,
        userId: user.userId,
        email: user.userId,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        country: user.country,
        phoneNumber: user.phoneNumber,
        timezone: user.timezone
      });
    }

    // POST /api/auth/login
    if (path === '/api/auth/login' && req.method === 'POST') {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
      }
      const result = await pool.query('SELECT * FROM user_role WHERE user_id = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      (req as any).session.visitorId = user.id;
      await new Promise<void>((resolve, reject) => {
        (req as any).session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.json({
        id: user.id,
        visitorId: user.id,
        userId: user.user_id,
        email: user.user_id,
        role: user.role,
        subscriptionTier: user.subscription_tier,
        subscriptionStatus: user.subscription_status,
        country: user.country,
        phoneNumber: user.phone_number,
        timezone: user.timezone
      });
    }

    // POST /api/auth/register
    if (path === '/api/auth/register' && req.method === 'POST') {
      const { email, password, country, phoneNumber, timezone } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
      }
      
      // Check if email already exists
      const existing = await pool.query('SELECT id FROM user_role WHERE user_id = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO user_role (user_id, password, role, subscription_tier, subscription_status, country, phone_number, timezone, terms_accepted, risk_acknowledged)
         VALUES ($1, $2, 'USER', 'FREE', 'active', $3, $4, $5, true, true)
         RETURNING id, user_id, role, subscription_tier, subscription_status, country, phone_number, timezone`,
        [email, hashedPassword, country || null, phoneNumber || null, timezone || null]
      );
      
      const newUser = result.rows[0];
      (req as any).session.visitorId = newUser.id;
      await new Promise<void>((resolve, reject) => {
        (req as any).session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      return res.json({
        id: newUser.id,
        visitorId: newUser.id,
        userId: newUser.user_id,
        email: newUser.user_id,
        role: newUser.role,
        subscriptionTier: newUser.subscription_tier,
        subscriptionStatus: newUser.subscription_status,
        country: newUser.country,
        phoneNumber: newUser.phone_number,
        timezone: newUser.timezone
      });
    }

    // POST /api/auth/logout
    if (path === '/api/auth/logout' && req.method === 'POST') {
      await new Promise<void>((resolve, reject) => {
        (req as any).session.destroy((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.json({ success: true });
    }

    // GET /api/user - Alias for /api/auth/user
    if (path === '/api/user' && req.method === 'GET') {
      const sess = (req as any).session;
      if (!sess?.visitorId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const result = await pool.query(
        `SELECT id, user_id, role, subscription_tier, subscription_status, country, phone_number, timezone
         FROM user_role WHERE id = $1`,
        [sess.visitorId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      const user = result.rows[0];
      return res.json({
        id: user.id,
        visitorId: user.id,
        userId: user.user_id,
        email: user.user_id,
        role: user.role,
        subscriptionTier: user.subscription_tier,
        subscriptionStatus: user.subscription_status,
        country: user.country,
        phoneNumber: user.phone_number,
        timezone: user.timezone
      });
    }

    return res.status(404).json({ message: 'Not found', path });
  } catch (err: any) {
    console.error('API error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
}
