import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log("LOGIN FUNCTION HIT");

  return res.status(200).json({
    ok: true,
    message: "Function is running",
  });
}
