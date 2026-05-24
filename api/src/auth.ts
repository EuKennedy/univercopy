import jwt from "jsonwebtoken";
import type { Context, Next } from "hono";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function sign(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: "7d" });
}

// Middleware: exige Bearer token válido e injeta userId no contexto.
export async function auth(c: Context, next: Next) {
  const header = c.req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string };
    c.set("userId", payload.sub);
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
}
