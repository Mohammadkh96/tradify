import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body; // password = access_key

  if (!email || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, email, label
      FROM admin_access
      WHERE email = $1
        AND access_key = $2
        AND is_active = true
      `,
      [email, password]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Authentication failed" });
    }

    return res.status(200).json({
      user: result.rows[0],
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
