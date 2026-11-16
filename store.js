// Camada de dados do Carrinho Barrocas.
// Duas versões com a mesma "cara":
//  - FirebaseStore: dados partilhados em tempo real (Firestore + login anónimo)
//  - LocalStore: modo demonstração, tudo guardado só neste aparelho
import { firebaseConfig } from './config.js';
import { PRODUTOS, SEED_VERSAO, NOVOS_V3 } from './seed.js';

const CORES = ['#1565C0', '#AD1457', '#6A1B9A', '#2E7D32', '#EF6C00', '#00838F', '#5D4037', '#C62828'];
const GKEY = 'cb-grupo';

// Código de convite longo e sem letras que se confundem (0/O, 1/I/L): ex. BAR-7KQ9-X2MP
const ALFA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function novoCodigo(nome) {
  const pal = (nome || 'Carrinho').normalize('NFD').replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).pop().toUpperCase();
  const pref = (pal.slice(0, 3) || 'CAR').padEnd(3, 'X');
  const r = new Uint32Array(8); crypto.getRandomValues(r);
  const bloco = (i) => Array.from(r.slice(i, i + 4), n => ALFA[n % ALFA.length]).join('');
  return `${pref}-${bloco(0)}-${bloco(4)}`;
}
const uid8 = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------- Local (demo)
class LocalStore {
  constructor() {
    this.demo = true;
    this.key = 'cb-demo';
    this.db = JSON.parse(localStorage.getItem(this.key) || 'null') || { me: null, group: null, members: {}, products: {}, lists: {} };
    this.subs = { group: [], products: [], lists: [] };
  }
  async init() {
    if (!this.db.me) { this.db.me = { uid: 'eu-' + uid8() }; this._save(); }
    this.uid = this.db.me.uid;
    return this.db.group ? this.db.group.id : null;
  }
  _save() { localStorage.setItem(this.key, JSON.stringify(this.db)); }
  _emit(...which) {
    this._save();
    for (const w of which) for (const cb of this.subs[w]) cb(this['_snap_' + w]());
  }
  _snap_group() {
    if (!this.db.group) return null;
    return { ...this.db.group, members: Object.entries(this.db.members).map(([uid, m]) => ({ uid, ...m })) };
  }
  _snap_products() { return Object.entries(this.db.products).map(([id, p]) => ({ id, ...p })); }
  _snap_lists() { return Object.entries(this.db.lists).map(([id, l]) => ({ id, ...l })); }
  _sub(w, cb) { this.subs[w].push(cb); cb(this['_snap_' + w]()); return () => { this.subs[w] = this.subs[w].filter(x => x !== cb); }; }
  subscribeGroup(cb) { return this._sub('group', cb); }
  subscribeProducts(cb) { return this._sub('products', cb); }
  subscribeLists(cb) { return this._sub('lists', cb); }

  async createGroup(nome, meuNome) {
    const id = 'g-' + uid8();
    this.db.group = { id, name: nome, code: novoCodigo(nome), owner: this.uid, seedV: SEED_VERSAO };
    this.db.members = { [this.uid]: { name: meuNome, color: CORES[0], joinedAt: Date.now() } };
    this.db.products = {};
    for (const p of PRODUTOS) this.db.products['p-' + uid8()] = { name: p.n, receipt: p.t, section: p.s, unit: p.u, price: p.p, count: p.c };
    this.db.lists = {};
    this._emit('group', 'products', 'lists');
    return id;
  }
  async joinGroup() { throw new Error('No modo demonstração não é possível entrar num grupo. Liga o Firebase primeiro (ver LEIA-ME).'); }
  async leaveGroup() { localStorage.removeItem(this.key); location.reload(); }
  async renameGroup(name) { this.db.group.name = name; this._emit('group'); }
  async newCode() { this.db.group.code = novoCodigo(this.db.group.name); this._emit('group'); }
  async removeMember(uid) { delete this.db.members[uid]; this._emit('group'); }

  async resetProducts() {
    this.db.products = {};
    for (const p of PRODUTOS) this.db.products['p-' + uid8()] = { name: p.n, receipt: p.t, section: p.s, unit: p.u, price: p.p, count: p.c };
    for (const l of Object.values(this.db.lists)) l.items = {};
    this.db.group.seedV = SEED_VERSAO;
    this._emit('group', 'products', 'lists');
  }
  async addNewProducts() {
    const tem = new Set(Object.values(this.db.products).map(p => p.name.toLowerCase()));
    for (const p of PRODUTOS) if (NOVOS_V3.includes(p.n) && !tem.has(p.n.toLowerCase())) this.db.products['p-' + uid8()] = { name: p.n, receipt: p.t, section: p.s, unit: p.u, price: p.p, count: 0 };
    this.db.group.seedV = SEED_VERSAO;
    this._emit('group', 'products');
  }
  async addList(name, copyFrom) {
    const id = 'l-' + uid8();
    const items = {};
    if (copyFrom && this.db.lists[copyFrom]) for (const pid of Object.keys(this.db.lists[copyFrom].items || {})) items[pid] = { q: 0, d: false, by: null, at: Date.now() };
    this.db.lists[id] = { name, createdAt: Date.now(), createdBy: this.uid, items };
    this._emit('lists');
    return id;
  }
  async renameList(id, name) { this.db.lists[id].name = name; this._emit('lists'); }
  async deleteList(id) { delete this.db.lists[id]; this._emit('lists'); }
  async addItems(lid, pids, q = 0) {
    const l = this.db.lists[lid];
    for (const pid of pids) if (!l.items[pid]) l.items[pid] = { q, d: false, by: null, at: Date.now() };
    this._emit('lists');
  }
  async setQty(lid, pid, q) { this.db.lists[lid].items[pid].q = q; this._emit('lists'); }
  async setDone(lid, pid, d) {
    const it = this.db.lists[lid].items[pid];
    if (it.d === d) return;
    it.d = d; it.by = d ? this.uid : null;
    const p = this.db.products[pid];
    if (p) p.count = Math.max(0, (p.count || 0) + (d ? 1 : -1));
    this._emit('lists', 'products');
  }
  async removeItem(lid, pid) { delete this.db.lists[lid].items[pid]; this._emit('lists'); }
  async addProduct(p) { const id = 'p-' + uid8(); this.db.products[id] = { count: 0, ...p }; this._emit('products'); return id; }
  async updateProduct(id, p) { Object.assign(this.db.products[id], p); this._emit('products'); }
  async deleteProduct(id) { delete this.db.products[id]; this._emit('products'); }
}

// ---------------------------------------------------------------- Firebase
const V = '10.12.2';
class FirebaseStore {
  constructor() { this.demo = false; }
  async init() {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    ]);
    this.fs = fs;
    const app = initializeApp(firebaseConfig);
    this.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    this.auth = auth;
    this.a = auth.getAuth(app);
    this.a.languageCode = 'pt';
    await auth.setPersistence(this.a, auth.browserLocalPersistence);
    await auth.getRedirectResult(this.a).catch(() => {});
    await this.a.authStateReady();
    const u = this.a.currentUser;
    if (!u || u.isAnonymous) return 'LOGIN';
    return this._entrou();
  }
  // Depois do login: descobre o grupo desta pessoa (neste aparelho ou guardado na conta)
  async _entrou() {
    const fs = this.fs, u = this.a.currentUser;
    this.uid = u.uid;
    this.user = { name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' };
    await u.getIdToken(true);
    this.gid = localStorage.getItem(GKEY);
    if (!this.gid) {
      const me = await fs.getDoc(fs.doc(this.db, 'users', this.uid)).catch(() => null);
      this.gid = me && me.exists() ? me.data().gid || null : null;
    }
    if (this.gid) {
      const m = await fs.getDoc(fs.doc(this.db, 'groups', this.gid, 'members', this.uid)).catch(() => null);
      if (!m || !m.exists()) this.gid = null;
    }
    if (this.gid) localStorage.setItem(GKEY, this.gid); else localStorage.removeItem(GKEY);
    return this.gid;
  }
  async login() {
    const auth = this.auth, a = this.a;
    const p = new auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    try {
      if (a.currentUser && a.currentUser.isAnonymous) {
        // quem já usava a app sem login fica com a mesma identidade (e o mesmo grupo)
        try { await auth.linkWithPopup(a.currentUser, p); }
        catch (e) {
          if (e.code === 'auth/credential-already-in-use') await auth.signInWithCredential(a, auth.GoogleAuthProvider.credentialFromError(e));
          else throw e;
        }
      } else await auth.signInWithPopup(a, p);
    } catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e.code)) { await auth.signInWithRedirect(a, p); return null; }
      if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) return 'CANCEL';
      throw new Error('Não foi possível entrar com a conta Google (' + (e.code || e.message) + ').');
    }
    return this._entrou();
  }
  async logout() { localStorage.removeItem(GKEY); await this.auth.signOut(this.a); location.reload(); }
  _guardarGrupo() { return this.fs.setDoc(this.fs.doc(this.db, 'users', this.uid), { gid: this.gid, email: this.user.email }, { merge: true }); }
  _g(...p) { return this.fs.doc(this.db, 'groups', this.gid, ...p); }
  _c(...p) { return this.fs.collection(this.db, 'groups', this.gid, ...p); }

  subscribeGroup(cb) {
    const { onSnapshot } = this.fs;
    let g = null, ms = null;
    // só avisa quando já chegaram o grupo E a lista de pessoas
    const send = () => g && ms && cb({ id: this.gid, ...g, members: ms });
    const perdeu = (e) => { if (e && e.code === 'permission-denied') { localStorage.removeItem(GKEY); location.reload(); } };
    const a = onSnapshot(this._g(), (s) => { g = s.data(); send(); }, perdeu);
    const b = onSnapshot(this._c('members'), (s) => { ms = s.docs.map(d => ({ uid: d.id, ...d.data() })); send(); }, perdeu);
    return () => { a(); b(); };
  }
  subscribeProducts(cb) { return this.fs.onSnapshot(this._c('products'), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}); }
  subscribeLists(cb) { return this.fs.onSnapshot(this._c('lists'), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}); }

  async createGroup(nome, meuNome) {
    const { doc, collection, setDoc, writeBatch } = this.fs;
    const gref = doc(collection(this.db, 'groups'));
    this.gid = gref.id;
    const code = novoCodigo(nome);
    await setDoc(gref, { name: nome, code, owner: this.uid, createdAt: Date.now(), seedV: SEED_VERSAO });
    await setDoc(this._g('members', this.uid), { name: meuNome, color: CORES[0], code, joinedAt: Date.now() });
    await setDoc(doc(this.db, 'codes', code), { gid: this.gid });
    for (let i = 0; i < PRODUTOS.length; i += 400) {
      const b = writeBatch(this.db);
      for (const p of PRODUTOS.slice(i, i + 400)) b.set(doc(this._c('products')), { name: p.n, receipt: p.t, section: p.s, unit: p.u, price: p.p, count: p.c });
      await b.commit();
    }
    await this._guardarGrupo();
    localStorage.setItem(GKEY, this.gid);
    return this.gid;
  }
  async joinGroup(code, meuNome) {
    const { doc, getDoc, setDoc, getDocs, collection } = this.fs;
    code = code.trim().toUpperCase().replace(/\s+/g, '');
    const c = await getDoc(doc(this.db, 'codes', code)).catch(() => null);
    if (!c || !c.exists()) throw new Error('Código não encontrado. Confirma com quem te convidou.');
    this.gid = c.data().gid;
    const used = (await getDocs(collection(this.db, 'groups', this.gid, 'members')).catch(() => ({ docs: [] }))).docs.length;
    await setDoc(this._g('members', this.uid), { name: meuNome, color: CORES[used % CORES.length], code, joinedAt: Date.now() });
    await this._guardarGrupo();
    localStorage.setItem(GKEY, this.gid);
    return this.gid;
  }
  async leaveGroup() {
    await this.fs.deleteDoc(this._g('members', this.uid)).catch(() => {});
    await this.fs.setDoc(this.fs.doc(this.db, 'users', this.uid), { gid: null }, { merge: true }).catch(() => {});
    localStorage.removeItem(GKEY); location.reload();
  }
  async renameGroup(name) { await this.fs.updateDoc(this._g(), { name }); }
  // Troca a base de produtos pela versão nova do seed.js (só o dono vê o botão)
  async resetProducts(lists = []) {
    const { getDocs, writeBatch, doc, updateDoc } = this.fs;
    const atuais = (await getDocs(this._c('products'))).docs;
    for (let i = 0; i < atuais.length; i += 400) {
      const b = writeBatch(this.db);
      for (const d of atuais.slice(i, i + 400)) b.delete(d.ref);
      await b.commit();
    }
    for (let i = 0; i < PRODUTOS.length; i += 400) {
      const b = writeBatch(this.db);
      for (const p of PRODUTOS.slice(i, i + 400)) b.set(doc(this._c('products')), { name: p.n, receipt: p.t, section: p.s, unit: p.u, price: p.p, count: p.c });
      await b.commit();
    }
    for (const l of lists) await updateDoc(this._g('lists', l.id), { items: {} });
    await updateDoc(this._g(), { seedV: SEED_VERSAO });
  }
  // Junta só os produtos novos da versão 3, sem mexer nos existentes nem nas listas
  async addNewProducts() {
    const { getDocs, writeBatch, doc, updateDoc } = this.fs;
    const tem = new Set((await getDocs(this._c('products'))).docs.map(d => (d.data().name || '').toLowerCase()));
    const b = writeBatch(this.db);
    for (const p of PRODUTOS) if (NOVOS_V3.includes(p.n) && !tem.has(p.n.toLowerCase())) b.set(doc(this._c('products')), { name: p.n, receipt: p.t, section: p.s, unit: p.u, price: p.p, count: 0 });
    await b.commit();
    await updateDoc(this._g(), { seedV: SEED_VERSAO });
  }
  async newCode() {
    const { doc, getDoc, setDoc, deleteDoc, updateDoc } = this.fs;
    const g = (await getDoc(this._g())).data();
    const code = novoCodigo(g.name);
    await setDoc(doc(this.db, 'codes', code), { gid: this.gid });
    await updateDoc(this._g(), { code });
    await deleteDoc(doc(this.db, 'codes', g.code)).catch(() => {});
  }
  async removeMember(uid) { await this.fs.deleteDoc(this._g('members', uid)); }

  async addList(name, copyFrom, lists) {
    const { doc, setDoc } = this.fs;
    const items = {};
    const src = (lists || []).find(l => l.id === copyFrom);
    if (src) for (const pid of Object.keys(src.items || {})) items[pid] = { q: 0, d: false, by: null, at: Date.now() };
    const ref = doc(this._c('lists'));
    await setDoc(ref, { name, createdAt: Date.now(), createdBy: this.uid, items });
    return ref.id;
  }
  async renameList(id, name) { await this.fs.updateDoc(this._g('lists', id), { name }); }
  async deleteList(id) { await this.fs.deleteDoc(this._g('lists', id)); }
  async addItems(lid, pids, q = 0) {
    const upd = {};
    for (const pid of pids) upd[`items.${pid}`] = { q, d: false, by: null, at: Date.now() };
    await this.fs.updateDoc(this._g('lists', lid), upd);
  }
  async setQty(lid, pid, q) { await this.fs.updateDoc(this._g('lists', lid), { [`items.${pid}.q`]: q }); }
  async setDone(lid, pid, d) {
    const { updateDoc, increment } = this.fs;
    await updateDoc(this._g('lists', lid), { [`items.${pid}.d`]: d, [`items.${pid}.by`]: d ? this.uid : null });
    updateDoc(this._g('products', pid), { count: increment(d ? 1 : -1) }).catch(() => {});
  }
  async removeItem(lid, pid) { await this.fs.updateDoc(this._g('lists', lid), { [`items.${pid}`]: this.fs.deleteField() }); }
  async addProduct(p) { const ref = this.fs.doc(this._c('products')); await this.fs.setDoc(ref, { count: 0, ...p }); return ref.id; }
  async updateProduct(id, p) { await this.fs.updateDoc(this._g('products', id), p); }
  async deleteProduct(id) { await this.fs.deleteDoc(this._g('products', id)); }
}

export function makeStore() { return firebaseConfig ? new FirebaseStore() : new LocalStore(); }
