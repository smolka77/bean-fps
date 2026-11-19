// Księga BEANLADEN: jedyne miejsce, w którym zmienia się saldo gracza (users.lamports) i kasa gry (tabela house).
//
// Zasady (sprawdzane testami w testy/ksiega.test.mjs):
//  - każda zmiana salda to wiersz w txs z applied=1; saldo == SUM(txs.lamports WHERE applied=1) dla każdego konta,
//  - wiersz z applied=0 nie ruszył salda (wygrana czekająca na admina, wypłata nieudana/odrzucona – środki wróciły),
//  - każda operacja ma klucz idempotencji (ref): drugi raz ta sama operacja nic nie zmienia (podwójne rozliczenie,
//    podwójny zwrot, ponowienie po awarii) – UNIQUE(ref) w bazie jest ostatnią zaporą,
//  - prowizje, „pył” z zaokrągleń, przepadłe nagrody i opłaty sieci idą do house (też z ref), więc da się uzgodnić
//    stan skarbca na łańcuchu z zobowiązaniami wobec graczy (rekoncyliacja).
// Funkcje credit/debit/house wołamy WEWNĄTRZ transakcji (tx()); tx() da się zagnieżdżać (SAVEPOINT).

export class LedgerError extends Error { constructor(code, msg, status = 400) { super(msg); this.code = code; this.status = status; } }

export function migrate(db) {
  const add = (table, col) => { try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch {} };
  add('txs', 'ref TEXT'); add('txs', 'applied INTEGER NOT NULL DEFAULT 1'); add('txs', 'game TEXT');
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS txs_ref ON txs(ref) WHERE ref IS NOT NULL;
  CREATE TABLE IF NOT EXISTS house(id INTEGER PRIMARY KEY, t INTEGER NOT NULL, kind TEXT NOT NULL, lamports INTEGER NOT NULL, usd REAL NOT NULL DEFAULT 0,
    ref TEXT UNIQUE, note TEXT NOT NULL DEFAULT '', match TEXT);
  CREATE INDEX IF NOT EXISTS house_t ON house(t);
  CREATE TABLE IF NOT EXISTS config_history(id INTEGER PRIMARY KEY, t INTEGER NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, who TEXT);
  CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY, t INTEGER NOT NULL);`);
  // stare wiersze: wypłaty nieudane/odrzucone i wygrane czekające/odrzucone nie zmieniły salda (zwrot był bez osobnego wiersza)
  once(db, 'txs_applied_v1', () => db.exec(`UPDATE txs SET applied=0 WHERE (type='withdraw' AND status IN ('failed','rejected')) OR (type='win' AND status IN ('pending','failed'))`));
}
export function once(db, name, fn) {
  if (db.prepare('SELECT 1 FROM migrations WHERE name=?').get(name)) return false;
  fn(); db.prepare('INSERT INTO migrations(name,t) VALUES(?,?)').run(name, Date.now()); return true;
}

// transakcja BEGIN IMMEDIATE; wywołanie w środku innej = SAVEPOINT (błąd cofa tylko wnętrze, a wyjątek idzie wyżej)
export function makeTx(db) {
  let depth = 0;
  return function tx(fn) {
    const sp = 'sp' + depth;
    db.exec(depth ? `SAVEPOINT ${sp}` : 'BEGIN IMMEDIATE'); depth++;
    try { const r = fn(); depth--; db.exec(depth ? `RELEASE ${sp}` : 'COMMIT'); return r; }
    catch (e) { depth--; try { db.exec(depth ? `ROLLBACK TO ${sp}; RELEASE ${sp}` : 'ROLLBACK'); } catch {} throw e; }
  };
}

const isLam = (v) => Number.isSafeInteger(v) && v >= 0;
const r2 = (v) => Math.round((+v || 0) * 100) / 100;

export function makeLedger(db, { usdOf = () => 0, now = () => Date.now() } = {}) {
  const q = (s) => db.prepare(s);
  const byRef = (ref) => (ref ? q('SELECT * FROM txs WHERE ref=?').get(ref) : null);
  function row(uid, type, lamports, o) {
    const r = q('INSERT INTO txs(user_id,t,type,lamports,usd,fee_usd,note,sig,status,ref,applied,game) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(uid, now(), type, lamports, o.usd ?? r2(usdOf(Math.abs(lamports)) * Math.sign(lamports)), o.fee || 0, String(o.note || '').slice(0, 200),
        o.sig || null, o.status || 'ok', o.ref || null, o.applied === 0 ? 0 : 1, o.game || null);
    q('UPDATE users SET last_active=? WHERE id=?').run(now(), uid);
    return Number(r.lastInsertRowid);
  }
  return {
    byRef,
    // dopisanie na saldo; applied:0 = tylko wpis w historii (np. wygrana czeka na decyzję admina)
    credit(uid, lam, o = {}) {
      if (!isLam(lam)) throw new LedgerError('amount', 'Zła kwota (credit)');
      const dup = byRef(o.ref); if (dup) return { id: dup.id, dup: true };
      const id = row(uid, o.type || 'credit', lam, o);
      if (o.applied !== 0 && lam > 0) { const ch = q('UPDATE users SET lamports=lamports+? WHERE id=?').run(lam, uid); if (!ch.changes) throw new LedgerError('user', 'Nie ma konta ' + uid); }
      return { id, dup: false };
    },
    // pobranie z salda (sprawdza środki w tej samej transakcji)
    debit(uid, lam, o = {}) {
      if (!isLam(lam)) throw new LedgerError('amount', 'Zła kwota (debit)');
      const dup = byRef(o.ref); if (dup) return { id: dup.id, dup: true };
      if (lam > 0) {
        const ch = q('UPDATE users SET lamports=lamports-? WHERE id=? AND lamports>=?').run(lam, uid, lam);
        if (!ch.changes) throw new LedgerError('funds', o.fundsMsg || 'Za mało środków', 400);
      }
      return { id: row(uid, o.type || 'debit', -lam, o), dup: false };
    },
    // wiersz z applied=0 staje się zaksięgowany (np. wstrzymana wygrana zatwierdzona): saldo + kwota wiersza
    apply(txId, patch = {}) {
      const t = q('SELECT * FROM txs WHERE id=?').get(txId); if (!t) throw new LedgerError('tx', 'Brak operacji ' + txId);
      if (t.applied) return false;
      q("UPDATE txs SET applied=1, status=?, note=COALESCE(?,note), t=? WHERE id=?").run(patch.status || 'ok', patch.note ?? null, now(), txId);
      if (t.lamports > 0) q('UPDATE users SET lamports=lamports+? WHERE id=?').run(t.lamports, t.user_id);
      else if (t.lamports < 0) { const ch = q('UPDATE users SET lamports=lamports-? WHERE id=? AND lamports>=?').run(-t.lamports, t.user_id, -t.lamports); if (!ch.changes) throw new LedgerError('funds', 'Za mało środków'); }
      return true;
    },
    // cofnięcie zaksięgowanego wiersza (wypłata nie wyszła / odrzucona): saldo − kwota wiersza, applied=0
    unapply(txId, patch = {}) {
      const t = q('SELECT * FROM txs WHERE id=?').get(txId); if (!t) throw new LedgerError('tx', 'Brak operacji ' + txId);
      if (!t.applied) { if (patch.status) q('UPDATE txs SET status=?, note=COALESCE(?,note) WHERE id=?').run(patch.status, patch.note ?? null, txId); return false; }
      if (t.lamports < 0) q('UPDATE users SET lamports=lamports+? WHERE id=?').run(-t.lamports, t.user_id);
      else if (t.lamports > 0) { const ch = q('UPDATE users SET lamports=lamports-? WHERE id=? AND lamports>=?').run(t.lamports, t.user_id, t.lamports); if (!ch.changes) throw new LedgerError('funds', 'Środki już wydane'); }
      q('UPDATE txs SET applied=0, status=?, note=COALESCE(?,note) WHERE id=?').run(patch.status || 'failed', patch.note ?? null, txId);
      return true;
    },
    // kasa gry: prowizja (fee), pył z zaokrągleń (dust), przepadła nagroda (forfeit), opłata sieci (netfee, ujemna)
    house(kind, lam, o = {}) {
      if (!Number.isSafeInteger(lam)) throw new LedgerError('amount', 'Zła kwota (house)');
      if (o.ref && q('SELECT 1 FROM house WHERE ref=?').get(o.ref)) return false;
      if (!lam && !o.keepZero) return false;
      q('INSERT INTO house(t,kind,lamports,usd,ref,note,match) VALUES(?,?,?,?,?,?,?)').run(now(), kind, lam, r2(usdOf(Math.abs(lam)) * Math.sign(lam)), o.ref || null, String(o.note || '').slice(0, 200), o.match || null);
      return true;
    },
  };
}

// saldo każdego konta zgadza się z sumą zaksięgowanych operacji (lista kont z różnicą)
export function balanceMismatches(db, limit = 50) {
  return db.prepare(`SELECT u.id, u.username, u.lamports, COALESCE(SUM(CASE WHEN t.applied=1 THEN t.lamports END),0) booked FROM users u LEFT JOIN txs t ON t.user_id=u.id
    GROUP BY u.id HAVING u.lamports != booked LIMIT ?`).all(limit);
}
