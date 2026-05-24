// Cliente mínimo da WooCommerce REST API v3 (autenticação Basic com key/secret).
export type WooCfg = { url: string; key: string; secret: string };

function base(cfg: WooCfg) {
  return cfg.url.replace(/\/$/, "") + "/wp-json/wc/v3";
}
function authHeader(cfg: WooCfg) {
  return "Basic " + Buffer.from(`${cfg.key}:${cfg.secret}`).toString("base64");
}

export type WooProduct = {
  id: number; sku?: string; name: string; description?: string;
  short_description?: string; price?: string; permalink?: string;
  categories?: { name: string }[]; images?: { src: string }[];
  average_rating?: string; rating_count?: number;
};

export async function wooListProducts(cfg: WooCfg, page = 1, perPage = 50) {
  const url = `${base(cfg)}/products?per_page=${perPage}&page=${page}&status=publish`;
  const res = await fetch(url, { headers: { authorization: authHeader(cfg) } });
  if (!res.ok) throw new Error(`WooCommerce list ${res.status}`);
  const totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
  const items = (await res.json()) as WooProduct[];
  return { items, totalPages };
}

export async function wooUpdateProduct(
  cfg: WooCfg, id: number, fields: { description?: string; short_description?: string }
) {
  const res = await fetch(`${base(cfg)}/products/${id}`, {
    method: "PUT",
    headers: { authorization: authHeader(cfg), "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`WooCommerce update ${res.status}`);
  return res.json();
}
