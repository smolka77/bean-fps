// Deathmatch – tryb po stronie przeglądarki: stałe, darmowe lobby do 20 graczy (wchodzisz od razu do trwającej gry),
// płynne pokazywanie przeciwników (bufor paczek z serwera i interpolacja ~100 ms wstecz), WANTED, broń za zabójstwa,
// ekran WASTED (Spacja – odrodzenie, Esc – wyjście do lobby).
// Wszystko, co ważne (trafienia, obrażenia, śmierć, kolejna broń), liczy serwer (serwer/dm.mjs) – tu tylko obraz i sterowanie.
import * as THREE from 'three';
import { createDmUi, tx, SKULL_PATH } from './dm-ui.js';
import { srvText } from './wallet.js';
import { getLang } from './lobby-ui.js';
import { makeGear, EMOTES } from './dm-scenes.js';
import { applyWeaponSkin, skinFor, mySkins } from './weapon-skins.js';
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

  const S = {
    active: false, phase: 'idle', tier: null, info: null, cfg: null, pid: 0, map: '', mapLabel: '', players: new Map(), names: new Map(),
    board: [], wanted: 0, wantedPos: null, off: null, deadT: 0, deathMsg: null, minDeath: 2.4, deadReady: false,
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
    const p = { id: info.id, nick: info.nick, wsk: info.wsk || null, root, holder, skull, guns: {}, gun: null, gunId: '', buf: [], life: -1, lastSeen: -9, alive: true, dying: 0, fall: 0, phase: 0, left: false, flags: 0, flash: 0, meshes: [] };
    root.traverse((o) => { if (o.isMesh && !o.userData.gear) { o.userData.dmId = info.id; p.meshes.push(o); } });
    setGun(p, ctx.PISTOL_ID);
    return p;
  }
  function setGun(p, id) {
    if (p.gunId === id) return;
    if (p.gun) p.holder.remove(p.gun.group);
    let g = p.guns[id]; if (!g) { g = p.guns[id] = ctx.createWeapon(id, { fx: false }); ctx.placeTP(g); applyWeaponSkin(g, skinFor(p.wsk, id)); }   // skin broni przeciwnika (sprawdzony przez serwer)
    p.holder.add(g.group); p.gun = g; p.gunId = id;
  }
  function clearRemotes() { for (const p of S.players.values()) { ctx.cfx.clear(p.root); scene.remove(p.root); } S.players.clear(); }   // clear: broń wypadła z rąk (leży w scenie) – wraca do postaci
  function dropRemote(id) { const p = S.players.get(id); if (p) { ctx.cfx.clear(p.root); scene.remove(p.root); S.players.delete(id); } }
  const _a = V3(), _b = V3(), _gr = V3(), _gl = V3(), _hd = V3();
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
    if (em) { if (!p.emT) p.emT = now(); ud.baseY = y; EMOTES[EMOTE_IDS[em]](ctx, r, now() - p.emT); } else { p.emT = 0; ctx.cfx.pose(r, dt); }   // szarpnięcie po trafieniu
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
      if (p.dying > 0) {                                    // upadek po śmierci: fizyka z kolizją mapy (ragdoll.js), na końcu ciało gaśnie
        p.dying -= dt; ctx.cfx.stepDeath(r, dt);
        p.skull.visible = false; ctx.cfx.flash(mats, 0);
        if (p.dying <= 0) { r.visible = false; ctx.cfx.clear(r); }
        continue;
      }
      const vis = p.buf.length && L - p.lastSeen < 0.35;
      r.visible = !!vis; if (!vis) continue;
      const s = sample(p, rt); if (!s) { r.visible = false; continue; }
      poseRemote(p, s, dt);
      // WANTED nad głową; ochrona po odrodzeniu: niebieska poświata; trafienie: biały błysk
      p.skull.visible = p.id === S.wanted;
      if (p.flash > 0) { p.flash -= dt; ctx.cfx.flash(mats, p.flash / 0.1); }
      else if (p.flags & 8) { const k = 0.25 + 0.2 * Math.sin(L * 10); mats.skin.emissive.setRGB(k * 0.3, k * 0.75, k); }
      else mats.skin.emissive.setScalar(0);
      if (mats.body) mats.body.emissive.copy(mats.skin.emissive);
    }
  }

  // ---------------- sieć ----------------
  const on = (t, f) => net.on(t, f);
  on('error', (m) => {
    const msg = srvText((m && m.message) || 'Error', getLang());
    if (m.code === 'xshare') { exit(false); dispatchEvent(new CustomEvent('fasolka:xshare')); return; }   // brak posta na X: okno udostępniania w lobby
    if (S.phase === 'connecting') { exit(false, msg); return; }          // np. lobby pełne (20/20)
    if (m.code === 'cheat' || m.code === 'idle' || m.code === 'dup') { exit(true, msg); return; }
    ui.notify(msg, 'red');
  });
  on('close', () => { if (S.active) exit(true, tx('lost')); });
  on('pi', (m) => net.send({ t: 'po', s: m.s }));
  on('dm', (m) => startMatch(m));
  on('spawn', (m) => onSpawn(m));
  on('joined', (m) => {                                    // nowy gracz w trwającym lobby
    if (!S.active || m.id === S.pid || S.players.has(m.id)) return;
    S.names.set(m.id, m.nick); S.players.set(m.id, makeRemote(m));
    ui.notify(esc(m.nick) + ' · ' + esc(tx('joined')), '');
  });
  on('s', (m) => {
    const L = now(), off = L - m.T;
    S.off = S.off == null ? off : off < S.off ? off : S.off + (off - S.off) * 0.01;
    const seen = new Set();
    for (const row of m.p) {
      const p = S.players.get(row[0]); if (!p) continue; seen.add(p.id);
      if (row[1] !== p.life) { p.life = row[1]; p.buf.length = 0; p.dying = 0; p.fall = 0; p.alive = true; ctx.cfx.clear(p.root); }
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
    if (p && !m.k) ctx.cfx.react(p.root, _hd.copy(p.root.position).sub(player.pos), !!m.h);   // szarpnięcie: kula leci ode mnie
    ctx.hitFeedback(!!m.h, !!m.k);
    if (p && m.d && ctx.damageNumber) ctx.damageNumber(p.root.position, m.d, !!m.h, !!m.k, p);   // dymek z obrażeniami (liczy serwer)
  });
  on('kf', (m) => {
    const wid = ctx.WEAPON_IDS[m.w] || ctx.PISTOL_ID;
    ui.killFeed(m.k, m.v, wid, m.h, m.wanted, S.pid, nameOf);
    const p = S.players.get(m.v);
    if (p) {
      p.alive = false; p.dying = 2.6; p.fall = 0; p.deadY = p.root.position.y; p.buf.length = 0;
      const kp = m.k === S.pid ? player.pos : S.players.get(m.k) && S.players.get(m.k).root.visible ? S.players.get(m.k).root.position : null;   // upadek: od strzelca
      if (p.root.visible) ctx.cfx.die(p.root, { from: kp, head: !!m.h, gun: p.gun && p.gun.group, life: 2.6 });
    }
    if (m.k === S.pid) { S.me.kills++; if (m.h) ui.notify(tx('head'), 'gold', false, 'head'); else ui.notify(tx('kill') + ' · ' + esc(nameOf(m.v)), ''); ctx.sfx('kill'); }
  });
  // zabójstwo: po 1, potem 2, potem 3… zabójstwach serwer daje następną broń z drabinki (pełny magazynek) – w rękach bez animacji
  // serwer: konto dostało broń za grę (P90 po minucie w Deathmatch) – w drabince od następnego awansu, w lobby w Ekwipunku
  on('unlock', (m) => {
    if (m.item !== 'p90') return;
    ui.notify(`${esc(tx('unlockP90'))}<small>${esc(tx('unlockP90s'))}</small>`, 'gold', true); ctx.sfx('buy');
    dispatchEvent(new CustomEvent('fasolka:unlock', { detail: m.item }));
  });
  on('upgrade', (m) => {
    S.me.owned = m.owned; ui.setNext(m.lk, m.need, m.top, m.locked);
    if (m.up && !player.dead) { ctx.upgrade(m.up); ui.notify(`${esc(tx(m.level >= S.cfg.guns.length - 1 ? 'maxGun' : 'upgrade'))}<small>${esc(gunName(m.up))}</small>`, 'gold', true); ctx.sfx('buy'); }
    if (m.wanted) ui.notify(tx('wantedKill', { m: S.cfg.wantedMult }), 'red', true, 'skull');
  });
  on('dead', (m) => die(m));
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
  on('left', (m) => { dropRemote(m.id); S.names.delete(m.id); });
  on('fix', (m) => { if (Array.isArray(m.p) && !player.dead) { player.pos.set(+m.p[0], +m.p[1], +m.p[2]); player.vel.set(0, 0, 0); } });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------- przebieg ----------------
  // wejście do stałego lobby: bez kolejki – serwer od razu wpuszcza (albo odpowiada, że lobby jest pełne)
  async function join(tier, info) {
    if (S.active) return;
    S.active = true; S.phase = 'connecting'; S.tier = tier || null; S.info = info;
    try { await net.connect(); net.send({ t: 'dmq', skin: ctx.skinId() || '', wsk: mySkins() }); }
    catch (e) { exit(false, (e && e.message) || 'offline'); }
  }
  function cancel() { if (S.phase === 'connecting') exit(false); }

  function startMatch(m) {
    S.phase = 'live'; S.pid = m.you; S.cfg = m.cfg; S.map = m.map; S.mapLabel = ctx.mapLabel(m.map);
    S.names = new Map(m.players.map((p) => [p.id, p.nick])); S.board = []; S.wanted = 0; S.wantedPos = null; S.off = null; S.q = 0;
    Object.assign(S.me, { life: 0, money: m.money, owned: m.owned, armor: 0, armorMax: 100, helmet: false, hp: 100, kills: 0, deaths: 0, damage: 0, rank: 0 });
    S.me.guns = Array.isArray(m.guns) ? m.guns : null;          // Arsenał: bronie do kupienia (poniżej progu – tylko pistolet); null = wszystkie
    S.me.ars = m.ars || null;                                    // progi Arsenału do kłódek w sklepie ({unit, need})
    patchStats(m.cfg);
    ui.setNext(m.lk, m.need, m.top, m.locked);
    clearRemotes();
    for (const p of m.players) if (p.id !== S.pid) S.players.set(p.id, makeRemote(p));
    ui.setIcons(ctx.icons());
    const md = ctx.enter(m.map);                               // tryb 'dm' w grze, mapa, widok z 3. osoby
    if (md) ui.mapBase(md.boxes, md.bx, md.bz);
    warmUp();
    ui.show(true); ui.setWantedMe(false); mySkull.visible = false;
    ui.setBoard(m.players.map((p) => [p.id, 0, 0, 0, 0]), S.pid, 0, nameOf);
    ui.notify(S.mapLabel, 'pink', true);
    ctx.lock(); ctx.sfx('go');
  }
  // Rozgrzewka: pierwsze narysowanie modelu broni (albo postaci ze skinem) kompiluje shadery i wgrywa model na kartę graficzną – to trwa
  // kilkaset ms i w Deathmatch wypadało w środku walki (każde zabójstwo daje komuś nową broń z drabinki). Tu rysujemy raz, poza ekranem
  // (do małej tekstury), całą scenę z wszystkimi broniami trybu i obecnymi graczami przed kamerą – potem w grze nic już się nie kompiluje.
  function warmUp() {
    const { THREE, renderer, camera } = ctx; if (!THREE || !renderer || !camera) return;
    const g = new THREE.Group(), saved = [];
    try {
      const pos = camera.getWorldPosition(new THREE.Vector3()), fwd = camera.getWorldDirection(new THREE.Vector3());
      g.position.copy(pos).addScaledVector(fwd, 3); g.lookAt(pos);
      [...(S.cfg.guns || []), 'akmgold'].forEach((id, i) => { const w = ctx.createWeapon(id, { fx: false }); ctx.placeTP(w); w.group.position.x += (i - 2.5) * 0.45; g.add(w.group); });
      scene.add(g);
      let i = 0; for (const p of S.players.values()) { saved.push([p.root, p.root.visible, p.root.position.clone()]); p.root.visible = true; p.root.position.copy(g.position).addScaledVector(fwd, 1 + (i++ % 4) * 0.5); }
      scene.updateMatrixWorld(true);
      const rt = new THREE.WebGLRenderTarget(64, 64), prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(prev); rt.dispose();
    } catch (e) { console.warn('[dm] rozgrzewka', e); }
    scene.remove(g);
    for (const [r, v, p] of saved) { r.visible = v; r.position.copy(p); }
  }
  function onSpawn(m) {
    S.me.life = m.life; Object.assign(S.me, { money: m.money, owned: m.owned, armor: m.armor, helmet: m.helmet, hp: 100, protUntil: now() + (m.prot || 0) });
    if (m.armor > 0) S.me.armorMax = m.armor;
    ui.setNext(m.lk, m.need, m.top, m.locked);
    ui.hideWasted(); ctx.filter('');
    document.body.classList.remove('dm-dead');
    ctx.respawn(m.p, m.yaw, m.owned);                          // pozycja, pełne HP, amunicja i broń w rękach (najlepsza z drabinki)
    ctx.me.rotation.z = 0; ctx.me.userData.gear.set(m.armor > 0, m.helmet && m.armor > 0);
    if (S.phase === 'dead') { S.phase = 'live'; ctx.lock(); ctx.sfx('spawn'); }
    S.deploying = false;
  }
  function die(m) {
    S.phase = 'dead'; S.deadT = now(); S.deathMsg = m; S.minDeath = m.minDeath || 2.4; S.deadReady = false; S.deploying = false; S.emote = null;
    S.me.hp = 0; S.me.armor = 0; S.me.helmet = false; S.me.owned = [ctx.PISTOL_ID]; ui.setNext(0, 1, 0);
    ctx.setDead(true); ctx.setHp(0); document.body.classList.add('dm-dead'); ctx.me.userData.gear.set(false, false);
    ui.scope(false); S.boardOpen = false; ui.showBoard(false);
    ctx.unlock();                                              // kursor wolny: Esc trafia do gry (wyjście do lobby), a nie tylko zwalnia mysz
    ctx.filter('saturate(.35) brightness(.78)');
    const k = m.by ? nameOf(m.by) : '';
    ui.showWasted({ killer: k, weapon: ctx.WEAPON_IDS[m.w] || ctx.PISTOL_ID, head: !!m.h, dist: m.d, killerHp: m.killerHp, killerAr: m.killerAr,
      kills: m.stats.kills, deaths: m.stats.deaths, damage: m.stats.damage });
    ctx.sfx('wasted');
  }
  // Spacja na ekranie śmierci: odrodzenie (blokada kursora w geście gracza – keydown)
  function deploy() {
    if (S.phase !== 'dead' || !S.deadReady || S.deploying) return;
    S.deploying = true; ctx.lock();
    net.send({ t: 'deploy' });
    setTimeout(() => { S.deploying = false; }, 1500);
  }
  function exit(toLobby, msg) {
    const was = S.active; S.active = false; S.phase = 'idle';
    try { if (net.open) net.send({ t: 'leave' }); } catch {}
    net.close();
    ui.hideWasted(); ui.showBoard(false); ui.scope(false); ui.countdown(null); ui.show(false);
    ctx.filter(''); document.body.classList.remove('dm-on', 'dm-dead');
    clearRemotes(); restoreStats(); mySkull.visible = false; ctx.me.userData.gear.set(false, false); ctx.me.rotation.z = 0;
    if (was) ctx.exit(msg);
  }
  function leave() { exit(true); }

  // ---------------- co klatkę ----------------
  function update(dt) {
    if (!S.active) return;
    const L = now();
    if (S.phase === 'connecting') return;
    if (S.phase === 'dead' && !S.deadReady && L - S.deadT >= S.minDeath) { S.deadReady = true; ui.wastedReady(true); }
    stepRemotes(dt);
    // własna fasolka: padanie po śmierci (widok z 3. osoby)
    if (player.dead) { S.fallK = Math.min(1, (S.fallK || 0) + dt * 3); ctx.me.rotation.z = S.fallK * (Math.PI / 2); } else S.fallK = 0;
    // HUD
    const w = ctx.curWeapon(), st = ctx.WEAPON_STATS[w.id];
    ui.setAmmo(w.mag, w.reserve, w.id, ctx.gunState(), w.mag <= Math.ceil(st.mag * 0.2), ctx.reloading());
    ui.setVitals(S.me.hp, 1 - (player.fatigue || 0), S.me.armor, S.me.armorMax, S.me.helmet);
    ui.setTimer(S.names.size, S.cfg.maxPlayers, S.me.kills, S.me.rank, S.total || S.names.size);
    ui.setProt(!player.dead && S.me.protUntil > L ? S.me.protUntil - L : 0);
    const scoped = !player.dead && !!st.scope && player.ads > 0.6 && S.phase === 'live'; ui.scope(scoped); S.scoped = scoped;
    // minimapa: widoczni przeciwnicy + WANTED (serwer podaje jego pozycję zawsze)
    const foes = []; for (const p of S.players.values()) if (p.root.visible && p.dying <= 0) foes.push({ id: p.id, x: p.root.position.x, z: p.root.position.z });
    let wp = null; if (S.wanted && S.wanted !== S.pid) { const p = S.players.get(S.wanted); wp = p && p.root.visible ? { id: p.id, x: p.root.position.x, z: p.root.position.z } : S.wantedPos && L - S.wantedPos.t < 1.5 ? S.wantedPos : null; }
    ui.drawMinimap({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }, foes, wp);
  }
  // paczka ruchu do serwera (20/s)
  function send(dt) {
    if (!S.active || !net.open || player.dead || S.phase !== 'live' || !S.me.life) return;
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
  function render() { return false; }
  function key(e, down) {
    if (!S.active) return false;
    // ekran śmierci: Spacja – odrodzenie, Esc – wyjście do lobby
    if (S.phase === 'dead' && (e.code === 'Space' || e.code === 'Escape')) {
      e.preventDefault();
      if (down && !e.repeat) { if (e.code === 'Space') deploy(); else exit(true); }
      return true;
    }
    if (down && e.code === 'KeyG' && S.phase === 'live' && !player.dead) { S.emote = { id: 1 + ((S.emoteN = (S.emoteN || 0) + 1) - 1) % 3, t0: now() }; return true; }
    if (e.code === 'Tab' && (S.phase === 'live' || S.phase === 'dead')) { e.preventDefault(); S.boardOpen = down; ui.showBoard(down, S.board, S.pid, S.wanted, nameOf, S.mapLabel); return true; }
    return false;
  }
  const hitMeshes = () => { const out = []; for (const p of S.players.values()) if (p.root.visible && p.dying <= 0) out.push(...p.meshes); return out; };
  addEventListener('fasolka:lang', () => ui.texts());

  return {
    join, cancel, leave, update, send, shot, render, key, hitMeshes, ui, postPose,
    reload() { if (S.active && S.phase === 'live') net.send({ t: 'rl' }); },
    get active() { return S.active; }, get phase() { return S.phase; }, get inMatch() { return S.active && (S.phase === 'live' || S.phase === 'dead'); },
    get frozen() { return S.active && S.phase !== 'live'; }, get scoped() { return !!S.scoped; }, get owned() { return S.me.owned; }, get cfg() { return S.cfg; },
    get tier() { return null; }, get overlay() { return S.phase === 'dead'; },   // ekran śmierci: kursor wolny (klik nie blokuje myszy)
  };
}
