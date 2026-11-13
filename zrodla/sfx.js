// Dźwięki broni i trafień generowane w przeglądarce (bez plików audio).
// Wystrzał składa się z warstw jak prawdziwe nagranie: trzask naddźwiękowy (fala N), podmuch gazów z "warknięciem",
// niskie uderzenie (punch), mechanika zamka i rolujący ogon, a do tego pogłos zależny od miejsca (otwarta przestrzeń / hala).
// Użycie: warmSfx() w wolnej chwili (opcjonalnie), potem const sfx = createSfx(AC, out); sfx.setEnv('indoor'|'outdoor'); sfx.shot('ak'); sfx.hit(kill, head); ...

const KINDS = {
  // trzask | podmuch: poziom, czas, filtr (start→koniec) | "warknięcie" (Hz, Q, poziom) | korpus (Hz, poziom) | uderzenie (Hz start→koniec, czas, poziom)
  ak:        { len: .95, crack: 1.0, crackDur: .0011, blast: 1.0, tau: .05, lp: [6500, 1100], bark: [1050, .8, .6], body: [330, .55],
               boom: [170, 72, .045, .8], drive: 2.2, mech: [[.030, .16], [.058, .10]], mechF: [2700, 4400, 6600],
               tail: .3, tailTau: .28, level: .98 },
  rifleSup:  { len: .62, crack: 0, blast: .6, tau: .022, lp: [3600, 900], bark: [800, .8, .45], body: [260, .45], puff: [1900, .8, .5, .03],
               boom: [140, 70, .035, .5], drive: 1.7, mech: [[.004, .42], [.030, .38], [.052, .16]], mechF: [2300, 3800, 5600],
               tail: .07, tailTau: .12, level: .66 },
  pistol:    { len: .72, crack: .95, crackDur: .0007, blast: .95, tau: .032, lp: [8000, 1600], bark: [1500, .9, .6], body: [430, .45],
               boom: [230, 95, .03, .62], drive: 2.0, mech: [[.016, .2], [.046, .16]], mechF: [3300, 5300, 7700],
               tail: .2, tailTau: .2, level: .9 },
  pistolSup: { len: .5, crack: 0, blast: .5, tau: .018, lp: [3000, 1000], bark: [1000, .8, .4], body: [330, .4], puff: [2300, .8, .45, .026],
               boom: [170, 90, .03, .4], drive: 1.6, mech: [[.004, .5], [.028, .45]], mechF: [2600, 4300, 6400],
               tail: .05, tailTau: .1, level: .58 },
};
const VARIANTS = 4;

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// filtr dwubiegunowy (RBJ) z możliwością zmiany częstotliwości w czasie
function biquad(type, sr) {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (f, Q) => {
    const w = 2 * Math.PI * Math.min(f, sr * .45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q), a0 = 1 + al;
    if (type === 'lp') { b0 = (1 - c) / 2 / a0; b1 = (1 - c) / a0; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2 / a0; b1 = -(1 + c) / a0; b2 = b0; }
    else { b0 = al / a0; b1 = 0; b2 = -al / a0; }                                  // pasmowy (szczyt 0 dB)
    a1 = -2 * c / a0; a2 = (1 - al) / a0;
  };
  const run = x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  return { set, run };
}
const sat = (x, d) => Math.tanh(x * d) / Math.tanh(d);

// ---------- bank buforów: renderowany raz na stronę – w tle (warmSfx) albo przy pierwszym użyciu ----------
let BANK = null;
function makeBank(SR) {
  const buf = (L, Rr) => { let b; try { b = new AudioBuffer({ numberOfChannels: 2, length: L.length, sampleRate: SR }); } catch { b = new OfflineAudioContext(2, 1, SR).createBuffer(2, L.length, SR); }
    b.copyToChannel(L, 0); b.copyToChannel(Rr || L, 1); return b; };
  const normalize = (L, Rr, level) => { let pk = 1e-6; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i])); const k = level / pk; for (let i = 0; i < L.length; i++) { L[i] *= k; Rr[i] *= k; } };

  // ---------- wystrzał ----------
  function renderGun(p, seed) {
    const n = Math.floor(p.len * SR), L = new Float32Array(n), Rr = new Float32Array(n), r = rng(seed);
    const jit = (v, a) => v * (1 + (r() * 2 - 1) * a);
    const tau = jit(p.tau, .08), lp0 = jit(p.lp[0], .1), lp1 = jit(p.lp[1], .1);
    const fL = biquad('lp', SR), fR = biquad('lp', SR), bk = biquad('bp', SR), bkR = biquad('bp', SR), bd = biquad('bp', SR), bdR = biquad('bp', SR), hp = biquad('hp', SR), hpR = biquad('hp', SR);
    const fb = jit(p.bark[0], .06), fd = jit(p.body[0], .06);
    bk.set(fb, p.bark[1]); bkR.set(fb, p.bark[1]); bd.set(fd, 1); bdR.set(fd, 1); hp.set(60, .7); hpR.set(60, .7);
    const [b0, b1, bDur, bAmp] = p.boom, f0 = jit(b0, .06);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      if (!(i & 15)) { const f = lp1 + (lp0 - lp1) * Math.exp(-t / (tau * 1.4)); fL.set(f, .7); fR.set(f, .7); }
      // podmuch gazów: szum częściowo wspólny (środek), częściowo osobny na kanał (szerokość)
      const env = (t < .0004 ? t / .0004 : 1) * (Math.exp(-t / tau) * .82 + Math.exp(-t / (tau * 3.2)) * .18);
      const nc = r() * 2 - 1, nl = nc * .75 + (r() * 2 - 1) * .25, nr = nc * .75 + (r() * 2 - 1) * .25;
      // podmuch: szeroki szum + "warknięcie" (pasmo średnie) + korpus; przester tylko na podmuchu
      const l = sat((fL.run(nl) * .55 + bk.run(nl) * p.bark[2] * 5 + bd.run(nl) * p.body[1] * 6.5) * env * p.blast * 1.4, p.drive);
      const rr = sat((fR.run(nr) * .55 + bkR.run(nr) * p.bark[2] * 5 + bdR.run(nr) * p.body[1] * 6.5) * env * p.blast * 1.4, p.drive);
      // niskie uderzenie: sinus z opadającą częstotliwością
      const f = b1 + (f0 - b1) * Math.exp(-t / (bDur * .35)); ph += 2 * Math.PI * f / SR;
      const boom = Math.sin(ph) * (t < .001 ? t / .001 : 1) * Math.exp(-t / bDur) * bAmp;
      const bm = sat(boom, 1.4);
      L[i] = hp.run(l + bm); Rr[i] = hpR.run(rr + bm);
    }
    // trzask naddźwiękowy (fala N) + ostre kliknięcie
    if (p.crack) {
      const d = Math.max(4, Math.floor(p.crackDur * SR));
      for (let i = 0; i < d * 6 && i < n; i++) {
        const t = i / d; let v = t < 1 ? 1 - 2 * t : 0;
        v += (r() * 2 - 1) * Math.exp(-i / (SR * .0005)) * .7;
        L[i] += v * p.crack * 1.15; Rr[i] += v * p.crack * 1.15;
      }
    }
    // wydmuch gazów przez tłumik ("pfft")
    if (p.puff) {
      const [pf, pq, pa, pt] = p.puff, bp = biquad('bp', SR); bp.set(jit(pf, .08), pq);
      for (let i = 0; i < n; i++) { const t = i / SR; if (t > pt * 7) break; const e = (t < .002 ? t / .002 : 1) * Math.exp(-t / pt); const v = bp.run(r() * 2 - 1) * e * pa * 2.4; L[i] += v; Rr[i] += v * .92; }
    }
    // mechanika zamka: metaliczne rezonanse
    for (const [t0, a] of p.mech) {
      const s0 = Math.floor(jit(t0, .12) * SR), modes = p.mechF.map(f => [jit(f, .05), .012 + r() * .016, .5 + r() * .5]);
      const cl = biquad('bp', SR); cl.set(4200, 1.4);
      for (let i = 0; i < SR * .09 && s0 + i < n; i++) {
        const t = i / SR; let v = cl.run(r() * 2 - 1) * Math.exp(-t / .0025) * 1.6;
        for (const [f, d, g] of modes) v += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / d) * g * .5;
        L[s0 + i] += v * a; Rr[s0 + i] += v * a * (.85 + r() * .3);
      }
    }
    // rolujący ogon (echo gazów i otoczenia)
    if (p.tail) {
      let yl = 0, yr = 0; const a = 1 - Math.exp(-2 * Math.PI * 900 / SR);
      for (let i = 0; i < n; i++) {
        const t = i / SR, e = Math.min(1, t / .02) * Math.exp(-t / p.tailTau) * p.tail * (1 + .35 * Math.sin(t * 37 + seed));
        yl += a * ((r() * 2 - 1) - yl); yr += a * ((r() * 2 - 1) - yr);
        L[i] += yl * e * 2.2; Rr[i] += yr * e * 2.2;
      }
    }
    // wygaszenie końcówki i normalizacja
    const fade = Math.floor(SR * .04); for (let i = 0; i < fade; i++) { const k = i / fade; L[n - 1 - i] *= k; Rr[n - 1 - i] *= k; }
    normalize(L, Rr, p.level);
    return buf(L, Rr);
  }
  // zadania: najpierw po jednym wariancie każdej broni, pogłosy i trafienia (core), potem reszta wariantów (extra)
  const B = { GUN: {}, IR: {} }, core = [], extra = [];
  for (const k in KINDS) { B.GUN[k] = []; for (let v = 0; v < VARIANTS; v++) (v ? extra : core).push(() => B.GUN[k].push(renderGun(KINDS[k], 101 + v * 977 + k.length * 13))); }

  // ---------- pogłos (odpowiedź impulsowa) ----------
  function makeIR(kind) {
    const indoor = kind === 'indoor', len = indoor ? 1.5 : 1.3, n = Math.floor(len * SR), r = rng(indoor ? 11 : 23), ch = [];
    for (let c = 0; c < 2; c++) {
      const d = new Float32Array(n); let y = 0;
      const tau = indoor ? .17 : .11;
      for (let i = 0; i < n; i++) {
        const t = i / SR, a = indoor ? .55 * Math.exp(-t / .5) + .08 : .3 * Math.exp(-t / .3) + .05;   // im dalej, tym ciemniej
        y += a * ((r() * 2 - 1) - y);
        d[i] = y * Math.exp(-t / tau) * (indoor ? 1 : .5) * Math.min(1, t / .004);
      }
      // wczesne odbicia: hala – gęste; plener – kilka wyraźnych odbić od budynków
      const taps = indoor ? Array.from({ length: 14 }, (_, k) => [.006 + k * .0045 + r() * .004, .55 * Math.exp(-k / 6)])
                          : [[.075 + r() * .01, .5], [.16 + r() * .02, .32], [.29 + r() * .03, .2], [.45 + r() * .03, .1]];
      for (const [tt, g] of taps) { const s0 = Math.floor(tt * SR); let yy = 0; for (let i = 0; i < SR * .03 && s0 + i < n; i++) { yy += .35 * ((r() * 2 - 1) - yy); d[s0 + i] += yy * g * Math.exp(-i / (SR * .006)) * (c ? .9 : 1.1); } }
      ch.push(d);
    }
    return buf(ch[0], ch[1]);
  }
  core.push(() => { B.IR.outdoor = makeIR('outdoor'); }, () => { B.IR.indoor = makeIR('indoor'); });

  // ---------- trafienia ----------
  function render(len, fn, level) {
    const n = Math.floor(len * SR), L = new Float32Array(n), Rr = new Float32Array(n); fn(L, Rr, n);
    const fade = Math.floor(SR * .01); for (let i = 0; i < fade; i++) { const k = i / fade; L[n - 1 - i] *= k; Rr[n - 1 - i] *= k; }
    normalize(L, Rr, level); return buf(L, Rr);
  }
  const addSine = (L, Rr, f, t0, tau, a, f2 = 0, sweep = 0) => { const s0 = Math.floor(t0 * SR); let ph = 0;
    for (let i = 0; s0 + i < L.length; i++) { const t = i / SR, e = Math.exp(-t / tau); if (e < .0005) break; const ff = f2 ? f2 + (f - f2) * Math.exp(-t / sweep) : f; ph += 2 * Math.PI * ff / SR; const v = Math.sin(ph) * e * a * Math.min(1, t / .0008); L[s0 + i] += v; Rr[s0 + i] += v; } };
  const addNoise = (L, Rr, type, f, q, t0, tau, a, seed) => { const s0 = Math.floor(t0 * SR), fl = biquad(type, SR), r = rng(seed); fl.set(f, q);
    for (let i = 0; s0 + i < L.length; i++) { const t = i / SR, e = Math.exp(-t / tau); if (e < .0005) break; const v = fl.run(r() * 2 - 1) * e * a; L[s0 + i] += v; Rr[s0 + i] += v; } };
  const sq = (L, Rr, d) => { for (let i = 0; i < L.length; i++) { L[i] = sat(L[i], d); Rr[i] = sat(Rr[i], d); } };
  // trafienie w ciało: wyraźny suchy "tk" (słychać też na głośnikach laptopa) + krótki klaps + metaliczny błysk
  const mkHIT = () => Array.from({ length: 3 }, (_, v) => render(.18, (L, Rr) => {
    addNoise(L, Rr, 'hp', 2800, .8, 0, .0032, 1.5, 40 + v);
    addNoise(L, Rr, 'bp', 1800 + v * 120, 1.2, 0, .007, 1.1, 50 + v);
    addSine(L, Rr, 200 + v * 12, 0, .02, .45, 120, .012);
    addNoise(L, Rr, 'bp', 700, 1, .001, .012, .45, 60 + v);
    sq(L, Rr, 1.6);
    addSine(L, Rr, 3150 + v * 60, .002, .04, .32); addSine(L, Rr, 4720 + v * 80, .002, .026, .2);
  }, .8));
  // trafienie w głowę: metaliczny "dink" (nieharmoniczne alikwoty jak w hełmie)
  const mkHEAD = () => Array.from({ length: 2 }, (_, v) => render(.55, (L, Rr) => {
    const base = 2050 + v * 80;
    addNoise(L, Rr, 'hp', 4500, .8, 0, .0015, 1.2, 80 + v);
    [[1, 1, .34], [1.594, .62, .24], [2.36, .46, .16], [3.27, .28, .1], [4.4, .16, .06]].forEach(([m, a, tau]) => addSine(L, Rr, base * m, 0, tau, a * .55));
    addNoise(L, Rr, 'bp', 1600, 1.2, 0, .008, .6, 85 + v);
  }, .82));
  // zabójstwo: krótkie "thunk" + wyraźne dwutonowe potwierdzenie
  const mkKILL = () => render(.75, (L, Rr) => {
    addSine(L, Rr, 150, 0, .05, .6, 70, .03); addNoise(L, Rr, 'bp', 600, .9, 0, .025, .7, 91); addNoise(L, Rr, 'hp', 2500, .8, 0, .003, .8, 92); sq(L, Rr, 1.8);
    for (const [f, t0] of [[987.77, .04], [1479.98, .13]]) { addSine(L, Rr, f, t0, .28, .6); addSine(L, Rr, f * 2, t0, .15, .22); addSine(L, Rr, f * 3.01, t0, .07, .1); }
  }, .85);
  // otrzymane obrażenia: tępe uderzenie z pasmem średnim
  const mkHURT = () => render(.3, (L, Rr) => { addSine(L, Rr, 140, 0, .045, .65, 70, .04); addNoise(L, Rr, 'bp', 500, .8, 0, .06, 1.6, 17); addNoise(L, Rr, 'lp', 1800, .7, 0, .015, .4, 18); sq(L, Rr, 2.2); }, .72);
  // kula w ścianę / skrzynię: ostry trzask + krótki stuk
  const mkIMPACT = () => Array.from({ length: 3 }, (_, v) => render(.16, (L, Rr) => {
    addNoise(L, Rr, 'bp', 2600 + v * 500, .9, 0, .006, 1.4, 120 + v); addNoise(L, Rr, 'hp', 4000, .7, 0, .002, .8, 125 + v);
    addSine(L, Rr, 380 - v * 30, 0, .014, .45, 190, .012); addNoise(L, Rr, 'lp', 3000, .7, .004, .025, .3, 130 + v); sq(L, Rr, 1.5);
  }, .5));
  // pusty magazynek
  const mkDRY = () => render(.12, (L, Rr) => { addNoise(L, Rr, 'hp', 3000, .8, 0, .0015, 1, 150); addSine(L, Rr, 3600, 0, .009, .4); addSine(L, Rr, 5400, 0, .006, .25); addSine(L, Rr, 2900, .028, .008, .3); }, .45);

  core.push(() => { B.HIT = mkHIT(); B.HEAD = mkHEAD(); B.KILL = mkKILL(); }, () => { B.HURT = mkHURT(); B.IMPACT = mkIMPACT(); B.DRY = mkDRY(); });
  B.step = () => { const j = core.shift() || extra.shift(); if (j) j(); return core.length + extra.length > 0; };
  B.ensureCore = () => { while (core.length) core.shift()(); };
  return B;
}
let warming = false;
// Renderuje dźwięki w tle, w wolnych chwilach przeglądarki (np. w lobby), żeby start gry nie przycinał.
export function warmSfx(sr = 48000) {
  if (!BANK) BANK = makeBank(sr); if (warming) return; warming = true;
  const idle = typeof requestIdleCallback === 'function' ? cb => requestIdleCallback(cb, { timeout: 400 }) : cb => setTimeout(cb, 30);
  const tick = () => { if (BANK.step()) idle(tick); else warming = false; };
  idle(tick);
}

export function createSfx(AC, out) {
  if (!BANK) BANK = makeBank(AC.sampleRate);
  BANK.ensureCore(); warmSfx();
  const { GUN, IR, HIT, HEAD, KILL, HURT, IMPACT, DRY } = BANK, R = rng(7331);
  // ---------- odtwarzanie ----------
  const bus = AC.createGain(); bus.connect(out);
  const verb = AC.createConvolver(), wet = AC.createGain(), send = AC.createGain(); verb.connect(wet); wet.connect(out); send.connect(verb);
  let env = '';
  function setEnv(e) { if (e === env || !IR[e]) return; env = e; verb.buffer = IR[e]; wet.gain.value = e === 'indoor' ? .42 : .26; }
  setEnv('outdoor');
  function play(b, { gain = 1, rate = 1, send: sg = 0, lp = 0, at = 0 } = {}) {
    const s = AC.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    let node = s; if (lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = .5; s.connect(f); node = f; }
    const g = AC.createGain(); g.gain.value = gain; node.connect(g); g.connect(bus);
    if (sg) { const w = AC.createGain(); w.gain.value = sg; g.connect(w); w.connect(send); }
    s.start(AC.currentTime + at);
  }
  const pick = a => a[Math.floor(R() * a.length)];
  const SUP = { rifleSup: 1, pistolSup: 1 };
  return {
    setEnv,
    shot(kind) { const a = GUN[kind] || GUN.ak; play(pick(a), { gain: .9 + R() * .12, rate: .97 + R() * .06, send: SUP[kind] ? .45 : 1 }); },
    far(kind = 'ak', dist = 20) { const a = GUN[kind] || GUN.ak, k = Math.max(.25, Math.min(1, 14 / Math.max(1, dist)));
      play(pick(a), { gain: .5 * k + .1, rate: .94 + R() * .05, lp: 900 + 2600 * k, send: 1.5 }); },
    hit(kill, head) { if (head) play(pick(HEAD), { gain: .85 }); else play(pick(HIT), { gain: .8, rate: .97 + R() * .06 }); if (kill) play(KILL, { gain: .85, at: head ? .05 : .03 }); },
    hurt() { play(HURT, { gain: .8, rate: .95 + R() * .1 }); },
    impact(dist = 10) { play(pick(IMPACT), { gain: Math.max(.15, Math.min(.6, 6 / Math.max(1, dist))), rate: .9 + R() * .2, lp: dist > 25 ? 2500 : 0, send: .4 }); },
    dry() { play(DRY, { gain: .7 }); },
    buffers: { GUN, HIT, HEAD, KILL, HURT, IMPACT, DRY, IR },          // do testów / podglądu
  };
}
