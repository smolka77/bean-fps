// Konta panelu admina BEANLADEN (osobne od kont graczy). Uruchamiane na serwerze, w katalogu serwer/:
//   node admin.mjs lista
//   node admin.mjs dodaj NAZWA       – nowe konto, losowe hasło (pokazane tylko raz); 2FA ustawia się przy pierwszym logowaniu w panelu
//   node admin.mjs haslo NAZWA       – nowe losowe hasło (wylogowuje sesje panelu)
//   node admin.mjs reset-2fa NAZWA   – kasuje 2FA (zgubiony telefon); przy następnym logowaniu panel pokaże nowy kod QR
//   node admin.mjs usun NAZWA
// Na VPS najprościej: bash beanladen-admin.sh ... (uruchamia to jako użytkownik usługi, z DATA_DIR z serwer/.env).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { hashPass, adminSchema, ADMIN_NAME } from './ochrona.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, 'dane'));
const file = path.join(DATA_DIR, 'portfele.db');
if (!fs.existsSync(file)) { console.error('Nie ma bazy ' + file + ' – ustaw DATA_DIR albo uruchom najpierw serwer.'); process.exit(1); }
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
adminSchema(db);
const audit = (who, action) => { try { db.prepare("INSERT INTO audit(t,who,ip,action,detail) VALUES(?,?,'serwer',?, 'admin.mjs')").run(Date.now(), who, action); } catch {} };
const newPass = () => crypto.randomBytes(18).toString('base64url');   // 24 znaki, ~144 bity
const get = n => db.prepare('SELECT * FROM admins WHERE username=?').get(n);
const day = t => t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '—';

const [cmd, name] = process.argv.slice(2);
const needName = () => { if (!name || !ADMIN_NAME.test(name)) { console.error('Podaj nazwę: 3–32 znaki (litery, cyfry, _ . -)'); process.exit(1); } };
const showPass = (n, p) => {
  console.log(`\n  Login: ${n}\n  Hasło: ${p}\n`);
  console.log('  Zapisz hasło w menedżerze haseł – pokazuję je tylko raz.');
  console.log('  Wejdź na https://beanladen.pl/#admin. Przy pierwszym logowaniu panel pokaże kod QR do Google Authenticator / Authy.');
};

switch (cmd) {
  case 'lista': {
    const rows = db.prepare('SELECT * FROM admins ORDER BY id').all();
    if (!rows.length) console.log('Brak kont panelu admina. Dodaj: dodaj NAZWA');
    for (const a of rows) console.log(`${String(a.id).padStart(3)} | ${a.username.padEnd(20)} | ${a.totp ? '2FA włączone ' : '2FA: przy 1. logowaniu'} | założone ${day(a.created)} | ostatnio ${day(a.last_login)}`);
    break;
  }
  case 'dodaj': {
    needName(); if (get(name)) { console.error(`Konto ${name} już istnieje (nowe hasło: haslo ${name}).`); process.exit(1); }
    const p = newPass();
    db.prepare('INSERT INTO admins(username,pass,created) VALUES(?,?,?)').run(name, await hashPass(p), Date.now());
    audit(name, 'admin_add'); showPass(name, p); break;
  }
  case 'haslo': {
    needName(); const a = get(name); if (!a) { console.error('Nie ma konta ' + name); process.exit(1); }
    const p = newPass();
    db.prepare('UPDATE admins SET pass=? WHERE id=?').run(await hashPass(p), a.id); db.prepare('DELETE FROM admin_tokens WHERE admin_id=?').run(a.id);
    audit(a.username, 'admin_password'); showPass(a.username, p); break;
  }
  case 'reset-2fa': {
    needName(); const a = get(name); if (!a) { console.error('Nie ma konta ' + name); process.exit(1); }
    db.prepare('UPDATE admins SET totp=NULL, totp_step=NULL WHERE id=?').run(a.id); db.prepare('DELETE FROM admin_tokens WHERE admin_id=?').run(a.id);
    audit(a.username, 'admin_2fa_reset'); console.log(`2FA konta ${a.username} skasowane. Przy następnym logowaniu panel pokaże nowy kod QR.`); break;
  }
  case 'usun': {
    needName(); const a = get(name); if (!a) { console.error('Nie ma konta ' + name); process.exit(1); }
    db.prepare('DELETE FROM admins WHERE id=?').run(a.id); audit(a.username, 'admin_delete'); console.log(`Konto ${a.username} usunięte.`); break;
  }
  default:
    console.log('Użycie: node admin.mjs lista | dodaj NAZWA | haslo NAZWA | reset-2fa NAZWA | usun NAZWA'); process.exit(cmd ? 1 : 0);
}
db.close();
