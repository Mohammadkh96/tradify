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

  try {
    const result = await pool.query("SELECT 1 AS ok");
    return res.status(200).json({ db: result.rows[0] });
  } catch (err) {
    console.error("DB ERROR:", err);
    return res.status(500).json({ error: "DB connection failed" });
  }
}
