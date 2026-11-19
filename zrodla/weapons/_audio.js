// Dźwięki broni z biblioteki gry (próbki MP3 w base64 → AudioBuffer, dekodowane raz na AudioContext).
// Pliki <id>-snd.js generuje narzedzia/assety/przygotuj-bronie.mjs (lista plików źródłowych: SOUNDS w tym skrypcie).
// Klucze: shot (strzał), far (strzał z daleka), draw (wyjęcie), magOut / magIn / magHit (magazynek),
// bolt / boltFwd (zamek do tyłu / do przodu), pump (pompka), shell (nabój do rury); wspólne: dryPistol / dryRifle.
import akm from './akm-snd.js';
import m4a1 from './m4a1-snd.js';
import glock17 from './glock17-snd.js';
import deagle from './deagle-snd.js';
import spas12 from './spas12-snd.js';
import mp5k from './mp5k-snd.js';
import common from './_wspolne-snd.js';

const DATA = { akm, m4a1, glock17, deagle, spas12, mp5k, common };
const banks = new WeakMap();
const bytes = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
// starsze Safari znają tylko wersję z callbackami
const decode = (AC, ab) => new Promise((res, rej) => { try { const p = AC.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } });

export function weaponAudio(AC) {
  let B = banks.get(AC); if (B) return B;
  const buf = {}, jobs = [], last = {};
  for (const id in DATA) {
    buf[id] = {};
    for (const key in DATA[id]) {
      const list = buf[id][key] = [];
      DATA[id][key].forEach((b64, i) => jobs.push(decode(AC, bytes(b64)).then((ab) => { list[i] = ab; }, () => {})));
    }
  }
  B = {
    ready: Promise.all(jobs),
    has: (id, key) => !!(buf[id] && buf[id][key] && buf[id][key].some(Boolean)),
    // losowy wariant (nie ten sam dwa razy z rzędu); lp = filtr dolnoprzepustowy [Hz], at = opóźnienie [s]
    play(id, key, { out, vol = 1, rate = 1, lp = 0, at = 0 } = {}) {
      const list = buf[id] && buf[id][key] && buf[id][key].filter(Boolean); if (!out || !list || !list.length) return false;
      let i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === last[id + key]) i = (i + 1) % list.length; last[id + key] = i;
      const s = AC.createBufferSource(); s.buffer = list[i]; s.playbackRate.value = rate;
      let node = s;
      if (lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = .5; node.connect(f); node = f; }
      const g = AC.createGain(); g.gain.value = vol; node.connect(g); g.connect(out);
      s.start(AC.currentTime + at); return true;
    },
  };
  banks.set(AC, B); return B;
}
