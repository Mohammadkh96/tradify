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
    return res.status(500).json({ error: 'Session initialization failed' });
  }

  const url = req.url || '';
  const path = url.split('?')[0];

  try {
    if (path === '/api/auth/user' && req.method === 'GET') {
      const sess = (req as any).session;
      if (!sess?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const result = await pool.query(
        'SELECT id, email, username, "subscriptionTier", "subscriptionStatus", role FROM users WHERE id = $1',
        [sess.userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(result.rows[0]);
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      (req as any).session.userId = user.id;
      await new Promise<void>((resolve, reject) => {
        (req as any).session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        role: user.role
      });
    }

    if (path === '/api/auth/register' && req.method === 'POST') {
      const { email, username, password } = req.body || {};
      if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username, and password required' });
      }
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (email, username, password, "subscriptionTier", "subscriptionStatus", role)
         VALUES ($1, $2, $3, 'FREE', 'active', 'USER')
         RETURNING id, email, username, "subscriptionTier", "subscriptionStatus", role`,
        [email, username, hashedPassword]
      );
      const newUser = result.rows[0];
      (req as any).session.userId = newUser.id;
      await new Promise<void>((resolve, reject) => {
        (req as any).session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.json(newUser);
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      await new Promise<void>((resolve, reject) => {
        (req as any).session.destroy((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Not found', path });
  } catch (err: any) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
