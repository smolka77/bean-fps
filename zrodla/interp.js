// Obraz zdalnych graczy (Deathmatch i 1v1): bufor stanów z serwera, zegar serwera i interpolacja.
// Bez three.js – ten sam kod liczy obraz w grze i w narzędziu do pomiarów (narzedzia/siec-pomiar.mjs).
//
// Jak to działa:
//  - każdy stan gracza ma znacznik czasu serwera ts (chwila, w której gracz był w tym miejscu; serwer liczy go z zegara nadawcy,
//    więc nie ma w nim ani nierównego wysyłania, ani czekania na tick serwera),
//  - zegar serwera: najmniejsze (najszybsze) opóźnienie paczek, a obraz idzie własnym, płynnym zegarem, który tylko lekko
//    przyspiesza albo zwalnia (najwyżej ±12%), żeby dogonić zegar serwera – bez skoków przy nierównych paczkach,
//  - opóźnienie obrazu (bufor na jitter) dobiera się samo: tyle, ile trzeba, żeby kolejny stan prawie zawsze był już na miejscu
//    (zwykle 50–110 ms, przy dużym jitterze więcej, najwyżej 220 ms),
//  - gdy kolejny stan się spóźnia, ruch idzie dalej po ostatniej prędkości (najwyżej 150 ms), a po nadejściu stanu
//    różnica znika łagodnie w ~0,1 s zamiast przeskoku.

export const SEND_EVERY = 1 / 30;                 // paczka ruchu gracza do serwera (s) – 30/s
const EX_MAX = 0.15;                              // najdłuższa ekstrapolacja (s)
const GAP_CUT = 0.4;                              // przerwa w stanach dłuższa niż tyle (s) = nowe pojawienie się (bez przesuwania przez pół mapy)
const D_MIN = 0.05, D_MAX = 0.22;                 // granice opóźnienia obrazu (s)
const angLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

// układ wiersza stanu: indeksy pozycji [x, y, z], kątów (interpolacja po okręgu) i liczb interpolowanych liniowo
export const DM_ROW = { pos: [2, 3, 4], ang: [5, 11], lin: [6, 7, 8, 9, 10] };
export const DUEL_ROW = { pos: [0, 1, 2], ang: [3, 9], lin: [4, 5, 6, 7, 8] };

export function createView(row = DM_ROW, opt = {}) {
  const PCT = opt.pct || 0.9, DMAX = opt.dMax || D_MAX;
  const P = new Map();                            // id -> {buf: [{ts, v}], off: [dx,dy,dz], disp, prevDisp, ex, fresh}
  const V = { off: null, rt: null, D: 0.1, gaps: [], L: 0 };
  const [ix, iy, iz] = row.pos;
  const get = (id) => { let p = P.get(id); if (!p) { p = { buf: [], off: [0, 0, 0], disp: null, prevDisp: null, ex: 0, fresh: false }; P.set(id, p); } return p; };
  // zegar: T = czas serwera w chwili wysłania paczki, L = czas odbioru (lokalny)
  function clock(T, L) {
    const o = L - T;
    if (V.off == null || o < V.off) V.off = o;                     // szybsza paczka = lepsze oszacowanie
    else V.off += (o - V.off) * 0.003;                             // bardzo powolny powrót (zmiana trasy w sieci, dryf zegarów)
  }
  // nowy stan gracza id z chwili ts (czas serwera)
  function push(id, ts, v, L) {
    const p = get(id), b = p.buf, last = b[b.length - 1];
    if (last && ts <= last.ts + 1e-4) return;                       // ten sam stan jeszcze raz (serwer nie dostał nic nowego)
    if (!last) { p.disp = null; p.off = [0, 0, 0]; }               // bufor wyczyszczony (odrodzenie, śmierć) – bez domykania starej pozycji
    if (V.off != null && last) {                                    // jak „stary” był poprzedni stan, gdy przyszedł następny – z tego bufor
      V.gaps.push(L - V.off - last.ts); if (V.gaps.length > 90) V.gaps.shift();
    }
    if (last && ts - last.ts > GAP_CUT) { b.length = 0; p.disp = null; p.off = [0, 0, 0]; }   // pojawił się po przerwie – od nowa
    b.push({ ts, v }); if (b.length > 40) b.shift();
    p.fresh = true;
  }
  function reset(id) { const p = P.get(id); if (p) { p.buf.length = 0; p.disp = null; p.off = [0, 0, 0]; p.ex = 0; } }
  function drop(id) { P.delete(id); }
  // bufor stanów gracza to tablica z zewnątrz (gra czyści ją sama przy śmierci i odrodzeniu: buf.length = 0)
  function bind(id, arr) { get(id).buf = arr; }
  // raz na klatkę: zegar obrazu (L = czas lokalny w s)
  function frame(L) {
    const dt = V.L ? L - V.L : 0; V.L = L; if (V.off == null) return;
    // opóźnienie obrazu: ~95. percentyl „wieku” stanów przy nadejściu następnego + 8 ms zapasu
    if (V.gaps.length >= 8) {
      const s = V.gaps.slice().sort((a, b) => a - b), want = Math.min(DMAX, Math.max(D_MIN, s[Math.floor(s.length * PCT)] + 0.008));
      V.D += (want - V.D) * Math.min(1, dt * (want > V.D ? 2 : 0.3)); // szybciej w górę (spóźnione paczki), wolno w dół
    }
    const target = L - V.off - V.D;
    if (V.rt == null || Math.abs(target - V.rt) > 0.3 || !(dt > 0) || dt > 0.25) V.rt = target;
    else V.rt += dt * (1 + Math.max(-0.12, Math.min(0.12, (target - V.rt) * 3)));
  }
  // stan gracza id w chwili obrazu (null = brak stanów); zwraca kopię wiersza z polem __ex (ile s ekstrapolacji)
  function sampleRaw(p, rt) {
    const b = p.buf; if (!b.length) return null;
    if (rt <= b[0].ts) { const o = b[0].v.slice(); o.__ex = 0; return o; }
    let i = b.length - 1; while (i > 0 && b[i].ts > rt) i--;
    const A = b[i], B = b[i + 1];
    if (B) {
      const k = (rt - A.ts) / Math.max(1e-4, B.ts - A.ts), a = A.v, c = B.v, o = a.slice();
      for (const j of row.pos) o[j] = a[j] + (c[j] - a[j]) * k;
      for (const j of row.lin) o[j] = a[j] + (c[j] - a[j]) * k;
      for (const j of row.ang) o[j] = angLerp(a[j], c[j], k);
      o.__ex = 0; return o;
    }
    // za ostatnim stanem: dalej po ostatniej prędkości (najwyżej EX_MAX), potem stoi
    const o = A.v.slice(), Z = b[b.length - 2], ex = Math.min(EX_MAX, rt - A.ts); o.__ex = rt - A.ts;
    if (Z && A.ts - Z.ts < 0.25) {
      const dt = Math.max(0.02, A.ts - Z.ts); let vx = (A.v[ix] - Z.v[ix]) / dt, vz = (A.v[iz] - Z.v[iz]) / dt; const sp = Math.hypot(vx, vz);
      if (sp > 12) { vx *= 12 / sp; vz *= 12 / sp; }
      o[ix] += vx * ex; o[iz] += vz * ex;
    }
    return o;
  }
  // stan do pokazania (z łagodnym domykaniem różnicy po ekstrapolacji)
  function sample(id) {
    const p = P.get(id); if (!p || V.rt == null) return null;
    const raw = sampleRaw(p, V.rt); if (!raw) return null;
    const pos = [raw[ix], raw[iy], raw[iz]];
    if (p.disp && p.fresh && p.ex > 0.02) {
      // przyszedł stan po ekstrapolacji: obraz rusza z miejsca, gdzie był (plus ruch z ostatniej klatki), różnica wygasa
      const v = p.prevDisp ? [p.disp[0] - p.prevDisp[0], p.disp[1] - p.prevDisp[1], p.disp[2] - p.prevDisp[2]] : [0, 0, 0];
      const o = [p.disp[0] + v[0] - pos[0], p.disp[1] + v[1] - pos[1], p.disp[2] + v[2] - pos[2]];
      p.off = Math.hypot(o[0], o[1], o[2]) < 1.5 ? o : [0, 0, 0];
    }
    p.fresh = false; p.ex = raw.__ex;
    const k = p.lastL != null ? Math.exp(-Math.max(0, V.L - p.lastL) / 0.07) : 1; p.lastL = V.L;
    p.off[0] *= k; p.off[1] *= k; p.off[2] *= k;
    raw[ix] += p.off[0]; raw[iy] += p.off[1]; raw[iz] += p.off[2];
    p.prevDisp = p.disp; p.disp = [raw[ix], raw[iy], raw[iz]];
    return raw;
  }
  return {
    clock, push, reset, drop, bind, frame, sample,
    has: (id) => { const p = P.get(id); return !!(p && p.buf.length); },
    get renderT() { return V.rt; }, get delay() { return V.D; }, get offset() { return V.off; },
    // paczka Deathmatch {T, p: [[id, life, x, y, z, …, ts], …]} (stary serwer bez ts: czas paczki) – w narzędziu pomiarowym
    packet(m, L) { clock(m.T, L); for (const r of m.p) push(r[0], r.length > 14 ? r[14] : m.T, r, L); },
  };
}

// ---------------- stary obraz (jak dm.js przed zmianą) – tylko do porównań w narzędziu pomiarowym ----------------
export function createLegacyView() {
  const P = new Map(); let off = null, L0 = 0;
  return {
    packet(m, L) {
      const o = L - m.T; off = off == null ? o : o < off ? o : off + (o - off) * 0.01;
      for (const r of m.p) { let b = P.get(r[0]); if (!b) P.set(r[0], (b = [])); b.push({ T: m.T, v: r }); if (b.length > 24) b.shift(); }
    },
    frame(L) { L0 = L; },
    sample(id) {
      const b = P.get(id); if (!b || !b.length || off == null) return null;
      const rt = L0 - off - 0.1;
      if (rt <= b[0].T) return b[0].v;
      for (let i = b.length - 1; i >= 0; i--) if (b[i].T <= rt) {
        const A = b[i], B = b[i + 1]; if (!B) return A.v;
        const k = Math.min(1, (rt - A.T) / Math.max(1e-4, B.T - A.T)), o = A.v.slice();
        for (const j of [2, 3, 4]) o[j] = A.v[j] + (B.v[j] - A.v[j]) * k;
        return o;
      }
      return b[b.length - 1].v;
    },
  };
}
// nazwy algorytmów dla narzędzia pomiarowego
export const ALGOS = ['legacy', 'smooth'];
export const legacy = () => createLegacyView();
export const smooth = () => createView(DM_ROW);
// czas lokalny (s) – wspólny dla gry i paczek
export const nowS = () => performance.now() / 1000;
