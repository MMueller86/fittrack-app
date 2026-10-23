# PLAN – Anmeldung im FitTrack-Design ohne Entra-Bestätigungsdialog

Status: Vollständiger Plan zur Vision. Ziel: Entra-Bestätigungsdialog entfernen. Umsetzung in zwei Stufen mit hartem Gate nach WP 1 (Nachweis, dass der Dialog entfällt); WP 2–5 sind vollständig spezifiziert, starten aber erst nach bestandenem Gate.

Infrastructure Impact: Alpha (neue Azure Static Web App; Dev nutzt dieselbe Instanz, siehe Entscheidung D3)
Mobile Build Impact: Potential Native Impact (Intent-Filter in `app.config.js`, neuer Android-Build nötig)

## 1. Requirement Assessment

**Klassifikation: Accept with modifications.** Der Architekturweg passt und hat eine dokumentierte Grundlage (siehe Recherche: `AADSTS50199 / CmsiInterrupt`). Offen ist nur, ob er auf den tatsächlich verwendeten Android-Builds und Geräten ohne Zusatzschritt funktioniert. Deshalb Spike vor UI-Umbau (wie im Auftrag gefordert).

### Ist-Zustand (aus dem Repository)

- `mobile/src/modules/auth/LoginScreen.tsx`: `expo-auth-session` (`useAuthRequest`, `usePKCE: true`), Redirect `makeRedirectUri({ scheme: 'fittrack', path: 'auth' })` = `fittrack://auth`, Token-Tausch per `exchangeCodeAsync` am CIAM-Token-Endpoint, Speicherung in SecureStore. Es gibt bereits einen eigenen Login-Screen (Button "Sign in with Google"); Entra routet derzeit selbst zu Google.
- `mobile/app.json`: `scheme: "fittrack"`. `app.config.js`: Package `com.fittrack.app` (Alpha/Preview) bzw. `com.fittrack.app.dev` (Dev). Keine Intent-Filter für https.
- `mobile/eas.json`: Preview-Profil mit fester Client-ID `ce439bd5-…`, Distribution `internal` (APK). Dev und Alpha nutzen offenbar dieselbe Entra-App-Registrierung [Annahme — im Portal zu prüfen].
- `domain_hint` ist im Repository nicht implementiert. Laut Team ist der beobachtete Fehler bekannt: eine Entra-Fehlerseite im Browser. Der genaue Wortlaut/Fehlercode wird vom Team in Abschnitt 3 nachgetragen; der Plan trifft dazu keine Annahme.
- Backend (`requireUser()`) validiert nur Issuer/Audience/Signatur; Redirect-URI wird dort nicht berücksichtigt. Backend-Änderungen sind **nicht** nötig, solange `sub` unverändert bleibt (siehe Risiko R5).

### Recherche (Microsoft Learn, Q&A, Stand 2026-10-23)

| Frage | Befund | Belastbarkeit |
|---|---|---|
| HTTPS-Redirect für nativen Client erlaubt? | `https://` wird für alle HTTP-basierten Redirect-URIs unterstützt; React Native gehört zur Plattform "Mobile and desktop applications"; Query-Parameter sind bei reinen Work/School-Registrierungen erlaubt. MSAL iOS dokumentiert Universal Links (`https`) ausdrücklich als Redirect-URI | Offizielle Doku (`reply-url`, MSAL-iOS-Redirect-Doku) |
| Auslöser des Dialogs "Only continue if you downloaded the app from a store or website that you trust" | **Offiziell dokumentiert:** `AADSTS50199 / CmsiInterrupt` in der Entra-Fehlercode-Referenz: "Interrupt is shown for all scheme redirects in mobile browsers"; Zweck ist Schutz vor Spoofing, weil ein System-Webview für ein natives Token angefragt wird. Vermeidung: Die Redirect-URI muss zur Safe-List gehören: `http://`, `https://` (und `chrome-extension://` nur Desktop-Chrome). Der Test zeigt: Auslöser ist das **Schema der Redirect-URI** im Authorize-Request, nicht das, was die App danach öffnet. Die Seite gilt allgemein für Entra; eine eigene Aussage für External-ID-Tenants ist nicht gefunden | Offizielle Doku (`reference-error-codes`). Praxistest auf dem Android-Build bleibt nötig (Gate G1) |
| `domain_hint` für Google in externen Tenants | Offiziell: `domain_hint=google` (nicht `google.com`; Facebook `facebook`, Apple `apple`). Native Authentication unterstützt Google nicht (nur Browser-delegiert) | Offizielle Doku (`concept-authentication-methods-customers`) |
| Bekannte Fehler mit `domain_hint=google` | (a) `google.com` wird ignoriert, Entra zeigt den IdP-Picker (MSAL-iOS-Thread, Okt. 2025). (b) `AADSTS90023: 'google' '' pair is not an external identity provider` bei `google`, aber **nur in Desktop-Browsern**; in Android Custom Tab funktionierte dieselbe URL. Ein Nutzer berichtet, dass `Google` (großgeschrieben) im Desktop-Browser lief. Microsoft nennt es "wahrscheinlich Service-Problem/Einschränkung", ohne Tracking-ID; empfohlen wird, `domain_hint` wegzulassen und den Picker zu nutzen (Mai/Juni 2026) | Q&A, inoffiziell, widersprüchlich |
| `prompt=select_account` | Laut Q&A-Antwort erzwingt es den IdP-Picker und kann `domain_hint` überschreiben | Q&A, unbestätigt |

Folgerungen:
- Der Dialog ist ein **dokumentierter Sicherheits-Interrupt** (`CmsiInterrupt`), kein Fehler und nicht per API bestätigbar. Der geplante Weg (HTTPS-Redirect-URI im Authorize-Request) entspricht der von Microsoft genannten Vermeidung.
- Weil die Safe-List die **Redirect-URI im Request** betrifft, bleibt der Dialog auch dann aus, wenn die Relay-Seite danach per `intent:` oder `fittrack://` an die App weiterleitet. Das ist eine Schlussfolgerung aus dem Doku-Text und wird in T3 gemessen.
- `domain_hint` ist Komfort und kein Teil des Ziels. Die Q&A-Berichte zu `google`/`Google`/`google.com` sind inoffiziell und widersprüchlich; der Fehler bleibt bis zur Messung (T5) eine Browser-Fehlerseite ohne Wirkung auf die App. Es gibt **keinen automatischen Neustart** (siehe WP 2).

### Einordnung des Dialogs

Der Screenshot zeigt einen Dialog von `*.ciamlogin.com` **nach** der Google-Kontoauswahl. Er entspricht dem dokumentierten `CmsiInterrupt` für Scheme-Redirects (aktuell `fittrack://auth`). Dokumentiert ist, dass HTTPS-Redirect-URIs ihn vermeiden. Ungeprüft ist nur die Praxis auf unseren Android-Builds, Custom Tabs und Zwischenseiten; das misst der Spike (G1).

### Prüfung der Vision je Punkt

| Punkt der Vision | Bewertung |
|---|---|
| Entra bleibt IdP/Token-Aussteller, Google federated | Unverändert, keine Auswirkung auf Backend/Gruppen/`sub`. OK |
| Eigener RN-Screen | Existiert bereits in Grundform; Umfang ist reines Design. OK |
| HTTPS-Redirect für Public Client | Offiziell zulässig unter Plattform "Mobile und Desktop" (siehe Recherche). Plattform "Single-Page-Anwendung" ist **nicht** zu verwenden (erzwingt Origin/CORS-Code-Einlösung) |
| Azure Static Web App Free | Machbar, kostenlos, `*.azurestaticapps.net`-Hostname ohne eigene Domain. Neue Ressource im bestehenden Resource Group per Bicep |
| `assetlinks.json` | Machbar. SHA-256 der **tatsächlichen** Signatur nötig (EAS-verwaltete Keystore für `preview`/`development`; bei späterem Play-Store-Release zusätzlich Play-App-Signing-Zertifikat). Mehrere Fingerprints/Packages sind in einer Datei möglich |
| Android übergibt Link an App | **Größtes technisches Risiko (R1):** Chrome Custom Tabs öffnen die App bei einem **serverseitigen 302** auf einen App Link in der Praxis oft nicht, sondern laden die HTTPS-Seite im Tab. Dann landet der Nutzer auf `/auth/callback` der Static Web App statt in der App |
| `expo-web-browser` + App Link | Auf Android wartet `openAuthSessionAsync` auf ein Linking-Event, dessen URL mit der Redirect-URL beginnt. Technisch passend, wenn der Link tatsächlich an die App geliefert wird (siehe R1) |
| Dialog entfällt | Dokumentiert (`CmsiInterrupt`-Safe-List `https://`); Praxisnachweis auf Android-Build steht aus (G1) |
| `domain_hint` | Offiziell `domain_hint=google`; bekannte Probleme siehe Recherche (R3). Nur Komfort, nicht Teil von G1 |

### Risiken

- **R1 – App-Link-Auslieferung aus Custom Tab:** Wenn der Redirect nicht automatisch an die App geht, braucht es die Relay-Seite (Variante B). Sie muss die App ohne Nutzerinteraktion öffnen, sonst ist G1 nicht erfüllt.
- **R2 – Dialog bleibt trotz HTTPS:** Von Microsoft als Vermeidung genannt; Restrisiko nur, falls ein anderer Auslöser im Tenant wirkt. Dann ist das Ziel nicht erreichbar, Entscheidung beim Product Owner ([PO-1]).
- **R3 – `domain_hint`/Google-Direktweiterleitung:** Der bekannte Fehler erscheint als Entra-Seite im Browser. Es ist nicht belegt, dass er überhaupt bei der App ankommt; ohne Rückleitung kann die App ihn weder erkennen noch automatisch neu starten. Deshalb ist `domain_hint` standardmäßig **aus** und wird nur per Build-Konfiguration aktiviert, wenn T5 auf dem Android-Build einen fehlerfreien Ablauf nachweist.
- **R4 – Dev/Alpha-Kollision:** Zwei Apps (`com.fittrack.app`, `com.fittrack.app.dev`) mit Verifizierung für denselben Host + Pfad lösen auf dem Gerät einen App-Chooser aus. Gegenmaßnahme: variantenspezifische Pfade (`/auth/callback/alpha`, `/auth/callback/dev`) und Intent-Filter mit `pathPrefix` pro Variante.
- **R5 – Gleiche Identität (AK 4):** Die `sub`-Claim bleibt gleich, solange gleiche App-Registrierung und gleicher Tenant/Client verwendet werden. Neue Registrierung würde `sub` ändern (pairwise) und Nutzerdaten verwaisen lassen. **Keine neue App-Registrierung anlegen; nur Redirect-URI ergänzen.** Im Spike bestätigen: gleicher Account → gleiche `sub`.
- **R6 – App-Link-Verifizierung bei Sideload:** Android verifiziert beim Install online; schlägt es fehl, öffnet sich der Link im Browser. Prüfen auf den realen Geräten/Android-Versionen (AK 6).
- **R7 – Signaturwechsel und ältere Builds:** Neue Keystores/Play-Signing machen `assetlinks.json`-Pflege nötig; Fehlkonfiguration bricht Login. Ältere Builds nutzen weiter `fittrack://auth`. Beides erfordert, dass `fittrack://auth` in Entra erhalten bleibt (siehe [PO-2]).
- **R8 – Abbruch während Anmeldung (Cold Start):** Android kann die App im Hintergrund beenden, während der Custom Tab offen ist; `state` und `code_verifier` im Speicher gehen verloren. Festlegung siehe Abschnitt 4 (Pending-Login).

### Varianten

**Variante A (Vision):** Entra → 302 auf `https://<swa>/auth/callback/<variant>?code=…` → Android öffnet App per verifiziertem App Link. Vorteil: Code wird nur an die verifizierte App geliefert. Nachteil: R1.

**Variante B (Relay, Fallback für R1):** Entra → `https://<swa>/auth/callback/<variant>?code&state` wird im Tab geladen → die Seite leitet **automatisch** per `intent://`-URI (Scheme `https`, gleicher Host und Pfad, `package=<Variant-Package>`) an die App weiter. Die App erhält damit dieselbe URL wie bei Variante A. Vorteil: robust gegen R1, kein Scheme-Wechsel. Nachteil: Der Code läuft kurz über eine FitTrack-eigene Seite (Datenschutz, siehe Abschnitt 6). Details in Abschnitt 4.

**Nicht empfohlen:**
- *Eigene Bestätigung per API gegen Entra:* nicht möglich/zulässig; widerspricht Auftrag.
- *Google-Token direkt an Backend (Entra umgehen):* ersetzt Identity-Architektur, ändert `sub`, Gruppen/Admin-Rollen entfallen. Nur nach PO-Entscheidung.
- *Native Authentication (Entra):* unterstützt Google nicht (nur lokale Konten, laut offizieller Doku) — nicht weiter verfolgen.

### Fallbacks, falls der Dialog bleibt

Abweichung dem PO vorlegen. Optionen: (1) Dialog akzeptieren und stattdessen Entra-Branding im Portal optimieren (Dialog selbst vermutlich nicht gestaltbar); (2) vorgeschalteten FitTrack-Screen erklären lassen ("Im nächsten Schritt bestätigt Microsoft die Anmeldung"), ohne den Dialog zu entfernen; (3) Architekturänderung gemäß oben, mit eigenem Plan. Das Fallback-Szenario ist nach der Doku unwahrscheinlich, aber nicht ausgeschlossen.

## 2. Open Product Owner Decisions

- **[PO-1] (nur falls Gate G1 scheitert)** Der Dialog erscheint auch mit HTTPS-Redirect (Variante A und B). Dann ist das Ziel nicht erreicht; die Abweichung wird vorgelegt, WP 2–5 starten nicht. Optionen siehe Abschnitt „Fallbacks“.
- **[PO-2] Abschaltung von `fittrack://auth`:** Ab welcher Build-Version und ab wann darf die alte Redirect-URI aus Entra und Client entfernt werden? Bis zu einer ausdrücklichen Freigabe bleibt sie registriert. Erfolgreiche Tests (G3) allein genügen nicht.
- **[PO-3] — entschieden (2026-10-23):** Keine eigene Bestätigung und kein zusätzlicher Dialog. Grundsatz: so wenige Dialoge wie nötig; was nicht notwendig ist, entfällt. Der Tap auf "Mit Google anmelden" ist die einzige Nutzeraktion vor Entra (siehe D4).

Entschieden per Planungsvorgabe (kein Blocker, jederzeit revidierbar):
- **D1:** Hybrid-Rückleitung (siehe Zielarchitektur): verifizierter App Link als Hauptweg, FitTrack-gestaltete Relay-Seite als automatischer Rückfall. Ein Button auf der Relay-Seite ist ausschließlich eine **Fehlerhilfe** und zählt im Regelablauf nicht als Erfolg.
- **D2:** Play-Store-Release ist nicht Teil dieses Plans. `assetlinks.json` führt mehrere Fingerprints; das Play-Signing-Zertifikat wird bei Bedarf ergänzt.
- **D3:** Eine gemeinsame Static Web App für Dev und Alpha (analog zu den bewusst geteilten Diensten in `01-system-overview.md`), getrennt über variantenspezifische Pfade.
- **D4:** Keine zusätzliche eigene Bestätigung. Der Tap auf "Mit Google anmelden" ist die Nutzeraktion; ein Entra-Sicherheitsdialog wird nicht nachgebaut.
- **D5:** Cold Start: laufende Anmeldung wird kurzzeitig gesichert und fortgesetzt (Abschnitt 4, Pending-Login).
- **D6:** `domain_hint` ist standardmäßig aus; kein automatischer Neustart bei Fehlern.

## 3. Aus der KB beantwortete Fragen

| Frage | Antwort | Quelle |
|---|---|---|
| Dev und Alpha dieselbe Entra-Umgebung? | Ja, gemeinsamer CIAM-Tenant (Dev liest Client-ID aus `mobile/.env`, Alpha aus `eas.json`). Ob beide dieselbe App-Registrierung nutzen, steht nicht in der KB; im Portal bestätigen (R5) | `01-system-overview.md`, `eas.json` |
| Wie werden Alpha-Builds verteilt? | EAS Preview-Build, `distribution: internal`, APK | `eas.json`, `01-system-overview.md` |
| Dev-Build | Expo Dev Build (`com.fittrack.app.dev`), Alpha `com.fittrack.app` | `app.config.js` |
| Wo liegt Entra-Konfiguration? | Nicht in `infra/`; manuelle Portal-Pflege. Die SWA wird dagegen per Bicep in `rg-Michael-Mueller` angelegt | `07-infrastructure.md` |
| Neue Resource Group? | Nein, `rg-Michael-Mueller`; Umgebungen nur per Namenspräfix | `01-system-overview.md` |
| Datenschutzerklärung nennt Entra und Azure | Ja (Anmeldung über Entra External ID, Speicherung in Azure). Static Web Apps als Hosting-Dienst ist nicht genannt, Google nicht ausdrücklich | `datenschutzerklaerung-alpha.md` |

Weiterhin nur empirisch klärbar (Teil von WP 1): Verifizierungsstatus des Publishers, ob der `domain_hint`-Fehler die App je erreicht (T5), tatsächliche Zielgeräte (mindestens je ein Android 12+ und ein älteres Gerät, falls vorhanden). Vom Team nachzutragen: genauer Wortlaut/Code und Screenshot der bekannten Entra-Fehlerseite bei `domain_hint`.

## 4. Zielarchitektur (Hybrid-Rückleitung)

```mermaid
sequenceDiagram
  participant App as FitTrack App (LoginScreen)
  participant CT as Chrome Custom Tab
  participant E as Entra External ID
  participant G as Google
  participant S as Static Web App
  App->>CT: authorize (PKCE, state, redirect_uri=https://SWA/auth/callback/VARIANTE)
  CT->>E: Authorization Request
  E->>G: Federation (Kontoauswahl)
  G-->>E: Identität
  E-->>CT: 302 https://SWA/auth/callback/VARIANTE?code&state
  alt Android liefert verifizierten App Link
    CT-->>App: Intent (VIEW, https) -> Linking
  else Seite wird im Tab geladen
    CT->>S: GET /auth/callback/VARIANTE
    S-->>CT: Relay-Seite (FitTrack-Design)
    CT-->>App: intent://SWA/auth/callback/VARIANTE?code&state#Intent;scheme=https;package=PACKAGE;end (automatisch)
  end
  App->>E: Token-Endpoint (code + code_verifier + ursprüngliche https redirect_uri)
  E-->>App: access + refresh token
```

Festlegungen:
- **Redirect-URI:** `https://<swa-host>/auth/callback/alpha` (Package `com.fittrack.app`) und `https://<swa-host>/auth/callback/dev` (Package `com.fittrack.app.dev`). Plattform in Entra: "Mobile und Desktop" (kein SPA). `fittrack://auth` bleibt in Entra registriert, bis [PO-2] die Abschaltung freigibt.
- **Relay-Seite (eindeutig):** Die Seite übergibt Code und State **kontrolliert** an die App. Sie liest nur die Allowlist `code`, `state`, `error`, `error_description` aus der URL, baut daraus eine `intent://`-URI mit **festem** Host, Pfad (gleich der geladenen Seite) und **festem** `package` der Variante und löst die Navigation automatisch aus. Es gibt keinen per Parameter gelieferten Zielort. Danach entfernt `history.replaceState` die Query aus der URL. Keine Speicherung, kein Logging, kein Tracking, keine Cookies, keine Drittressourcen, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, CSP ohne externe Quellen.
- **Scheme-Wahl:** Die Relay-Seite öffnet **keinen** Custom Scheme und nicht erneut die gleiche HTTPS-URL im Tab (eine Navigation zur identischen URL bliebe im Browser). Sie nutzt `intent://` mit `scheme=https` und `package`. Die App sieht damit dieselbe URL wie bei Variante A (Redirect-URI plus Query). Die wartende AuthSession (`openAuthSessionAsync` mit HTTPS-Redirect-URL) erkennt die Rückkehr deshalb wie im Hauptweg; ein Scheme-Wechsel entfällt. Der Spike prüft das in T3. Nur wenn T3 zeigt, dass `intent://` nicht automatisch greift, wird als Ausweichlösung `fittrack://auth/relay?...` evaluiert; dann gilt zwingend: die App registriert dafür einen eigenen Link-Handler (die wartende AuthSession erkennt den Scheme-Wechsel nicht), und der Token-Tausch nutzt unverändert die ursprüngliche HTTPS-Redirect-URI aus dem Authorize-Request.
- **Token-Tausch:** `redirect_uri` im Token-Request ist immer die **ursprüngliche HTTPS-Redirect-URI** des Authorize-Requests, unabhängig vom Zustellweg. Sie wird zusammen mit `state` und `code_verifier` im Pending-Login gehalten.
- **Button auf der Relay-Seite:** "Zurück zu FitTrack" erscheint nur, wenn die automatische Weiterleitung nach kurzer Zeit nicht ausgelöst wurde. Er ist eine Fehlerhilfe und zählt im Regelablauf als Misserfolg (G1).
- **Pending-Login (Cold Start):** Beim Start der Anmeldung speichert die App `state`, `code_verifier`, die verwendete `redirect_uri` und einen Zeitstempel in SecureStore (Key z. B. `fittrack_pending_login`). Gültigkeit 10 Minuten, einmalig verwendbar, wird nach Erfolg, Fehler, Abbruch oder Ablauf gelöscht. Kommt der Link nach App-Neustart (`Linking.getInitialURL`), lädt die App den Pending-Login, prüft `state`, tauscht den Code ein und löscht den Eintrag. Fehlt er, ist abgelaufen oder passt `state` nicht, zeigt die App "Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut." mit Button "Erneut anmelden"; ein alter Code wird nie wiederverwendet. Der Eintrag ist ein neues lokales, kurzlebiges Datum (siehe Privacy Impact).
- **assetlinks.json:** je Package die SHA-256-Fingerprints der real verwendeten Signatur (`eas credentials`, Preview/Development).
- **Client:** `expo-auth-session` bleibt (Authorization Code + PKCE, `state` prüfen). Redirect-URI kommt aus einer Konfiguration je Build-Variante.
- **Rollback und ältere Builds:** `fittrack://auth` bleibt registriert; ältere Builds funktionieren unverändert, neue Builds können per Build-Konfiguration zurück auf `fittrack://auth` gestellt werden.
- **`domain_hint`:** separat und optional, standardmäßig aus (siehe WP 2), damit eine Fehlerursache nie mit dem Redirect-Test vermischt wird.

## 5. Gates

| Gate | Bedingung | Bei Misserfolg |
|---|---|---|
| **G1 — Dialog entfällt im Regelablauf** | Auf realen Alpha-Preview-Builds mit HTTPS-Redirect: kein Entra-Dialog **und** keine Nutzeraktion nach der Google-Kontoauswahl bis zur Anzeige der App (automatische Zustellung per App Link oder automatische Relay-Weiterleitung). Der Button der Relay-Seite zählt nicht als Erfolg | Stopp, [PO-1], WP 2–5 starten nicht |
| **G2 — Gleiche Identität** | Gleicher Google-Account liefert dieselbe `sub`, Profil und Admin-Rolle/Gruppen bleiben erhalten | Stopp, Entra-Konfiguration korrigieren; keine neue App-Registrierung |
| **G3 — Robustheit** | Abbruch, Fehler, Link-Übergabe, Cold Start, Dev+Alpha parallel, Zielgeräte bestanden. G3 gibt **nicht** die Abschaltung von `fittrack://auth` frei ([PO-2]) | Nachbessern vor Release |

## 6. Work Packages

### WP 1 — Technischer Durchstich (Spike, Gate G1/G2)

Agent: Infrastructure & Release (SWA, Entra-Portal, Build) und Frontend (Mobile). Wegwerf-Code auf Branch, nur Alpha-Preview-Build; kein Merge in `main` vor G1.

Required Knowledge Base:
- docs/kb/tech/05-authentication.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

Required Skills: `privacy-impact-review` (Relay-Seite empfängt Auth-Code)

Subtasks (in dieser Reihenfolge):

1. **Infra (Bicep, Agent Infrastructure):** neues Modul `infra/modules/staticwebapp.bicep` (Free-Tarif, `rg-Michael-Mueller`, Namenspräfix alpha, gemeinsam genutzt von Dev und Alpha gemäß D3), per Parameter nur im Alpha-Deployment aktiviert. Statische Dateien: `/.well-known/assetlinks.json` (Content-Type `application/json`, kein Redirect, ohne Auth — per `staticwebapp.config.json` sicherstellen) und `/auth/callback/*` (Relay-Seite). Keine Analytics. Alpha-Fingerprint per `eas credentials` ermitteln und eintragen. Verfügbarkeit des Free-Tarifs in der gewählten Region vor Deployment prüfen.
2. **Entra (manuell, Portal):** zur bestehenden App-Registrierung unter Plattform "Mobile und Desktop" die HTTPS-Redirect-URI ergänzen; `fittrack://auth` bleibt als Rückfallweg. Keine neue Registrierung.
3. **Mobile:** `app.config.js` um Android-Intent-Filter (`autoVerify`, `VIEW`, `BROWSABLE`/`DEFAULT`, `https`, Host der SWA, `pathPrefix` je Variante) erweitern; Redirect-URI im Spike-Build konfigurierbar (https statt `fittrack://auth`). Neuer Alpha-Preview-Build.
4. **Messreihe auf realen Geräten** (Befund pro Zeile dokumentieren):

| # | Test | Erwartung / Ergebnis |
|---|---|---|
| T1 | `adb shell pm get-app-links com.fittrack.app` | Domain `verified` |
| T0 | Baseline: aktueller Build mit `fittrack://auth` | Dialog erscheint (Referenz, Screenshot) |
| T2 | HTTPS-Redirect, App Link verifiziert, ohne `domain_hint` | Dialog erscheint? App direkt geöffnet oder landet Tab auf SWA? |
| T3 | Relay: Seite im Tab geladen, `intent://`-Weiterleitung (scheme=https, package) | Dialog erscheint? App öffnet automatisch ohne Tap? Erkennt die wartende AuthSession die Rückkehr? Query wird aus der Tab-URL entfernt? Wenn nicht: `fittrack://`-Ausweichlösung bewerten |
| T3b | Wie T2 mit Zusatzparameter `prompt` (z. B. `select_account`) | Einfluss auf Dialog (nur eingrenzend, falls T2/T3 den Dialog zeigen) |
| T4 | Verifizierten App Link deaktivieren (`pm set-app-links`) | Bestätigt, dass Dialog an Redirect-URI und nicht an App-Verifizierung hängt |
| T5 | Login mit `domain_hint=google` (dann `Google`, dann ohne Hint), jeweils ohne `prompt=select_account` | Kommt die Fehlerseite/der Fehler überhaupt als Redirect bei der App an (`error=…` per Link) oder bleibt sie im Browser (nur `dismiss`)? Welche Variante läuft fehlerfrei? Ergebnis steuert nur den Schalter `domain_hint` |
| T6 | Gleicher Google-Account: `sub` vor/nach Umstellung | Identisch (G2) |
| T7 | Abbruch (Zurück/Schließen), Fehler-Redirect, `state`-Mismatch | App zeigt verständlichen Zustand, erneuter Versuch möglich |
| T8 | Dev-Build und Alpha-Build parallel installiert | Kein App-Chooser (R4) |
| T9 | Verfügbare Testgeräte / Android-Versionen | Verifizierung/Verhalten je Version |
| T10 | Cold Start: App während offenem Custom Tab beenden (`adb shell am kill`), dann Login abschließen | Pending-Login wird geladen, Anmeldung gelingt; bei abgelaufenem/fehlendem Eintrag klare Meldung + "Erneut anmelden" |
| T11 | Alter Build (`fittrack://auth`) und neuer Build auf demselben Gerät/Account | Beide Anmeldungen funktionieren, kein gegenseitiger Einfluss |

5. **Ergebnisbericht:** Dialog ja/nein je Variante und Auslöser (T0–T4), empfohlene Variante, Aufwand für WP 2–5, ggf. PO-1.

Akzeptanz Spike: T0–T4 und T6 dokumentiert. **Entscheidungsregel (G1):** Erscheint der Dialog in T2 und T3 weiterhin, oder ist in beiden Varianten ein Tap nötig, **Stopp**; Abweichung an PO ([PO-1]); WP 2–5 starten nicht.

### WP 2 — Auth-Umbau Mobile
Status: startet nach G1 und G2

Agent: Frontend. Required Skills: `privacy-impact-review`. Required Knowledge Base: `05-authentication.md`, `03-mobile.md`.

- Redirect-URI aus Build-Konfiguration je Variante (`alpha`/`dev`, Umschalter auf `fittrack://auth` als Rollback). Intent-Filter in `app.config.js` (`autoVerify`, `pathPrefix` je Variante).
- Pending-Login (SecureStore, 10 Minuten, einmalig) wie in Abschnitt 4; Verarbeitung der Rückleitung über `expo-auth-session`/`expo-web-browser`/Linking inkl. `Linking.getInitialURL` im Cold-Start-Fall, `state`-Prüfung, Token-Tausch mit der ursprünglichen HTTPS-`redirect_uri`. Doppelte Link-Zustellung darf den Code nicht zweimal einlösen.
- Fehlerzustände (AK 5): Abbruch/`dismiss`, `error`/`error_description` von Entra (nutzerverständlich, deutsch, ohne Rohtexte), Token-Austausch-Fehler, fehlender/abgelaufener Pending-Login, ausbleibende Rückleitung (Timeout + Hinweis + "Erneut versuchen"). Nach jedem Fehler ist ein neuer Versuch ohne App-Neustart möglich. Es gibt **keinen automatischen Neustart**.
- `domain_hint`: eigener Build-Schalter, Standard aus; Wert gemäß T5-Ergebnis. Aktivierung nur, wenn T5 auf dem Android-Build fehlerfrei läuft. Nie zusammen mit `prompt=select_account`.
- Tests (Vitest): Redirect-/Fehlerauswertung, `state`-Mismatch, Doppelzustellung, Pending-Login (gültig, abgelaufen, fehlend, einmalig), Zustandsübergänge; `LoginScreen.test.tsx` anpassen.
- Mobile Build Impact: neuer Build zwingend.

### WP 3 — Login-Screen im FitTrack-Design
Status: kann parallel zu WP 2 entworfen werden, Merge nach G1

Agent: Frontend. Gestaltung mit vorhandenen Theme-Tokens: Logo/Claim, primärer Button "Mit Google anmelden", Datenschutz-Link bleibt, Ladezustand und Fehlertexte aus WP 2 (deutsch; aktuell "Sign in with Google").

Eigene Bestätigung: entfernt ([PO-3], D4). Der Button-Tap ist die einzige Nutzeraktion; es gibt weder Hinweisdialog noch Modal, Checkbox oder zusätzlichen Tap. Ein statischer Hinweistext unter dem Button ist ebenfalls nicht vorgesehen. Dialoge nur bei Fehlern, die der Nutzer beheben muss (z. B. "Erneut anmelden").

### WP 4 — Infrastruktur & Release
Status: Teil 1 läuft in WP 1; Rest nach G1

Agent: Infrastructure. Required Knowledge Base: `07-infrastructure.md`, `01-system-overview.md`.

Reihenfolge: SWA (Bicep) + `assetlinks.json` + Relay-Seite → Entra-Redirect-URIs (Alpha, Dev) → Alpha-Preview-Build → Dev-Build. `fittrack://auth` bleibt in Entra und im Rollback-Schalter erhalten und wird **nicht** nach G3 entfernt; Entfernung nur nach ausdrücklicher Freigabe ([PO-2]) mit dokumentierter Mindest-Build-Version. Backend-Deploy ist nicht erforderlich. Fingerprint-Pflege bei Keystore-Wechsel dokumentieren.

### WP 5 — QA
Status: nach WP 2–4

Required Skills: `privacy-impact-review`. Prüft AK 1–6 mit realen Alpha-Builds (G3), Regression bestehender Nutzer (Profil, Daten, Admin-Rolle, Gruppen), Logout/Re-Login, Refresh-Token-Pfad (`refreshAccessToken` nutzt den Token-Endpoint; Redirect-URI-Bedarf beim Refresh prüfen), App-Chooser-Freiheit mit Dev+Alpha, Relay-Seite (Header, keine Logs/Drittressourcen), Rollback-Umschalter.

## 5. Persistence Impact

Keine. Keine Cosmos-Änderung, kein Backend-Code.

## 6. Privacy Impact

- Neue Verarbeitung: Eine FitTrack-eigene HTTPS-Seite (Azure Static Web App) wird beim Rücksprung vom Identitätsanbieter mit einem kurzlebigen Autorisierungscode (und `state`) in der URL aufgerufen und übergibt beides kontrolliert an die App. Der Code allein ist ohne `code_verifier` wertlos (PKCE). Die Seite speichert/loggt nichts, lädt keine Drittskripte, setzt keine Cookies. Azure-seitige Zugriffsprotokolle der SWA sind zu prüfen (Open question: ob URL-Query in Plattformlogs landet).
- Neues lokales Datum: Pending-Login (`state`, `code_verifier`, `redirect_uri`, Zeitstempel) in SecureStore, 10 Minuten, einmalig, danach gelöscht. Es verlässt das Gerät nicht.
- Neuer Auftragsverarbeiter/Anbieter: Azure Static Web Apps ist Teil derselben Microsoft-Azure-Umgebung; ob die Datenschutzerklärung den Hosting-Dienst abdeckt, ist gegen `docs/legal/datenschutzerklaerung-alpha.md` zu prüfen. Keine Änderung wird ohne ausdrückliche Freigabe vorgenommen. Rechtsgrundlagen/Fristen: Open question.
- Bei Variante A läuft der Code nicht über die Webseite (sofern App Link greift).

## 7. Empfohlene Reihenfolge

1. WP 1: Infra (SWA, assetlinks, Relay) → Entra-Redirect-URI → Mobile-Intent-Filter + Spike-Build → Messreihe T0–T9
2. Gate G1/G2 → bei Misserfolg [PO-1]
3. WP 2 + WP 3 → WP 4 (Rest) → WP 5 (G3)

Deploy-Sequenz: Infrastruktur (SWA, `assetlinks.json`) → Entra-Redirect-URI → neuer Alpha-Build. Backend-Deploy nicht erforderlich.

## 8. Knowledge-Base-Updates (nach Umsetzung)

`docs/kb/tech/05-authentication.md` (Redirect-URI, App Link, Relay), `docs/kb/tech/07-infrastructure.md` (SWA, `assetlinks.json`, Fingerprint-Pflege), `docs/kb/tech/03-mobile.md`. Bis dahin sind diese Inhalte `[Planned]`.
