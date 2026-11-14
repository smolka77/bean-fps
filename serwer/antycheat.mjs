// Ocena ryzyka oszustwa po meczu 1v1: aimbot, triggerbot, silent aim, skrypty na odrzut, lag switch, speedhack.
// Wejście: statystyki gracza z serwera meczu (mecz.mjs → playerStats). Wyjście: ryzyko 0..1 i lista sygnałów z opisem dla admina.
//
// Zasada: jeden sygnał rzadko przesądza, bo ludzie też miewają świetne mecze. Ryzyko łączy sygnały (1 − Π(1 − s)).
// Wysokie ryzyko nie banuje automatycznie: wstrzymuje wypłatę do decyzji admina, który ogląda powtórkę meczu (panel admina w grze, sekcja Antycheat).
// Progi są ustawione ostrożnie: dobry gracz bez cheatów nie powinien ich przekraczać, a gdy przekroczy, traci tylko czas
// (wypłata czeka), a nie pieniądze.

export const HOLD_RISK = 0.5;        // od takiego ryzyka meczu wygrana czeka na decyzję admina
export const FLAG_SUSP = 0.35;       // podejrzenie konta (średnia ważona z meczów), od którego każda wygrana czeka
const SUSP_KEEP = 0.7;               // podejrzenie konta: tyle zostaje ze starej wartości po każdym meczu

const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (v) => Math.round(v * 100) + '%';
const ms = (v) => Math.round(v * 1000) + ' ms';

export function assess(st) {
  const flags = [];
  const add = (code, score, text) => { if (score > 0) flags.push({ code, score: +score.toFixed(2), text }); };
  const shots = st.shots || 0, hits = st.hits || 0;

  // 1. Czas reakcji: od pojawienia się przeciwnika (według serwera) do pierwszego trafienia, minus ping i wygładzanie obrazu.
  //    Człowiek: 180–300 ms. Aimbot: kilkadziesiąt ms.
  const r = st.reactions || [];
  if (r.length >= 3) {
    const m = med(r), fast = r.filter((x) => x < 0.12).length;
    add('reakcja', m < 0.09 ? 0.9 : m < 0.13 ? 0.6 : fast >= 3 && fast / r.length >= 0.5 ? 0.45 : 0,
      `mediana czasu reakcji ${ms(m)} w ${r.length} pojedynkach, ${fast} poniżej 120 ms (człowiek: 180–300 ms)`);
  }
  // 2. Snap: z bezruchu jednym skokiem kamery w jednej klatce (> 10 rad/s) prosto na cel i znów bezruch – ręka tak nie potrafi.
  if (st.snaps) add('snap', st.snaps >= 4 ? 0.95 : st.snaps >= 2 ? 0.7 : 0.3,
    `${st.snaps}× skok kamery w jednej klatce z bezruchu prosto na przeciwnika (${st.snapHeads} trafień w głowę)`);
  // 3. Silent aim: kierunek strzału inny niż kamera w tej samej klatce albo kamera, która skoczyła na cel tylko na czas strzału.
  if (st.mismatch) add('silent', st.mismatch >= 3 ? 0.95 : st.mismatch >= 2 ? 0.7 : 0.35,
    `${st.mismatch} strzałów w kierunku innym niż kamera w chwili strzału (silent aim albo zmieniony klient)`);
  if (st.spikes) add('skok_kamery', st.spikes >= 3 ? 0.9 : st.spikes >= 2 ? 0.6 : 0.25,
    `${st.spikes}× kamera „skoczyła” na przeciwnika tylko na czas strzału i wróciła (silent aim)`);
  // 4. Brak próbek kamery: zmieniony klient, który nie wysyła danych o celowaniu.
  const noS = (st.noSamp || 0) + (st.noShotSamp || 0);
  if (shots >= 10 && noS / shots > 0.5) add('telemetria', 0.6, `${noS} z ${shots} strzałów bez danych o ruchu kamery (zmieniony klient?)`);
  // 5. Trafienia w głowę – tylko gdy tułów też był odsłonięty (zza murka widać tylko głowę, więc tam to nic nie znaczy).
  const ho = st.hitsOpen ?? hits, hh = st.headsOpen ?? st.heads;
  if (ho >= 12) { const hr = hh / ho; add('glowa', hr > 0.85 ? 0.7 : hr > 0.7 ? 0.35 : 0, `${pct(hr)} trafień w głowę, gdy cała sylwetka była odsłonięta (${hh} z ${ho})`); }
  // 6. Celność (rozrzut broni liczy serwer, więc nawet idealne celowanie nie daje 100%). Fasolka jest duża, więc to słaby sygnał.
  if (shots >= 40) { const acc = hits / shots; add('celnosc', acc > 0.93 ? 0.3 : acc > 0.86 ? 0.15 : 0, `celność ${pct(acc)} (${hits} z ${shots} strzałów)`); }
  // 7. Śledzenie: celownik przyklejony do biegnącego przeciwnika.
  const tr = st.track || { n: 0, on: 0 };
  if (tr.n >= 60) { const v = tr.on / tr.n; add('sledzenie', v > 0.6 ? 0.6 : v > 0.5 ? 0.35 : 0, `celownik w środku sylwetki biegnącego przeciwnika przez ${pct(v)} czasu (${(tr.n / 20).toFixed(1)} s obserwacji; człowiek zwykle 15–40%)`); }
  // Strzały tylko z celownikiem na przeciwniku: człowiek strzela też, gdy celownik ucieka z biegnącego celu; triggerbot i aimbot – prawie nigdy.
  if (st.shotsSeen >= 40) { const v = st.shotsOn / st.shotsSeen; add('selektywny', v >= 0.95 ? 0.6 : v >= 0.9 ? 0.3 : 0, `${pct(v)} strzałów w biegnącego przeciwnika oddanych z celownikiem na nim (${st.shotsOn} z ${st.shotsSeen}; człowiek zwykle 55–80%)`); }
  // 8. Triggerbot: pierwszy strzał oddany w biegu celownika przez przeciwnika i natychmiast po najechaniu na niego.
  const tg = st.trigger || [];
  if (tg.length >= 8) { const m = med(tg); add('trigger', m < 0.02 ? 0.3 : 0, `mediana ${ms(m)} od najechania celownikiem na przeciwnika do strzału (${tg.length} pierwszych strzałów serii)`); }
  if (st.firstOn >= 6) { const v = st.sweep / st.firstOn; add('trigger_ruch', st.sweep >= 4 && v >= 0.5 ? 0.6 : st.sweep >= 3 && v >= 0.35 ? 0.3 : 0, `${st.sweep} z ${st.firstOn} pierwszych strzałów oddanych w biegu celownika przez przeciwnika (triggerbot)`); }
  // 9. Skrypt na odrzut: długie serie z broni automatycznej bez śladu odrzutu w celowaniu.
  const perfect = (st.sprays || []).filter((s) => s.n >= 10 && s.sd < 0.05).length;
  if (perfect) add('odrzut', perfect >= 3 ? 0.7 : perfect >= 2 ? 0.45 : 0.2, `${perfect} długich serii, w których celownik ani drgnął względem przeciwnika (wahania < 5% sylwetki: skrypt albo aimbot)`);
  // 10. Flicki: szybkie obroty zakończone na celu – zdarzają się dobrym graczom, więc to słaby sygnał.
  if (st.flicks >= 4) add('flick', st.flickHeads >= 4 && st.flickHeads / st.flicks >= 0.75 ? 0.4 : st.flicks >= 8 ? 0.25 : 0,
    `${st.flicks} szybkich obrotów zakończonych na celu (${st.flickHeads} w głowę)`);
  // 11. Lag switch: przerwy w paczkach ruchu (strzały w czasie przerwy i tak są odrzucane).
  if (st.gaps >= 4) add('lag', st.gaps >= 8 ? 0.5 : 0.25, `${st.gaps} przerw ponad 0,3 s w paczkach ruchu (lag switch?), ping ${ms(st.rttMed || st.rtt || 0)}`);
  // 12. Ruch: teleport, latanie, przenikanie, za duża prędkość (odrzucone przez serwer).
  if (st.sevMoves >= 5) add('ruch', st.sevMoves >= 15 ? 0.6 : 0.3, `${st.sevMoves} odrzuconych ruchów (teleport, latanie, przenikanie, za szybko)`);

  flags.sort((a, b) => b.score - a.score);
  const risk = 1 - flags.reduce((p, f) => p * (1 - f.score), 1);
  return {
    risk: +risk.toFixed(2), flags,
    summary: { shots, hits, heads: st.heads || 0, acc: shots ? +(hits / shots).toFixed(2) : 0, hs: hits ? +(st.heads / hits).toFixed(2) : 0, hsOpen: (st.hitsOpen ?? hits) ? +((st.headsOpen ?? st.heads) / (st.hitsOpen ?? hits)).toFixed(2) : 0,
      reaction: med(r), trigger: med(tg), snaps: st.snaps || 0, mismatch: st.mismatch || 0, spikes: st.spikes || 0, sweep: st.sweep || 0, gaps: st.gaps || 0, rtt: st.rttMed || st.rtt || 0 },
  };
}

// nowe podejrzenie konta po meczu; mecz z kilkoma strzałami niewiele mówi, więc waży mniej
export function nextSuspicion(old, a) {
  const w = Math.min(1, (a.summary.shots || 0) / 20) * (1 - SUSP_KEEP);
  return +((old || 0) * (1 - w) + a.risk * w).toFixed(3);
}
