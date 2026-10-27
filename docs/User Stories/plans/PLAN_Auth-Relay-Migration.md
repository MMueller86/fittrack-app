# Plan: Auth-Relay (Static Web App) in die Subscription `Fittrack` umziehen

**Planrevision:** `2026-10-26-RELAY-01`
**Status:** Entscheidungen getroffen, wartet auf ausdrückliche `APPROVE`. Dieser Plan implementiert, testet und deployt nichts.
**Stand:** 2026-10-26
**Plan-Typ:** Kleine Infrastruktur-Migration (Folgemigration zu `PLAN_Node24-Flex-Migration.md`, Abschnitt 9, E-5)

Infrastructure Impact: Alpha (neue SWA in `rg-fittrack-alpha`; alte SWA in PRODYNA bleibt unverändert)
Mobile Build Impact: Potential Native Impact (Host in `auth-callback-host.json` ändert den `autoVerify`-Intent-Filter in `app.config.js` -> neuer EAS-Build `preview` nötig)
Privacy Impact: Covered, kein Update, kein Gate (Abschnitt 4)
Persistence Impact: None (kein Cosmos-Bezug)

---

## 1. Ziel und Leitgedanke

Die SWA `swa-fittrack-alpha-ppf5sc` (`blue-hill-03fb3c103.1.azurestaticapps.net`, PRODYNA) liefert `/.well-known/assetlinks.json` und die Callback-/Relay-Seiten für den Login (Entra External ID, Tenant `997c7414-a6e0-47fa-9f5f-de98ea6c426e`). Sie wird als **neue Instanz** in `Fittrack` (`dd7539ab-c638-44f8-9173-8bcd28cdbae3`, `rg-fittrack-alpha`) erstellt. Der Hostname einer SWA wird von Azure vergeben und kann nicht gewählt werden: ein neuer Host ist unvermeidbar und erzwingt einen neuen EAS-Build. Die alte SWA und die alte Umgebung bleiben unverändert (Backup); Abbau ist nicht Teil des Plans.

**Einfachste Variante:** bestehendes Bicep-Modul `infra/modules/staticwebapp.bicep` über `deployStaticWebApp = true` in `alpha-fittrack.bicepparam`; Inhalt aus `infra/static/auth-relay/` per SWA CLI hochladen; Host in drei Stellen im Repo ersetzen; zwei Redirect-URIs in Entra ergänzen (Benutzer); Build `preview`.

**Nicht Teil dieses Plans:** Abbau der alten SWA/Umgebung, Dev-Build, Custom Domain (nur Option, Abschnitt 6), Entfernen alter Redirect-URIs, `fittrack://auth`.

---

## 2. Festlegungen

| Festlegung | Inhalt |
|---|---|
| Region | `centralus` (Free-SKU; Benutzerentscheidung 2026-10-26 nach WP-1-STOP: `westeurope` ist in `Fittrack` per Policy gesperrt (`RequestDisallowedByAzure`); `centralus`, `eastus2`, `westus2`, `eastasia` passierten die Policy). Die SWA liefert nur statische Seiten, keine Nutzerdaten (Abschnitt Datenschutz) |
| Name | `swa-fittrack-alpha-<uniqueSuffix>` (Muster `main.bicep` Z. 101); Suffix aus RG-ID, vermutlich `wcobsd`, aus Deployment-Output übernehmen, nie raten |
| Deployment | Resource per Bicep (`deployStaticWebApp = true` in `alpha-fittrack.bicepparam`, aktuell `false`); Inhalt per SWA CLI mit Deployment Token nur als Prozess-Umgebungsvariable (Abschnitt 6) |
| Übergang | Alte SWA bleibt aktiv, alte Redirect-URIs bleiben in Entra, neue werden **zusätzlich** ergänzt (Abschnitt 5) |
| EAS-Profil | `preview` (zeigt auf `https://func-fittrack-alpha-wcobsd.azurewebsites.net/api`); `preview-flex` existiert nicht mehr |
| `assetlinks.json` | Inhalt unverändert übernommen (Fingerprints hängen an den EAS-Keystores, nicht an Azure) |

---

## 3. Befund: Stellen mit SWA-Host (Repo)

| Stelle | Rolle | Änderung |
|---|---|---|
| `mobile/auth-callback-host.json` (`host`) | Einzige Quelle für `app.config.js` (`AUTH_CALLBACK_HOST`, Intent-Filter `https`, `autoVerify`, `pathPrefix` `/auth/callback/alpha` bzw. `/dev`) und `authRedirect.ts` (Redirect-URI) | neuer Host |
| `infra/static/auth-relay/auth/relay.js` Z. 4 (`HOST`) | Fester Host für die `intent://`-URL im Relay | neuer Host |
| Tests: `mobile/src/services/authRedirect.test.ts` Z. 6, `mobile/src/modules/auth/useAuthLogin.test.tsx` Z. 52, `mobile/src/modules/auth/LoginScreen.test.tsx` Z. 96 | Erwarteter Host/Redirect-URI | neuer Host |
| `infra/static/auth-relay/.well-known/assetlinks.json` | Pakete `com.fittrack.app` / `com.fittrack.app.dev` mit je einem SHA-256-Fingerprint | unverändert; keine Host-Angabe in der Datei |
| `infra/static/auth-relay/staticwebapp.config.json` | Header (`application/json` für assetlinks), Rewrites, CSP | unverändert; keine Host-Angabe |
| KB `07-infrastructure.md` (Abschnitt „Auth Relay Static Web App", Hostname, Entra-Schritt), `05-authentication.md` | Doku nennt alten Host/Subscription | WP-3 |
| `mobile/app.json` (`scheme: fittrack`), `mobile/eas.json` | Enthalten keinen SWA-Host | unverändert |
| Entra App Registration (Redirect URIs) | Nicht im Repo | Benutzer (Abschnitt 5) |

**`assetlinks.json`/Fingerprint.** Die Datei wird von der SWA statisch ausgeliefert. Der Fingerprint ist das SHA-256 des Signaturzertifikats der APK, d. h. des EAS-Keystores je Paket. Er ändert sich durch den SWA-Umzug **nicht**, solange derselbe Expo-Account/dieselben EAS-Credentials genutzt werden. Wird ein Keystore neu erzeugt oder gewechselt, muss der neue Fingerprint **ergänzt** werden (KB `07-infrastructure.md`). WP-3 verifiziert den ausgelieferten Fingerprint gegen die EAS-Credentials (lesend) bzw. die gebaute APK.

---

## 4. Privacy Impact

Skill: `privacy-impact-review`.

```
Privacy Impact: Covered, kein Update, kein Gate
Data flow: Die SWA liefert statische Seiten. Der Relay-Code läuft im Browser des Nutzers, keine Speicherung, kein Netzwerkzugriff (CSP default-src 'none'); die Query (code, state) wird im Browser an die App weitergereicht. Datenkategorien unverändert; Hosting wechselt nur von PRODYNA- in die private Subscription.
Policy sections affected: keine
Open questions: Ob die SWA-Plattform Query-Strings (code, state) in Zugriffslogs erfasst, ist laut KB unverifiziert und ändert sich durch den Umzug nicht. Der Code ist einmalig und PKCE-gebunden.
```

---

## 5. Übergangsstrategie (Alt-Build, Redirect-URIs)

- **Alter Build bis zum neuen Build:** funktioniert weiter. Er nutzt den alten Host (im Manifest und in der Redirect-URI). Solange die alte SWA aktiv ist und die alten Redirect-URIs in Entra stehen, ändert sich für ihn nichts. Er zeigt auch weiter auf die API, die in ihm einkompiliert ist.
- **Redirect-URIs parallel:** Ja, nötig und unkritisch. Entra vergleicht den Redirect-URI exakt; mehrere URIs sind erlaubt. Die neuen `.../auth/callback/alpha` und `.../auth/callback/dev` kommen **zusätzlich** zu den alten und zu `fittrack://auth`. Nichts wird entfernt (Rückfall, Abbau liegt beim Benutzer).
- **Reine Host-Änderung?** Nach Repo-Befund ja: Pfade (`/auth/callback/alpha|dev`), Client-ID, Tenant, Scope sind gleich. Nicht prüfbar im Repo: ob die App Registration weitere Einstellungen mit dem Host hat [Unsicherheit U-2].
- **Gleiches Paket:** `com.fittrack.app` ist in Alt- und Neu-Build identisch; der neue Build ersetzt den alten per Update (gleiche Signatur). Nach der Installation gibt es keinen „alten Build" mehr auf dem Gerät.
- **Dev:** Der installierte Dev-Build behält den alten Host (alte SWA, alte URI). Dev-Builds, die nach der Repo-Änderung gebaut werden, benötigen die neue `.../dev`-URI. Ein Dev-Build ist **nicht** Teil des Plans; die Metro-Dev-Sitzung nutzt aber den neuen Host zur Laufzeit, der installierte Dev-Build hat den alten Host im Manifest: Dev-Login via Metro kann bis zu einem neuen Dev-Build mismatchen [Unsicherheit U-4].

---

## 6. Technische Lösung

- **IaC.** `infra/parameters/alpha-fittrack.bicepparam`: `deployStaticWebApp = true`, `staticWebAppLocation = 'centralus'` (Parameter `main.bicep` Z. 81, 84). Der Deploy der SWA läuft isoliert (nur das SWA-Modul, z. B. `az deployment group create` mit dem Modul/`main.bicep` unter Ausschluss anderer Ressourcen oder `az staticwebapp create`), weil das volle `what-if` von `main.bicep` neben dem SWA-Create zwei Modifies zeigte (Cosmos `sqlEndpoint`, Function App `functionAppConfig.deployment.storage.value` und `siteConfig`-Felder); die Function App und Cosmos dürfen nicht verändert werden. Secrets (OpenAI/DI) wie im Kopf der Parameterdatei nur als Prozess-Umgebungsvariablen.
- **Content-Deploy.** SWA CLI, ein Deployment mit `infra/static/auth-relay/` als App-Ordner (kein Build, keine API). Token per `az staticwebapp secrets list` holen und nur in der Prozess-Umgebungsvariable `SWA_CLI_DEPLOYMENT_TOKEN` halten, nie in Datei, Log oder Argument; danach Variable entfernen. Der exakte Befehl ist im Repo nicht dokumentiert (KB `07-infrastructure.md` [Open]); der Agent verifiziert und dokumentiert ihn in WP-3. Reihenfolge: **erst** `relay.js` auf den neuen Host ändern (der Host ist erst nach WP-1 bekannt), dann deployen.
- **Dotfolder-Risiko.** Ob `.well-known/` beim SWA-CLI-Upload mitgenommen wird, ist per Auslieferungstest (AC-3) zu belegen [Unsicherheit U-5].
- **Option stabiler Hostname (nur Empfehlung, nicht im Plan).** Eine eigene Domain/Subdomain als Custom Domain auf der SWA (Free-SKU unterstützt das) würde Host, Redirect-URIs und Manifest dauerhaft unabhängig von der Subscription machen und künftige Umzüge ohne neuen Build erlauben. Setzt eine Domain im Besitz des Benutzers voraus [Open]; wird nur bei Bedarf als eigene Folgeänderung geplant.

---

## 7. Work Packages

Strikt sequenziell. Ergebnis jeweils `PASS`, `STOP` oder `UNVERIFIED`.

### WP-1 Infrastructure: SWA provisionieren

Agent: Infrastructure
Goal: Neue SWA in `rg-fittrack-alpha` erstellen und den Hostnamen melden.
Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md
Required Repository Context:
- infra/main.bicep
- infra/modules/staticwebapp.bicep
- infra/parameters/alpha-fittrack.bicepparam
Required Skills: None
Relevant Acceptance Criteria: AC-1, AC-9
Dependencies: Neue Alpha aus `PLAN_Node24-Flex-Migration.md` existiert (`rg-fittrack-alpha`)
Inhalt: Preflight: aktiver Kontext `Fittrack` (jeder `az`-Befehl mit `--subscription`); `Microsoft.Web`-Registrierung und Region-Verfügbarkeit (Free-SKU, `westeurope`) prüfen; bei Nichtverfügbarkeit STOP, Alternative aus der Modul-Liste vorschlagen. Parameter setzen (Abschnitt 6), `az bicep build`, `what-if` (nur SWA-Create erlaubt), Deploy. Hostname aus Output `staticWebAppHostName` und per `az staticwebapp show` lesen.
Expected Handoff: Ressourcenname, Region, Hostname, `what-if`-Ergebnis.

### WP-2 Frontend: Host in Mobile-Konfiguration und Tests

Agent: Frontend
Goal: Den Host an den drei Mobile-Stellen ersetzen; sonst nichts.
Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/05-authentication.md
Required Repository Context:
- mobile/auth-callback-host.json
- mobile/app.config.js
- mobile/src/services/authRedirect.ts
- mobile/src/modules/auth
Required Skills: None
Relevant Acceptance Criteria: AC-4
Dependencies: WP-1 `PASS` (neuer Hostname)
Inhalt: `auth-callback-host.json` und die drei Tests (Abschnitt 3) auf den neuen Host. `app.config.js`, `authRedirect.ts`, `app.json`, `eas.json` bleiben unverändert (keine hartcodierten Hosts). Vitest und `tsc` für `mobile`; kein alter Host mehr in `mobile/` (`git grep blue-hill`).
Expected Handoff: Diff, Testnachweis.

### WP-3 Infrastructure: Relay-Inhalt, Deploy, Verifikation, Doku

Agent: Infrastructure
Goal: Relay-Host ersetzen, Inhalt deployen, Auslieferung belegen, KB angleichen.
Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/05-authentication.md
Required Repository Context:
- infra/static/auth-relay/
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/05-authentication.md
Required Skills: None
Relevant Acceptance Criteria: AC-2, AC-3, AC-4, AC-5, AC-9
Dependencies: WP-2 `PASS`
Inhalt: (1) `relay.js` `HOST` auf den neuen Host. (2) Content-Deploy nach Abschnitt 6 (Token nur als Prozess-Variable). (3) Prüfungen: `GET https://<neu>/` = 200; `GET /.well-known/assetlinks.json` = 200, `Content-Type: application/json`, Pakete `com.fittrack.app` und `com.fittrack.app.dev`, Fingerprints gleich denen der EAS-Credentials/APKs (lesend) und gleich der Altdatei; `GET /auth/callback/alpha` und `/dev` = 200 mit `Cache-Control: no-store`. (4) KB-Angleich: Host, Subscription, Region, Deploy-Befehl (löst das [Open]), Entra-Schritt in `07-infrastructure.md` bzw. `05-authentication.md`; Hinweis, dass der alte Host als Backup bis zum Abbau bestehen bleibt. Datenschutztext nicht ändern.
Expected Handoff: Curl-Ergebnisse (Status, Header), Fingerprint-Abgleich, Deploy-Befehl, Liste geänderter Dokumente.

### Benutzer-Schritt U-1: Redirect-URIs in Entra ergänzen

Agent: Benutzer (kein WP, nur im Portal möglich; Zustand nicht aus dem Repo prüfbar)
Dependencies: WP-3 `PASS`
Inhalt: Checkliste in Abschnitt 8.

### WP-4 Infrastructure: EAS-Build `preview`

Agent: Infrastructure
Goal: Neuen Android-Build mit neuem Host erzeugen.
Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
Required Repository Context:
- mobile/eas.json
- mobile/auth-callback-host.json
Required Skills: None
Relevant Acceptance Criteria: AC-6
Dependencies: WP-3 `PASS` und U-1 bestätigt
Inhalt: `eas build --profile preview --platform android --non-interactive` aus `mobile/`; `eas.json` unverändert. `Dev Build Required` laut `infra-release.instructions.md` bewerten und melden (kein Dev-Build). Die gebaute APK/Build-Info gegen `assetlinks.json` abgleichen (Paket, Fingerprint).
Expected Handoff: Build-ID, Artefakt-Link, Fingerprint-Abgleich.

### WP-5 QA

Agent: QA
Goal: ACs gegen Evidence prüfen; Verdict `PASS`, `PASS WITH ISSUES` oder `FAIL`; fehlende Evidence ist nie PASS. Geräte-Login (AC-7) und Entra-Eintrag (AC-5) sind Benutzernachweise, kein QA-Test.
Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/07-infrastructure.md
Required Repository Context:
- Diff von `mobile/`, `infra/`, `docs/kb/`
Required Skills: None
Relevant Acceptance Criteria: AC-1 bis AC-10
Dependencies: WP-4 `PASS`
Expected Handoff: QA-Bericht mit einem Verdict.

---

## 8. Execution Order

1. WP-1 SWA provisionieren (Infrastructure)
2. WP-2 Mobile-Host und Tests (Frontend)
3. WP-3 Relay-Inhalt, Deploy, Verifikation, Doku (Infrastructure)
4. **U-1** Entra-Redirect-URIs (Benutzer)
5. WP-4 EAS-Build `preview` (Infrastructure)
6. WP-5 QA (QA)
7. **U-2** Neuinstallation/Login-Test auf dem Gerät (Benutzer)

**Deploy-Reihenfolge:** Infrastruktur, Relay-Inhalt, Entra-URI, Build zuletzt. Die Entra-URI muss vor dem ersten Login-Test stehen, kann aber schon vor dem Build ergänzt werden.

### Benutzer-Checkliste U-1 (Microsoft Entra, ohne Secrets)

1. Öffne das **Microsoft Entra admin center** und wechsle über **Settings > Directories + subscriptions** in den External Tenant `997c7414-a6e0-47fa-9f5f-de98ea6c426e` (Host `michaelmuellertestapp.ciamlogin.com`).
2. Gehe zu **Entra ID > App registrations > All applications** und öffne die FitTrack-App mit **Application (client) ID** `ce439bd5-864f-46cb-ae77-518d3cba368b`.
3. Öffne **Manage > Authentication**.
4. Unter der Plattform **Mobile and desktop applications** wähle **Add URI** (bzw. **Add Redirect URI**; Bezeichnung je nach Portalversion).
5. Trage `https://<neuer-host>/auth/callback/alpha` ein und wiederhole für `https://<neuer-host>/auth/callback/dev`.
6. **Behalte** die alten URIs (`https://blue-hill-03fb3c103.1.azurestaticapps.net/auth/callback/alpha|dev`) und `fittrack://auth`.
7. Klicke **Save**; teile dem Agenten mit, dass die URIs gespeichert sind.

### Benutzer-Checkliste U-2 (Gerät)

1. Neuen `preview`-Build installieren (Update über die bestehende App).
2. Login starten; die App muss ohne Entra-Bestätigungsdialog zurückkehren (wie im Spike). Bei Fehler: `adb shell pm get-app-links com.fittrack.app` prüfen (Status der neuen Domain) und ggf. neu installieren.

---

## 9. Rückfall

Bis zum Abbau bleiben alte SWA, alte Redirect-URIs und `fittrack://auth` in Entra bestehen. Scheitert der Login mit dem neuen Build, ist der Rückfall: den alten Build (alter Host, alte SWA) weiter nutzen, oder temporär `EXPO_PUBLIC_AUTH_REDIRECT_MODE=scheme` für einen Test-Build setzen (`fittrack://auth`). Fehler an der neuen SWA werden per Neu-Deploy des Inhalts behoben. Die alte SWA wird erst abgebaut, wenn der neue Build und der Login bestätigt sind (Verantwortung Benutzer).

**STOP-Fälle:** SWA-Free in `Fittrack` nicht verfügbar; `what-if` zeigt mehr als das Anlegen der SWA; `assetlinks.json` nicht als `application/json` oder ohne korrekte Fingerprints ausgeliefert; Token/Secret in Ausgabe oder Log.

---

## 10. Verifikation, Abweichungen und Annahmen

- KB `07-infrastructure.md` nennt den SWA-CLI-Befehl nicht ([Open]); WP-3 ermittelt und dokumentiert ihn.
- Alle Hostangaben im Repo wurden per Suche geprüft (Abschnitt 3); die genannten Quellen sind vollständig, soweit Suche und Lesen reichen.
- Nicht verifiziert: Region-Verfügbarkeit in `Fittrack`; Zustand der Entra App Registration; Android-Verhalten bei Host-Wechsel.

---

## 11. Acceptance Criteria

1. **AC-1** Neue SWA (Free) existiert in `rg-fittrack-alpha` (Subscription `Fittrack`), Region dokumentiert (`westeurope` oder begründete Alternative); `what-if` zeigte nur das Anlegen der SWA.
2. **AC-2** `https://<neu>/` liefert HTTP 200 über HTTPS; `/auth/callback/alpha` und `/dev` liefern 200 mit `Cache-Control: no-store`.
3. **AC-3** `https://<neu>/.well-known/assetlinks.json` liefert 200, `Content-Type: application/json`, Pakete `com.fittrack.app` und `com.fittrack.app.dev`, Fingerprints entsprechen den EAS-Credentials bzw. den gebauten APKs.
4. **AC-4** Repo-Konfiguration konsistent: `auth-callback-host.json`, `relay.js`, die drei Tests und die KB nennen denselben neuen Host; `git grep` findet in `mobile/` und `infra/static/` keinen alten Host; Mobile-Tests und `tsc` grün.
5. **AC-5** Der Benutzer bestätigt: `.../auth/callback/alpha` und `.../dev` des neuen Hosts stehen in Entra, die alten URIs und `fittrack://auth` sind unverändert.
6. **AC-6** Ein neuer EAS-Build mit Profil `preview` existiert (Build-ID); `eas.json` ist unverändert.
7. **AC-7** Der Benutzer bestätigt: Login auf dem Gerät mit dem neuen Build funktioniert (Rückkehr in die App ohne Entra-Dialog).
8. **AC-8** Kein Secret/Deployment Token in Dateien, Logs, Argumenten oder Berichten.
9. **AC-9** Die alte SWA, alte Redirect-URIs, die alte Alpha und Dev-Ressourcen wurden nicht verändert (Stichprobe: alter Host liefert weiter 200 und `assetlinks.json`).
10. **AC-10** `npm run check:encoding` grün.

---

## 12. Offene Unsicherheiten

- **U-1 Region:** Free-SKU-Verfügbarkeit von `westeurope` in `Fittrack` ungeprüft (WP-1 Preflight).
- **U-2 Redirect-URI:** Repo zeigt eine reine Host-Änderung; Portalzustand nicht prüfbar.
- **U-3 App-Links-Verifikation:** Ob `autoVerify` für den neuen Host beim Update ausreicht oder eine Neuinstallation/`pm verify-app-links --re-verify` nötig ist, ist ungewiss; Verifikation erfolgt auf Android bei Installation/Update und setzt eine erreichbare, korrekte `assetlinks.json` voraus. Der Relay-Fallback (`intent://`) fängt einen Fehlschlag teilweise ab.
- **U-4 Dev:** Installierter Dev-Build behält den alten Host (Abschnitt 5).
- **U-5 `.well-known` im SWA-CLI-Upload:** per AC-3 zu belegen.
- **U-6 Custom Domain:** nur Option; Domainbesitz unbekannt.
