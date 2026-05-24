/* UniverCopy — SDK de frontend para a API.
   Uso:
     import { UniverCopy } from './api.js';
     const uc = new UniverCopy('https://api.univercopy.com.br');
     await uc.login('diego@lizzon.com.br','Diego');
     const wss = await uc.workspaces.list();
*/
export class UniverCopy {
  constructor(baseUrl, token) {
    this.base = (baseUrl || '').replace(/\/$/, '');
    try { this.token = token || localStorage.getItem('uc_token') || ''; } catch (_) { this.token = token || ''; }
  }
  setToken(t) { this.token = t || ''; try { t ? localStorage.setItem('uc_token', t) : localStorage.removeItem('uc_token'); } catch (_) {} }

  async _req(method, path, body) {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: 'Bearer ' + this.token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (method + ' ' + path + ' → ' + res.status));
    return data;
  }
  get(p) { return this._req('GET', p); }
  post(p, b) { return this._req('POST', p, b); }
  put(p, b) { return this._req('PUT', p, b); }
  patch(p, b) { return this._req('PATCH', p, b); }
  del(p) { return this._req('DELETE', p); }

  // --- Auth ---
  async login(email, name) {
    const r = await this.post('/auth/login', { email, name });
    this.setToken(r.token);
    return r.user;
  }
  me() { return this.get('/me'); }

  // --- Bibliotecas globais ---
  styles() { return this.get('/styles'); }
  frameworks() { return this.get('/frameworks'); }
  pieceTypes() { return this.get('/piece-types'); }
  categories() { return this.get('/categories'); }

  // --- Workspaces ---
  workspaces = {
    list: () => this.get('/workspaces'),
    create: (w) => this.post('/workspaces', w),
    get: (id) => this.get('/workspaces/' + id),
    update: (id, w) => this.patch('/workspaces/' + id, w),
    remove: (id) => this.del('/workspaces/' + id),
    members: (id) => this.get('/workspaces/' + id + '/members'),
  };

  // --- DNA ---
  dna = {
    get: (ws) => this.get('/workspaces/' + ws + '/dna'),
    save: (ws, kind, data) => this.put('/workspaces/' + ws + '/dna/' + kind, data),
    use: (ws, kind) => this.post('/workspaces/' + ws + '/dna/use', { kind }),
  };

  // --- Acervo (copies) ---
  copies = {
    list: (ws) => this.get('/workspaces/' + ws + '/copies'),
    create: (ws, copy) => this.post('/workspaces/' + ws + '/copies', copy),
    addVersion: (cid, content, note) => this.post('/copies/' + cid + '/versions', { content, note }),
    setStatus: (cid, status) => this.patch('/copies/' + cid + '/status', { status }),
    comments: (cid) => this.get('/copies/' + cid + '/comments'),
    comment: (cid, text) => this.post('/copies/' + cid + '/comments', { text }),
  };

  // --- Geração / Auditoria ---
  generate(ws, opts) { return this.post('/workspaces/' + ws + '/generate', opts); }
  audit(ws, url) { return this.post('/workspaces/' + ws + '/audit', { url }); }

  // --- WooCommerce ---
  woo = {
    connect: (ws, cfg) => this.post('/workspaces/' + ws + '/integrations/woocommerce', cfg),
    sync: (ws) => this.post('/workspaces/' + ws + '/products/sync', {}),
    products: (ws) => this.get('/workspaces/' + ws + '/products'),
    bulkGenerate: (ws, pieceTypeKey, limit) => this.post('/workspaces/' + ws + '/products/bulk-generate', { pieceTypeKey, limit }),
    publish: (pid, content, field) => this.post('/products/' + pid + '/publish', { content, field }),
  };
}

export default UniverCopy;
