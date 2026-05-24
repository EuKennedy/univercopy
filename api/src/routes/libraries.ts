import { Hono } from "hono";
import { pool } from "../db.js";
import type { Env } from "../types.js";

// Bibliotecas globais (estilos, frameworks, peças, categorias) — leitura pública.
const r = new Hono<Env>();

r.get("/styles", async (c) =>
  c.json((await pool.query("select * from style order by grp, name")).rows));

r.get("/frameworks", async (c) =>
  c.json((await pool.query("select * from framework order by name")).rows));

r.get("/piece-types", async (c) =>
  c.json((await pool.query("select * from piece_type order by category_key, name")).rows));

r.get("/categories", async (c) =>
  c.json((await pool.query("select * from category where workspace_id is null order by name")).rows));

export default r;
