// Deathmatch – tryb po stronie przeglądarki: kolejka, mecz do 20 graczy, płynne pokazywanie przeciwników (bufor paczek
// z serwera i interpolacja ~100 ms wstecz), kasa i WANTED, ekran WASTED, sklep po śmierci, odrodzenie, podium i powrót do lobby.
// Wszystko, co ważne (trafienia, obrażenia, śmierć, kasa, zakupy, zegar, wynik), liczy serwer (serwer/dm.mjs) – tu tylko obraz i sterowanie.
import * as THREE from 'three';
import { createDmUi, tx, SKULL_PATH } from './dm-ui.js';
import { createShopScene, createPodiumScene, makeGear, EMOTES } from './dm-scenes.js';
const EMOTE_IDS = ['', 'wave', 'dance', 'cheer'];

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const now = () => performance.now() / 1000;
const angLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const INTERP = 0.1;                                   // opóźnienie obrazu przeciwników (s) – zapas na nierówne paczki z sieci

// tekstura czaszki WANTED (czerwona, z czarnym obrysem) – nad postacią
function skullTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), p = new Path2D(SKULL_PATH);
  x.translate(8, 8); x.scale(112 / 24, 112 / 24);
  x.lineJoin = 'round'; x.lineWidth = 2.2; x.strokeStyle = '#000'; x.stroke(p);
  x.fillStyle = '#ff2626'; x.fill(p, 'evenodd');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createDM(ctx) {
  const { scene, player, net } = ctx;
  const ui = createDmUi({ sfx: (n) => ctx.sfx(n), gunName: (id) => gunName(id) });
  const attachGear = makeGear(ctx); ctx.gear = attachGear;
  attachGear(ctx.me);
  const skullMat = new THREE.SpriteMaterial({ map: skullTexture(), depthWrite: false, transparent: true, fog: false });
  const mySkull = new THREE.Sprite(skullMat); mySkull.scale.setScalar(0.42); mySkull.position.y = 2.05; mySkull.visible = false; ctx.me.add(mySkull);
  let shopScene = null, podScene = null;

  const S = {
    active: false, phase: 'idle', tier: null, info: null, cfg: null, pid: 0, map: '', mapLabel: '', players: new Map(), names: new Map(),
    board: [], wanted: 0, wantedPos: null, endT: 0, liveT: 0, off: null, deadT: 0, deathMsg: null, minDeath: 2.4, shopT: 0, shopTimeout: 30, endMsg: null, podT: 0,
    me: { life: 0, money: 0, owned: [ctx.PISTOL_ID], armor: 0, armorMax: 100, helmet: false, hp: 100, kills: 0, deaths: 0, damage: 0, protUntil: 0, rank: 0 },
    q: 0, sendT: 0, statsBackup: null, boardOpen: false, deploying: false, lastAmmoKey: '', tabHeld: false,
  };
  const gunName = (id) => (S.cfg && S.cfg.weapons[id] && S.cfg.weapons[id].name) || (ctx.WEAPON_STATS[id] && ctx.WEAPON_STATS[id].name) || id;
  const nameOf = (id) => id === S.pid ? tx('you') : (S.names.get(id) || '?');

  // ---------------- statystyki broni z serwera (przewidywanie strzałów i odrzutu = te same liczby co na serwerze) ----------------
  function patchStats(cfg) {
    const W = ctx.WEAPON_STATS; S.statsBackup = {};
    for (const id of cfg.guns) {
      const s = W[id], c = cfg.weapons[id]; if (!s || !c) continue;
      S.statsBackup[id] = JSON.parse(JSON.stringify(s));
      Object.assign(s, { name: c.name, rpm: c.rpm, auto: c.auto, mag: c.mag, reserve: c.reserve, reload: c.reload, dmg: c.dmg, head: c.head, pellets: c.pellets, pelletSpread: c.pelletSpread });
      s.recoil = { ...s.recoil, pitch: c.recoil.pitch, yaw: c.recoil.yaw }; s.spread = { ...c.spread };
    }
  }
  function restoreStats() { if (!S.statsBackup) return; for (const id in S.statsBackup) { const s = ctx.WEAPON_STATS[id]; for (const k of Object.keys(s)) delete s[k]; Object.assign(s, S.statsBackup[id]); } S.statsBackup = null; }

  // ---------------- przeciwnicy: fasolki z buforem stanów ----------------
  function makeRemote(info) {
    const sk = ctx.findSkin(info.skin) || { id: 'klasyk', c: 0xf0b440 };
    const root = ctx.makeBean(sk.c != null ? sk.c : 0xf0b440); scene.add(root); root.visible = false;
    ctx.skin(root, sk);
    const holder = new THREE.Group(); holder.position.copy(ctx.HOLDER_PIVOT); root.userData.torso.add(holder);
    attachGear(root);
    const skull = new THREE.Sprite(skullMat); skull.scale.setScalar(0.42); skull.position.y = 2.05; skull.visible = false; root.add(skull);
    const p = { id: info.id, nick: info.nick, root, holder, skull, guns: {}, gun: null, gunId: '', buf: [], life: -1, lastSeen: -9, alive: true, dying: 0, fall: 0, phase: 0, left: false, flags: 0, flash: 0, meshes: [] };
    root.traverse((o) => { if (o.isMesh && !o.userData.gear) { o.userData.dmId = info.id; p.meshes.push(o); } });
    setGun(p, ctx.PISTOL_ID);
    return p;
  }
  function setGun(p, id) {
    if (p.gunId === id) return;
    if (p.gun) p.holder.remove(p.gun.group);
    let g = p.guns[id]; if (!g) { g = p.guns[id] = ctx.createWeapon(id, { fx: false }); ctx.placeTP(g); }
    p.holder.add(g.group); p.gun = g; p.gunId = id;
  }
  function clearRemotes() { for (const p of S.players.values()) { scene.remove(p.root); } S.players.clear(); }
  const _a = V3(), _b = V3(), _gr = V3(), _gl = V3();
  function poseRemote(p, s, dt) {
    const r = p.root, ud = r.userData;
    const [, , x, y, z, yaw, pitch, cr, run, air, sl, legYaw, w, fl] = s;
    r.position.set(x, y, z); r.rotation.y = yaw; r.rotation.z = 0;
    const id = ctx.WEAPON_IDS[w] || ctx.PISTOL_ID; setGun(p, id);
    p.phase += dt * 9.7 * run; ud.pelvis.rotation.y = -(legYaw || 0);
    ctx.poseLegs(ud, p.phase, run * (1 - sl), air, cr * (1 - sl));
    ud.upper.position.y = -ctx.CROUCH_DROP * cr + Math.abs(Math.sin(p.phase)) * 0.06 * run * (1 - air);
    ctx.leanTorso(ud, -0.08 - 0.2 * run - 0.18 * cr, Math.sin(p.phase) * 0.08 * run, Math.sin(p.phase) * 0.05 * run);
    p.holder.rotation.x = Math.max(-0.5, Math.min(0.5, pitch)); p.holder.rotation.y = 0;
    // przeładowanie (flaga 16): broń opada i przechyla się
    const rl = fl & 16 ? 1 : 0; p.rl = THREE.MathUtils.damp(p.rl || 0, rl, 10, dt);
    ctx.placeTP(p.gun, -0.08 * p.rl, 0, -0.35 * p.rl, 0.3 * p.rl);
    // odrzut po strzale
    if (p.kick > 0) { p.kick = Math.max(0, p.kick - dt * 8); p.gun.group.position.z += p.kick * 0.06; p.gun.group.rotation.x += p.kick * 0.12; }
    ctx.keepRifleOut(ud, p.gun.group); r.updateWorldMatrix(true, true);
    _gr.copy(p.gun.gripR); p.gun.group.localToWorld(_gr); ud.torso.worldToLocal(_gr);
    _gl.copy(p.gun.gripLTP); p.gun.group.localToWorld(_gl); ud.torso.worldToLocal(_gl);
    ctx.poseArmsTo(ud, _gr, _gl);
    ud.gear.set(fl & 2, fl & 4);
    p.flags = fl;
    // emotka (klawisz G u innego gracza): broń chowa się, postać macha / tańczy / się cieszy
    const em = (fl >> 5) & 3; p.gun.group.visible = !em;
    if (em) { if (!p.emT) p.emT = now(); ud.baseY = y; EMOTES[EMOTE_IDS[em]](ctx, r, now() - p.emT); } else p.emT = 0;
  }
  function sample(p, rt) {
    const b = p.buf; if (!b.length) return null;
    if (rt <= b[0].T) return b[0].v;
    for (let i = b.length - 1; i >= 0; i--) {
      if (b[i].T <= rt) {
        const A = b[i], B = b[i + 1]; if (!B) return A.v;
        const k = Math.min(1, (rt - A.T) / Math.max(1e-4, B.T - A.T)), a = A.v, c = B.v, o = a.slice();
        for (const j of [2, 3, 4, 7, 8, 9, 10]) o[j] = a[j] + (c[j] - a[j]) * k;
        o[5] = angLerp(a[5], c[5], k); o[6] = a[6] + (c[6] - a[6]) * k; o[11] = angLerp(a[11], c[11], k);
        return o;
      }
    }
    return b[b.length - 1].v;
  }
  function stepRemotes(dt) {
    const L = now(), rt = S.off == null ? 0 : L - S.off - INTERP;
    for (const p of S.players.values()) {
      const r = p.root, mats = r.userData.mats;
      if (p.left) { r.visible = false; continue; }
      if (p.dying > 0) {                                    // padanie po śmierci
        p.dying -= dt; p.fall = Math.min(1, p.fall + dt * 3.2); r.rotation.z = p.fall * (Math.PI / 2); r.position.y = (p.deadY || 0) + Math.sin(p.fall * Math.PI / 2) * 0.28;
        p.skull.visible = false; mats.skin.emissive.setScalar(0);
        if (p.dying <= 0) { r.visible = false; r.rotation.z = 0; }
        continue;
      }
      const vis = p.buf.length && L - p.lastSeen < 0.35;
      r.visible = !!vis; if (!vis) continue;
      const s = sample(p, rt); if (!s) { r.visible = false; continue; }
      poseRemote(p, s, dt);
      // WANTED nad głową; ochrona po odrodzeniu: niebieska poświata; trafienie: biały błysk
      p.skull.visible = p.id === S.wanted;
      if (p.flash > 0) { p.flash -= dt; mats.skin.emissive.setRGB(0.9, 0.9, 0.9); }
      else if (p.flags & 8) { const k = 0.25 + 0.2 * Math.sin(L * 10); mats.skin.emissive.setRGB(k * 0.3, k * 0.75, k); }
      else mats.skin.emissive.setScalar(0);
      if (mats.body) mats.body.emissive.copy(mats.skin.emissive);
    }
  }

  // ---------------- sieć ----------------
  const on = (t, f) => net.on(t, f);
  on('dmqueued', (m) => { if (m.account && ctx.onAccount) ctx.onAccount(m.account); });
  on('dmq', (m) => { if (S.phase === 'queue') ui.updateQueue(m); });
  on('dmcancelled', () => { exit(false); });
  on('error', (m) => {
    const msg = (m && m.message) || 'Error';
    if (S.phase === 'queue' || S.phase === 'connecting') { exit(false, msg); return; }
    if (m.code === 'cheat') { exit(true, msg); return; }
    ui.notify(msg, 'red');
  });
  on('close', () => { if (S.active && S.phase !== 'podium') exit(true, tx('lost')); });
  on('pi', (m) => net.send({ t: 'po', s: m.s }));
  on('dm', (m) => startMatch(m));
  on('spawn', (m) => onSpawn(m));
  on('go', (m) => { S.phase = player.dead ? 'dead' : 'live'; S.endT = now() + m.left; S.liveT = now(); ctx.sfx('go'); setTimeout(() => ui.countdown(null), 900); });
  on('tm', (m) => { S.endT = now() + m.left; });
  on('s', (m) => {
    const L = now(), off = L - m.T;
    S.off = S.off == null ? off : off < S.off ? off : S.off + (off - S.off) * 0.01;
    const seen = new Set();
    for (const row of m.p) {
      const p = S.players.get(row[0]); if (!p) continue; seen.add(p.id);
      if (row[1] !== p.life) { p.life = row[1]; p.buf.length = 0; p.dying = 0; p.fall = 0; p.alive = true; p.root.rotation.z = 0; }
      p.buf.push({ T: m.T, v: row }); if (p.buf.length > 24) p.buf.shift();
      p.lastSeen = L;
    }
  });
  on('fx', (m) => {
    const p = S.players.get(m.id), id = ctx.WEAPON_IDS[m.w] || ctx.PISTOL_ID;
    _a.set(m.a[0], m.a[1], m.a[2]);
    if (p && p.root.visible && p.gun) { p.gun.muzzle.getWorldPosition(_a); p.kick = 1; }
    for (const e of m.b || []) ctx.spawnTracer(_a.clone(), V3(e[0], e[1], e[2]));
    const d = Math.hypot(m.a[0] - player.pos.x, m.a[2] - player.pos.z);
    ctx.remoteShot(id, Math.max(0.05, Math.min(1, 1.15 - d / 70)), d);   // z daleka: nagranie „distant”
  });
  on('dmg', (m) => {
    S.me.hp = m.hp; S.me.armor = m.ar; if (m.ar <= 0) S.me.helmet = false;
    ctx.setHp(m.hp);
    if (m.from) { const dx = m.from[0] - player.pos.x, dz = m.from[1] - player.pos.z, a = Math.atan2(-dx, -dz); ui.damageDir(-(a - player.yaw)); }
    ctx.sfx(m.h ? 'hurtHead' : 'hurt');
  });
  on('hc', (m) => {
    const p = S.players.get(m.id); if (p) p.flash = 0.1;
    if (m.prot) { ui.notify(tx('protect'), 'pink'); return; }
    ctx.hitFeedback(!!m.h, !!m.k);
  });
  on('kf', (m) => {
    const wid = ctx.WEAPON_IDS[m.w] || ctx.PISTOL_ID;
    ui.killFeed(m.k, m.v, wid, m.h, m.wanted, S.pid, nameOf);
    const p = S.players.get(m.v);
    if (p) { p.alive = false; p.dying = 2.6; p.fall = 0; p.deadY = p.root.position.y; p.buf.length = 0; }
    if (m.k === S.pid) { S.me.kills++; if (m.h) ui.notify(tx('head'), 'gold', false, 'head'); else ui.notify(tx('kill') + ' · ' + esc(nameOf(m.v)), ''); ctx.sfx('kill'); }
  });
  on('reward', (m) => { S.me.money = m.money; ui.setMoney(m.money, m.plus); if (m.wanted) ui.notify(tx('wantedKill', { m: S.cfg.wantedMult }), 'red', true, 'skull'); ctx.sfx('cash'); });
  on('dead', (m) => die(m));
  on('inv', (m) => {
    Object.assign(S.me, { money: m.money, owned: m.owned, armor: m.armor, helmet: m.helmet });
    if (m.armor > 0) S.me.armorMax = m.armor;
    ui.setMoney(m.money, 0);
    if (ui.shopOpen) ui.updateShop(shopState(), m.ok ? tx('bought', { n: itemName(m.item) }) : m.why === 'funds' ? tx('noFunds') : m.why === 'locked' ? tx('locked') : '');
    if (shopScene) shopScene.setLoadout(null, S.me.armor, S.me.helmet);
    if (m.ok) ctx.sfx('buy');
  });
  on('wanted', (m) => {
    const prev = S.wanted; S.wanted = m.id; if (!m.id) S.wantedPos = null;
    if (m.id === S.pid && prev !== S.pid) { ui.notify(`${tx('youWanted')}<small>${esc(tx('youWantedSub', { m: S.cfg.wantedMult }))}</small>`, 'red', true, 'skull'); ctx.sfx('wanted'); }
    else if (m.id && m.id !== S.pid) ui.notify(tx('wantedNow', { n: esc(nameOf(m.id)) }), 'red', false, 'skull');
    ui.setWantedMe(m.id === S.pid); mySkull.visible = m.id === S.pid;
  });
  on('wp', (m) => { S.wantedPos = { id: m.id, x: m.x, z: m.z, t: now() }; });
  on('board', (m) => {
    S.board = m.r; S.wanted = m.wanted;
    const act = m.r.filter((r) => !r[4]); const i = act.findIndex((r) => r[0] === S.pid); S.me.rank = i + 1; S.total = act.length;
    const mine = m.r.find((r) => r[0] === S.pid); if (mine) { S.me.kills = mine[1]; S.me.deaths = mine[2]; S.me.damage = mine[3]; }
    ui.setBoard(m.r, S.pid, S.wanted, nameOf);
    if (S.boardOpen) ui.showBoard(true, S.board, S.pid, S.wanted, nameOf, S.mapLabel);
  });
  on('left', (m) => { const p = S.players.get(m.id); if (p) { p.left = true; p.root.visible = false; } });
  on('fix', (m) => { if (Array.isArray(m.p) && !player.dead) { player.pos.set(+m.p[0], +m.p[1], +m.p[2]); player.vel.set(0, 0, 0); } });
  on('end', (m) => onEnd(m));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const itemName = (id) => S.cfg ? (S.cfg.weapons[id] ? S.cfg.weapons[id].name : S.cfg.armor[id] ? S.cfg.armor[id].name : id) : id;

  // ---------------- przebieg ----------------
  async function join(tier, info) {
    if (S.active) return;
    S.active = true; S.phase = 'connecting'; S.tier = tier; S.info = info;
    ui.showQueue(tier, info, cancel); document.body.classList.add('dm-queue');
    try { await net.connect(); net.send({ t: 'dmq', tier: tier.id, skin: ctx.skinId() || '' }); S.phase = 'queue'; }
    catch (e) { exit(false, (e && e.message) || 'offline'); }
  }
  function cancel() { if (S.phase === 'queue' || S.phase === 'connecting') { net.send({ t: 'dmc' }); setTimeout(() => { if (S.phase === 'queue' || S.phase === 'connecting') exit(false); }, 1500); } }

  function startMatch(m) {
    ui.hideQueue(); document.body.classList.remove('dm-queue');
    S.phase = 'count'; S.pid = m.you; S.cfg = m.cfg; S.map = m.map; S.mapLabel = ctx.mapLabel(m.map);
    S.names = new Map(m.players.map((p) => [p.id, p.nick])); S.board = []; S.wanted = 0; S.wantedPos = null; S.off = null; S.q = 0;
    S.endT = now() + m.liveIn + m.duration; S.liveT = now() + m.liveIn;
    Object.assign(S.me, { life: 0, money: m.money, owned: m.owned, armor: 0, armorMax: 100, helmet: false, hp: 100, kills: 0, deaths: 0, damage: 0, rank: 0 });
    S.me.guns = Array.isArray(m.guns) ? m.guns : null;          // Arsenał: bronie do kupienia (poniżej progu – tylko pistolet); null = wszystkie
    S.me.ars = m.ars || null;                                    // progi Arsenału do kłódek w sklepie ({unit, need})
    patchStats(m.cfg);
    clearRemotes();
    for (const p of m.players) if (p.id !== S.pid) S.players.set(p.id, makeRemote(p));
    ui.setIcons(ctx.icons());
    const md = ctx.enter(m.map);                               // tryb 'dm' w grze, mapa, widok z 3. osoby
    if (md) ui.mapBase(md.boxes, md.bx, md.bz);
    ui.show(true); ui.setMoney(m.money, 0); ui.setWantedMe(false); mySkull.visible = false;
    ui.setBoard(m.players.map((p) => [p.id, 0, 0, 0, 0]), S.pid, 0, nameOf);
    ctx.lock();
  }
  function onSpawn(m) {
    S.me.life = m.life; Object.assign(S.me, { money: m.money, owned: m.owned, armor: m.armor, helmet: m.helmet, hp: 100, protUntil: now() + (m.prot || 0) });
    if (m.armor > 0) S.me.armorMax = m.armor;
    ui.hideWasted(); ui.closeShop(); ctx.filter('');
    document.body.classList.remove('dm-shop', 'dm-dead');
    ctx.respawn(m.p, m.yaw, m.owned);                          // pozycja, pełne HP, amunicja i broń w rękach (najlepsza kupiona)
    ctx.me.rotation.z = 0; ctx.me.userData.gear.set(m.armor > 0, m.helmet && m.armor > 0);
    ui.setMoney(m.money, 0);
    if (S.phase === 'dead' || S.phase === 'shop') { S.phase = 'live'; ctx.lock(); ctx.sfx('spawn'); }
    S.deploying = false;
  }
  function die(m) {
    S.phase = 'dead'; S.deadT = now(); S.deathMsg = m; S.minDeath = m.minDeath || 2.4; S.shopTimeout = m.shopTimeout || 30;
    S.me.hp = 0; S.me.armor = 0; S.me.helmet = false; S.me.owned = [ctx.PISTOL_ID]; S.me.money = m.money;
    ctx.setDead(true); ctx.setHp(0); document.body.classList.add('dm-dead'); ctx.me.userData.gear.set(false, false);
    ui.scope(false);
    ctx.filter('grayscale(1) contrast(1.08) brightness(.82)');
    const k = m.by ? nameOf(m.by) : '';
    ui.showWasted({ killer: k, weapon: ctx.WEAPON_IDS[m.w] || ctx.PISTOL_ID, head: !!m.h, dist: m.d, killerHp: m.killerHp, killerAr: m.killerAr,
      kills: m.stats.kills, deaths: m.stats.deaths, damage: m.stats.damage, money: m.money });
    ctx.sfx('wasted');
  }
  const shopState = () => ({ money: S.me.money, owned: S.me.owned.slice(), armor: S.me.armor, helmet: S.me.helmet, guns: S.me.guns || null, ars: S.me.ars || null });
  function openShop() {
    S.phase = 'shop'; S.shopT = now();
    ui.hideWasted(); ctx.filter(''); ctx.unlock(); document.body.classList.add('dm-shop');
    if (!shopScene) shopScene = createShopScene(ctx);
    shopScene.setLoadout(null, S.me.armor, S.me.helmet, ctx.mySkin());
    ui.openShop(shopState(), S.cfg, { onBuy: (id) => net.send({ t: 'buy', item: id }), onDeploy: deploy, onPreview: (id) => shopScene.preview(id) });
    net.send({ t: 'shop' });
  }
  function deploy() {
    if (S.phase !== 'shop' || S.deploying) return;
    S.deploying = true; ctx.lock();                            // blokada kursora w geście gracza (klawisz / klik)
    net.send({ t: 'deploy' });
    setTimeout(() => { S.deploying = false; }, 1500);
  }
  function onEnd(m) {
    S.endMsg = m; S.phase = 'end';
    if (m.account && ctx.onAccount) ctx.onAccount(m.account);
    ui.scope(false); ui.closeShop(); ui.hideWasted(); ctx.filter(''); ui.showBoard(false); document.body.classList.remove('dm-dead', 'dm-shop');
    ui.notify(tx('timeUp'), 'pink', true); ctx.sfx('end');
    setTimeout(() => {
      if (S.phase !== 'end') return;
      S.phase = 'podium'; S.podT = now(); ctx.unlock(); document.body.classList.add('dm-shop');
      ui.show(false); document.body.classList.add('dm-on');
      if (!podScene) podScene = createPodiumScene(ctx);
      const top = m.podium.map((id) => { const st = m.standings.find((s) => s.id === id), sk = id === S.pid ? ctx.mySkin() : ctx.findSkin(st && st.skin); return { skin: sk, color: sk && sk.c != null ? sk.c : 0xf0b440 }; });
      podScene.setup(top);
      ui.showPodium(m, S.pid, () => exit(true));
      ctx.sfx('podium');
    }, 2400);
  }
  function exit(toLobby, msg) {
    const was = S.active; S.active = false; S.phase = 'idle';
    try { if (net.open) net.send({ t: 'leave' }); } catch {}
    net.close();
    ui.hideQueue(); ui.hideWasted(); ui.closeShop(); ui.hidePodium(); ui.showBoard(false); ui.scope(false); ui.countdown(null); ui.show(false);
    ctx.filter(''); document.body.classList.remove('dm-shop', 'dm-on', 'dm-dead', 'dm-queue');
    clearRemotes(); restoreStats(); mySkull.visible = false; ctx.me.userData.gear.set(false, false); ctx.me.rotation.z = 0;
    if (was) ctx.exit(msg);
  }
  function leave() { exit(true); }

  // ---------------- co klatkę ----------------
  function update(dt) {
    if (!S.active) return;
    const L = now();
    if (S.phase === 'count') ui.countdown(Math.max(0, S.liveT - L), S.mapLabel);
    if (S.phase === 'dead' && L - S.deadT >= S.minDeath) openShop();
    if (S.phase === 'shop') ui.shopTick(S.shopTimeout - (L - S.deadT - S.minDeath));
    if (S.phase === 'podium') {
      ui.podiumCd(S.cfg ? 14 - (L - S.podT) : 0);
      if (L - S.podT > 14) exit(true);
      return;
    }
    stepRemotes(dt);
    // własna fasolka: padanie po śmierci (widok z 3. osoby)
    if (player.dead) { S.fallK = Math.min(1, (S.fallK || 0) + dt * 3); ctx.me.rotation.z = S.fallK * (Math.PI / 2); } else S.fallK = 0;
    // HUD
    const w = ctx.curWeapon(), st = ctx.WEAPON_STATS[w.id];
    ui.setAmmo(w.mag, w.reserve, w.id, ctx.gunState(), w.mag <= Math.ceil(st.mag * 0.2), ctx.reloading());
    ui.setVitals(S.me.hp, 1 - (player.fatigue || 0), S.me.armor, S.me.armorMax, S.me.helmet);
    const left = Math.max(0, S.endT - L);
    ui.setTimer(S.phase === 'count' ? S.cfg.duration : left, S.me.kills, S.me.rank, S.total || S.names.size);
    ui.setProt(!player.dead && S.me.protUntil > L ? S.me.protUntil - L : 0);
    const scoped = !player.dead && !!st.scope && player.ads > 0.6 && S.phase === 'live'; ui.scope(scoped); S.scoped = scoped;
    // minimapa: widoczni przeciwnicy + WANTED (serwer podaje jego pozycję zawsze)
    const foes = []; for (const p of S.players.values()) if (p.root.visible && p.dying <= 0) foes.push({ id: p.id, x: p.root.position.x, z: p.root.position.z });
    let wp = null; if (S.wanted && S.wanted !== S.pid) { const p = S.players.get(S.wanted); wp = p && p.root.visible ? { id: p.id, x: p.root.position.x, z: p.root.position.z } : S.wantedPos && L - S.wantedPos.t < 1.5 ? S.wantedPos : null; }
    ui.drawMinimap({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }, foes, wp);
  }
  // paczka ruchu do serwera (20/s)
  function send(dt) {
    if (!S.active || !net.open || player.dead || !(S.phase === 'live' || S.phase === 'count') || !S.me.life) return;
    S.sendT -= dt; if (S.sendT > 0) return; S.sendT = 0.05;
    const p = player, f2 = (v) => +(+v || 0).toFixed(2), f3 = (v) => +(+v || 0).toFixed(3);
    net.send({ t: 'st', s: [f3(p.pos.x), f3(p.pos.y), f3(p.pos.z), f3(p.yaw), f3(p.pitch), f2(p.crouch), f2(p.run), f2(p.air), f2(p.slideK), f2(p.legYaw), ctx.WEAPON_IDS.indexOf(ctx.curWeapon().id), p.ads > 0.5 ? 1 : 0, S.me.life, S.emote ? S.emote.id : 0] });
  }
  function shot(o, d) { if (!S.active || S.phase !== 'live') return; net.send({ t: 'sh', o: [o.x, o.y, o.z].map((v) => +v.toFixed(3)), d: [d.x, d.y, d.z].map((v) => +v.toFixed(4)), q: ++S.q }); if (now() < S.me.protUntil) S.me.protUntil = 0; }
  // emotka gracza (widok z 3. osoby): po pozie z gry; ruch, strzał, celowanie albo 4 s przerywają
  function postPose() {
    if (!S.emote) return;
    const L = now(), w = ctx.curWeapon();
    if (player.dead || S.phase !== 'live' || player.speed01 > 0.08 || player.ads > 0.2 || ctx.firing() || L - S.emote.t0 > 4) { S.emote = null; w.inst.group.visible = true; return; }
    w.inst.group.visible = false;
    if (player.view !== 'fps') { ctx.me.userData.baseY = player.pos.y; EMOTES[EMOTE_IDS[S.emote.id]](ctx, ctx.me, L - S.emote.t0); }
  }
  function render(renderer, dt) {
    if (S.phase === 'shop' && shopScene) { shopScene.render(renderer, dt); return true; }
    if (S.phase === 'podium' && podScene) { ui.podiumPlates(podScene.render(renderer, dt)); return true; }
    return false;
  }
  function key(e, down) {
    if (!S.active) return false;
    if (down && S.phase === 'shop' && e.code === 'Escape') { ctx.pause(); return true; }   // menu (wyjście z meczu) także ze sklepu
    if (down && ui.shopKey(e)) return true;
    if (down && e.code === 'KeyG' && S.phase === 'live' && !player.dead) { S.emote = { id: 1 + ((S.emoteN = (S.emoteN || 0) + 1) - 1) % 3, t0: now() }; return true; }
    if (e.code === 'Tab' && (S.phase === 'live' || S.phase === 'dead' || S.phase === 'count')) { e.preventDefault(); S.boardOpen = down; ui.showBoard(down, S.board, S.pid, S.wanted, nameOf, S.mapLabel); return true; }
    if (S.phase === 'podium' && down && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) { e.preventDefault(); exit(true); return true; }
    return false;
  }
  const hitMeshes = () => { const out = []; for (const p of S.players.values()) if (p.root.visible && p.dying <= 0) out.push(...p.meshes); return out; };
  addEventListener('fasolka:lang', () => ui.texts());

  return {
    join, cancel, leave, update, send, shot, render, key, hitMeshes, ui, postPose,
    reload() { if (S.active && S.phase === 'live') net.send({ t: 'rl' }); },
    get active() { return S.active; }, get phase() { return S.phase; }, get inMatch() { return S.active && ['count', 'live', 'dead', 'shop', 'end'].includes(S.phase); },
    get frozen() { return S.active && S.phase !== 'live'; }, get scoped() { return !!S.scoped; }, get owned() { return S.me.owned; }, get cfg() { return S.cfg; },
    get tier() { return S.tier; }, get shopOpen() { return S.phase === 'shop'; }, get overlay() { return S.phase === 'shop' || S.phase === 'podium'; },
  };
}
