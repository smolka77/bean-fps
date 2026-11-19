# BEANLADEN – wrzucenie na VPS

Paczka to najnowsza wersja z GitHuba (`smolka77/bean-fps`, commit `f4bb475`). Jeden program Node.js (`serwer/serwer.mjs`)
podaje grę, skiny i kreator, a do tego obsługuje konta, portfele SOL (devnet), logowanie Google i panel admina.

```
beanladen-vps/
  index.html                  gra w jednym pliku
  skins.json                  skiny z kreatora
  kreator-skinow.html         kreator (kopia)
  zrodla/kreator-skinow.html  kreator – tę ścieżkę podaje serwer pod /kreator-skinow.html
  serwer/                     serwer (Node.js 22.5+)
```

## 1. Node.js 22 na VPS (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs
```

## 2. Pliki

Wrzuć cały folder `beanladen-vps` np. do `/opt/beanladen` (scp, WinSCP, FileZilla), potem:

```bash
cd /opt/beanladen/serwer && npm ci --omit=dev
```

## 3. Ustawienia (plik `/opt/beanladen/serwer/.env`, nie wrzucaj go nigdzie)

```
PORT=8787
SOLANA_CLUSTER=devnet
ADMIN_USERS=twojanazwa
CORS_ORIGINS=https://twoja-domena.pl
DATA_DIR=/opt/beanladen/dane
GOOGLE_CLIENT_ID=
WALLET_MNEMONIC=
```

- `DATA_DIR` – baza kont i (na devnecie) fraza portfeli. **Rób kopie zapasowe tego folderu.**
- `WALLET_MNEMONIC` – fraza 24 słów. Pusta = na devnecie serwer sam ją wygeneruje w `DATA_DIR/fraza.txt`.
  Kto zna frazę, ma dostęp do wszystkich środków.
- `GOOGLE_CLIENT_ID` – do „Kontynuuj z Google”. W Google Cloud dopisz swoją domenę (z https) do autoryzowanych źródeł JavaScriptu.

## 4. Uruchamianie na stałe (systemd)

`/etc/systemd/system/beanladen.service`:

```
[Unit]
Description=BEANLADEN
After=network.target

[Service]
WorkingDirectory=/opt/beanladen/serwer
EnvironmentFile=/opt/beanladen/serwer/.env
ExecStart=/usr/bin/node serwer.mjs
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /opt/beanladen/dane && sudo chown -R www-data /opt/beanladen/dane
sudo systemctl daemon-reload && sudo systemctl enable --now beanladen && journalctl -u beanladen -f
```

## 5. Domena i HTTPS (nginx + Let's Encrypt)

HTTPS jest potrzebne do logowania Google i kopiowania do schowka w kreatorze.

`/etc/nginx/sites-available/beanladen`:

```
server {
  server_name twoja-domena.pl;
  client_max_body_size 50m;
  gzip on; gzip_types application/json text/html;
  location / { proxy_pass http://127.0.0.1:8787; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/beanladen /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d twoja-domena.pl
```

Gra: `https://twoja-domena.pl`, panel admina: `https://twoja-domena.pl/#admin`.

## Skiny a VPS – ważne

„Opublikuj w grze” w panelu admina zapisuje `skins.json` **na GitHubie**, nie na VPS. Żeby VPS dostawał nowe skiny,
najprościej trzymać na VPS klon repo zamiast tej paczki i co minutę go odświeżać:

```bash
sudo git clone https://github.com/smolka77/bean-fps.git /opt/beanladen
( crontab -l; echo '* * * * * cd /opt/beanladen && git pull -q' ) | crontab -
```

(Folder `dane/` i plik `.env` są w `.gitignore`, więc `git pull` ich nie rusza.)
