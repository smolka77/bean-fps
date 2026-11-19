// Boty w lobby Deathmatch: zapełniają stałe lobby, gdy jest w nim mało prawdziwych graczy.
// Bot to zwykły gracz w pokoju dm.mjs (te same zasady: ruch sprawdzany fizyką serwera, strzały z rozrzutem, drabinka broni),
// tylko zamiast przeglądarki steruje nim ten moduł – wysyła te same wiadomości co gra ('st', 'sh', 'rl', 'deploy').
// Bot widzi tylko tych przeciwników, których serwer uznał za widocznych dla niego (ta sama widoczność co u graczy – bez wallhacka).
// Moduł nie zna WebSocketu ani bazy: serwer.mjs woła createBot / botMessage / botStep.
import * as MECZ from './mecz.mjs';
import * as DM from './dm.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NICKS = ['Rico', 'Vercetti', 'Sonny', 'Lance', 'Kenji', 'Cortez', 'Diaz', 'Mercedes', 'Phil', 'Umberto', 'Candy', 'Avery', 'Hilary', 'Kent', 'Maude',
  'Tito', 'Marco', 'Benny', 'Zero', 'Kowal', 'Szczur', 'Bandzior', 'Mrozik', 'Kaktus', 'Rambo', 'Szeryf', 'Lis', 'Wilk', 'Grizzly', 'Joker', 'Cobra', 'Viper',
  'Ghost', 'Bullet', 'Razor', 'Tank', 'Sniper', 'Hitman', 'Bandit', 'Outlaw', 'Maverick', 'Ace', 'Dex', 'Nitro', 'Turbo', 'Blaze', 'Rocky', 'Shadow'];
// skiny botów: tylko postacie GTA z kreatora skinów (skins.json obok gry, ten sam plik, który czyta lobby) – w pliku są też memy (Pepe, Trump…),
// których boty nie biorą. Nową postać GTA dla botów dopisuje się do GTA_SKINS (id z kreatora). Plik czytany najwyżej raz na minutę.
const SKINS_FILE = path.join(process.env.GAME_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), 'skins.json');
const GTA_SKINS = ['nowy-skin-8', 'jason-duval', 'lucia', 'michael-de-santa', 'tommy', 'niko-bellic', 'b-i-g-s-m-o-k-e', 'trevor'];   // CJ, Jason, Lucia, Michael, Tommy, Niko, Big Smoke, Trevor
const GTA = new Set(GTA_SKINS), FALLBACK = GTA_SKINS;
let gta = null, gtaT = 0;
function gtaSkins() {
  const now = Date.now(); if (gta && now - gtaT < 60000) return gta; gtaT = now;
  try { const ids = JSON.parse(fs.readFileSync(SKINS_FILE, 'utf8')).filter((s) => s && s.id && s.tex && GTA.has(s.id)).map((s) => s.id); gta = ids.length ? ids : FALLBACK; }
  catch { gta = gta || FALLBACK; }
  return gta;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const angTo = (dx, dz) => Math.atan2(-dx, -dz);                 // kąt patrzenia (yaw) w stronę wektora (dx, dz) – jak w grze

// nick bota: z listy, bez powtórek w pokoju; czasem z cyframi, żeby wyglądał jak nick gracza
export function botNick(taken) {
  for (let i = 0; i < 40; i++) {
    const base = NICKS[(Math.random() * NICKS.length) | 0], n = Math.random() < 0.55 ? base + ((Math.random() * 99) | 0) : base;
    if (!taken.has(n.toLowerCase())) return n;
  }
  return 'Gracz' + ((Math.random() * 9000 + 1000) | 0);
}
// skin dla nowego bota: najrzadziej używana w pokoju postać GTA (różne postacie zamiast kilku takich samych)
export function botSkin(used = []) {
  const list = gtaSkins(), n = new Map(list.map((id) => [id, 0])); for (const u of used) if (n.has(u)) n.set(u, n.get(u) + 1);
  const min = Math.min(...n.values()), pool = list.filter((id) => n.get(id) === min);
  return pool[(Math.random() * pool.length) | 0];
}

// skill 0–1 (z ustawień): czas reakcji, celność, szybkość obrotu, częstość strzałów w głowę
export function createBot(pid, skill) {
  const s = clamp(skill + rnd(-0.12, 0.12), 0, 1);                // każdy bot trochę inny
  return { pid, skill: s, q: 0, deployAt: 0, goal: null, goalT: 0, path: null, pi: 0, dir: Math.random() * 6.28, yaw: 0, pitch: 0, legYaw: 0, legDir: 1, run: 0,
    tgt: 0, seenAt: 0, err: [0, 0], aimHead: false, nextShot: 0, burst: 0, strafe: 1, strafeT: 0, hurtFrom: null, hurtT: 0, stuck: 0, lastLife: -1,
    react: 0.75 - s * 0.5,                                          // s do pierwszego strzału po zobaczeniu przeciwnika
    jit: 0.05 - s * 0.038,                                          // losowy błąd celowania na strzał (rad)
    turn: 4 + s * 8 };                                              // obrót (rad/s)
}

// wiadomości, które serwer wysłałby graczowi – bot reaguje tylko na kilka
export function botMessage(b, m, now, cfg) {
  if (m.t === 'dead') b.deployAt = now + (m.minDeath || cfg.minDeathTime) + rnd(0.6, 2.2);          // jak Spacja na ekranie śmierci
  else if (m.t === 'fix') { b.dir += Math.PI * rnd(0.6, 1.4); b.goal = null; b.path = null; }
  else if (m.t === 'dmg' && Array.isArray(m.from)) { b.hurtFrom = m.from; b.hurtT = now; }
}

// waypointy do chodzenia po mapie: punkty odrodzenia (osiągalne miejsca na podłodze)
function pickGoal(game, b, p) {
  const pts = DM.navPoints(game.map); if (!pts.length) return null;
  for (let i = 0; i < 6; i++) { const c = pts[(Math.random() * pts.length) | 0]; if (Math.hypot(c[0] - p.x, c[1] - p.z) > 8) return c; }
  return pts[(Math.random() * pts.length) | 0];
}

function setGoal(game, b, p, goal, now) {
  b.goal = goal; b.goalT = now; b.pi = 0;
  b.path = goal ? DM.navPath(game.map, p.x, p.z, goal[0], goal[1]) : null;
  if (b.path && !b.path.length) b.path = null;
  if (b.path) b.goal = b.path[b.path.length - 1];                   // cel na podłodze (np. strzelec stał na flybridge albo przy relingu)
}

// próba ruchu w kierunku dir: wysokość z podłogi (stopnie w górę do ~0,6 m, zejścia w dół), ta sama kontrola co u graczy
function tryMove(game, p, dir, sp, dt, now) {
  const nx = p.x - Math.sin(dir) * sp * dt, nz = p.z - Math.cos(dir) * sp * dt;
  const ny = MECZ.supportTop(game.map, nx, nz, p.y + 0.45);
  const s = { x: nx, y: ny, z: nz };
  if (MECZ.checkMove({ map: game.map }, p, s, now)) return null;
  if (MECZ.insideSolid(game.map, nx, ny, nz)) return null;
  const clip = MECZ.inClip(game.map, nx, ny, nz);                   // niewidzialne blokady (relingi nad wodą) – jak u gracza w przeglądarce
  if (clip && clip !== MECZ.inClip(game.map, p.x, p.y, p.z)) return null;
  // ciało (promień 0,3 m) nie wchodzi w nową bryłę – bez tego bot przeciskał się przez szczeliny między wąskimi bryłami
  const was = new Set(MECZ.bodyHits(game.map, p.x, p.y, p.z));
  if (MECZ.bodyHits(game.map, nx, ny, nz).some((b) => !was.has(b))) return null;
  return s;
}

// jeden krok bota (co tick serwera, 20/s): wybór celu, ruch, celowanie, strzał. send(m) = wiadomość jak od przeglądarki
export function botStep(game, b, now, dt, send) {
  const p = game.p.get(b.pid); if (!p || p.left) return;
  if (!p.alive) { if (p.dead && b.deployAt && now >= b.deployAt) { b.deployAt = 0; send({ t: 'deploy' }); } return; }
  if (p.life !== b.lastLife) { b.lastLife = p.life; b.yaw = p.yaw; b.dir = p.yaw; b.goal = null; b.path = null; b.tgt = 0; b.hurtFrom = null; }
  const cfg = game.cfg, gun = DM.DM_GUNS[p.level] || DM.PISTOL, W = cfg.weapons[gun];

  // cel: najbliższy przeciwnik, którego serwer pokazuje temu botowi
  let tgt = null, best = 1e9;
  for (const [tid, c] of p.sent) {
    if (!c.vis) continue; const t = game.p.get(tid); if (!t || !t.alive || t.left) continue;
    const d = Math.hypot(t.x - p.x, t.z - p.z) - (t.pid === b.tgt ? 4 : 0);   // trzyma się obecnego celu
    if (d < best) { best = d; tgt = t; }
  }
  if (tgt && tgt.pid !== b.tgt) {                                   // nowy przeciwnik: czas reakcji i początkowy błąd celowania
    b.tgt = tgt.pid; b.seenAt = now; const e = 0.06 + (1 - b.skill) * 0.16;
    b.err = [rnd(-e, e), rnd(-e * 0.5, e * 0.5)]; b.aimHead = Math.random() < 0.12 + b.skill * 0.35;
  } else if (!tgt) b.tgt = 0;
  const dist = tgt ? Math.hypot(tgt.x - p.x, tgt.z - p.z) : 0;

  // ---- ruch ----
  let want, sp;
  if (tgt) {
    const toT = angTo(tgt.x - p.x, tgt.z - p.z), pref = gun === 'spas12' ? 5 : gun === 'glock17' || gun === 'deagle' ? 14 : 18;
    b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = rnd(0.5, 1.6); b.strafe = Math.random() < 0.5 ? -1 : 1; }
    const approach = clamp((dist - pref) / 8, -1, 1);                // >0: bliżej, <0: dalej
    want = toT + b.strafe * (Math.PI / 2) * (1 - Math.abs(approach) * 0.6) + (approach < 0 ? Math.PI * -approach * 0.5 * b.strafe : 0);
    sp = dist < 4 ? 3.0 : 3.4;
  } else {
    if (b.hurtFrom && now - b.hurtT < 2.5) { setGoal(game, b, p, [b.hurtFrom[0], b.hurtFrom[1]], now); b.hurtFrom = null; }   // ktoś strzela – idzie sprawdzić
    if (!b.goal || Math.hypot(b.goal[0] - p.x, b.goal[1] - p.z) < 1.5 || now - b.goalT > 14) setGoal(game, b, p, pickGoal(game, b, p), now);
    // idzie drogą po siatce podłogi (punkt po punkcie), a bez drogi – prosto do celu
    let wp = b.goal;
    if (b.path) {
      while (b.pi < b.path.length - 1 && Math.hypot(b.path[b.pi][0] - p.x, b.path[b.pi][1] - p.z) < 0.7) b.pi++;
      wp = b.path[b.pi];
    }
    want = wp ? angTo(wp[0] - p.x, wp[1] - p.z) : b.dir;
    sp = 4.8;
  }
  // płynny skręt w stronę żądanego kierunku; jak ściana – szuka obejścia (±45°, ±90°, ±135°)
  b.dir += clamp(wrap(want - b.dir), -6 * dt, 6 * dt);
  let mv = null;
  for (const off of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4]) {
    const d = b.dir + off * (b.strafe || 1); mv = tryMove(game, p, d, sp, dt, now);
    if (mv) { if (off) { b.dir = d; b.stuck++; } else b.stuck = 0; break; }
  }
  if (!mv) { mv = { x: p.x, y: p.y, z: p.z }; sp = 0; b.stuck += 3; }
  if (b.stuck > 40) { b.goal = null; b.path = null; b.stuck = 0; b.strafe = -b.strafe; }

  // ---- patrzenie: na cel (z ograniczoną szybkością obrotu) albo w stronę ruchu ----
  const eye = MECZ.EYE(p);
  let aimYaw = b.dir, aimPitch = 0, aimDist = 0;
  if (tgt) {
    const st = MECZ.stateAt(tgt, now - 0.1);                        // tam, gdzie serwer cofnie przeciwnika przy sprawdzaniu trafienia
    const hy = st.y + (b.aimHead ? 1.45 : 1.0) - MECZ.CROUCH_DROP * (st.cr || 0);
    const dx = st.x - p.x, dz = st.z - p.z; aimDist = Math.hypot(dx, dz);
    aimYaw = angTo(dx, dz); aimPitch = Math.atan2(hy - eye, aimDist);
    const k = Math.exp(-dt * (1.2 + b.skill * 2.5)); b.err[0] *= k; b.err[1] *= k;   // błąd maleje, im dłużej celuje
  } else if (b.hurtFrom) aimYaw = angTo(b.hurtFrom[0] - p.x, b.hurtFrom[1] - p.z);
  const tYaw = aimYaw + (tgt ? b.err[0] : 0), tPitch = aimPitch + (tgt ? b.err[1] : 0);
  b.yaw = wrap(b.yaw + clamp(wrap(tYaw - b.yaw), -b.turn * dt, b.turn * dt));
  b.pitch += clamp(tPitch - b.pitch, -b.turn * dt, b.turn * dt);

  // nogi i animacja biegu jak w grze (kierunek ruchu względem patrzenia)
  b.run += (Math.min(1, sp / 6.8) - b.run) * Math.min(1, dt * 9);
  if (sp > 0.35) {
    const vx = -Math.sin(b.dir), vz = -Math.cos(b.dir), fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    const a = Math.atan2(vx * rx + vz * rz, vx * fx + vz * fz), ab = Math.abs(a);
    if (b.legDir > 0 && ab > 2.0) b.legDir = -1; else if (b.legDir < 0 && ab < 1.75) b.legDir = 1;
    const leg = b.legDir > 0 ? a : wrap(a - Math.PI);
    b.legYaw += (clamp(leg, -1.6, 1.6) * 0.8 - b.legYaw) * Math.min(1, dt * 10);
  } else b.legYaw *= 1 - Math.min(1, dt * 6);

  // broń: z drabinki; bez amunicji – pistolet
  let wid = DM.WIDS.indexOf(gun); const am = p.ammo[gun];
  if (am && am.mag <= 0 && am.res <= 0) wid = DM.WIDS.indexOf(DM.PISTOL);
  const st = [mv.x, mv.y, mv.z, b.yaw, b.pitch, 0, b.run, 0, 0, b.legYaw, wid, 0, p.life, 0].map((v) => Math.round(v * 1000) / 1000);
  send({ t: 'st', s: st });

  // ---- strzał ----
  const curId = DM.WIDS[p.w], CW = cfg.weapons[curId] || W, a = p.ammo[curId];
  if (!a || !CW) return;
  if (a.mag <= 0 && p.reloadW < 0) { if (a.res > 0) send({ t: 'rl' }); return; }
  if (!tgt && a.mag < CW.mag * 0.4 && a.res > 0 && p.reloadW < 0) { send({ t: 'rl' }); return; }
  const range = curId === 'spas12' ? 24 : curId === 'glock17' || curId === 'deagle' ? 50 : 75;
  if (!tgt || now - b.seenAt < b.react || aimDist > range || now < b.nextShot || p.reloadW >= 0) return;
  if (Math.abs(wrap(aimYaw - b.yaw)) > 0.12 + 0.6 / Math.max(2, aimDist)) return;   // jeszcze się obraca
  const j = () => rnd(-b.jit, b.jit), yaw = b.yaw + j(), pitch = b.pitch + j();
  const d = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  send({ t: 'sh', o: [p.x, eye, p.z], d, q: ++b.q });
  let gap = 60 / CW.rpm + 0.01;
  if (!CW.auto) gap += rnd(0.08, 0.32) * (1.3 - b.skill);         // pistolety i strzelba: klikanie
  else if (++b.burst >= 3 + ((Math.random() * 6) | 0)) { b.burst = 0; gap += rnd(0.2, 0.5); }   // seria i krótka przerwa (rozrzut opada)
  b.nextShot = now + gap;
}
