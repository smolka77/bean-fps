// Dane firmy, kontakt biznesowy, regulamin i polityka prywatności BEANLADEN (zakładka Business w ustawieniach).
// UZUPEŁNIJ pola w OPERATOR (puste = w dokumentach widać „[do uzupełnienia]”). Dokumenty są szablonem –
// przed startem na prawdziwe pieniądze powinien je sprawdzić prawnik z jurysdykcji spółki.
export const OPERATOR = {
  brand: 'BEANLADEN',
  company: '',            // pełna nazwa spółki, np. „… Ltd.” / „… N.V.”
  country: '',            // kraj rejestracji na Karaibach, np. Curaçao / Saint Lucia / Anguilla
  regNo: '',              // numer rejestrowy spółki
  address: '',            // adres siedziby
  license: '',            // numer i organ licencji na gry (jeśli jest)
  businessEmail: '',      // e-mail do zapytań biznesowych
  supportEmail: '',       // e-mail do pomocy dla graczy
  privacyEmail: '',       // e-mail w sprawach danych osobowych
  updated: '2026-11-13',  // data ostatniej zmiany dokumentów
};

const F = (v, lang) => v ? esc(v) : `<span class="lg-todo">${lang === 'pl' ? '[do uzupełnienia]' : '[to be completed]'}</span>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mail = (v, lang) => v ? `<a href="mailto:${esc(v)}">${esc(v)}</a>` : F('', lang);

function op(lang) {
  const o = OPERATOR;
  return lang === 'pl'
    ? `Serwis ${esc(o.brand)} prowadzi spółka ${F(o.company, lang)} z siedzibą na Karaibach (${F(o.country, lang)}), nr rejestrowy ${F(o.regNo, lang)}, adres: ${F(o.address, lang)} („Operator”, „my”).${o.license ? ' Licencja: ' + esc(o.license) + '.' : ''}`
    : `${esc(o.brand)} is operated by ${F(o.company, lang)}, a company registered in the Caribbean (${F(o.country, lang)}), registration no. ${F(o.regNo, lang)}, registered address: ${F(o.address, lang)} (the “Operator”, “we”, “us”).${o.license ? ' Licence: ' + esc(o.license) + '.' : ''}`;
}

const TERMS = {
  pl: lang => [
    ['1. Operator', `<p>${op(lang)}</p><p>Kontakt dla graczy: ${mail(OPERATOR.supportEmail, lang)}. Zapytania biznesowe: ${mail(OPERATOR.businessEmail, lang)}.</p>`],
    ['2. Akceptacja regulaminu', `<p>Zakładając konto lub grając w ${esc(OPERATOR.brand)}, akceptujesz ten regulamin i politykę prywatności. Jeśli się z nimi nie zgadzasz, nie korzystaj z serwisu.</p>`],
    ['3. Kto może grać', `<ul><li>Musisz mieć ukończone <b>18 lat</b> (lub więcej, jeśli wymaga tego prawo Twojego kraju).</li><li>Gry o stawkę są zabronione w krajach, w których prawo zakazuje takich gier. Odpowiadasz za sprawdzenie, czy możesz grać tam, gdzie mieszkasz.</li><li>Jedna osoba – jedno konto. Konto jest osobiste i nie można go odsprzedać ani udostępnić.</li></ul>`],
    ['4. Konto', `<ul><li>Konto zakładasz, podając nazwę gracza i hasło (e-mail jest opcjonalny, ale pomaga w kontakcie i odzyskaniu konta).</li><li>Odpowiadasz za poufność hasła i za wszystko, co dzieje się na Twoim koncie.</li><li>Nazwa gracza i awatar nie mogą być obraźliwe, łamać praw innych osób ani podszywać się pod kogoś.</li></ul>`],
    ['5. Gra', `<p>${esc(OPERATOR.brand)} to strzelanka 3D (FPS) w przeglądarce. Dostępne tryby:</p><ul><li><b>Strzelnica</b> – trening solo, bez stawki.</li><li><b>1v1</b> – pojedynek z przeciwnikiem na losowanej mapie (Oaza, Magazyn, Baza), rozgrywany do 3 wygranych rund. Gracz trafia losowo do drużyny niebieskiej (USP-S i M4A1-S) albo czerwonej (Glock-18 i AK-47).</li></ul><p>Przebieg meczu: wyszukanie przeciwnika, losowanie mapy, rundy z odliczaniem. Wyjście z trwającego meczu (np. „Wróć do lobby”, zamknięcie karty) oznacza <b>przegraną walkowerem</b>.</p>`],
    ['6. Stawki i wygrane', `<ul><li>Stawki są wyrażone w <b>dolarach amerykańskich (USD)</b> i pobierane w <b>SOL</b> po bieżącym kursie w chwili rozpoczęcia meczu. Dostępne stawki: $5, $10, $20 lub własna od $1 do $1000.</li><li>Pula meczu to dwukrotność stawki. Zwycięzca otrzymuje pulę pomniejszoną o <b>prowizję Operatora 10%</b> (np. przy stawce $10 wygrana wynosi $18).</li><li>Przegrana oznacza utratę stawki. Remisów nie ma.</li><li>Wynik meczu jest ostateczny. Możemy unieważnić mecz i cofnąć rozliczenie, jeśli wykryjemy oszustwo, błąd techniczny lub nadużycie.</li></ul>`],
    ['7. Portfel w grze (Solana)', `<ul><li>Każde konto dostaje własny adres portfela w sieci Solana. Wpłacasz na niego SOL z dowolnego portfela; wpłata trafia na saldo po potwierdzeniu w sieci.</li><li>Saldo jest pokazywane w USD (z ilością SOL), ale przechowywane i wypłacane w SOL – jego wartość w dolarach zmienia się razem z kursem SOL.</li><li>Wypłaty realizujemy na podany przez Ciebie adres Solana. Transakcji w blockchainie nie da się cofnąć – sprawdź adres przed wypłatą. Minimalna wypłata: 0,001 SOL. Opłatę sieci pokrywa Operator.</li><li>Wysyłaj wyłącznie SOL w sieci Solana. Środki wysłane w innym tokenie lub innej sieci mogą zostać utracone.</li><li>Możemy wstrzymać wypłatę do czasu wyjaśnienia (np. weryfikacja tożsamości, podejrzenie oszustwa, wymogi prawa).</li><li><b>Tryb testowy:</b> dopóki serwis działa w sieci testowej Solana (devnet), środki nie mają wartości pieniężnej.</li></ul>`],
    ['8. Uczciwa gra', `<p>Zabronione są: cheaty, boty, makra, modyfikacje gry, wykorzystywanie błędów, ustawianie meczów, gra kilkoma kontami, pranie pieniędzy i każde inne działanie dające nieuczciwą przewagę. W takim przypadku możemy zablokować konto, unieważnić mecze i zatrzymać środki pochodzące z nadużycia.</p>`],
    ['9. Odpowiedzialna gra', `<p>Graj tylko za pieniądze, których utrata nie będzie dla Ciebie problemem. Jeśli gra przestaje być rozrywką, zrób przerwę lub poproś nas o zablokowanie konta. Pomoc znajdziesz też w organizacjach wspierających osoby z problemem hazardowym w Twoim kraju.</p>`],
    ['10. Zawieszenie i zamknięcie konta', `<p>Możesz zamknąć konto w każdej chwili, pisząc na ${mail(OPERATOR.supportEmail, lang)}; saldo wypłacimy na wskazany adres. Możemy zawiesić lub zamknąć konto przy naruszeniu regulaminu lub prawa.</p>`],
    ['11. Odpowiedzialność', `<p>Serwis jest udostępniany „tak jak jest”. Nie odpowiadamy za przerwy w działaniu sieci Solana, zmiany kursu SOL, błędy po stronie Twojego urządzenia lub łącza, ani za straty wynikające z podania błędnego adresu wypłaty. Nasza odpowiedzialność jest ograniczona do kwoty salda na Twoim koncie, o ile prawo nie stanowi inaczej.</p>`],
    ['12. Zmiany regulaminu', `<p>Możemy zmieniać regulamin. O istotnych zmianach poinformujemy w grze. Dalsze korzystanie z serwisu po zmianie oznacza jej akceptację.</p>`],
    ['13. Prawo i spory', `<p>Regulamin podlega prawu kraju siedziby Operatora (${F(OPERATOR.country, lang)}). Spory rozstrzygają sądy właściwe dla siedziby Operatora, chyba że bezwzględnie obowiązujące przepisy stanowią inaczej. Przed sądem prosimy o kontakt – większość spraw da się wyjaśnić polubownie.</p>`],
  ],
  en: lang => [
    ['1. Operator', `<p>${op(lang)}</p><p>Player support: ${mail(OPERATOR.supportEmail, lang)}. Business inquiries: ${mail(OPERATOR.businessEmail, lang)}.</p>`],
    ['2. Acceptance', `<p>By creating an account or playing ${esc(OPERATOR.brand)} you accept these Terms and the Privacy Policy. If you do not agree, do not use the service.</p>`],
    ['3. Eligibility', `<ul><li>You must be at least <b>18 years old</b> (or older where your local law requires).</li><li>Staked games are not available where such games are prohibited by law. You are responsible for checking that you may play where you live.</li><li>One person – one account. Accounts are personal and may not be sold or shared.</li></ul>`],
    ['4. Your account', `<ul><li>You sign up with a player name and password (e-mail is optional but helps us contact you and recover your account).</li><li>You are responsible for keeping your password secret and for all activity on your account.</li><li>Player names and avatars must not be offensive, infringe others’ rights or impersonate anyone.</li></ul>`],
    ['5. The game', `<p>${esc(OPERATOR.brand)} is a browser-based 3D first-person shooter. Modes:</p><ul><li><b>Shooting range</b> – solo practice, no stake.</li><li><b>1v1</b> – a duel against an opponent on a randomly drawn map (Oasis, Warehouse, Base), played to 3 round wins. Each player is randomly placed on the blue team (USP-S and M4A1-S) or the red team (Glock-18 and AK-47).</li></ul><p>A match consists of matchmaking, a map draw and rounds with a countdown. Leaving a match in progress (e.g. “Back to lobby”, closing the tab) counts as a <b>forfeit loss</b>.</p>`],
    ['6. Stakes and winnings', `<ul><li>Stakes are set in <b>US dollars (USD)</b> and charged in <b>SOL</b> at the current rate when the match starts. Available stakes: $5, $10, $20 or a custom amount from $1 to $1,000.</li><li>The pot is twice the stake. The winner receives the pot minus the Operator’s <b>10% fee</b> (e.g. a $10 stake wins $18).</li><li>Losing a match means losing the stake. There are no draws.</li><li>Match results are final. We may void a match and reverse its settlement if we detect cheating, a technical fault or abuse.</li></ul>`],
    ['7. In-game wallet (Solana)', `<ul><li>Every account gets its own Solana wallet address. Send SOL to it from any wallet; deposits are credited once confirmed on-chain.</li><li>Your balance is shown in USD (with the SOL amount) but is held and paid out in SOL, so its dollar value moves with the SOL price.</li><li>Withdrawals are sent to the Solana address you provide. Blockchain transactions are irreversible – double-check the address. Minimum withdrawal: 0.001 SOL. Network fees are covered by the Operator.</li><li>Send only SOL on the Solana network. Funds sent as another token or on another network may be lost.</li><li>We may hold a withdrawal pending checks (e.g. identity verification, suspected fraud, legal requirements).</li><li><b>Test mode:</b> while the service runs on the Solana test network (devnet), funds have no monetary value.</li></ul>`],
    ['8. Fair play', `<p>Cheats, bots, macros, game modifications, bug exploits, match fixing, multiple accounts, money laundering and any other conduct giving an unfair advantage are prohibited. We may suspend accounts, void matches and withhold funds obtained through abuse.</p>`],
    ['9. Responsible gaming', `<p>Only play with money you can afford to lose. If playing stops being fun, take a break or ask us to block your account. Support is also available from problem-gambling organisations in your country.</p>`],
    ['10. Suspension and closure', `<p>You may close your account at any time by writing to ${mail(OPERATOR.supportEmail, lang)}; we will pay out your balance to an address you provide. We may suspend or close accounts that breach these Terms or the law.</p>`],
    ['11. Liability', `<p>The service is provided “as is”. We are not liable for Solana network outages, SOL price changes, faults of your device or connection, or losses caused by an incorrect withdrawal address. Our liability is limited to the balance of your account, unless the law provides otherwise.</p>`],
    ['12. Changes', `<p>We may update these Terms. We will announce material changes in the game. Continuing to use the service after a change means you accept it.</p>`],
    ['13. Governing law', `<p>These Terms are governed by the laws of the Operator’s country of registration (${F(OPERATOR.country, lang)}). Disputes are subject to the courts competent for the Operator’s seat, unless mandatory law provides otherwise. Please contact us first – most issues can be resolved amicably.</p>`],
  ],
};

const PRIVACY = {
  pl: lang => [
    ['1. Administrator danych', `<p>${op(lang)} Administratorem Twoich danych jest Operator. Kontakt w sprawach danych: ${mail(OPERATOR.privacyEmail || OPERATOR.supportEmail, lang)}.</p>`],
    ['2. Jakie dane zbieramy', `<ul><li><b>Konto:</b> nazwa gracza, hasło (przechowujemy tylko jego bezpieczny skrót – scrypt), opcjonalnie e-mail i awatar.</li><li><b>Portfel:</b> adres Twojego portfela w grze, saldo, wpłaty, wypłaty (z adresami nadawców i odbiorców) i identyfikatory transakcji Solana.</li><li><b>Gra:</b> mecze, stawki, wyniki, statystyki (strzały, trafienia, trafienia w głowę, zabójstwa, śmierci), czas ostatniej aktywności.</li><li><b>Dane techniczne:</b> adres IP (ochrona przed nadużyciami, np. limit prób logowania), typ przeglądarki.</li><li><b>Pamięć przeglądarki:</b> ustawienia (język, głośność, klawisze, czułość myszy) i token sesji – zapisane lokalnie na Twoim urządzeniu. Nie używamy reklamowych plików cookie.</li></ul>`],
    ['3. Po co je przetwarzamy', `<ul><li>prowadzenie konta i gry, rozliczanie stawek i wygranych,</li><li>obsługa wpłat i wypłat,</li><li>bezpieczeństwo, wykrywanie oszustw i cheatów,</li><li>kontakt z Tobą i pomoc,</li><li>wypełnianie obowiązków prawnych (np. przeciwdziałanie praniu pieniędzy).</li></ul>`],
    ['4. Blockchain', `<p>Transakcje w sieci Solana są <b>publiczne i trwałe</b>. Adres Twojego portfela w grze, kwoty i czasy wpłat oraz wypłat może zobaczyć każdy w eksploratorze blockchaina. Nie możemy ich usunąć.</p>`],
    ['5. Komu przekazujemy dane', `<p>Nie sprzedajemy Twoich danych. Mogą je przetwarzać wyłącznie nasi dostawcy (hosting serwera, dostawca węzła RPC Solana) w zakresie potrzebnym do działania serwisu, a także organy publiczne, gdy wymaga tego prawo. Kurs SOL pobieramy z zewnętrznych serwisów bez przekazywania Twoich danych.</p>`],
    ['6. Jak długo', `<p>Dane konta przechowujemy, dopóki konto istnieje. Historię transakcji i meczów możemy przechowywać dłużej, jeśli wymaga tego prawo (np. przepisy finansowe) lub do obrony przed roszczeniami.</p>`],
    ['7. Twoje prawa', `<p>Możesz poprosić o dostęp do swoich danych, ich poprawienie, usunięcie, ograniczenie przetwarzania lub przeniesienie, a także wnieść sprzeciw. Nick, e-mail, awatar i hasło zmienisz sam w profilu. Pozostałe prośby wyślij na ${mail(OPERATOR.privacyEmail || OPERATOR.supportEmail, lang)}.</p>`],
    ['8. Bezpieczeństwo', `<p>Hasła przechowujemy wyłącznie jako skróty, połączenie z serwerem jest szyfrowane, a klucze portfeli nie są zapisywane w bazie – są wyliczane w chwili podpisu transakcji. Żaden system nie jest jednak w pełni odporny – chroń swoje hasło.</p>`],
    ['9. Osoby niepełnoletnie', `<p>Serwis jest przeznaczony wyłącznie dla osób pełnoletnich. Jeśli dowiemy się, że konto należy do osoby poniżej 18 lat, zamkniemy je.</p>`],
    ['10. Zmiany', `<p>Możemy aktualizować tę politykę. Data ostatniej zmiany jest podana na górze dokumentu.</p>`],
  ],
  en: lang => [
    ['1. Data controller', `<p>${op(lang)} The Operator is the controller of your personal data. Privacy contact: ${mail(OPERATOR.privacyEmail || OPERATOR.supportEmail, lang)}.</p>`],
    ['2. Data we collect', `<ul><li><b>Account:</b> player name, password (we only store a secure hash – scrypt), optionally e-mail and avatar.</li><li><b>Wallet:</b> your in-game wallet address, balance, deposits and withdrawals (including sender and recipient addresses) and Solana transaction IDs.</li><li><b>Gameplay:</b> matches, stakes, results, statistics (shots, hits, headshots, kills, deaths) and last activity time.</li><li><b>Technical data:</b> IP address (abuse prevention such as login rate limits) and browser type.</li><li><b>Browser storage:</b> settings (language, volume, key bindings, mouse sensitivity) and a session token, stored locally on your device. We do not use advertising cookies.</li></ul>`],
    ['3. Why we use it', `<ul><li>running your account and the game, settling stakes and winnings,</li><li>processing deposits and withdrawals,</li><li>security, fraud and cheat detection,</li><li>contacting and supporting you,</li><li>meeting legal obligations (e.g. anti-money-laundering).</li></ul>`],
    ['4. Blockchain', `<p>Solana transactions are <b>public and permanent</b>. Your in-game wallet address and the amounts and times of deposits and withdrawals are visible to anyone in a blockchain explorer. We cannot delete them.</p>`],
    ['5. Sharing', `<p>We do not sell your data. It may be processed only by our providers (server hosting, Solana RPC node provider) as needed to run the service, and by public authorities where required by law. We fetch the SOL price from external services without sharing your data.</p>`],
    ['6. Retention', `<p>We keep account data while your account exists. Transaction and match history may be kept longer where required by law (e.g. financial regulations) or to defend legal claims.</p>`],
    ['7. Your rights', `<p>You may request access to, correction, deletion, restriction or portability of your data, and object to processing. You can change your name, e-mail, avatar and password yourself in your profile. Send other requests to ${mail(OPERATOR.privacyEmail || OPERATOR.supportEmail, lang)}.</p>`],
    ['8. Security', `<p>Passwords are stored only as hashes, the connection to our server is encrypted, and wallet keys are not stored in the database – they are derived only when a transaction is signed. No system is perfectly secure, so please protect your password.</p>`],
    ['9. Minors', `<p>The service is for adults only. If we learn that an account belongs to someone under 18, we will close it.</p>`],
    ['10. Changes', `<p>We may update this policy. The date of the last change is shown at the top of the document.</p>`],
  ],
};

export const LEGAL_TXT = {
  pl: { tab: 'Biznes', docs: 'Dokumenty', mailL: 'Adres do kontaktu', soon: 'Adres pojawi się wkrótce', biz: 'Zapytania biznesowe', bizD: 'Współpraca, partnerstwa, sponsoring, media i reklama – napisz do nas.', copy: 'Kopiuj', write: 'Napisz', copied: 'Skopiowano',
    terms: 'Regulamin', termsD: 'Zasady gry, stawki, portfel i odpowiedzialna gra', privacy: 'Polityka prywatności', privacyD: 'Jakie dane zbieramy i po co', back: '‹ Wróć', upd: 'Ostatnia zmiana: {d}', company: 'Operator', none: 'nie ustawiono' },
  en: { tab: 'Business', docs: 'Documents', mailL: 'Contact address', soon: 'Address coming soon', biz: 'Business inquiries', bizD: 'Partnerships, sponsorships, media and advertising – get in touch.', copy: 'Copy', write: 'Write', copied: 'Copied',
    terms: 'Terms of Service', termsD: 'Game rules, stakes, wallet and responsible gaming', privacy: 'Privacy Policy', privacyD: 'What data we collect and why', back: '‹ Back', upd: 'Last updated: {d}', company: 'Operator', none: 'not set' },
  ru: { tab: 'Бизнес', docs: 'Документы', mailL: 'Адрес для связи', soon: 'Адрес скоро появится', biz: 'Деловые запросы', bizD: 'Сотрудничество, партнёрство, спонсорство, СМИ и реклама – напишите нам.', copy: 'Копировать', write: 'Написать', copied: 'Скопировано',
    terms: 'Условия использования', termsD: 'Правила игры, ставки, кошелёк (на английском)', privacy: 'Политика конфиденциальности', privacyD: 'Какие данные мы собираем (на английском)', back: '‹ Назад', upd: 'Обновлено: {d}', company: 'Оператор', none: 'не указан' },
  es: { tab: 'Negocios', docs: 'Documentos', mailL: 'Dirección de contacto', soon: 'Dirección disponible pronto', biz: 'Consultas comerciales', bizD: 'Colaboraciones, patrocinios, prensa y publicidad – escríbenos.', copy: 'Copiar', write: 'Escribir', copied: 'Copiado',
    terms: 'Términos del servicio', termsD: 'Reglas, apuestas, cartera (en inglés)', privacy: 'Política de privacidad', privacyD: 'Qué datos recogemos (en inglés)', back: '‹ Volver', upd: 'Última actualización: {d}', company: 'Operador', none: 'sin definir' },
};

// dokument jako HTML (PL po polsku, pozostałe języki – wersja angielska)
export function legalDoc(kind, lang) {
  const l = lang === 'pl' ? 'pl' : 'en', src = (kind === 'terms' ? TERMS : PRIVACY)[l](l);
  const title = (LEGAL_TXT[lang] || LEGAL_TXT.en)[kind];
  const d = new Date(OPERATOR.updated + 'T12:00').toLocaleDateString(l === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<h4>${esc(title)}</h4><p class="lg-upd">${esc((LEGAL_TXT[lang] || LEGAL_TXT.en).upd.replace('{d}', d))}</p>` + src.map(([h, b]) => `<h5>${esc(h)}</h5>${b}`).join('');
}
