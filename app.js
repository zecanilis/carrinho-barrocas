import { makeStore } from './store.js';
import { SECCOES, PRODUTOS as SEED, SEED_VERSAO, NOVOS_V3 } from './seed.js';

// ------------------------------------------------------------------ utilidades
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (v) => (v || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const num = (v, un) => un === 'kg' ? (Math.round(v * 100) / 100).toLocaleString('pt-PT') : String(Math.round(v));
const parseNum = (s) => { const n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? 0 : n; };
const EMO = { 'Frutas e legumes': '🍎', 'Mercearia': '🥫', 'Bebidas': '🥤', 'Limpeza': '🧽', 'Higiene e casa': '🧴', 'Leite e bebidas vegetais': '🥛', 'Ovos': '🥚', 'Padaria': '🥖', 'Queijos': '🧀', 'Talho': '🥩', 'Peixaria': '🐟', 'Iogurtes': '🍶', 'Pronto a comer': '🥧', 'Congelados': '🧊', 'Charcutaria': '🥓', 'Outros': '🛒' };
const secOrd = (s) => { const i = SECCOES.indexOf(s); return i < 0 ? 99 : i; };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const I = {
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14h6M9 17h4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  share: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/>',
};
const ic = (n, s = 22, extra = '') => `<svg class="ic ${extra}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

// ------------------------------------------------------------------ estado
const store = makeStore();
const S = { group: null, products: {}, lists: [], ready: { g: false, p: false, l: false } };
let unsub = [];
const ui = { fechadas: new Set(), sel: new Set(), q: '', sec: 'Todas', pq: '', psec: 'Todas', installHidden: localStorage.getItem('cb-noinstall') === '1' };

const membro = (uid) => (S.group?.members || []).find(m => m.uid === uid);
const nomeDe = (uid) => membro(uid)?.name || 'alguém';
const souDono = () => S.group && S.group.owner === store.uid;
const av = (uid, size = 24) => {
  const m = membro(uid);
  const n = m ? m.name : '?';
  return `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .45)}px;background:${m ? m.color : '#8D6E63'}" title="${esc(n)}" aria-label="${esc(n)}">${esc(n.trim()[0] || '?').toUpperCase()}</span>`;
};
const avs = (size = 24) => `<span class="avs">${(S.group?.members || []).slice(0, 5).map(m => av(m.uid, size)).join('')}</span>`;

function resumo(l) {
  const its = Object.entries(l.items || {}).filter(([pid]) => S.products[pid]);
  let tot = 0, done = 0, doneTot = 0;
  for (const [pid, it] of its) {
    const v = (it.q || 0) * (S.products[pid].price || 0);
    tot += v; if (it.d) { done++; doneTot += v; }
  }
  return { n: its.length, tot, done, doneTot };
}

// ------------------------------------------------------------------ arranque
async function start() {
  const app = $('#app');
  app.innerHTML = `<div class="loading">${ic('cart', 40)}<span>A abrir o carrinho…</span></div>`;
  let gid;
  try { gid = await store.init(); }
  catch (e) { app.innerHTML = `<div class="loading"><b>Não foi possível ligar.</b><span>${esc(e.message)}</span><button class="btn" onclick="location.reload()">Tentar outra vez</button></div>`; return; }
  if (gid === 'LOGIN') S.needLogin = true;
  else if (gid) ligar();
  render();
  window.addEventListener('hashchange', () => { notarHash(); ui.sel.clear(); ui.q = ''; render(); window.scrollTo(0, 0); });
}
function ligar() {
  S.linked = true;
  unsub.forEach(f => f()); unsub = [];
  unsub.push(store.subscribeGroup(g => { S.group = g; S.ready.g = true; if (g && g.members.length && !g.members.some(m => m.uid === store.uid) && !store.demo) { toast('Já não fazes parte deste grupo.'); store.leaveGroup(); } render(true); }));
  unsub.push(store.subscribeProducts(ps => { S.products = Object.fromEntries(ps.map(p => [p.id, p])); S.ready.p = true; render(true); }));
  unsub.push(store.subscribeLists(ls => { S.lists = ls.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); S.ready.l = true; render(true); }));
}

// ------------------------------------------------------------------ router
function rota() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, qs: new URLSearchParams(qs || '') };
}
let lastKey = '';
function render(fromData = false) {
  const app = $('#app');
  const { parts, qs } = rota();
  if (S.needLogin) { app.innerHTML = vLogin(); return; }
  if (!S.linked) { if (!fromData || !app.dataset.onb) { app.dataset.onb = '1'; app.innerHTML = vEntrar(parts[0] === 'entrar' ? parts[1] : ''); } return; }
  delete app.dataset.onb;
  if (!S.ready.g || !S.ready.p || !S.ready.l) { app.innerHTML = `<div class="loading">${ic('cart', 40)}<span>A carregar as listas…</span></div>`; return; }
  const key = location.hash;
  // ao receber dados, não refazer ecrãs com campos a ser escritos
  const ae = document.activeElement;
  if (fromData && key === lastKey && ae && ae.matches('input[type=text],input[type=search],textarea,input:not([type])')) { atualizarParcial(); return; }
  lastKey = key;
  const scroll = window.scrollY;
  const [a, b] = parts;
  let html;
  if (!a) html = vListas();
  else if (a === 'lista' && b) html = vLista(b);
  else if (a === 'adicionar' && b) html = vAdicionar(b);
  else if (a === 'produtos') html = vProdutos();
  else if (a === 'produto') html = vProduto(b, qs.get('lista'));
  else if (a === 'grupo') html = vGrupo();
  else html = vListas();
  app.innerHTML = html;
  if (fromData) window.scrollTo(0, scroll);
  depoisDeRender();
}
function atualizarParcial() {
  const r = $('#resultados'); if (r && rota().parts[0] === 'adicionar') r.innerHTML = resultadosAdicionar(rota().parts[1]);
  const p = $('#prod-lista'); if (p) p.innerHTML = listaProdutos();
}

// ------------------------------------------------------------------ componentes
const nav = (on) => `<nav class="nav" aria-label="Navegação">
  <a href="#/" class="${on === 'listas' ? 'on' : ''}">${ic('list', 24)}<span>Listas</span></a>
  <a href="#/produtos" class="${on === 'produtos' ? 'on' : ''}">${ic('box', 24)}<span>Produtos</span></a>
  <a href="#/grupo" class="${on === 'grupo' ? 'on' : ''}">${ic('users', 24)}<span>Grupo</span></a></nav>`;
const demoBar = () => store.demo ? `<div class="demo">Modo demonstração: só neste aparelho. <a href="#/grupo">Saber mais</a></div>` : '';
// ------------------------------------------------------------------ navegação: o "voltar" do telemóvel segue a hierarquia
// Guardamos a pilha de ecrãs desta sessão. Ir para um ecrã que já está na pilha volta atrás no histórico
// (em vez de acrescentar), e trocar de separador substitui o ecrã atual. Assim o botão de voltar não
// percorre o histórico todo.
const pilha = [location.hash || '#/'];
let trocando = false;
const RAIZES = ['#/', '#/produtos', '#/grupo'];
function notarHash() {
  const h = location.hash || '#/';
  if (trocando) { trocando = false; pilha[pilha.length - 1] = h; return; }
  const i = pilha.lastIndexOf(h);
  if (i >= 0 && i < pilha.length - 1) pilha.length = i + 1; else if (pilha[pilha.length - 1] !== h) pilha.push(h);
}
function ir(h) {
  h = h || '#/';
  const i = pilha.lastIndexOf(h);
  if (i >= 0 && i < pilha.length - 1) history.go(i - (pilha.length - 1));
  else if (RAIZES.includes(h) && RAIZES.includes(pilha[pilha.length - 1])) { trocando = true; location.replace(h); }
  else location.hash = h;
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a || e.defaultPrevented) return;
  e.preventDefault(); ir(a.getAttribute('href'));
});
const topo = (titulo, voltar, extra = '', sub = '') => `<header class="top">
  <a href="${voltar}" class="iconbtn" aria-label="Voltar">${ic('back', 26)}</a>
  <div class="grow"><h1>${titulo}</h1>${sub}</div>${extra}</header>`;

// ------------------------------------------------------------------ ecrã: login Google
const G_LOGO = '<svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function vLogin() {
  return `<div class="screen onb">
  <div class="logo">${ic('cart', 40)}</div>
  <h1 class="big">Carrinho Barrocas</h1>
  <p class="muted lead">Listas de compras do mês, partilhadas em tempo real.</p>
  <section class="card stack">
    <h2>Entrar</h2>
    <p class="muted" style="margin:0;line-height:1.45">Usamos a tua conta Google só para te reconhecer em qualquer telemóvel. Não lemos o teu email nem mais nada.</p>
    <button class="btn ghost gbtn" data-act="login">${G_LOGO}<span>Entrar com a conta Google</span></button>
  </section>
  ${dicaInstalar(true)}
  </div>`;
}

// ------------------------------------------------------------------ ecrã: entrar / criar
function vEntrar(code) {
  return `<div class="screen onb">
  <div class="logo">${ic('cart', 40)}</div>
  <h1 class="big">Carrinho Barrocas</h1>
  <p class="muted lead">Listas de compras do mês, partilhadas em tempo real.</p>
  ${store.demo ? `<div class="card warn"><b>Modo demonstração.</b> Ainda não está ligado ao Firebase: o que fizeres fica só neste aparelho. Dá para experimentar à vontade.</div>` : ''}
  <form class="card stack" data-form="entrar">
    <h2>${store.demo ? 'Começar' : 'Entrar num grupo'}</h2>
    <label class="field">O teu nome<input name="nome" required maxlength="20" autocomplete="given-name" value="${esc(localStorage.getItem('cb-nome') || (store.user?.name || '').split(' ')[0])}"></label>
    ${store.demo ? '' : `<label class="field">Código do grupo<input name="code" required value="${esc(code || '')}" placeholder="BAR-XXXX-XXXX" autocapitalize="characters" autocomplete="off" class="code"></label>
    <button class="btn" type="submit">Entrar</button>`}
    ${store.demo ? `<label class="field">Nome do grupo<input name="grupo" value="Condomínio Barrocas"></label><button class="btn" type="submit" data-criar="1">Começar</button>` : ''}
  </form>
  ${store.demo ? '' : `<details class="card"><summary><b>Criar um grupo novo</b></summary>
    <form class="stack" data-form="criar" style="margin-top:12px">
      <label class="field">Nome do grupo<input name="grupo" required value="Condomínio Barrocas"></label>
      <p class="muted small">Começa com os 153 produtos das faturas do Pingo Doce. Usa o nome que escreveste acima.</p>
      <button class="btn ghost" type="submit">Criar grupo</button>
    </form></details>`}
  ${dicaInstalar(true)}
  </div>`;
}
async function onEntrar(form, criar) {
  const fd = new FormData(form);
  const nome = (fd.get('nome') || $('[data-form=entrar] [name=nome]')?.value || '').trim();
  if (!nome) { toast('Escreve o teu nome primeiro.'); $('[name=nome]')?.focus(); return; }
  localStorage.setItem('cb-nome', nome);
  const btn = form.querySelector('button[type=submit]'); if (btn) { btn.disabled = true; btn.textContent = 'Um momento…'; }
  try {
    if (criar) await store.createGroup((fd.get('grupo') || 'Condomínio Barrocas').trim(), nome);
    else await store.joinGroup(fd.get('code'), nome);
    ir('#/'); ligar(); render();
  } catch (e) { toast(e.message || 'Algo correu mal.'); if (btn) { btn.disabled = false; btn.textContent = criar ? 'Criar grupo' : 'Entrar'; } }
}

// ------------------------------------------------------------------ ecrã: listas
function vListas() {
  const swAct = (l) => `<div class="sw-act"><button class="act red" data-act="apagar-lista" data-id="${l.id}">${ic('trash', 22)}<span>Apagar</span></button></div>`;
  const ativas = [], feitas = [];
  for (const l of S.lists) { const r = resumo(l); (r.n > 0 && r.done === r.n ? feitas : ativas).push([l, r]); }
  const cards = ativas.map(([l, r]) => {
    const pct = r.n ? Math.round(r.done / r.n * 100) : 0;
    return `<div class="sw big-sw" data-sw="${l.id}" data-kind="lista">${swAct(l)}
      <a class="sw-front curcard" href="#/lista/${l.id}">
        <div class="row between end gap8"><span class="curname">${esc(l.name)}</span><span class="curtot">${eur(r.tot)}</span></div>
        <div class="bar light"><i style="width:${pct}%"></i></div>
        <div class="row between small b7"><span>${r.done} de ${r.n} no carrinho</span><span class="openbtn">Abrir →</span></div>
      </a></div>`;
  }).join('');
  const rows = feitas.map(([l, r]) => `<div class="sw" data-sw="${l.id}" data-kind="lista">${swAct(l)}
      <a class="sw-front lrow feita" href="#/lista/${l.id}"><span class="grow b7">✓ ${esc(l.name)}</span><b class="lp">${eur(r.tot)}</b></a></div>`).join('');
  return `${demoBar()}<div class="screen pad-nav">
  <header class="hero"><span class="muted b6">${esc(S.group.name)}</span>
    <div class="row between"><h1 class="big">As minhas listas</h1><a href="#/grupo" class="avbox" aria-label="Grupo">${avs(30)}</a></div></header>
  ${dicaInstalar()}
  ${!S.lists.length ? `<div class="empty">${ic('cart', 44)}<b>Ainda não há listas.</b><span>Carrega em “Nova lista” para começar, por exemplo “Dezembro”.</span></div>` : ''}
  ${cards ? `<h3 class="sec">A decorrer · ${ativas.length}</h3><div class="stack8">${cards}</div>` : ''}
  ${rows ? `<h3 class="sec">Concluídas</h3><div class="grp">${rows}</div>` : ''}
  ${S.lists.length ? '<p class="hint">← desliza uma lista para a apagar</p>' : ''}
  <button class="fab wide" data-act="nova-lista">${ic('plus', 22)}<span>Nova lista</span></button>
  </div>${nav('listas')}`;
}
function sheetNovaLista() {
  const ops = [['', 'Lista vazia', ''], ...S.lists.map(l => [l.id, l.name, `${Object.keys(l.items || {}).length} produtos`])];
  abrirSheet(`<form class="stack" data-form="nova-lista">
    <h2>Nova lista</h2>
    <label class="field">Nome da lista<input name="nome" required placeholder="Ex.: Dezembro, Festa…" maxlength="40"></label>
    ${S.lists.length ? `<div class="stack0"><span class="small muted b7">Começar com os produtos de</span><div class="origens">${ops.map(([id, n, s], k) => `<label class="origem"><input type="radio" name="origem" value="${id}" ${k === 0 ? 'checked' : ''}><span class="grow b7">${esc(n)}</span><small class="muted">${s}</small></label>`).join('')}</div><small class="muted">Os produtos vêm com quantidades a zero.</small></div>` : ''}
    <button class="btn" type="submit">Criar lista</button></form>`);
}

// ------------------------------------------------------------------ ecrã: lista
function vLista(id) {
  const l = S.lists.find(x => x.id === id);
  if (!l) return `${topo('Lista', '#/')}<div class="empty">Esta lista já não existe.</div>`;
  const r = resumo(l), pct = r.n ? Math.round(r.done / r.n * 100) : 0;
  const its = Object.entries(l.items || {}).filter(([pid]) => S.products[pid]).map(([pid, it]) => ({ pid, it, p: S.products[pid] }))
    .sort((a, b) => secOrd(a.p.section) - secOrd(b.p.section) || a.p.name.localeCompare(b.p.name, 'pt'));
  const cont = {}; its.forEach(x => cont[x.p.section] = (cont[x.p.section] || 0) + 1);
  let sec = '', rows = '';
  for (const { pid, it, p } of its) {
    if (p.section !== sec) {
      if (sec) rows += '</div>';
      sec = p.section; const fe = ui.fechadas.has(sec);
      rows += `<button class="sec secbtn" data-act="toggle-sec" data-s="${esc(sec)}" aria-expanded="${!fe}"><span>${EMO[sec] || '🛒'} ${esc(sec)} · ${cont[sec]}</span><span class="chev ${fe ? 'fe' : ''}">▾</span></button><div class="grp${fe ? ' fechada' : ''}">`;
    }
    const step = p.unit === 'kg' ? 0.5 : 1;
    rows += `<div class="sw" data-sw="${pid}"><div class="sw-act"><button class="act red" data-act="tirar" data-lid="${id}" data-pid="${pid}">${ic('trash', 20)}<span>Tirar</span></button></div>
    <div class="sw-front lrowi ${it.d ? 'done' : ''}">
      <span class="grow nm"><span class="iname" title="${esc(p.name)} · ${eur(p.price)}/${p.unit}">${esc(p.name)}</span>${(it.d ? it.by : it.add) ? `<span class="quem" title="${it.d ? 'Comprado por' : 'Pedido por'} ${esc(nomeDe(it.d ? it.by : it.add))}">${av(it.d ? it.by : it.add, 18)}</span>` : ''}</span>
      <div class="stepper sm">
        <button class="sbtn" aria-label="Menos" data-act="qtd" data-lid="${id}" data-pid="${pid}" data-d="${-step}">${ic('minus', 16)}</button>
        <input class="qty" inputmode="decimal" aria-label="Quantidade de ${esc(p.name)}" data-qty data-lid="${id}" data-pid="${pid}" value="${num(it.q || 0, p.unit)}">${p.unit === 'kg' ? '<span class="un">kg</span>' : ''}
        <button class="sbtn" aria-label="Mais" data-act="qtd" data-lid="${id}" data-pid="${pid}" data-d="${step}">${ic('plus', 16)}</button>
      </div>
      <b class="lp">${eur((it.q || 0) * p.price)}</b>
      <button class="tick xs ${it.d ? 'on' : ''}" aria-pressed="${!!it.d}" aria-label="${it.d ? 'Desmarcar' : 'Marcar como comprado'}" data-act="tick" data-lid="${id}" data-pid="${pid}">${it.d ? ic('check', 16) : ''}</button>
    </div></div>`;
  }
  if (sec) rows += '</div>';
  return `${demoBar()}<div class="screen pad-bottom">
  ${topo(esc(l.name), '#/', `<button class="iconbtn soft" aria-label="Exportar PDF" data-act="pdf" data-id="${id}">${ic('pdf', 22)}</button><button class="iconbtn" aria-label="Mais opções" data-act="menu-lista" data-id="${id}">${ic('dots', 22)}</button>`,
    `<a href="#/grupo" class="row gap6 small muted b7 nolink">${avs(20)}Partilhada com ${S.group.members.length}</a>`)}
  <section class="summary slim" aria-label="Resumo">
    <div class="row between"><span><b class="lg">${eur(r.tot)}</b> · ${r.n} ite${r.n === 1 ? 'm' : 'ns'}</span><span class="b7">${r.done}/${r.n} no carrinho</span></div>
    <div class="bar light thin"><i style="width:${pct}%"></i></div>
  </section>
  <div class="stack8">${rows || `<div class="empty">${ic('plus', 40)}<b>Lista vazia.</b><span>Carrega no + para adicionar produtos.</span></div>`}</div>
  ${its.length ? '<p class="hint">← desliza um produto para o tirar da lista</p>' : ''}
  <div class="bottombar"><a class="btn" href="#/adicionar/${id}">${ic('plus', 22)}<span>Adicionar produtos</span></a></div></div>`;
}
function menuLista(id) {
  const l = S.lists.find(x => x.id === id);
  abrirSheet(`<div class="stack"><h2>${esc(l.name)}</h2>
    <button class="mitem" data-act="pdf" data-id="${id}">${ic('pdf')}<span>Exportar PDF</span></button>
    <button class="mitem" data-act="partilhar-texto" data-id="${id}">${ic('share')}<span>Enviar como texto (WhatsApp…)</span></button>
    <button class="mitem" data-act="renomear-lista" data-id="${id}">${ic('edit')}<span>Mudar o nome</span></button>
    <button class="mitem red" data-act="apagar-lista" data-id="${id}">${ic('trash')}<span>Apagar lista</span></button></div>`);
}

// ------------------------------------------------------------------ escolha de secção
const secsDisp = () => ['Todas', ...SECCOES.filter(s => Object.values(S.products).some(p => p.section === s)), ...(Object.values(S.products).some(p => p.section === 'Outros') ? ['Outros'] : [])];
const secLbl = (s) => s === 'Todas' ? '🛒 Todas' : `${EMO[s] || '🛒'} ${esc(s)}`;
const chipSec = (k) => { const s = k === 'add' ? ui.sec : ui.psec; return `<div class="row gap8"><button class="secchip" data-act="escolher-sec" data-k="${k}">${secLbl(s)} <span class="chev">▾</span></button></div>`; };
function sheetSeccoes(k) {
  const atual = k === 'add' ? ui.sec : ui.psec, ps = Object.values(S.products);
  abrirSheet(`<div class="stack"><h2>Secção</h2><div class="secgrid">${secsDisp().map(s => `<button class="secopt ${s === atual ? 'on' : ''}" data-act="pick-sec" data-k="${k}" data-s="${esc(s)}"><span>${secLbl(s)}</span><small>${s === 'Todas' ? ps.length : ps.filter(p => p.section === s).length}</small></button>`).join('')}</div></div>`);
}

// ------------------------------------------------------------------ ecrã: adicionar
function vAdicionar(id) {
  const l = S.lists.find(x => x.id === id);
  if (!l) return `${topo('Produtos', '#/')}<div class="empty">Esta lista já não existe.</div>`;
  return `<div class="screen pad-bottom">
  ${topo('Produtos', `#/lista/${id}`, `<a class="txtbtn" href="#/produto/novo?lista=${id}">+ Novo</a>`, `<span class="small muted b7">Adicionar a ${esc(l.name)}</span>`)}
  <label class="search">${ic('search', 20)}<input type="search" placeholder="Procurar produto" aria-label="Procurar produto" data-search="add" value="${esc(ui.q)}"></label>
  ${chipSec('add')}
  <div id="resultados" class="stack8">${resultadosAdicionar(id)}</div>
  <div class="bottombar"><button class="btn" data-act="adicionar" data-id="${id}" ${ui.sel.size ? '' : 'disabled'}>${ic('check', 22)}<span id="addlbl">${lblAdd()}</span></button></div>
  </div>`;
}
const lblAdd = () => ui.sel.size ? `Adicionar ${ui.sel.size} produto${ui.sel.size > 1 ? 's' : ''}` : 'Escolhe produtos';
function resultadosAdicionar(id) {
  const l = S.lists.find(x => x.id === id); if (!l) return '';
  const q = norm(ui.q);
  const ps = Object.values(S.products).filter(p => (ui.sec === 'Todas' || p.section === ui.sec) && (!q || norm(p.name).includes(q) || norm(p.receipt).includes(q)))
    .sort((a, b) => secOrd(a.section) - secOrd(b.section) || a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
  let sec = '', out = '';
  for (const p of ps.slice(0, 300)) {
    if (p.section !== sec) { if (sec) out += '</div>'; sec = p.section; out += `<h3 class="sec">${EMO[sec] || '🛒'} ${esc(sec)}</h3><div class="grp">`; }
    const na = !!(l.items || {})[p.id], sel = ui.sel.has(p.id);
    out += `<button class="prow ${sel ? 'sel' : ''} ${na ? 'na' : ''}" ${na ? 'disabled' : ''} data-act="sel" data-pid="${p.id}" aria-pressed="${sel || na}">
      <span class="grow iname left">${esc(p.name)}</span><small class="muted pr">${na ? 'Na lista' : `${eur(p.price)}/${p.unit}`}</small>
      ${na ? `<span class="tick on xs">${ic('check', 16)}</span>` : `<span class="tick ${sel ? 'on acc' : ''} xs">${sel ? ic('check', 16) : ''}</span>`}</button>`;
  }
  if (sec) out += '</div>';
  return out || `<div class="empty"><b>Nada encontrado.</b><a href="#/produto/novo?lista=${id}&nome=${encodeURIComponent(ui.q)}">Criar “${esc(ui.q)}” como produto novo</a></div>`;
}

// ------------------------------------------------------------------ ecrã: produtos
function vProdutos() {
  return `${demoBar()}<div class="screen pad-nav">
  <header class="hero row between end"><div class="stack0"><span class="muted b6">${Object.keys(S.products).length} produtos</span><h1 class="big">Produtos</h1></div>
    <div class="row gap8"><button class="iconbtn soft" aria-label="Exportar ou importar" data-act="menu-produtos">${ic('dots', 22)}</button><a class="sqbtn" href="#/produto/novo" aria-label="Novo produto">${ic('plus', 24)}</a></div></header>
  <label class="search">${ic('search', 20)}<input type="search" placeholder="Procurar produto" aria-label="Procurar produto" data-search="prod" value="${esc(ui.pq)}"></label>
  ${chipSec('prod')}
  <div id="prod-lista" class="stack8">${listaProdutos()}</div>
  <p class="hint">← desliza para editar ou apagar</p>
  </div>${nav('produtos')}`;
}
function listaProdutos() {
  const q = norm(ui.pq);
  const ps = Object.values(S.products).filter(p => (ui.psec === 'Todas' || p.section === ui.psec) && (!q || norm(p.name).includes(q) || norm(p.receipt).includes(q)))
    .sort((a, b) => secOrd(a.section) - secOrd(b.section) || a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
  const cont = {}; ps.forEach(p => cont[p.section] = (cont[p.section] || 0) + 1);
  let sec = '', out = '';
  for (const p of ps) {
    if (p.section !== sec) { if (sec) out += '</div>'; sec = p.section; out += `<h3 class="sec">${EMO[sec] || '🛒'} ${esc(sec)} · ${cont[sec]}</h3><div class="grp">`; }
    out += `<div class="sw" data-sw="${p.id}"><div class="sw-act two"><a class="act orange" href="#/produto/${p.id}">${ic('edit', 20)}<span>Editar</span></a><button class="act red" data-act="apagar-produto" data-pid="${p.id}">${ic('trash', 20)}<span>Apagar</span></button></div>
      <div class="sw-front prow static"><span class="grow iname left">${esc(p.name)}</span><b class="price">${eur(p.price)}${p.unit === 'kg' ? '/kg' : ''}</b></div></div>`;
  }
  if (sec) out += '</div>';
  return out || '<div class="empty"><b>Nada encontrado.</b></div>';
}

// ------------------------------------------------------------------ exportar / importar base
function menuProdutos() {
  abrirSheet(`<div class="stack"><h2>Base de produtos</h2>
    <button class="mitem" data-act="exportar-csv">${ic('down')}<span>Exportar para Excel<small class="muted"> · ficheiro CSV</small></span></button>
    <button class="mitem" data-act="importar-csv">${ic('up')}<span>Importar ficheiro</span></button>
    <p class="small muted">Exporta, muda preços ou nomes no Excel e importa de volta. Linhas novas sem código criam produtos. Importar nunca apaga nada.</p></div>`);
}
const csvCel = (v) => { v = String(v ?? ''); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function exportarCSV() {
  const ps = Object.values(S.products).sort((a, b) => secOrd(a.section) - secOrd(b.section) || a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
  const linhas = [['Código', 'Nome', 'Secção', 'Unidade', 'Preço'], ...ps.map(p => [p.id, p.name, p.section, p.unit, String(Number(p.price || 0).toFixed(2)).replace('.', ',')])];
  const txt = '﻿' + linhas.map(l => l.map(csvCel).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = `carrinho-produtos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  fecharSheet(); toast(`${ps.length} produtos exportados.`);
}
function lerCSV(txt) {
  txt = txt.replace(/^﻿/, '');
  const prim = txt.split(/\r?\n/)[0] || '';
  const sep = [';', '\t', ','].sort((a, b) => prim.split(b).length - prim.split(a).length)[0];
  const rows = []; let row = [], cel = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cel); cel = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cel); rows.push(row); row = []; cel = ''; }
    else cel += c;
  }
  if (cel || row.length) { row.push(cel); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
const numPreco = (v) => { const s = String(v || '').replace(/[€\s]/g, ''); if (!s) return NaN; return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); };
let importPend = null;
function analisarImport(txt) {
  const rows = lerCSV(txt);
  if (rows.length < 2) throw new Error('O ficheiro não tem produtos.');
  const h = rows[0].map(c => norm(c));
  const col = (...ns) => h.findIndex(c => ns.some(n => c.startsWith(n)));
  const cC = col('codigo', 'id'), cN = col('nome', 'produto'), cS = col('seccao', 'secao'), cU = col('unidade'), cP = col('preco');
  if (cN < 0 || cP < 0) throw new Error('Não encontrei as colunas Nome e Preço.');
  const secs = [...SECCOES, 'Outros'];
  const porNome = new Map(Object.values(S.products).map(p => [norm(p.name), p]));
  const alt = [], novos = [], erros = [];
  rows.slice(1).forEach((r, k) => {
    const nome = (r[cN] || '').trim(); if (!nome) return;
    const preco = numPreco(r[cP]);
    const secTxt = cS >= 0 ? (r[cS] || '').trim() : '';
    const sec = secTxt ? secs.find(s => norm(s) === norm(secTxt)) : null;
    const un = cU >= 0 && /kg/i.test(r[cU] || '') ? 'kg' : (cU >= 0 && (r[cU] || '').trim() ? 'un' : null);
    const p = (cC >= 0 && S.products[(r[cC] || '').trim()]) || porNome.get(norm(nome));
    if (Number.isNaN(preco)) { erros.push(`Linha ${k + 2}: preço inválido (${esc(r[cP] || 'vazio')})`); return; }
    if (p) {
      const d = {};
      if (nome !== p.name) d.name = nome;
      if (Math.abs(preco - (p.price || 0)) > 0.004) d.price = Math.round(preco * 100) / 100;
      if (sec && sec !== p.section) d.section = sec;
      if (un && un !== p.unit) d.unit = un;
      if (Object.keys(d).length) alt.push({ p, d });
    } else novos.push({ name: nome, price: Math.round(preco * 100) / 100, section: sec || 'Outros', unit: un || 'un', receipt: '' });
  });
  return { alt, novos, erros };
}
function sheetImport(res) {
  importPend = res;
  const { alt, novos, erros } = res;
  const nP = alt.filter(a => 'price' in a.d).length, nN = alt.filter(a => 'name' in a.d).length, nO = alt.filter(a => 'section' in a.d || 'unit' in a.d).length;
  const ex = [...alt.slice(0, 8).map(({ p, d }) => `<li><b>${esc(d.name || p.name)}</b>${d.price !== undefined ? ` · ${eur(p.price)} → ${eur(d.price)}` : ''}${d.name ? ` · antes “${esc(p.name)}”` : ''}${d.section ? ` · ${esc(d.section)}` : ''}</li>`), ...novos.slice(0, 4).map(n => `<li><b>${esc(n.name)}</b> · novo · ${eur(n.price)}</li>`)].join('');
  const nada = !alt.length && !novos.length;
  abrirSheet(`<div class="stack"><h2>Importar</h2>
    ${nada ? '<p>O ficheiro é igual à base. Não há nada para mudar.</p>' : `<div class="impres">${nP ? `<span><b>${nP}</b> ${nP === 1 ? 'preço alterado' : 'preços alterados'}</span>` : ''}${nN ? `<span><b>${nN}</b> ${nN === 1 ? 'nome mudado' : 'nomes mudados'}</span>` : ''}${nO ? `<span><b>${nO}</b> ${nO === 1 ? 'secção ou unidade' : 'secções ou unidades'}</span>` : ''}${novos.length ? `<span><b>${novos.length}</b> ${novos.length === 1 ? 'produto novo' : 'produtos novos'}</span>` : ''}</div>
    <ul class="implist">${ex}</ul>${alt.length + novos.length > 12 ? `<p class="small muted">… e mais ${alt.length + novos.length - 12}.</p>` : ''}`}
    ${erros.length ? `<p class="small" style="color:var(--red)">${erros.slice(0, 3).join('<br>')}${erros.length > 3 ? `<br>… e mais ${erros.length - 3} linhas ignoradas.` : ''}</p>` : ''}
    ${nada ? '' : '<button class="btn" data-act="aplicar-import">Aplicar alterações</button>'}</div>`);
}
async function aplicarImport() {
  const r = importPend; if (!r) return; importPend = null;
  fecharSheet(); toast('A importar…');
  for (const { p, d } of r.alt) await store.updateProduct(p.id, d);
  for (const n of r.novos) await store.addProduct(n);
  toast(`Base atualizada: ${r.alt.length} alterados, ${r.novos.length} novos.`);
}
function escolherFicheiro() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,text/csv,text/plain';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    let txt = await f.text();
    if (txt.includes('�')) { try { txt = new TextDecoder('windows-1252').decode(await f.arrayBuffer()); } catch {} }
    try { sheetImport(analisarImport(txt)); } catch (e) { fecharSheet(); toast(e.message); }
  };
  inp.click();
}

// ------------------------------------------------------------------ ecrã: produto (novo/editar)
function vProduto(pid, lid) {
  const novo = pid === 'novo' || !pid;
  const p = novo ? { name: rota().qs.get('nome') || '', section: SECCOES[0], unit: 'un', price: '' } : S.products[pid];
  if (!p) return `${topo('Produto', '#/produtos')}<div class="empty">Este produto já não existe.</div>`;
  const l = lid && S.lists.find(x => x.id === lid);
  const voltar = lid ? `#/adicionar/${lid}` : '#/produtos';
  const secs = [...SECCOES, 'Outros'];
  return `<div class="screen">
  ${topo(novo ? 'Novo produto' : 'Editar produto', voltar)}
  <form class="stack20 padx" data-form="produto" data-pid="${novo ? '' : pid}" data-lid="${lid || ''}">
    <label class="field">Nome do produto<input name="name" required maxlength="60" value="${esc(p.name)}" ${novo ? 'autofocus' : ''}></label>
    <label class="field">Secção<select name="section">${secs.map(s => `<option value="${esc(s)}" ${s === p.section ? 'selected' : ''}>${EMO[s] || ''} ${esc(s)}</option>`).join('')}</select></label>
    <fieldset class="field"><legend>Vende-se à</legend><div class="seg">
      <label><input type="radio" name="unit" value="un" ${p.unit !== 'kg' ? 'checked' : ''}><span>Unidade</span></label>
      <label><input type="radio" name="unit" value="kg" ${p.unit === 'kg' ? 'checked' : ''}><span>Quilo</span></label></div></fieldset>
    <label class="field">Preço (€)<input name="price" inputmode="decimal" required value="${p.price === '' ? '' : String(p.price).replace('.', ',')}" placeholder="0,00"></label>
    ${novo && l ? `<label class="check"><input type="checkbox" name="junta" checked><span><b>Juntar também à lista ${esc(l.name)}</b><small>Entra com quantidade 1</small></span></label>` : ''}
    <div class="bottombar"><button class="btn" type="submit">Guardar produto</button></div>
  </form></div>`;
}

// ------------------------------------------------------------------ ecrã: grupo
function vGrupo() {
  const g = S.group;
  const mem = g.members.slice().sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)).map(m => `<div class="prow static">${av(m.uid, 40)}
    <span class="grow stack0 left"><b>${esc(m.name)}</b><small class="muted">${m.uid === g.owner ? 'Criou o grupo' : 'Entrou a ' + new Date(m.joinedAt).toLocaleDateString('pt-PT')}</small></span>
    ${m.uid === store.uid ? '<small class="b8 muted">Tu</small>' : souDono() ? `<button class="txtbtn" data-act="tirar-membro" data-uid="${m.uid}">Tirar</button>` : ''}</div>`).join('');
  return `${demoBar()}<div class="screen pad-nav">
  <header class="hero"><span class="muted b6">Grupo</span><h1 class="big">${esc(g.name)}</h1></header>
  ${store.demo ? `<div class="card warn stack"><b>Modo demonstração</b><span>Para partilhar com a família, liga a app ao Firebase seguindo o LEIA-ME. Depois disso aparece aqui o código e o QR para convidar.</span></div>` : `
  <section class="card peach center stack" aria-label="Convidar">
    <span class="b8 muted">Para alguém entrar, mostra o QR ou envia o convite</span>
    <div id="qr" class="qr" role="img" aria-label="Código QR do convite"></div>
    <span class="code-big">${esc(g.code)}</span>
    <div class="row gap10 full"><button class="btn grow" data-act="convite">${ic('share', 20)}<span>Enviar convite</span></button>
      ${souDono() ? '<button class="btn ghost" data-act="novo-codigo">Novo código</button>' : ''}</div>
    <small class="muted">O convite leva o link da app e o código.</small>
  </section>`}
  <h3 class="sec">Pessoas · ${g.members.length}</h3>
  <div class="stack8">${mem}</div>
  ${store.user ? `<div class="prow static">${ic('users')}<span class="grow stack0 left"><small class="muted">Sessão iniciada com</small><b>${esc(store.user.email)}</b></span><button class="txtbtn" data-act="logout">Sair</button></div>` : ''}
  ${souDono() && (S.group.seedV || 1) >= 2 && S.group.seedV < SEED_VERSAO ? `<section class="card peach stack"><b>${S.group.seedV === 2 ? Object.keys(NOVOS_V3).length + ' produtos novos' : 'Atualização da base'}</b><span>${S.group.seedV === 2 ? 'Batata, açúcar, detergente da roupa e outros básicos. ' : ''}${S.group.seedV < 10 ? 'Sai da base: Sacos de compras. ' : 'Produtos novos e nomes acertados. '}O resto dos produtos e as listas ficam iguais.</span><button class="btn" data-act="novos-produtos">Adicionar à base</button></section>` : ''}
  ${souDono() && (S.group.seedV || 1) < 2 ? `<section class="card peach stack"><b>Base de produtos nova</b><span>Há uma base limpa com ${SEED.length} produtos, sem repetidos e com nomes simples. Substitui os ${Object.keys(S.products).length} atuais.</span><button class="btn" data-act="repor-produtos">Atualizar base de produtos</button></section>` : ''}
  ${souDono() && !store.demo ? `<button class="mitem" data-act="renomear-grupo">${ic('edit')}<span>Mudar o nome do grupo</span></button>` : ''}
  ${dicaInstalar(true)}
  <button class="mitem red" data-act="sair">${ic('trash')}<span>${store.demo ? 'Apagar a demonstração e recomeçar' : 'Sair do grupo neste telemóvel'}</span></button>
  </div>${nav('grupo')}`;
}
function linkConvite() { return `${location.origin}${location.pathname}#/entrar/${encodeURIComponent(S.group.code)}`; }

// ------------------------------------------------------------------ instalar
function standalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone; }
function dicaInstalar(sempre = false) {
  if (standalone() || (!sempre && ui.installHidden)) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const passos = ios ? ['Carrega em <b>Partilhar</b> (o quadrado com a seta para cima).', 'Escolhe <b>Adicionar ao ecrã principal</b>.', 'Abre a app pelo ícone.']
    : ['Carrega em <b>Instalar app</b> (ou no menu ⋮ → <b>Instalar app</b>).', 'Abre a app pelo ícone.'];
  return `<section class="card stack install" aria-label="Instalar a app"><div class="row between"><b>Põe a app no ecrã principal</b>${sempre ? '' : '<button class="txtbtn" data-act="esconder-instalar">Agora não</button>'}</div>
    ${window.__bip && !ios ? '<button class="btn" data-act="instalar">Instalar app</button>' : passos.map((t, i) => `<div class="row gap10 start"><span class="num">${i + 1}</span><span>${t}</span></div>`).join('')}</section>`;
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__bip = e; });

// ------------------------------------------------------------------ PDF e texto
function itensOrdenados(l) {
  return Object.entries(l.items || {}).filter(([pid]) => S.products[pid]).map(([pid, it]) => ({ it, p: S.products[pid] }))
    .sort((a, b) => secOrd(a.p.section) - secOrd(b.p.section) || a.p.name.localeCompare(b.p.name, 'pt'));
}
function pdf(id) {
  const l = S.lists.find(x => x.id === id); const r = resumo(l);
  let sec = '', rows = '';
  const todos = itensOrdenados(l); const comQtd = todos.filter(x => x.it.q > 0);
  for (const { it, p } of (comQtd.length ? comQtd : todos)) {
    if (p.section !== sec) { sec = p.section; rows += `<h3>${esc(sec)}</h3>`; }
    rows += `<div class="pl"><span class="bx">${it.d ? '✓' : ''}</span><span class="nm">${esc(p.name)}</span><span class="q">${it.q ? num(it.q, p.unit) + ' ' + p.unit : '—'}</span><span class="v">${eur((it.q || 0) * p.price)}</span></div>`;
  }
  $('#print').innerHTML = `<div class="ph"><div><small>Lista de compras · ${esc(S.group.name)}</small><h1>${esc(l.name)}</h1></div>
    <div class="r"><small>${new Date().toLocaleDateString('pt-PT')}</small><b>${(comQtd.length || todos.length)} itens · ${eur(r.tot)}</b></div></div>
    <div class="pl hd"><span class="bx" style="border:0"></span><span class="nm">PRODUTO</span><span class="q">QTD.</span><span class="v">PREVISTO</span></div>
    ${rows}<div class="pf"><small>Preços da última compra · podem ter mudado</small><b>Total previsto ${eur(r.tot)}</b></div>`;
  fecharSheet();
  const t = document.title; document.title = `Lista ${l.name}`;
  setTimeout(() => { window.print(); document.title = t; }, 150);
}
async function partilharTexto(id) {
  const l = S.lists.find(x => x.id === id); const r = resumo(l);
  let sec = '', txt = `🛒 *${l.name}* — ${r.n} itens · ${eur(r.tot)}\n`;
  for (const { it, p } of itensOrdenados(l)) {
    if (p.section !== sec) { sec = p.section; txt += `\n${EMO[sec] || ''} *${sec}*\n`; }
    txt += `${it.d ? '✅' : '⬜'} ${p.name}${it.q ? ` — ${num(it.q, p.unit)} ${p.unit}` : ''}\n`;
  }
  fecharSheet();
  try { if (navigator.share) await navigator.share({ title: l.name, text: txt }); else { await navigator.clipboard.writeText(txt); toast('Lista copiada. Cola no WhatsApp.'); } } catch { }
}

// ------------------------------------------------------------------ diálogos
function abrirSheet(html) {
  fecharSheet();
  const d = document.createElement('div'); d.className = 'overlay'; d.id = 'sheet';
  d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><button type="button" class="xclose" aria-label="Fechar">${ic('close')}</button>${html}</div>`;
  d.querySelector('.xclose').addEventListener('click', fecharSheet);
  d.addEventListener('click', (e) => { if (e.target === d) fecharSheet(); });
  document.body.appendChild(d);
  setTimeout(() => d.querySelector('input')?.focus(), 50);
}
function fecharSheet() { $('#sheet')?.remove(); }
function confirmar({ titulo, texto, botao = 'Apagar' }) {
  return new Promise((res) => {
    fecharSheet();
    const d = document.createElement('div'); d.className = 'overlay center'; d.id = 'sheet';
    d.innerHTML = `<section class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t"><div class="dico">${ic('trash', 30)}</div>
      <h2 id="dlg-t">${titulo}</h2><p class="muted">${texto}</p>
      <div class="row gap10 full"><button class="btn ghost grow" data-r="0">Cancelar</button><button class="btn red grow" data-r="1">${botao}</button></div></section>`;
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b || e.target === d) { d.remove(); res(b ? b.dataset.r === '1' : false); } });
    document.body.appendChild(d);
    d.querySelector('[data-r="0"]').focus();
  });
}
function pedirTexto(titulo, valor) {
  return new Promise((res) => {
    abrirSheet(`<form class="stack" data-form="texto"><h2>${titulo}</h2><label class="field">Nome<input name="v" required value="${esc(valor)}" maxlength="40"></label><button class="btn" type="submit">Guardar</button></form>`);
    $('#sheet form').addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); const v = new FormData(e.target).get('v').trim(); fecharSheet(); res(v || null); });
  });
}
let tt;
function toast(msg) { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2800); }
const falhou = (e) => { console.error(e); toast('Não foi possível guardar. Tenta outra vez.'); };

// ------------------------------------------------------------------ eventos
document.addEventListener('click', async (e) => {
  const chip = e.target.closest('[data-chip]'); if (chip) { $('#sheet [name=nome]').value = chip.dataset.chip; return; }
  const tab = e.target.closest('[data-sec]'); if (tab) { ui.sec = tab.dataset.sec; document.querySelectorAll('.tab').forEach(t => { t.classList.toggle('on', t === tab); t.setAttribute('aria-selected', t === tab); }); $('#resultados').innerHTML = resultadosAdicionar(rota().parts[1]); return; }
  const pt = e.target.closest('[data-psec]'); if (pt) { ui.psec = pt.dataset.psec; document.querySelectorAll('[data-psec]').forEach(t => { t.classList.toggle('on', t === pt); t.setAttribute('aria-selected', t === pt); }); $('#prod-lista').innerHTML = listaProdutos(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, id, lid, pid } = b.dataset;
  try {
    switch (act) {
      case 'nova-lista': sheetNovaLista(); break;
      case 'menu-produtos': menuProdutos(); break;
      case 'exportar-csv': exportarCSV(); break;
      case 'importar-csv': fecharSheet(); escolherFicheiro(); break;
      case 'aplicar-import': await aplicarImport(); break;
      case 'escolher-sec': sheetSeccoes(b.dataset.k); break;
      case 'pick-sec': { if (b.dataset.k === 'add') ui.sec = b.dataset.s; else ui.psec = b.dataset.s; fecharSheet(); render(); window.scrollTo(0, 0); break; }
      case 'toggle-sec': { const s = b.dataset.s; if (ui.fechadas.has(s)) ui.fechadas.delete(s); else ui.fechadas.add(s); render(); break; }
      case 'menu-lista': menuLista(id); break;
      case 'pdf': pdf(id); break;
      case 'partilhar-texto': partilharTexto(id); break;
      case 'renomear-lista': { const l = S.lists.find(x => x.id === id); const v = await pedirTexto('Mudar o nome', l.name); if (v) await store.renameList(id, v); break; }
      case 'apagar-lista': { const l = S.lists.find(x => x.id === id); fecharSheet();
        if (await confirmar({ titulo: 'Apagar lista?', texto: `A lista <b>${esc(l.name)}</b> é apagada para todo o grupo. Os produtos continuam na base.` })) { await store.deleteList(id); if (location.hash !== '#/') ir('#/'); toast('Lista apagada.'); } else fecharSwipes(); break; }
      case 'qtd': { const l = S.lists.find(x => x.id === lid); const it = l.items[pid]; const q = Math.max(0, Math.round(((it.q || 0) + parseFloat(b.dataset.d)) * 100) / 100); await store.setQty(lid, pid, q); break; }
      case 'tick': { const l = S.lists.find(x => x.id === lid); await store.setDone(lid, pid, !l.items[pid].d); break; }
      case 'tirar': { const p = S.products[pid]; const l = S.lists.find(x => x.id === lid);
        if (await confirmar({ titulo: 'Tirar da lista?', texto: `<b>${esc(p.name)}</b> sai da lista ${esc(l.name)}. Continua na base de produtos.`, botao: 'Tirar' })) await store.removeItem(lid, pid); else fecharSwipes(); break; }
      case 'sel': { ui.sel.has(pid) ? ui.sel.delete(pid) : ui.sel.add(pid); const on = ui.sel.has(pid); b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); b.querySelector('.tick').outerHTML = `<span class="tick ${on ? 'on acc' : ''} sm">${on ? ic('check', 18) : ''}</span>`; const ab = $('[data-act=adicionar]'); ab.disabled = !ui.sel.size; $('#addlbl').textContent = lblAdd(); break; }
      case 'adicionar': { const n = ui.sel.size; await store.addItems(id, [...ui.sel], 1); ui.sel.clear(); ir(`#/lista/${id}`); toast(`${n} produto${n > 1 ? 's' : ''} adicionado${n > 1 ? 's' : ''}.`); break; }
      case 'apagar-produto': { const p = S.products[pid];
        if (await confirmar({ titulo: 'Apagar produto?', texto: `<b>${esc(p.name)}</b> sai da base de produtos e deixa de aparecer nas listas.` })) { await store.deleteProduct(pid); toast('Produto apagado.'); } else fecharSwipes(); break; }
      case 'convite': { const txt = `Junta-te ao ${S.group.name} no Carrinho Barrocas 🛒\nCódigo: ${S.group.code}`; try { if (navigator.share) await navigator.share({ title: 'Carrinho Barrocas', text: txt, url: linkConvite() }); else { await navigator.clipboard.writeText(`${txt}\n${linkConvite()}`); toast('Convite copiado.'); } } catch { } break; }
      case 'novo-codigo': if (await confirmar({ titulo: 'Gerar código novo?', texto: 'O código atual deixa de funcionar para quem ainda não entrou. Quem já está no grupo continua.', botao: 'Gerar' })) { await store.newCode(); toast('Código novo criado.'); } break;
      case 'tirar-membro': { const m = membro(b.dataset.uid);
        if (await confirmar({ titulo: `Tirar ${esc(m.name)} do grupo?`, texto: `<b>${esc(m.name)}</b> deixa de ver e mexer nas listas. Pode voltar a entrar com um código.`, botao: 'Tirar' })) await store.removeMember(b.dataset.uid); break; }
      case 'repor-produtos': {
        const nl = S.lists.filter(l => Object.keys(l.items || {}).length).length;
        if (!(await confirmar({ titulo: 'Atualizar base de produtos?', texto: `Os ${Object.keys(S.products).length} produtos atuais são substituídos pelos ${SEED.length} da base limpa. Produtos que tenhas criado ou editado perdem-se.${nl ? ` As ${nl} lista${nl > 1 ? 's' : ''} com produtos ficam vazias (o nome mantém-se).` : ''}`, botao: 'Atualizar' }))) break;
        b.disabled = true; b.textContent = 'A atualizar…';
        await store.resetProducts(S.lists); toast('Base de produtos atualizada.'); break; }
      case 'novos-produtos': b.disabled = true; b.textContent = 'A adicionar…'; await store.addNewProducts(S.group.seedV || 1); toast('Produtos novos adicionados.'); break;
      case 'renomear-grupo': { const v = await pedirTexto('Nome do grupo', S.group.name); if (v) await store.renameGroup(v); break; }
      case 'sair': if (await confirmar({ titulo: store.demo ? 'Apagar a demonstração?' : 'Sair do grupo?', texto: store.demo ? 'Apaga tudo o que fizeste neste aparelho e recomeça.' : 'Deixas de ver as listas neste telemóvel. Podes voltar a entrar com o código.', botao: store.demo ? 'Apagar' : 'Sair' })) await store.leaveGroup(); break;
      case 'login': {
        b.disabled = true; b.querySelector('span').textContent = 'Um momento…';
        try {
          const r = await store.login();
          if (r === null) return; // vai sair da página (login por redirecionamento)
          if (r === 'CANCEL') { b.disabled = false; b.querySelector('span').textContent = 'Entrar com a conta Google'; return; }
          S.needLogin = false; if (r) ligar(); render();
        } catch (err) { toast(err.message); b.disabled = false; b.querySelector('span').textContent = 'Entrar com a conta Google'; }
        break; }
      case 'logout': if (await confirmar({ titulo: 'Terminar sessão?', texto: 'Neste aparelho deixas de ver as listas até voltares a entrar com a conta Google. O grupo e as listas ficam como estão.', botao: 'Sair' })) await store.logout(); break;
      case 'esconder-instalar': ui.installHidden = true; localStorage.setItem('cb-noinstall', '1'); b.closest('.install').remove(); break;
      case 'instalar': if (window.__bip) { window.__bip.prompt(); window.__bip = null; } break;
    }
  } catch (err) { falhou(err); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target; const k = f.dataset.form; if (!k || k === 'texto') return;
  e.preventDefault();
  if (k === 'entrar') return onEntrar(f, !!f.querySelector('[data-criar]'));
  if (k === 'criar') return onEntrar(f, true);
  try {
    if (k === 'nova-lista') {
      const fd = new FormData(f); const nome = fd.get('nome').trim(); if (!nome) return;
      const nid = await store.addList(nome, fd.get('origem') || null, S.lists);
      fecharSheet(); ir(`#/lista/${nid}`);
    }
    if (k === 'produto') {
      const fd = new FormData(f);
      const p = { name: fd.get('name').trim(), section: fd.get('section'), unit: fd.get('unit'), price: Math.round(parseNum(fd.get('price')) * 100) / 100 };
      if (!p.name) return;
      const { pid, lid } = f.dataset;
      if (pid) { await store.updateProduct(pid, p); toast('Produto guardado.'); ir('#/produtos'); }
      else {
        const nid = await store.addProduct({ ...p, receipt: '' });
        if (lid && fd.get('junta')) { await store.addItems(lid, [nid], 1); toast('Produto criado e juntado à lista.'); ir(`#/lista/${lid}`); }
        else { toast('Produto criado.'); ir(lid ? `#/adicionar/${lid}` : '#/produtos'); }
      }
    }
  } catch (err) { falhou(err); }
});
document.addEventListener('input', (e) => {
  const s = e.target.dataset.search;
  if (s === 'add') { ui.q = e.target.value; $('#resultados').innerHTML = resultadosAdicionar(rota().parts[1]); }
  if (s === 'prod') { ui.pq = e.target.value; $('#prod-lista').innerHTML = listaProdutos(); }
});
document.addEventListener('change', async (e) => {
  const ss = e.target.closest('[data-secsel]');
  if (ss) { if (ss.dataset.secsel === 'add') { ui.sec = ss.value; $('#resultados').innerHTML = resultadosAdicionar(rota().parts[1]); } else { ui.psec = ss.value; $('#prod-lista').innerHTML = listaProdutos(); } window.scrollTo(0, 0); return; }
  const q = e.target.closest('[data-qty]'); if (!q) return;
  try { await store.setQty(q.dataset.lid, q.dataset.pid, Math.max(0, Math.round(parseNum(q.value) * 100) / 100)); } catch (err) { falhou(err); }
});
document.addEventListener('focusin', (e) => { if (e.target.matches('[data-qty]')) setTimeout(() => e.target.select(), 0); });

// ------------------------------------------------------------------ deslizar (swipe)
let sw = null;
function fecharSwipes(except) { document.querySelectorAll('.sw.open').forEach(x => { if (x !== except) { x.classList.remove('open'); x.querySelector('.sw-front').style.transform = ''; } }); }
document.addEventListener('pointerdown', (e) => {
  const front = e.target.closest('.sw-front'); if (!front || e.target.closest('input,button:not(.sw-front)')) { if (!e.target.closest('.sw-act')) fecharSwipes(); return; }
  const row = front.closest('.sw');
  sw = { row, front, x0: e.clientX, y0: e.clientY, w: row.querySelector('.sw-act').offsetWidth, base: row.classList.contains('open') ? -row.querySelector('.sw-act').offsetWidth : 0, moving: false, id: e.pointerId };
});
document.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
  if (!sw.moving) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { sw.moving = true; fecharSwipes(sw.row); sw.row.classList.add('moving'); sw.front.style.transition = 'none'; } else if (Math.abs(dy) > 10) { sw = null; return; } else return; }
  const x = Math.min(0, Math.max(-sw.w - 30, sw.base + dx));
  sw.front.style.transform = `translateX(${x}px)`;
});
const fimSwipe = (e) => {
  if (!sw) return;
  if (sw.moving) {
    const m = new DOMMatrix(getComputedStyle(sw.front).transform).m41;
    sw.front.style.transition = '';
    const abre = m < -sw.w * 0.4;
    sw.row.classList.toggle('open', abre); const rr = sw.row; setTimeout(() => rr.classList.remove('moving'), 250);
    sw.front.style.transform = abre ? `translateX(${-sw.w}px)` : '';
    suprimir = Date.now();
  }
  sw = null;
};
document.addEventListener('pointerup', fimSwipe);
document.addEventListener('pointercancel', fimSwipe);
// depois de deslizar, o clique que se segue não abre a lista/produto
let suprimir = 0;
document.addEventListener('click', (e) => { if (Date.now() - suprimir < 400 && e.target.closest('.sw-front')) { e.preventDefault(); e.stopPropagation(); } }, true);

// ------------------------------------------------------------------ depois de desenhar
function depoisDeRender() {
  const qr = $('#qr');
  if (qr && S.group?.code) {
    const draw = () => { try { const q = window.qrcode(0, 'M'); q.addData(linkConvite()); q.make(); qr.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch { qr.innerHTML = `<span class="muted small">QR indisponível sem rede</span>`; } };
    if (window.qrcode) draw();
    else { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = draw; s.onerror = () => { qr.innerHTML = '<span class="muted small">QR indisponível sem rede</span>'; }; document.head.appendChild(s); }
  }
}

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => { });
start();
