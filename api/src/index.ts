import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { auth, sign } from "./auth.js";
import { withUser } from "./db.js";
import type { Env } from "./types.js";
import libraries from "./routes/libraries.js";
import workspaces from "./routes/workspaces.js";
import dna from "./routes/dna.js";
import copies from "./routes/copies.js";
import generate from "./routes/generate.js";
import audit from "./routes/audit.js";
import woocommerce from "./routes/woocommerce.js";

const app = new Hono<Env>();
app.use("*", cors({ origin: (process.env.APP_ORIGIN || "*").split(",") }));

app.get("/health", (c) => c.json({ ok: true, service: "univercopy-api" }));

// Login de desenvolvimento (substituir por OAuth depois).
app.post("/auth/login", async (c) => {
  const body = await c.req
    .json<{ email?: string; name?: string }>()
    .catch(() => ({} as { email?: string; name?: string }));
  const { email, name } = body;
  if (!email) return c.json({ error: "email obrigatório" }, 400);
  const user = await withUser(null, async (cl) => {
    const u = await cl.query(
      `insert into app_user(email, name) values($1, $2)
       on conflict(email) do update set name = coalesce(excluded.name, app_user.name)
       returning id, email, name`,
      [email, name ?? null]
    );
    return u.rows[0];
  });
  return c.json({ token: sign(user.id), user });
});

app.get("/me", auth, async (c) => {
  const id = c.get("userId");
  const out = await withUser(id, (cl) =>
    cl.query("select id, email, name from app_user where id = $1", [id]));
  return c.json(out.rows[0] ?? null);
});

app.route("/", libraries);
app.route("/", workspaces);
app.route("/", dna);
app.route("/", copies);
app.route("/", generate);
app.route("/", audit);
app.route("/", woocommerce);

const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port });
console.log(`UniverCopy API rodando na porta ${port}`);
