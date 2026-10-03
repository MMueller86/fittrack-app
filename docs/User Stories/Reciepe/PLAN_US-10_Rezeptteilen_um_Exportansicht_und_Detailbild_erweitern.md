# PLAN_US-10: Rezeptteilen um Exportansicht und Detailbild erweitern

**Status: RE-PLAN PENDING EXPLICIT APPROVAL — CORRECTION WORK STOPPED**

**Plan Revision:** `US-10-AC11-2026-09-30-R2`

**Approval:** Pending. This revision invalidates the previous `APPROVE US-10 replan 2026-09-30` approval. No corrective implementation or correction checks may start until the user explicitly replies: `APPROVE US-10 AC-11 replan 2026-09-30`.

**Infrastructure Impact: Dev**

**Mobile Build Impact: Potential Native Impact**

**Revision Notice:** This re-plan follows the second technical plan gap reported by Backend during the approved QA correction loop. The latest Q-1 report remains `FAIL`; its only actionable blocker is FT-QA-2026-037 / AC-11. QA verified FT-QA-2026-038 through FT-QA-2026-043 as resolved, and FT-QA-2026-044 is not actionable under the scoped Recipe Analyze eval gate. Backend attempted the approved B-5 ambiguity correction but stopped without edits because the preparation response has no representation for unresolved matches or candidates. The focused baseline `npx vitest run src/functions/recipes.test.ts` passed 63 tests; no typecheck, full suite, or build was run during that stopped attempt. This revision invalidates the previous approval and is pending fresh approval; no correction work may start before that approval. Existing handoff evidence remains as reported below. Cosmos contract tests remain `UNVERIFIED` because the local emulator was unavailable. Android U-1/native behavior and Base64 transport measurement remain `UNVERIFIED`. No EAS build, deployment, or release-record edit is authorized or performed by this planning revision.

No build or deployment is authorized by this plan. A Dev Build is an operational prerequisite only if your post-QA final test requires a new native binary; any such build, and any deployment needed by the selected test setup, requires a separate explicit operational request.

## Product scope decision (resolved)

- Android-only product scope is accepted for this plan revision. The unchanged US-10 story still includes iOS language for sharing and validation; the latest explicit user instruction narrows this plan to Android only. No iOS implementation acceptance, test, build, or device gate is included, and the story file remains unchanged.
- The user assumes Android native multi-image sharing is technically feasible, but this is not test evidence or a pass claim.
- Every pre-Q-1 implementation check is automated. No real Android-device test, native system-share-sheet test, or real-user end-to-end test may start before Q-1 is complete with no unresolved Blocking finding. Q-1 does not wait for such evidence.
- Exactly one native `Share.open({ urls: [...] })` invocation with both image URIs is mandatory. Sequential calls and dual-dialog fallbacks are forbidden.
- Base64 JSON transport is currently `UNVERIFIED`, not failed. Run `B-6A` only if an actual post-QA Android measurement demonstrates that its payload, memory, or timeout budget fails.

`Dev Build Required` is currently `NOT DETERMINED`. Assess it only when the user is preparing U-1 and the required test setup is known; that assessment does not authorize a build. No build or deployment is authorized implicitly by this plan.

## Revised execution order and ownership

The detailed sequential queue is in Section 22 and is inactive pending the
fresh approval requested at the top of this plan. The previous approval is
invalidated. The latest Q-1 re-review verified the prior corrections except
for the single AC-11 ambiguity gap. After approval, only the B-5 response-
contract correction, the dependent F-1 clarification flow, their automated
checks, and the required Q-1 re-review are reopened. Previously reported
handoffs remain as recorded; they are not re-run unless this correction changes
their surface.

1. After approval, Backend adds the versioned preparation request/response and
  explicit ingredient-resolution states in B-5. Existing B-1/B-2 contracts,
  quota behavior, scoped Recipe Analyze evidence, and stale-safe bundle remain
  unchanged unless a focused regression check identifies a defect.
2. Frontend extends the existing F-1 review with explicit ambiguous/unmatched
  ingredient clarification and the versioned preparation call. The existing
  bundle preview, media flow, and native candidate remain unchanged; mocked
  native tests are not a device pass.
3. All available automated implementation checks and documentation updates are
  completed before Q-1. No real Android device, system share sheet, manual
  recipient, or real-user E2E test runs before or during QA.
4. Q-1 re-reviews all 29 ACs, verifies FT-QA-2026-037 / AC-11 with the new
  contract and regression evidence, confirms FT-QA-2026-038 through -043
  remain resolved, and keeps FT-QA-2026-044 non-actionable under the scoped
  Recipe Analyze gate. Unrelated aggregate Daily/Weekly results are reported
  accurately and do not authorize unrelated prompt edits.
5. Only after Q-1 is complete with no unresolved Blocking finding, Infrastructure
  performs the I-1 release-record correction as documentation only. The user
  then performs U-1 on Android. No iOS acceptance, device, or build gate exists.
6. A measured TECH-1 failure in U-1 routes a Frontend fix, automated
  regression checks, QA review, and a repeated U-1. `B-6A` is routed only if
  U-1 actually measures a Base64 payload, memory, response-budget, or timeout
  failure; absence of a measurement remains `UNVERIFIED`.
7. No EAS build or deployment is authorized implicitly. A separate operational
  request is required if the user's U-1 setup needs either.

**Owner and handoff definition:**

- Backend owns the server-side contract and `B-6A` only after a measured TECH-2 failure.
- Frontend owns the Android-only native candidate, the single-call integration, automated native-candidate checks, and fixes for a measured TECH-1 failure.
- QA owns the automated/documentary review after implementation checks. Device absence is recorded as `UNVERIFIED` / `MANUAL VALIDATION REQUIRED`, not as a reason to block that review.
- You own U-1 and decide whether its operational setup requires a Dev Build. Infrastructure owns the I-1 release-record update and any separately requested build/deployment operation; it does not perform U-1 on your behalf.
- The invariant remains exactly one native `Share.open({ urls: [...] })` call for both images, with no dual-dialog fallback.

**Implementation status:** The latest Q-1 re-review verified the implemented F-1 flow except for preparation ambiguity, and verified F-2/F-3 including the automated pair and one-call contracts. FT-QA-2026-041 is resolved; only FT-QA-2026-037 remains Blocking. B-5's attempted ambiguity correction stopped before edits because its API response contract was insufficient. B-5 and the affected F-1 path are reopened only for the changes below; F-1a's automated candidate preflight remains reported, not Android device evidence. No correction work starts until fresh approval. U-1 remains after Q-1, and no iOS gate is included.

This plan is an architecture and handoff document. It does not create a production claim or authorize a build/deployment. The Story US-10 is the authoritative functional source; the repository implementation remains authoritative for current behavior.

## Product-owner decision status

- Resolved: Android-only scope; one native multi-image invocation; no fallback; final Android end-to-end validation is performed by the user after QA.
- No iOS acceptance or iOS build gate is required.
- No additional product decision is open. The preparation match states, explicit resolution/exclusion, V1 compatibility fallback, and server-side ID membership checks are technical/API/UX resolutions of AC-11, grounded in the existing wizard review and recipe API; they do not introduce a domain rule or require a new PO choice. Whether a new Dev Build is operationally needed is assessed only for U-1 and does not authorize a build.
- The previous approval `APPROVE US-10 replan 2026-09-30` is invalidated by this revision. This revision is pending the exact fresh approval `APPROVE US-10 AC-11 replan 2026-09-30`; no corrective work may start before it. Missing Android SDK/device/build evidence does not block automated checks or Q-1.

### PO-1: Bestätigte Gesamtzeit ist die kanonische Share-Zeit

Die Gesamtzeit wird im bestehenden `recipe-analyze`-Aufruf durch die KI
geschätzt und als Teil seines Structured Outputs geliefert. Es gibt keinen
separaten KI-Aufruf nur für die Zeit. Nach Review und ausdrücklicher
Bestätigung wird `exportView.totalTimeMinutes` serverseitig persistiert und im
neuen gemeinsamen `share-bundle`-Aufruf sowohl an den Detailrenderer als auch
an den bestehenden Instagram-Adapter übergeben. Beide Bilder verwenden damit
dieselbe bestätigte Zeit.

Der bestehende direkte `instagram-render`-Vertrag bleibt für ältere Mobile-
Versionen kompatibel. Sein bisheriges `recipeMeta`-Requestfeld bleibt eine
Legacy-Transportform; der neue Mobile-Share-Flow sendet kein clientseitiges
`recipeMeta`, sondern verwendet ausschließlich den serverseitig geladenen
`exportView`-Wert.

### PO-2: Bestehende Rezepte ohne verlässliche Zeit

Für ein bestehendes Rezept ohne bestätigte Gesamtzeit wird niemals eine
Default-Zeit, insbesondere nicht `30` Minuten, eingesetzt oder persistiert.
Das Feld bleibt im lokalen Exportentwurf leer. Der Nutzer erhält im
gemeinsamen mobilen Export-Review-Dialog ein Zeitfeld und kann eine positive
gültige Zeit selbst eintragen. Speichern der Exportfassung und Teilen werden
erst nach gültiger Eingabe und ausdrücklicher Bestätigung freigegeben.

Eine ausdrücklich gestartete KI-Vorbereitung darf eine Zeit vorschlagen; auch
dieser Vorschlag bleibt transient, bis der Nutzer ihn geprüft und bestätigt
hat.

### PO-3: Schwierigkeit beziehungsweise Komplexität

Die Schwierigkeit wird im selben `recipe-analyze`-Aufruf wie die Gesamtzeit
geschätzt. Es gibt keinen zusätzlichen KI-Aufruf beim Öffnen, Speichern oder
Teilen. Der bestätigte Wert wird als `exportView.difficulty` in derselben
versionierten Exportfassung wie Teaser, Zeit, Schritte und Zutatenauswahl
persistiert.

Der neue gemeinsame Share-Bundle-Adapter liest `exportView.difficulty`
serverseitig und setzt damit die `difficulty`-Zeile des bestehenden Instagram-
Meta-Vertrags. Es gibt für diesen Flow keinen stillen Rendererwert `Einfach`.
Bei historischen Rezepten ohne bestätigte Schwierigkeit bleibt das Feld leer
und wird im selben mobilen Dialog wie die fehlende Zeit abgefragt. Eine
ausdrücklich gestartete KI-Vorbereitung darf beide fehlenden Vorschläge in
einem einzigen `recipe-analyze`-Aufruf liefern.

Die persistierte Schwierigkeit bleibt bewusst ein getrimmter, einzeiliger
String. Die Story und die Knowledge Base definieren keine verbindliche
Schwierigkeits-Enum; eine neue fachliche Klassifikation wird nicht erfunden.

## Technical Execution Gates

Diese technischen Gates sind keine Produktalternativen. `TECH-3` und alle
anderen automatisierbaren Prüfungen werden vor Q-1 ausgeführt. `TECH-1` und
`TECH-2` bleiben bis zum post-QA-User-Test U-1 `UNVERIFIED`; ihr offener
Gerätenachweis blockiert weder die automatisierten Vorprüfungen noch Q-1.

### TECH-1: Android-native one-call multi-image share

Android ist die einzige Produktplattform. Vor dem vollständigen Done-Claim
prüft U-1 auf einem realen Android-Gerät, dass die App zwei lokale PNG-URIs in
genau einem nativen `Share.open({ urls: [...] })`-Aufruf an das System
übergibt. Die vor Q-1 laufenden automatisierten Tests dürfen den nativen
Adapter mocken und Call-Anzahl sowie beide URIs prüfen; sie belegen nicht, dass
Android das Teilen tatsächlich akzeptiert. Zwei unabhängige Share-Dialoge und
sequentielle Share-Aufrufe sind verboten.

**Ownership und Ablauf:**

- Frontend besitzt die native Kandidaten-Implementation und automatisierten
  Call-Contract-Tests. Ein erfolgreicher Mock-Test ist kein Android-Pass.
- Du führst den realen Geräte- und End-to-End-Test U-1 nach Q-1 aus.
- Infrastructure aktualisiert den I-1-Dokumentations-/Evidenzdatensatz erst
  nach Q-1; der Buildbedarf bleibt bis zur bekannten U-1-Testumgebung
  `NOT DETERMINED`. Infrastructure führt U-1 nicht aus. Falls TECH-1 in U-1 fehlschlägt,
  korrigiert Frontend den nativen Code, danach folgen automatisierte
  Regressionstests, QA-Review und ein erneuter U-1-Test.

### TECH-2: Transport des vollständigen PNG-Paars

Der aktuelle Base64-JSON-Transport ist `UNVERIFIED`, nicht fehlgeschlagen.
Automatisierte Contract-, Decode-, Paar-Atomizitäts- und Grenztests laufen vor
Q-1. Erst U-1 misst mit realistischen PNG-Größen den tatsächlichen Android-
Decode-/Parse-/Memory-/Timeout-Pfad und das Function-Response-Limit; die
Rezeptmetadaten bleiben serverseitig.

**Pass / conditional redesign:**

- **Pass:** Base64-JSON bleibt bestehen, wenn die U-1-Messung die relevanten
  Android- und Response-Budgets erfüllt.
- **Fail:** Nur eine dokumentierte Messung, die ein Budget tatsächlich
  überschreitet oder einen Timeout/Transportfehler zeigt, löst Backend-Subtask
  `B-6A` aus. Danach laufen die betroffenen automatisierten Tests, ein
  fokussiertes QA-Review und ein erneuter U-1-Test.
- **Not measured / unavailable:** Status bleibt `UNVERIFIED`; kein
  `B-6A`-Redesign und keine Fehlermeldung zum Base64-Transport werden daraus
  abgeleitet.

Der Redesign-Pfad darf nur temporäre Datei-URLs oder presignete Referenzen
einführen, behält das atomare PNG-Paar und exakt einen nativen Share-Aufruf und
erlaubt keinen Dual-Dialog-Fallback.

### TECH-3: Gemessener Renderer-Overflow

Die Zeichenlimits sind nur ein Vorfilter. B-4 führt vor Q-1 einen
automatisierten Probe-Render mit derselben Satori-/Resvg-/Produktionsfont-
Konfiguration aus und prüft tatsächliche Bounds sowie abgeschnittene Bereiche.
Ohne erfolgreichen Probe-Render wird kein Detailbild als gültig ausgeliefert;
der Renderer liefert einen strukturierten feldbezogenen Fehler und kürzt
keinen Titel, Teaser, Zutatentext oder Schritt still.

## 1. Requirement Assessment

US-10 ist eine große Folge-Story zu US-09 und betrifft mehrere
Verantwortungsgrenzen:

- persistierte Recipe-Daten und Cosmos-Read-Kompatibilität;
- Shared-Type- und Validierungsverträge;
- den bestehenden Recipe-Analyze-Structured-Output-Aufruf;
- die explizite KI-Vorbereitung für bestehende Rezepte;
- einen neuen Detailrenderer mit festen Layout- und Messgrenzen;
- den bestehenden authentifizierten Instagram-Render;
- den Mobile-Rezeptwizard, die Rezeptdetailansicht und den Share-Draft;
- lokale Mediendateien, Album-Rollback und einen nativen Multi-Image-Share;
- Dev-Deployment, potenziell native Mobile Builds, Dokumentation und QA.

Die fachliche Komplexität ist hoch. Die kleinste sinnvolle Umsetzung ist keine
Renderer-Erweiterung allein, sondern ein versionierter Exportvertrag mit
expliziter Bestätigung, serverseitiger Stale-Erkennung und einem atomaren
zweiteiligen Share-Flow.

### Architektur- und Release-Bewertung

| Bereich | Bewertung | Konsequenz |
|---|---|---|
| Infrastruktur | **Dev** | Keine neue Azure-Ressource und kein neuer Cosmos-Container erwartet. Backend-Änderungen werden nach den bestehenden Clean-Build-/Staging-Regeln für Dev deploybar gemacht. |
| Mobile Build | **Potential Native Impact** | Der reine JS-Flow wäre ohne Buildänderung möglich; der eine Multi-Image-Share kann aber eine native Bridge, ein Config Plugin oder eine native Abhängigkeit erfordern. |
| Persistenz | Additive, read-kompatible Schemaerweiterung | Optionales `exportView` im bestehenden Recipe-Dokument; keine Migration, keine Datenkopie, kein neuer Container. |
| AI | Bestehender Recipe-Analyze-v11-Exportvertrag wird scoped verifiziert | Exportvorschläge, Servervalidierung und Review sind vorhanden; das Preparation-Routing muss dieselbe `recipe-analyze`-Quota anwenden. Kein Prompt-Bump; der Recipe-Analyze-Eval ist der US-10-Gate. |
| Sicherheit | Bestehende Authentifizierung bleibt zwingend | Alle neuen Routen nutzen `requireUser()`, laden Rezept- und Blobdaten serverseitig und akzeptieren keine client-eigenen Rezept- oder Eigentümerdaten. |
| Produktion | Dokumentationskonflikt | US-10 fordert Produktionsintegration. Die Knowledge Base beschreibt Production derzeit als nicht verfügbar. Der Plan verlangt produktionsfähigen Code und Release-Gates, behauptet aber keinen nicht möglichen Produktionsdeploy. |

### Freigabestatus

Die vorherige Freigabe `APPROVE US-10 replan 2026-09-30` ist durch diese Revision ungültig. Diese Revision wartet auf die ausdrückliche Freigabe `APPROVE US-10 AC-11 replan 2026-09-30`; bis dahin startet keine Korrekturarbeit. Das letzte Q-1-Ergebnis ist `FAIL` mit genau einem actionable Blocking Finding, FT-QA-2026-037 / AC-11. FT-QA-2026-038 bis -043 sind laut Q-1 gelöst; FT-QA-2026-044 ist unter dem scoped Recipe-Analyze-Gate nicht actionable. Backend stoppte den B-5-Korrekturversuch ohne Änderungen; der gezielte Baseline-Lauf bestand 63 Tests. Frühere Handoffs bleiben als gemeldete oder von QA geprüfte Evidence erhalten. Cosmos Contract bleibt `UNVERIFIED`; TECH-1/TECH-2 bleiben bis U-1 `UNVERIFIED`. Kein EAS-Build und kein Deploy wurde ausgeführt oder durch diese Planrevision autorisiert.

## 2. Decided Product Behaviour

Die drei PO-Entscheidungen aus Abschnitt 0 sind verbindlich:

1. `totalTimeMinutes` und `difficulty` entstehen für neue Rezepte im selben
  Recipe-Analyze-Ergebnis, werden gemeinsam reviewed und erst nach
  Bestätigung gespeichert.
2. Eine historische Exportfassung ohne bestätigte Zeit oder Schwierigkeit
  zeigt beide Werte im lokalen Entwurf als offen. Der Nutzer trägt fehlende
  Werte im selben mobilen Dialog ein oder startet dort ausdrücklich eine
  einmalige KI-Vorbereitung.
3. Der Dialog kann beide transienten KI-Vorschläge anzeigen und bearbeiten.
  Bereits bestätigte Werte werden durch eine Vorbereitung nicht ungefragt
  ersetzt.
4. Speichern und Teilen bleiben bis zur gültigen Eingabe und ausdrücklichen
  Bestätigung gesperrt. Teilen löst keine KI aus.
5. Die bestätigte Schwierigkeit wird als Teil der `exportView`-Fassung
  persistiert und vom gemeinsamen Server-Adapter für die bestehende
  Instagram-Meta-Zeile verwendet.
6. Bei der bestehenden-Rezept-Vorbereitung wird eine Zutat nur dann
  automatisch einer Quellzutat zugeordnet, wenn genau eine geeignete ID
  übereinstimmt. Mehrdeutige und nicht gefundene Zuordnungen bleiben explizit
  offen und müssen im Review ausgewählt oder ausdrücklich ausgeschlossen
  werden; stilles Weglassen und First-Match-Auswahl sind unzulässig.

## 3. Feature Summary

Der Nutzer erhält im Erstellungs- und Bearbeitungsworkflow eine eigene,
editierbare Exportansicht mit Teaser, bestätigter Gesamtzeit, bestätigter
Schwierigkeit, höchstens fünf Exportschritten und höchstens 20 ausgewählten
Nicht-Gewürz-Zutaten. KI-Vorschläge werden vor dem Speichern angezeigt und
müssen ausdrücklich bestätigt werden.

Neue Rezepte erhalten diese Vorschläge im bestehenden Recipe-Analyze-Aufruf.
Bestehende Rezepte erhalten beim Öffnen zunächst nur einen lokalen Fallback;
eine KI-Vorbereitung ist dort ausschließlich über eine explizite Nutzeraktion
zulässig.

Beim Teilen werden das bestehende Instagram-Rezeptbild und ein neues
`1080 x 1350`-Rezept-Detailbild mit denselben serverseitig geladenen und
bestätigten Rezeptinformationen erzeugt. Beide Bilder werden als Paar
vorgehalten, in `FitTrack` gespeichert und in einem einzigen nativen
Multi-Image-Share übergeben.

## 4. Current Behaviour

### Persistenz und API

- `shared/types/recipes.ts` trennt Input, Persistenz und Response;
  `RecipeExportViewInput` enthält keinen `sourceFingerprint`, und
  `exportViewStatus` ist response-only.
- Create/Update verwenden das request-only Paar
  `exportView` + `exportViewAction: 'confirm'`. Ein vorhandener Export wird
  durch gewöhnliche Updates ohne dieses Paar bewahrt und nicht neu
  fingerprintet.
- GET/Create/erfolgreiches PUT liefern einen opaken ETag. Bestätigende PUTs
  verlangen den exakten `If-Match`-Wert; Handler und In-Memory/Cosmos-
  Repository verwenden Compare-and-Replace. `400`, `428` und `412` decken
  unvollständige Bestätigung, fehlende Vorbedingung und Konflikt ab.
- Der Server prüft ausgewählte Zutaten-IDs gegen die effektive,
  authentifiziert geladene Recipe und schließt Seasonings aus. Der Fingerprint
  wird serverseitig aus der effektiven Quelle gebildet. Cosmos-Contract-
  Evidence bleibt `UNVERIFIED`, weil der Emulator im letzten QA-Lauf nicht
  verfügbar war.
- Historische Cosmos-Dokumente ohne Exportfassung bleiben ohne Backfill
  lesbar.

### KI

- Der Recipe-Analyze-Aufruf verwendet aktuell Prompt-Version `v11`.
- Das strukturierte v11-Ergebnis enthält bereits den `exportSuggestion`-Block
  im selben KI-Aufruf; Q-1 hat AC-3, AC-15 und AC-16 als bestanden bewertet.
- Quota wird unter `recipe-analyze` vor dem KI-Aufruf geprüft und nach einer
  erfolgreichen Antwort getrackt.
- Der bestehende Review-Flow verhindert, dass KI-Werte ohne Bestätigung als
  Rezeptdaten gespeichert werden.
- Beim bloßen Öffnen eines bestehenden Rezepts gibt es keinen expliziten
  Export-Vorbereitungsweg.
- Die ausdrücklich gestartete Preparation ist authentifiziert, transient,
  verwendet `recipe-analyze`-Quota vor dem Provider und trackt einmal nach
  erfolgreicher Servervalidierung; Q-1 hat FT-QA-2026-040 als behoben
  verifiziert.
- Der verbleibende Defekt liegt nach der AI-Validierung:
  `resolveIncludedIngredientIds()` verwendet beim exakten und danach fuzzy
  Display-Namen-Match jeweils `recipe.ingredients.find()` und gibt nur
  `includedIngredientIds` zurück. `recipeApi.ts` hat ebenfalls einen ID-only
  Response-Typ; der Edit-Bootstrap übernimmt diese IDs und leert Analysekeys.
  Dadurch greift die bestehende Analysekey-Klärungssperre bei Preparation
  nicht. Backend stoppte den jüngsten Korrekturversuch ohne Änderungen, weil
  der Vertrag keinen Zustand für Kandidaten/Mehrdeutigkeit transportiert.

### Renderer und Share

- `POST /api/recipes/{id}/instagram-render` liefert ein einzelnes PNG mit
  exakt `1080 x 1350` Pixeln.
- Der Renderer erhält Rezeptdaten und Bilddaten aus dem authentifizierten
  Backend; der Client darf keine Titel-, Nutrition-, Eigentümer-, Blob- oder
  URL-Daten einspeisen.
- Das US-09-Mobile-Modell verwaltete eine einzelne PNG-URI; die US-10-
  Erweiterung verwaltet und testet nun das vollständige Bildpaar.
- Der produktive Android-Kandidat verwendet `react-native-share` und ruft
  automatisiert genau einmal `Share.open({ urls: [...] })` mit beiden
  unterschiedlichen PNG-URIs auf. Android-System-/Geräteverhalten bleibt bis
  U-1 `UNVERIFIED`.
- `mobile/src/shared/api/recipeInstagramRenderContract.ts` enthält für den
  Legacy-US-09-Pfad noch temporäre Werte `30` Minuten und `Einfach`; diese
  dürfen nicht in den neuen Bundle-Flow gelangen.
- Der Bundle-Handler verlangt vor beiden Renderern eine aktuelle bestätigte
  `exportView`, verwendet dieselbe serverseitig bestätigte Zeit/Schwierigkeit
  für beide Bilder und liefert kein Teilpaar.
- Der produktive Mobile-Pfad ist an das Bundle angebunden. Pair-Readiness,
  getrennte lokale PNG-URIs, zwei Vorschauen, Rollback/Retry/Cleanup und der
  native One-call-Vertrag sind automatisiert geprüft.
- Renderergrenzen werden vor dem Rendern und per Produktionsfont-Probe
  gemessen; Q-1 verifizierte Layout-/Overflowverhalten ohne stilles Kürzen.
  Die tatsächliche Cosmos-Contract-Ausführung bleibt davon getrennt
  `UNVERIFIED`.
- Die lokalen Prototypen
  `backend/output/nine-ingredients-details-template.png` und
  `backend/output/twenty-ingredients-details-template.png` sind visuelle
  Referenzen, keine Produktionsintegration.

### US-09-Verhalten, das erhalten bleiben muss

- serverseitig bestimmtes primäres Bild;
- gespeicherte Tag-Auswahl in Rezeptreihenfolge;
- expliziter High-Protein-Presentation-Toggle;
- bestehender Hero-Crop-Editor und temporärer Crop-Override;
- Abbrechen-, Back-, Retry- und Cleanup-Semantik;
- exaktes lokales Album `FitTrack`;
- keine clientseitigen Rezeptdaten im Renderer-Request;
- kein Instagram-Login, kein Instagram-Upload und keine Speicherung fertiger
  PNGs im Backend.

## 5. Desired Behaviour

### Exportansicht

Die Exportansicht ist Bestandteil desselben Recipe-Wizard-Flows für Create und
Edit. Sie zeigt mindestens:

- einen editierbaren Teaser mit maximal 96 Zeichen;
- eine positive, editierbare Gesamtzeit in Minuten;
- eine editierbare, getrimmte, einzeilige Schwierigkeit;
- höchstens fünf editierbare Exportschritte;
- eine Auswahl von höchstens 20 Nicht-Gewürz-Zutaten;
- eine sichtbare Information, ob die kompakte Fünf-Schritte-Darstellung aktiv
  ist;
- eine explizite Bestätigungs- und Speichermöglichkeit.

Die Exportansicht darf vor der Bestätigung nur lokalen Zustand ändern. Eine
Bestätigung schreibt sie zusammen mit dem Rezept über den bestehenden
Create-/Update-Vertrag.

### Neue Rezepte

Der bestehende Recipe-Analyze-Request liefert Exportvorschläge im selben
Structured-Output-Aufruf. Die Mobile-Review zeigt diese Vorschläge zusammen
mit den übrigen Rezeptdaten. Teaser, Zeit, Schwierigkeit, Auswahl und Schritte
sind editierbar.
Erst nach ausdrücklicher Bestätigung werden sie an den Recipe-Create- oder
-Update-Request angehängt.

### Bestehende Rezepte

Beim Öffnen wird ohne Netzwerk-KI-Aufruf ein lokaler Entwurf gebildet:

- Beschreibung wird als Teaser vorgeschlagen;
- vorhandene Schritte werden als Exportschritte vorgeschlagen;
- alle Nicht-Gewürz-Zutaten werden ausgewählt, wenn es höchstens 20 gibt;
- bei mehr als 20 Zutaten wird nichts still auf die ersten 20 gekürzt; die
  Auswahl bleibt eine offene Aufgabe;
- bei mehr als fünf Schritten wird nichts still abgeschnitten; der Entwurf
  wird als prüfbedürftig markiert;
- eine fehlende Zeit bleibt leer/offen;
- eine fehlende Schwierigkeit bleibt leer/offen;
- eine KI-Vorbereitung startet nur über eine sichtbare, explizite Aktion.

Der bestehende Mobile-FitTrack-Dialog fragt fehlende Zeit und Schwierigkeit
gemeinsam ab. Eine gültige Eingabe und die ausdrückliche Bestätigung sind vor
Speichern der Exportfassung und vor Teilen erforderlich. Die KI-Vorbereitung
kann beide Felder in einem transienten Ergebnis vorschlagen, ersetzt aber
keine Nutzerbestätigung.

Die KI-Vorbereitung lädt das Rezept ausschließlich serverseitig, verwendet die
Quota `recipe-analyze`, liefert einen transienten Vorschlag und persistiert
nichts. Auch ein Share-Aufruf darf keine KI auslösen.

### Stale Export

Eine bestätigte Exportfassung wird nicht gelöscht, wenn sich das Rezept ändert.
Der Server vergleicht den gespeicherten `sourceFingerprint` mit dem aktuellen
Rezeptzustand und markiert die Fassung als `stale`. Eine stale Fassung darf
nicht als aktuell geteilt werden. Der Nutzer kann sie erneut bearbeiten,
bestätigen oder über die explizite KI-Vorbereitung ersetzen.

### Detailbild

- Ausgabeformat ist immer PNG mit exakt `1080 x 1350` Pixeln.
- 1 bis 8 exportierte Nicht-Gewürz-Zutaten werden einspaltig in der großen
  Darstellung angezeigt.
- 9 bis 20 werden kompakt zweispaltig angezeigt, links
  `Math.ceil(count / 2)` Einträge. Damit stehen bei 9 Zutaten 5 links und 4
  rechts, bei 20 Zutaten 10 und 10.
- Bei 9 bis 14 Zutaten erscheint ausschließlich im freien Listenbereich das
  rein dekorative Teller-und-Gemüse-Motiv.
- Bei 15 bis 20 Zutaten bleibt das Motiv aus.
- Menge und Name jeder ausgewählten Zutat bleiben sichtbar.
- 1 bis 4 Exportschritte erhalten die große Darstellung; genau 5 Schritte die
  kompakte Darstellung.
- Kein Text, keine Zutat und kein Schritt wird per `slice`, Ellipse oder
  stiller Kürzung entfernt.

## 6. Scope

### Backend und Shared

- versionierter optionaler `exportView`-Vertrag;
- Create-/Update-Validierung und serverseitige Fingerprint-Berechnung;
- In-Memory- und Cosmos-Repository-Unterstützung;
- Stale-Erkennung und Exportfehlercodes;
- scoped Verifikation des bestehenden Recipe-Analyze-v11-Structured-Outputs
  inklusive Eval-Guard;
- explizite bestehende-Rezepte-Exportvorbereitung mit `recipe-analyze`-Quota;
- Detailadapter, Detailtemplate, Probe-Render und feldbezogene Rendererfehler;
- authentifizierter gemeinsamer Render-Bundle-Vertrag;
- Beibehaltung des direkten Instagram-Endpunkts für US-09-Kompatibilität;
- Backend-Unit-, Handler-, Renderer-, Contract- und Prompt-Tests.

### Mobile

- Exportansicht in Create/Edit innerhalb von `RecipeWizardScreen`;
- lokaler bestehende-Rezepte-Fallback und explizite KI-Aktion;
- typisierte API-Erweiterung;
- Share-Draft-Paar aus Instagram- und Detailbild;
- duale Preview, atomare Renderbereitschaft, Retry und Fehlerzustände;
- Zwei-Dateien-Media-Service mit Album-Rollback und einem Share-Aufruf;
- Integration des verifizierten nativen Multi-Image-Adapters;
- Erhalt von Tags, Highlight, Crop, Permissions, Back, Cancel und Cleanup;
- Mobile-Unit-, State-, API-, Komponenten- und gegebenenfalls E2E-Tests.

### Release und Dokumentation

- Automatisierte Native-Candidate-/Dependency-/Konfigurationsprüfungen;
- optionale, separat autorisierte Betriebsprüfung für einen Dev Build oder ein
  Deployment, falls dein finaler Test dies tatsächlich benötigt;
- API-, Domain-, Mobile- und UX-Dokumentation;
- dediziertes automatisiertes QA-Arbeitspaket; U-1 bleibt ein separater
  post-QA-User-Gate und ist keine manuelle QA-Voraussetzung.

## 7. Out of Scope

- Instagram-Login, Instagram-Graph-API-Upload oder Zustellbestätigung durch
  Instagram;
- Google-Photos-Upload oder Backupgarantie;
- Persistierung fertiger PNGs in Cosmos oder Blob Storage;
- ein neuer Cosmos-Container oder globale Migration alter Rezeptdokumente;
- automatische High-Protein-Klassifikation;
- eine neue Difficulty-Enum oder eine fachliche Klassifikation außerhalb des
  bestehenden getrimmten Renderer-Strings;
- Änderung bestehender Rezeptdaten ohne Nutzerbestätigung;
- eine zweite KI-Anfrage beim Teilen;
- zwei unabhängige native Share-Dialoge als Plattform-Fallback;
- automatische Alpha- oder Produktionsdeployments im Rahmen dieser Story;
- Änderung oder Neuinterpretation des US-09-Plans außerhalb der für die
  Kompatibilität notwendigen Erweiterungen.

## 8. Confirmed Facts

| Fakt | Quelle / Bedeutung |
|---|---|
| `Recipe` hat bereits ein optionales `exportView` und einen abgeleiteten Status | `shared/types/recipes.ts`; die Korrektur betrifft Bestätigungs- und Konkurrenzsemantik, nicht das erstmalige Feld |
| Zeit und Schwierigkeit gehören gemeinsam in die bestätigte Exportfassung | PO-1/PO-3; `exportView.totalTimeMinutes` und `exportView.difficulty` sind die kanonischen Bundle-Werte |
| Alte Cosmos-Rezepte müssen lesbar bleiben | Cosmos-Regel und US-10 AC-26; kein Backfill erforderlich |
| Kein neuer Container | US-10 Persistence Impact; bestehender `recipes`-Container bleibt zuständig |
| Recipe-Analyze ist `recipe-analyze`-quotiert | `backend/src/functions/ai.ts` und Quota-Dokumentation |
| Recipe-Analyze-Prompt-Version ist derzeit `v11` | `backend/src/lib/prompts/recipeAnalyze.ts`; Recipe-spezifische Eval bestand 8/8 |
| KI-Ausgaben werden vor Persistenz reviewed | `docs/kb/domain/07-ai-features.md` |
| `/api/recipes/{id}/instagram-render` ist geschützt | `requireUser()` plus user-scoped Repository-Lookup |
| Renderer darf nur serverseitige Rezeptdaten verwenden | bestehender API-/Renderer-Vertrag |
| PNG-Zielgröße ist `1080 x 1350` | bestehender Renderer und US-10 |
| Detailgrenzen sind Titel 60, Teaser 96, Menge 16, Zutatenname 36,
  Schritt 90 Zeichen | US-10 Template- und Exportregeln |
| Detaildaten schließen Seasonings aus | US-10 Produktentscheidung |
| Detaillayout teilt 9 als 5/4 und 20 als 10/10 | US-10 Produktentscheidung |
| Motiv gilt nur für 9 bis 14 Zutaten | US-10 AC-29 |
| US-09 speichert im lokalen Album `FitTrack` | bestehender Mobile- und UX-Vertrag |
| Mobile-Bildpaar und Android-One-call-Kandidat sind automatisiert geprüft | `expo-file-system` 19.0.24, `expo-media-library` 18.2.1, `react-native-share` 12.3.1; Android-Systemverhalten bleibt `UNVERIFIED` bis U-1 |
| Ein tatsächlicher nativer Android-Gerätepass liegt nicht vor | QA-Report und TECH-1; U-1 ist erst nach Q-1 und durch den User vorgesehen |
| Plattformumfang dieser Revision | Die unveränderte Story nennt iOS und Android; die neueste ausdrückliche Nutzeranforderung begrenzt diese Planrevision auf Android. Die Story bleibt unverändert. |
| TECH-1 und TECH-2 sind im aktuellen Workflow unverified, nicht fehlgeschlagen | Nutzerangabe; frühere fehlende SDK-/ADB-/Build-/Device-Umgebung beweist keinen Produktfehler |
| Der Base64-Transport ist derzeit unverified, nicht fehlgeschlagen | Es liegt keine reale Android-Budgetmessung vor |
| Latest Q-1 verdict is `FAIL`; only FT-QA-2026-037 / AC-11 remains actionable and Blocking | latest report re-review: FT-QA-2026-038 through -043 resolved; FT-QA-2026-044 not actionable under scoped Recipe Analyze gate |
| FT-QA-2026-037 remains `In progress`, Owner Backend, AC-11, key `US10-Q1-F01` | current `docs/qa/findings.md`; this plan does not create a duplicate or edit the register |
| Backend's latest B-5 correction attempt made no file changes | focused `npx vitest run src/functions/recipes.test.ts`: 63 passed; no typecheck, full suite, or build was run for the stopped attempt |
| Recipe confirmation ETag/If-Match/CAS is implemented and QA-verified at handler/unit level | `recipes.ts`, repository implementations, and latest Q-1 report; Cosmos emulator contract execution remains `UNVERIFIED` |
| Preparation currently returns only IDs and first-match mapping | `recipes.ts`, `recipeApi.ts`, and `recipeWizardEditBootstrap.ts`; exact/fuzzy `.find()` can select an arbitrary source ingredient and the preparation bootstrap clears analysis keys |
| Die In-Memory-Rezeptablage ist in `recipesRepository.ts` enthalten | `backend/src/lib/repositories/recipesRepository.ts`; `inMemoryRecipesRepository.ts` existiert in diesem Checkout nicht |
| Cosmos-Contract-Tests sind `UNVERIFIED` | QA-Report: Emulator `127.0.0.1:18081` war nicht erreichbar; kein Azure Cosmos wurde verwendet |
| Scoped Recipe-Analyze-Eval passed 8/8; latest aggregate diagnostic passed 31/31 | latest QA report; historical Daily/Weekly failures remain outside the US-10 prompt gate and authorize no unrelated edits |
| Previously reported package handoffs remain as reported; AC verification comes from latest Q-1 | B-1 Shared 449 tests/typecheck; B-2 handler/unit/type/build with Cosmos contract `UNVERIFIED`; B-3 scoped eval 8/8; B-4 focused renderer/overflow/typecheck; B-5 quota path previously passed but AC-11 mapping remains open; B-6 backend tests/type/build; F-1/F-2/F-3 Mobile suite 484/typecheck; F-1a mocked native preflight only |
| Kein EAS-Build und kein Deployment wurden ausgeführt oder durch diese Revision autorisiert | Nutzerangabe; operative Aktionen benötigen eine separate explizite Anforderung |
| Infrastruktur Impact ist Dev | US-10 und bestehende Release-Regeln |
| Mobile Build Impact ist Potential Native Impact | US-10 und mögliche Share-Bridge |
| Production ist laut KB noch nicht verfügbar | Konflikt mit der storyseitigen Forderung nach Produktionsintegration |

### Q-1 Findings und Routing

Die letzte Q-1-Re-Review ist `FAIL` mit genau einem offenen actionable
Blocking Finding. Der Report und das Finding-Register bleiben unverändert
; diese Planrevision korrigiert nur die Planung und erzeugt kein Duplikat.

| Finding | Letzter Q-1-Status | Verbleibendes Routing |
|---|---|---|
| FT-QA-2026-037 — AC-11: Preparation wählt bei exakten/fuzzy Mehrfachtreffern das erste Ingredient | Blocking; Owner Backend; Registerstatus `In progress`; key `US10-Q1-F01` | Backend B-5 definiert und implementiert den V2 Request/Response-Vertrag; Frontend F-1 macht Mehrdeutigkeit/Ausschluss explizit und sperrt Bestätigung bis zur Entscheidung. |
| FT-QA-2026-038 — gewöhnliches PUT bestätigt stale Export | Resolved | Keine Wiederöffnung; B-1/B-2 ETag-/Action-/CAS-Protokoll bleibt unverändert. |
| FT-QA-2026-039 — Share-Bundle akzeptiert stale Export | Resolved | Keine Wiederöffnung; B-6 stale-Gate bleibt unverändert. |
| FT-QA-2026-040 — Preparation umgeht Quota/Tracking | Resolved | Keine Wiederöffnung; B-5 behält die verifizierte Quota-Reihenfolge und Erfolgstracking-Regel. |
| FT-QA-2026-041 — produktiver Mobile-Share bleibt Single-Image | Resolved | Keine Wiederöffnung; F-2/F-3 Pair- und One-call-Vertrag bleibt unverändert. |
| FT-QA-2026-042 — Instagram-Bild nutzt keine bestätigten kanonischen Metadaten | Resolved | Keine Wiederöffnung; B-6 leitet beide Renderpfade aus derselben serverseitigen `exportView` ab. |
| FT-QA-2026-043 — API-/Mobile-Dokumentation divergiert | Resolved | Backend B-5 aktualisiert nur die neue Preparation-API-/Shared-Semantik; Frontend F-1 aktualisiert das betroffene Mobile-Verhalten. |
| FT-QA-2026-044 — aggregate Eval-Gate | Nicht actionable im US-10-Scope | Scoped Recipe Analyze 8/8 ist das US-10-Gate; Daily-/Weekly-Prompts bleiben unverändert. Der letzte Aggregate-Lauf bestand 31/31. |

## 9. Assumptions and Open Questions

Es gibt keine offenen Product-Owner-Entscheidungen. Android-only scope, genau
ein nativer Share-Aufruf, die QA-vor-Gerät-Reihenfolge, die User-Verantwortung
für U-1 und die Bedingung für B-6A sind entschieden. Die V2 Preparation-
Auflösung und das fail-closed Verhalten des bisherigen `{}`-V1-Vertrags sind
technische API-/UX-Vertragsentscheidungen, keine neue Domänenregel: sie
verhindern die von QA belegte stille First-Match-Auswahl, erhalten sichere
Legacy-Erfolge und machen ungelöste Review-Arbeit sichtbar. Die vorherige
Freigabe ist ungültig; diese Revision ist bis zur exakt angegebenen neuen
Freigabe gestoppt. Geräte- und Buildbedarf werden ausschließlich für U-1 nach
Q-1 beurteilt und blockieren keine automatisierten Checks oder Q-1.

### Technische Annahmen

1. `exportView` wird optional im bestehenden Recipe-Dokument gespeichert.
2. `sourceFingerprint` bleibt ausschließlich serverberechnete
  Persistenzdaten; `RecipeExportViewInput` enthält weiterhin kein
  Fingerprintfeld. Create/Update akzeptieren Exportfelder nur zusammen mit
  dem request-only `exportViewAction: 'confirm'`. Beim Update ist zusätzlich
  der vom Server im ETag-Header gelieferte Wert als `If-Match` erforderlich.
  Der Client berechnet oder setzt keinen Fingerprint.
3. Stale-Status wird aus Fingerprintvergleich abgeleitet und nicht als
   dauerhaftes, separat zu migrierendes Boolean gespeichert.
4. Der neue Bundle-Endpunkt verwendet gemäß PO-1 die serverseitig bestätigte
  Exportzeit.
5. Die vorgeschlagene Bundle-Antwort verwendet Base64 nur als Transport der
   flüchtigen PNG-Bytes. Titel, Teaser, Zutaten, Schritte, Blobnamen,
   Eigentümer und SAS-URLs werden nicht in die Mobile-Anfrage oder Antwort
   aufgenommen.
6. Für die positive Zeit wird zusätzlich zum `> 0`-Check eine technische
   Plausibilitätsobergrenze von 10080 Minuten vorgeschlagen. Diese Grenze ist
   kein Ersatz für die KI-Plausibilitätsprüfung und muss in der Implementierung
   als benannte Konstante testbar sein.
7. Der Detailrenderer erhält gemäß PO-3 die serverseitig bestätigte
  `exportView.difficulty`; `Einfach` ist im neuen Bundle-Flow kein Default.
8. Preparation-V2 ist ein transienter, auf die bei GET geladene ETag-Revision
  gebundener API-Vertrag. Der alte leere Body bleibt für ältere Mobile-Clients
  erhalten, darf aber bei Mehrdeutigkeit, Nichttreffer oder ID-Kollision keine
  ID-only-Erfolgsantwort liefern.
9. Der sichtbare Mobile-Review darf einen nicht eindeutig aufgelösten AI-Key
  nur nach expliziter Nutzerzuordnung zu einer eigenen Rezeptzutat oder nach
  sichtbarem Ausschluss als entschieden behandeln. Das persistierte Modell
  enthält weiterhin ausschließlich ausgewählte Ingredient-IDs.

### Technische Evidence-Aufgaben (keine offenen Nutzerentscheidungen)

- **F-1a / Frontend, vor Q-1:** automatisiert Package-/Konfigurationsverträglichkeit
  und den One-call-Contract mit zwei lokalen PNG-URIs prüfen. Ein Package-Wechsel
  erfordert vor seiner Umsetzung eine aktuelle Stable-Version-Verifikation.
  Android-Systemverhalten bleibt bis U-1 `UNVERIFIED`.
- **TECH-2 / User, U-1 nach Q-1:** Base64-JSON bleibt `UNVERIFIED`, bis die
  reale Android-Budgetmessung abgeschlossen ist. Nur eine dokumentierte
  Budgetüberschreitung oder ein messbarer Timeout-/Transportfehler löst B-6A
  aus; fehlende Messung ist weder Fail noch Anlass für Redesign.
- **B-4 / Backend, vor Q-1:** den Satori-/Resvg-Overflow-Gate mit
  Produktionsfonts automatisiert ausführen; die konkrete Bounds-Prüfung ist
  Teil der Renderer-Implementierung und ihres Tests.
- **B-3 / Backend, vor Q-1:** semantische Verdichtung gegen Temperatur-, Zeit-,
  Mengen-, Zutaten- und Aktionsanker validieren und durch Prompt-Eval prüfen.
- **B-2 / Backend, vor Q-1:** Nur `exportViewAction: 'confirm'` mit passendem
  `If-Match` darf einen Fingerprint für die effektiv gespeicherte Recipe-Quelle
  neu berechnen. Konflikte geben `412` ohne Änderung zurück; fehlendes
  `If-Match` bei Bestätigung gibt `428`. Gewöhnliche Updates lassen
  `exportView` aus und bewahren dessen alten Fingerprint.
- **User / U-1 readiness:** den Buildbedarf anhand der tatsächlich gewählten
  Testumgebung bestimmen. Bis dahin bleibt `Dev Build Required` `NOT
  DETERMINED`; keine Build- oder Deployment-Aktion ist autorisiert.

### Knowledge-Base-Konflikt

US-10 nennt Produktionsintegration ausdrücklich als Bestandteil. Die aktuelle
Knowledge Base beschreibt jedoch, dass Production noch nicht verfügbar ist.
Der Plan behandelt "Produktionsintegration" deshalb als produktionsfähige
Backend-/Mobile-/Dokumentationsverträge, Release-Gates und spätere
Deploybarkeit. Kein Agent darf daraus einen tatsächlich erfolgten oder aktuell
möglichen Produktionsdeploy ableiten. Die Knowledge Base muss nach der
Implementierung um den tatsächlichen Environment-Status ergänzt werden.

## 10. Existing Components to Reuse

| Bereich | Wiederverwendung |
|---|---|
| Handler | `withHandler`, `requireUser`, `parseBody`, bestehende Status- und Logging-Muster |
| Recipe API | `recipes.ts`, `recipeApi.ts`, bestehende Create-/Update-/GET-Verträge |
| Persistenz | `RecipesRepository` einschließlich In-Memory-Implementierung in `recipesRepository.ts`, `CosmosRecipesRepository`, bestehender `recipes`-Container |
| Ernährung | `calculateRecipeNutrition`; keine Client-Autorität für gespeicherte Nutrition |
| AI | `recipeAnalyzeHandler`, `analyzeRecipeText`, Structured Output, `enforceQuota`/`trackUsage` |
| Wizard | `RecipeWizardScreen` als Orchestrator, bestehende Phasen und Review-/Back-Semantik |
| Edit-Bootstrap | `recipeWizardEditBootstrap.ts` für bestehende Zutaten, Schritte und Bilder |
| Renderer | `recipeAdapter.ts`, `render.ts`, Satori, Resvg, Sharp, vorhandene Fonts und Fehler-Muster |
| Instagram | bestehender direkter Render-Endpunkt und US-09-Options-/Crop-Vertrag |
| Mobile Share | `recipeShareDraftState.ts`, `RecipeInstagramPreview.tsx`, `recipeShareMediaService.ts`, `InfoOverlay`, `ConfirmSheet` |
| Media | bestehende Permission-, Album-, Rollback- und Cleanup-Logik für `FitTrack` |
| Theme/UX | bestehende Dark-only Tokens, deutsche Strings, Recipe- und Snackbar-/Overlay-Muster |
| Testtooling | Vitest pro Paket, Cosmos Emulator für Contract-Tests, `npm run test:eval`, `npm run build:verify` |

Keine zusätzliche Recipe-Creation- oder Navigation-Architektur einführen.

## 11. Proposed Technical Solution

### 11.1 Shared Exportvertrag

Der persistierte Shared-Typ soll fachlich mindestens folgende Form abbilden:

```ts
export interface RecipeExportStep {
  order: number;
  description: string;
}

export interface RecipeExportView {
  version: 1;
  teaser: string;
  totalTimeMinutes: number;
  difficulty: string;
  steps: RecipeExportStep[];
  includedIngredientIds: string[];
  sourceFingerprint: string;
}

export interface RecipeExportViewInput {
  version: 1;
  teaser: string;
  totalTimeMinutes: number;
  difficulty: string;
  steps: RecipeExportStep[];
  includedIngredientIds: string[];
}

export interface RecipeExportSuggestion {
  version: 1;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: string | null;
  steps: RecipeExportStep[];
  includedIngredientKeys: string[];
  sourceFingerprint: string;
}

export interface RecipeExportIngredientCandidate {
  ingredientId: string;
  displayName: string;
  inputAmount: number | null;
  unit: string;
}

export type RecipeExportIngredientResolution =
  | {
      analysisKey: string;
      displayName: string;
      status: 'resolved';
      ingredientId: string;
    }
  | {
      analysisKey: string;
      displayName: string;
      status: 'ambiguous';
      candidates: RecipeExportIngredientCandidate[];
    }
  | {
      analysisKey: string;
      displayName: string;
      status: 'unmatched';
      candidates: [];
    };

export interface PrepareRecipeExportViewRequestV2 {
  contractVersion: 2;
}

export interface PrepareRecipeExportViewSuggestionV2 {
  version: 1;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: string | null;
  steps: RecipeExportStep[];
  ingredientResolutions: RecipeExportIngredientResolution[];
}

export interface PrepareRecipeExportViewResponseV2 {
  recipeId: string;
  contractVersion: 2;
  sourceEtag: string;
  suggestion: PrepareRecipeExportViewSuggestionV2;
}

export interface PrepareRecipeExportViewResponseV1 {
  recipeId: string;
  suggestion: {
    version: 1;
    teaser: string;
    totalTimeMinutes: number | null;
    difficulty: string | null;
    steps: RecipeExportStep[];
    includedIngredientIds: string[];
  };
}
```

`Recipe.exportView` bleibt optional. Die Input-Form ohne Fingerprint ist für
Create/Update vorgesehen; der Response-/Persistenztyp enthält den
serverberechneten Fingerprint. `sourceFingerprint` darf weder aus dem Client
übernommen noch durch einen Mobile-Hash ersetzt werden.

Der Request ergänzt den request-only Typ `RecipeExportViewAction = 'confirm'`.
Ein Create-/Update-Body darf `exportView` nur gemeinsam mit
`exportViewAction: 'confirm'` senden; dieser Marker wird nicht persistiert.
Bei einem Update ist zusätzlich der ETag aus dem Recipe-GET als HTTP-Header
`If-Match` erforderlich. Der ETag ist eine opake Serverrevision, kein
Client-Fingerprint und kein Feld in `RecipeExportViewInput`.

Die öffentliche Recipe-Antwort soll zusätzlich einen abgeleiteten Status
ausgeben können:

```ts
export type RecipeExportViewStatus = 'missing' | 'current' | 'stale';
```

`exportViewStatus` ist response-only und wird nicht als eigene Persistenz-
autorität gespeichert. Der Status lautet `missing`, `current` oder `stale`;
bei fehlender Exportfassung bleibt das Feld abwesend und die Mobile-Ansicht
behandelt dies als `missing`.

#### Preparation-Auflösung für bestehende Rezepte (B-5 / F-1)

Die bestehende Preparation-Route erhält einen additiven, explizit
versionierten Vertrag. Neue Mobile-Clients senden als strict JSON-Body
`{ "contractVersion": 2 }` und den beim Recipe-GET geladenen opaken ETag im
`If-Match`-Header. Eine erfolgreiche V2-Antwort hat exakt diese Form:

```json
{
  "recipeId": "recipe-uuid",
  "contractVersion": 2,
  "sourceEtag": "W/\"recipe-revision-7\"",
  "suggestion": {
    "version": 1,
    "teaser": "Frischer Salat",
    "totalTimeMinutes": 15,
    "difficulty": "Einfach",
    "steps": [{ "order": 1, "description": "Tomaten schneiden." }],
    "ingredientResolutions": [
      {
        "analysisKey": "tomato-key",
        "displayName": "Tomaten",
        "status": "resolved",
        "ingredientId": "ingredient-uuid-1"
      },
      {
        "analysisKey": "pepper-key",
        "displayName": "Paprika",
        "status": "ambiguous",
        "candidates": [
          {
            "ingredientId": "ingredient-uuid-2",
            "displayName": "Paprika rot",
            "inputAmount": 150,
            "unit": "g"
          },
          {
            "ingredientId": "ingredient-uuid-3",
            "displayName": "Paprika gelb",
            "inputAmount": 1,
            "unit": "Stück"
          }
        ]
      },
      {
        "analysisKey": "herb-key",
        "displayName": "Kräuter",
        "status": "unmatched",
        "candidates": []
      }
    ]
  }
}
```

Der strict Request akzeptiert ausschließlich `{}` als Legacy-V1 oder
`{ "contractVersion": 2 }` als V2; unbekannte Felder oder andere Versionen
ergeben `400 invalid_export_preparation_request`. Ein Legacy-V1-Caller darf
ohne `If-Match` aufrufen; wenn er den Header mitsendet, wird er gegen die
aktuelle Recipe-Revision geprüft. V2 ohne Header ergibt `428`, mit veraltetem
Header `412`.

`ingredientResolutions` enthält genau einen Eintrag je AI-
`includedIngredientKey`, in deren Reihenfolge. Die Zuordnung verwendet die
validierten AI-`analysisKey`-/`displayName`-Werte und ausschließlich Zutaten
des per `requireUser()` und Recipe-ID geladenen Rezepts. Verglichen wird der
getrimmte, kleingeschriebene Anzeigename: genau ein exakter food-/Legacy-food-
Treffer ist `resolved`; mehrere exakte Treffer sind `ambiguous` und beenden
die Suche ohne fuzzy-Fallback. Gibt es keinen exakten Treffer, wird die
bisherige Contains-in-either-direction-Fuzzy-Regel auf alle geeigneten
Quellzutaten angewandt: genau ein Treffer ist `resolved`, mehrere sind
`ambiguous`, keiner ist `unmatched`. `category: 'seasoning'` ist niemals ein
Kandidat; eine fehlende Legacy-Kategorie bleibt food. Kandidaten folgen der
gespeicherten Rezeptreihenfolge und enthalten nur ID, Anzeigename,
`inputAmount` und `unit` der Zutaten dieses authentifizierten Rezepts. Es gibt
keinen globalen Zutaten-Lookup und keine Zutaten eines anderen Rezepts oder
Benutzers in der Antwort. Eine Zuordnung mehrerer AI-Keys auf dieselbe
RecipeIngredient-ID ist kein automatisch bestätigbarer eindeutiger Satz und
muss im Mobile-Review explizit aufgelöst werden.

V2 erfordert `If-Match`. Fehlt der Header, antwortet der Handler mit `428`
`recipe_precondition_required`; bei Abweichung von der aktuellen Recipe-
Revision antwortet er vor Quota-/Provider-Aufruf mit `412`
`recipe_revision_conflict`. `sourceEtag` echo't exakt den geprüften ETag; die
Mobile-Ansicht verwirft die Antwort, wenn er nicht der beim Edit geladenen
Revision entspricht. V2-Antworten sind transient und enthalten weder ein
fertiges `includedIngredientIds`-Array noch eine persistierbare
`exportView`-Fassung.

**Kompatibilität älterer Mobile-Clients:** Der bisherige strict leere Body
`{}` bleibt als Legacy-V1-Aufruf akzeptiert. Wenn jeder AI-Included-Key
eindeutig auf eine unterschiedliche geeignete RecipeIngredient-ID aufgelöst
wird, bleibt die bisherige erfolgreiche V1-Antwort unverändert:
`suggestion.includedIngredientIds` enthält die eindeutigen IDs. Sobald auch
nur ein Key `ambiguous`, `unmatched` oder mit einer anderen AI-Zeile auf dieselbe
ID kollidiert, antwortet V1 mit `409` und
`{ "error": "export_preparation_contract_upgrade_required" }`, ohne
Suggestion. Das verhindert, dass ältere Clients Mehrdeutigkeit stillschweigend
als First-Match oder als ausgelassene Zutat bestätigen. Nach gültiger AI-
Servervalidierung wird auch dieser V1-Aufruf gemäß `recipe-analyze` einmal
getrackt; die Vorschlagsantwort wird in keinem Fall persistiert. Der neue
Mobile-Client verwendet V2 und zeigt den kontrollierten V1-Upgradefehler nicht
im normalen Pfad.

Die unveränderte V1-Erfolgsform lautet:

```json
{
  "recipeId": "recipe-uuid",
  "suggestion": {
    "version": 1,
    "teaser": "Frischer Salat",
    "totalTimeMinutes": 15,
    "difficulty": "Einfach",
    "steps": [{ "order": 1, "description": "Tomaten schneiden." }],
    "includedIngredientIds": ["ingredient-uuid-1"]
  }
}
```

Im V2-Review wird ein `resolved`-ID-Treffer als AI-Vorschlag angezeigt, nicht
als gespeicherte Auswahl. Bei `ambiguous` wird keine ID vorgewählt; der Nutzer
muss genau einen der servergelieferten Kandidaten ausdrücklich zuordnen oder
die AI-Zutat sichtbar aus der Exportauswahl ausschließen. Bei `unmatched` zeigt
Mobile Name und offene Zuordnung und verlangt entweder eine bewusste manuelle
Zuordnung zu einer food-Zutat des gerade geladenen Rezepts oder den
ausdrücklichen Ausschluss. Alle AI-Included-Keys müssen damit eine sichtbare
Review-Entscheidung haben, und zwei Keys dürfen nicht still dieselbe
RecipeIngredient-ID ergeben. Ohne Entscheidung ist `Exportansicht bestätigen`
gesperrt. Nach der Entscheidung baut Mobile ausschließlich die normale
`includedIngredientIds`-Liste; Resolutionen, Kandidaten und AI-Keys werden
nicht persistiert.

Bei der späteren Bestätigung validiert Backend jede übermittelte ID erneut
gegen die effektive Zutatenliste des authentifizierten Rezepts in demselben
ETag-gebundenen Update: Die ID muss dort genau einmal vorkommen und darf kein
Seasoning bezeichnen. Eine nicht vorhandene, doppelte, fremde oder entfernte
ID wird mit `400` (`invalid_export_view_ingredient`) ohne Write abgewiesen;
hat sich die Recipe-Revision seit Review geändert, gewinnt vorher `412` ohne
Write. Der Server lädt keine Ingredient-ID als globales/owner-fremdes Objekt;
ein ID-Wert ohne genau ein passendes Ingredient im effektiven, user-scoped
Recipe-Payload ist kein gültiger Auswahlbeleg. Ein neu hinzugefügtes
Ingredient ist nur dann auswählbar, wenn sein vollständiges Ingredient-Objekt
Teil desselben autorisierten Recipe-Updates ist. Danach bleiben
Fingerprintbildung und Compare-and-Replace unverändert: Fingerprint
serverseitig aus der effektiven Recipe, atomarer CAS gegen den geprüften ETag.
Candidate-IDs sind nur UI-Vorschläge, keine Serverautorität.
Es wird weder ein neues Persistenzfeld noch ein zusätzlicher KI-Aufruf
eingeführt.

### 11.2 Gemeinsame Validierungsregeln

Die Backend-Grenze validiert strikt:

- `version` ist exakt `1`;
- `teaser` ist getrimmt, nicht leer und höchstens 96 Zeichen;
- `totalTimeMinutes` ist endlich, ganzzahlig und positiv, mit der freigegebenen
  technischen Obergrenze;
- `difficulty` ist getrimmt, nicht leer und einzeilig; im neuen Bundle gibt es
  keinen Defaultwert `Einfach`;
- `steps` enthält 1 bis 5 eindeutige positive `order`-Werte in aufsteigender
  Reihenfolge;
- jeder Schritt ist getrimmt, nicht leer und höchstens 90 Zeichen;
- `includedIngredientIds` enthält höchstens 20 eindeutige IDs;
- jede ID gehört genau einmal zum effektiven Recipe des authentifizierten
  Besitzers und zu einem Ingredient mit `category !== 'seasoning'`; fehlende
  Legacy-Kategorie wird wie bisher als `food` behandelt. Fehlende, mehrfache,
  fremde oder entfernte IDs geben `400 invalid_export_view_ingredient` ohne
  Persistierung zurück. Ein veralteter ETag wird vorher als `412` abgewiesen;
- Menge und Name für den Renderer werden aus dem servergeladenen Ingredient
  gebildet, nicht aus frei übergebenen Exporttexten;
- Titel, Mengen, Zutatenname und Layout werden zusätzlich im Renderer mit den
  Grenzen 60/16/36 und dem Probe-Render geprüft.

Ein ungültiges `exportView` führt zu einem 400 beim Recipe-Create/Update. Ein
bereits gespeichertes Rezept wird bei einem ungültigen späteren Export- oder
Render-Versuch nicht überschrieben oder beschädigt.

#### Explizite Bestätigung und Konkurrenzschutz

- Create mit Exportfassung erfordert `exportView` und
  `exportViewAction: 'confirm'`; Backend validiert die vollständige Recipe-
  Eingabe, berechnet Nutrition und `sourceFingerprint` serverseitig und legt
  Rezept plus Exportfassung in einem Create an. Für ein neues Resource-ID gibt
  es keine vorherige `If-Match`-Vorbedingung.
- Ein Update ohne diese beiden Felder ist ein gewöhnlicher Recipe-Edit. Mobile
  lässt `exportView` und `exportViewAction` dabei weg. Backend erhält einen
  vorhandenen Export unverändert einschließlich seines alten Fingerprints;
  Änderungen an fingerprintrelevanten Rezeptdaten lassen den Status `stale`
  werden. Ein Body mit genau einem der beiden Felder ist `400` und wird nicht
  geschrieben.
- Eine ausdrückliche Re-Bestätigung sendet `exportView`,
  `exportViewAction: 'confirm'` und `If-Match` mit dem exakten ETag aus dem
  `GET /api/recipes/{id}`, auf dessen Inhalt die Review basiert. Backend bildet
  die effektive Recipe nach dem PUT-Merge und der serverseitigen
  Nutrition-Berechnung, berechnet daraus den neuen Fingerprint und persistiert
  Quelle und Exportfassung in einem bedingten Replace.
- `GET /api/recipes/{id}`, `POST /api/recipes` und erfolgreiche
  `PUT /api/recipes/{id}` liefern den aktuellen ETag im HTTP-Response-Header.
  Für die Bestätigung eines bestehenden Rezepts fehlt `If-Match` -> `428`;
  passt der Wert nicht mehr oder schlägt die Cosmos-ETag-Bedingung beim
  Schreiben fehl -> `412`, ohne Teilpersistenz. Nach `412` lädt Mobile das
  aktuelle Rezept neu und erfordert eine erneute Review/Bestätigung; es spielt
  den alten Request nicht automatisch erneut ab.
- Fehlercodes sind stabil und werden im API-Referenzdokument beschrieben:
  `invalid_export_view_confirmation` (`400`) für ein unvollständiges
  `exportView`-/Action-Paar, `recipe_precondition_required` (`428`) für eine
  Bestätigung ohne `If-Match` und `recipe_revision_conflict` (`412`) für einen
  veralteten ETag oder Write-Race. Ein `If-Match` auf einem gewöhnlichen PUT
  ist optional, aber wird bei Vorliegen ebenfalls geprüft.
- Jeder Repository-Update verwendet Compare-and-Replace auf genau der Revision,
  aus der der Handler die effektive Recipe berechnet hat, auch wenn ein
  gewöhnlicher Legacy-PUT keinen Client-ETag sendet. Cosmos nutzt den
  gelesenen `_etag` als Replace-Bedingung; der In-Memory-Repository bildet
  dieselbe opake Revision/CAS-Semantik ab. Ein Write-Race gibt `412` ohne
  Teilpersistenz zurück. Die Mobile-API behält den GET-ETag und sendet ihn bei
  jedem PUT; bei Bestätigungen ist er serverseitig verpflichtend.
- Die Fingerprint-Berechnung bleibt ausschließlich serverseitig. Kein
  `sourceFingerprint` im Request ist erlaubt; `RecipeExportViewInputSchema`
  weist unbekannte Fingerprintfelder weiterhin zurück.

### 11.3 Source Fingerprint und Stale-Erkennung

Der Backend-Fingerprint wird aus einer kanonischen, deterministisch
serialisierten Struktur und SHA-256 gebildet. Die Struktur enthält mindestens:

- Rezeptname;
- Beschreibung oder `null`;
- Portionen;
- Schritte in ihrer fachlichen Reihenfolge mit `order`, `title` und
  `description`;
- alle Zutaten in ihrer gespeicherten Reihenfolge mit `id`, `displayName`,
  Kategorie, Eingabemodus, Eingabemenge, Grammmenge, Einheit,
  `amountLabel`, Produkt-/Reusable-Item-Verknüpfungen, AI-Estimate- und
  Portionsmetadaten sowie `nutritionPer100g` und `nutritionContribution`;
- gespeicherte Tags;
- serverberechnete `nutritionPerPortion`, weil sie im gemeinsamen Instagram-
  und Detail-Rendering Teil der effektiven Recipe-Quelle ist.

Die kanonische JSON-Serialisierung sortiert Objekt-Keys rekursiv, bewahrt aber
fachliche Array-Reihenfolgen; SHA-256 erzeugt den Fingerprint. Änderungen an
einem dieser Werte machen die gespeicherte Exportfassung `stale`.

## 12. Backend Work Package

  **Agent:** Backend

  **Goal:** Den serverseitigen Exportvertrag mit bestätigter Zeit und
  Schwierigkeit, Persistenz, KI, Renderer, Vorbereitung und Bundle-Route in
  sechs eindeutig routbaren Subtasks bereitstellen.

  **Dependencies:** Die unveränderte US-10-Story, die entschiedenen
  PO-Regeln, die bestehenden Auth-, Quota-, Repository- und Renderer-Verträge.

  Dieses Work Package hat keinen separat ausführbaren Parent-Schritt. Jeder
  ausführbare Eintrag steht als eigene Subtask mit vollständigem Kontext,
  Akzeptanzbezug und Handoff unten.

### Subtask B-1: Shared-Vertrag

  **Agent:** Backend

  **Goal:** Den vorhandenen Shared-Exportvertrag um den request-only Typ
  `RecipeExportViewAction = 'confirm'` und die eindeutige Trennung von Input,
  Persistenz und Response ergänzen. Fingerprint bleibt aus dem Input
  ausgeschlossen. Strukturgrenzen, Unit-Tests und
  `docs/kb/tech/04-shared-library.md` aktualisieren.

  **Required Knowledge Base:**

  - `docs/kb/tech/04-shared-library.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/domain/06-recipes.md`

  **Required Repository Context:**

  - `shared/types/recipes.ts`
  - `shared/index.ts`
  - `shared/package.json`
  - `shared/vitest.config.mts`

  **Required Skills:**

  - None

  **Relevant Acceptance Criteria:**

  - AC-1
  - AC-5
  - AC-17
  - AC-19
  - AC-26
  - AC-27
  - AC-28

  **Dependencies:**

  - Keine vorherige Implementierungs-Subtask; die entschiedenen PO-Regeln und
    Abschnitt 11 dieses Plans sind verbindlich.

  **Expected Handoff:**

  - versionierte Shared-Typen für `exportView`, `difficulty`, Status und den
    request-only Bestätigungsmarker;
  - dokumentierter Body-/Header-Vertrag: Bestätigungsmarker im Request,
    Server-ETag als `If-Match`, kein Client-Fingerprint;
  - reine Strukturtests und Typecheck-Ergebnis;
  - aktualisierte Shared-KB-Dokumentation für B-2 und die nachgelagerten
    Frontend-Subtasks.

### Subtask B-2: Backend-Persistenz

  **Agent:** Backend

  **Goal:** Create/Update/GET/List und Repositories für das optionale
  `exportView` mit explizitem Bestätigungsmarker, ETag/If-Match und atomarem
  Compare-and-Replace umsetzen. Gewöhnliche Updates bewahren die alte Fassung;
  nur explizit bestätigte Updates berechnen den Fingerprint neu. Cosmos-
  Lesekompatibilität und `docs/kb/domain/06-recipes.md` bleiben erhalten bzw.
  werden aktualisiert.

  **Required Knowledge Base:**

  - `docs/kb/tech/02-backend.md`
  - `docs/kb/tech/04-shared-library.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/domain/06-recipes.md`

  **Required Repository Context:**

  - `backend/src/functions/recipes.ts`
  - `backend/src/functions/recipes.test.ts`
  - `backend/src/lib/repositories/recipesRepository.ts`
  - `backend/src/lib/repositories/cosmosRecipesRepository.ts`
  - `backend/src/lib/repositories/cosmosRecipesRepository.contract.test.ts`
  - `backend/src/lib/recipeValidation.ts`
  - `backend/src/lib/cosmos.ts`
  - `shared/types/recipes.ts`

  **Required Skills:**

  - `cosmos-data-model-and-migration`

  **Relevant Acceptance Criteria:**

  - AC-5
  - AC-6
  - AC-8
  - AC-10
  - AC-11
  - AC-12
  - AC-17
  - AC-19
  - AC-26
  - AC-27
  - AC-28

  **Dependencies:**

  - B-1 Shared-Vertrag und dessen Handoff.

  **Expected Handoff:**

  - Create verlangt bei übermittelter Exportfassung `exportViewAction: 'confirm'`;
  - gewöhnliche Updates ohne Exportfelder erhalten den alten Snapshot und
    können ihn nicht re-fingerprintfen; unvollständige Marker-Paare sind `400`;
  - GET/Create/PUT ETag-Header und explizites Update-`If-Match`; fehlendes
    `If-Match` bei Bestätigung ist `428`, stale Revision/Write-Race ist `412`
    ohne Teilpersistenz;
  - serverseitige Fingerprint- und `missing`/`current`/`stale`-Semantik für die
    effektiv gemergte Recipe;
  - In-Memory-Revisionstest und Cosmos-ETag-Contract-Test für die Compare-and-
    Replace-Grenze;
  - Legacy-Cosmos-Roundtrip ohne Migration und ohne neuen Container;
  - Repository-, Handler- und Cosmos-Contract-Tests;
  - aktualisierte Domain-Dokumentation für B-3 bis B-6.

### Subtask B-3: AI-Erweiterung

  **Agent:** Backend

  **Goal:** Den bereits implementierten Recipe-Analyze-v11-Exportblock und
  seine Review-/Traceability-Regeln gegen den scoped Recipe-Analyze-Eval
  nachweisen. B-3 ändert keine Daily- oder Weekly-Prompts; nur ein Fehler im
  in-scope Recipe-Analyze-Eval autorisiert eine B-3-Korrektur.

  **Required Knowledge Base:**

  - `docs/kb/tech/02-backend.md`
  - `docs/kb/tech/06-ai-integrations.md`
  - `docs/kb/domain/06-recipes.md`
  - `docs/kb/domain/07-ai-features.md`
  - `docs/kb/domain/08-quota-system.md`

  **Required Repository Context:**

  - `backend/src/functions/ai.ts`
  - `backend/src/lib/openai.ts`
  - `backend/src/lib/prompts/recipeAnalyze.ts`
  - `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`
  - `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`
  - `backend/src/lib/quota.ts`
  - `shared/types/recipes.ts`

  **Required Skills:**

  - `azure-openai-feature-integration`

  **Relevant Acceptance Criteria:**

  - AC-3
  - AC-15
  - AC-16
  - AC-17
  - AC-19
  - AC-25
  - AC-27
  - AC-28

  **Dependencies:**

  - B-2 Backend-Persistenz für den effektiven Rezeptkontext und den
    serverseitigen Fingerprint.

  **Expected Handoff:**

  - Recipe-Analyze-v11-Schema und Version Guard mit gemeinsamem
    Zeit-/Schwierigkeitsblock unverändert beibehalten;
  - `analysisKey`-, Anker- und Verdichtungsvalidierung ohne `30`-/`Einfach`-
    Default;
  - scoped Recipe-Analyze-Eval-Ergebnis; fehlende Credentials werden als
    `UNVERIFIED` gemeldet;
  - vorhandene Full-Aggregate-Eval-Fehler exakt als nicht-US-10-Diagnostik
    ausweisen; keine Daily-/Weekly-Änderung und kein aggregate Pass-Claim;
  - Quota-/Review-Semantik für B-5 und Frontend F-1;
  - aktualisierte `docs/kb/domain/07-ai-features.md`.

### Subtask B-4: Detailrenderer

  **Agent:** Backend

  **Goal:** Den serverseitigen Detailadapter und das `1080 x 1350`-Template mit
  den Regeln für 1-8, 9-20, 9-14-Motiv und 1-5 Schritte umsetzen. Stille
  Kürzung wird entfernt; TECH-3 wird durch den Produktionsfont-Probe-Render
  und feldbezogene Fehler erfüllt.

  **Required Knowledge Base:**

  - `docs/kb/tech/02-backend.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/domain/06-recipes.md`

  **Required Repository Context:**

  - `backend/src/lib/instagramRenderer/recipeAdapter.ts`
  - `backend/src/lib/instagramRenderer/render.ts`
  - `backend/src/lib/instagramRenderer/`
  - `backend/output/nine-ingredients-details-template.png`
  - `backend/output/twenty-ingredients-details-template.png`
  - `backend/src/functions/instagramRecipe.ts`

  **Required Skills:**

  - None

  **Relevant Acceptance Criteria:**

  - AC-9
  - AC-10
  - AC-12
  - AC-13
  - AC-14
  - AC-15
  - AC-17
  - AC-18
  - AC-19
  - AC-29

  **Dependencies:**

  - B-2 Backend-Persistenz für bestätigte Exportdaten und serverseitige
    Ingredient-Auswahl;
  - B-3 AI-Erweiterung für die validierten Verdichtungsdaten.

  **Expected Handoff:**

  - Detailadapter-/Template-Vertrag mit serverseitig gebildeten Mengen und
    Namen;
  - tatsächliche Spalten-, Schritt- und Motivregeln ohne Truncation;
  - strukturierte Overflow-Fehler und TECH-3-Probe-Render-Ergebnis;
  - Renderer-Fixture- und Bounds-Test-Ergebnisse für B-6 und QA.

### Subtask B-5: Bestehende-Rezept-Preparation

  **Agent:** Backend

  **Goal:** Den bestehenden authentifizierten Endpoint
  `POST /api/recipes/{id}/export-view/prepare` für neue Mobile-Clients um den
  strict V2 Request-/Response-Vertrag aus Abschnitt 11 erweitern. V2 muss die
  beim Edit geladene Recipe-Revision per `If-Match` binden, eindeutige
  Zuordnungen als einzelne ID und Mehrdeutigkeit/Nichttreffer als explizite,
  `analysisKey`-gebundene Kandidatenzustände zurückgeben. Der bisherige
  `{}`-Aufruf bleibt für ältere Mobile-Clients kompatibel, darf bei einem
  nicht eindeutigen Ergebnis aber nur `409
  export_preparation_contract_upgrade_required` liefern, niemals eine
  ID-only-Antwort mit First-Match oder stiller Auslassung. Keine Prompt- oder
  Persistenzänderung: Preparation bleibt transient und nutzt den bestehenden
  Recipe-Analyze-Aufruf, `recipe-analyze`-Quota vor Provider und genau ein
  Usage-Tracking nach gültiger Servervalidierung. Shared-Typen, Backend-Schema,
  API-Dokumentation und Fokus-Regressionstests werden gemeinsam aktualisiert.

  **Required Knowledge Base:**

  - `docs/kb/tech/02-backend.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/tech/04-shared-library.md`
  - `docs/kb/domain/06-recipes.md`
  - `docs/kb/domain/07-ai-features.md`
  - `docs/kb/domain/08-quota-system.md`

  **Required Repository Context:**

  - `backend/src/functions/recipes.ts`
  - `backend/src/functions/recipes.test.ts`
  - `backend/src/functions/ai.ts`
  - `backend/src/index.ts`
  - `backend/src/lib/quota.ts`
  - `backend/src/lib/recipeValidation.ts`
  - `backend/src/lib/recipeValidation.test.ts`
  - `backend/src/lib/repositories/recipesRepository.ts`
  - `backend/src/lib/openai.ts`
  - `shared/types/recipeExport.ts`
  - `shared/types/recipes.ts`
  - `shared/types/recipes.test.ts`
  - `mobile/src/shared/api/recipeApi.ts`
  - `mobile/src/modules/recipes/recipeWizardEditBootstrap.ts`

  **Required Skills:**

  - `azure-openai-feature-integration`

  **Relevant Acceptance Criteria:**

  - AC-6
  - AC-7
  - AC-11
  - AC-15
  - AC-16
  - AC-19
  - AC-25
  - AC-27
  - AC-28

  **Dependencies:**

  - B-2 verified versioned Recipe repository/ETag contract;
  - B-3 validated Recipe Analyze output and stable `analysisKey` references.
    B-4 is not a dependency of preparation ambiguity resolution.

  **Expected Handoff:**

  - Shared request/response types for V2 plus strict backend parsing of `{}`
    legacy and `{ "contractVersion": 2 }` V2 requests;
  - V2 requires exact `If-Match`, checks it before quota/provider, and returns
    `sourceEtag` with the transient suggestion;
  - exact/fuzzy matcher collects all eligible source matches: one exact wins;
    otherwise one fuzzy match resolves, multiple matches return every
    same-recipe candidate, and zero matches return `unmatched`; seasoning and
    other-user/other-recipe data never enter candidate results;
  - V2 returns exactly one resolution for each AI-included key and never
    includes an ID-only `includedIngredientIds` array;
  - legacy V1 keeps its old success shape only when every key maps to a
    distinct unique source ID; ambiguity, unmatched keys, or duplicate IDs
    return `409 export_preparation_contract_upgrade_required` with no
    suggestion;
  - duplicate-exact, overlapping-fuzzy, exact-precedence, unmatched,
    seasoning-exclusion, recipe-scope, V1-compatibility, V2-ETag,
    quota/provider/validation/auth regression tests;
  - quota is checked before AI; successful validated AI output tracks exactly
    once even if a legacy caller then receives the controlled upgrade error;
    quota/provider/AI-validation failures do not track;
  - no Cosmos write, prompt/schema change, extra AI call, or change to the
    persisted `exportView`/fingerprint protocol;
  - updated Shared/API documentation and TypeScript/Focused-test evidence for
    F-1 and QA.

### Subtask B-6: Share-Bundle

  **Agent:** Backend

  **Goal:** Den authentifizierten `share-bundle`-Handler mit einem serverseitigen
  Load, dem vollständigen Instagram-/Detailbildpaar, atomischer Antwort und
  Legacy-Kompatibilität des direkten Instagram-Endpunkts bereitstellen. Vor
  beiden Renderaufrufen muss `exportViewStatus === 'current'` serverseitig
  nachgewiesen werden; fehlende oder stale Exportdaten blockieren das gesamte
  Bundle. Instagram- und Detailrenderer erhalten Zeit und Schwierigkeit aus
  demselben aktuellen, servergeladenen `exportView`; Bundle-Requests dürfen
  keine clientseitige `recipeMeta`-Autorität liefern. Der finale Bundle- und
  Fehlervertrag wird in `docs/kb/tech/09-api-reference.md` dokumentiert.

  **Required Knowledge Base:**

  - `docs/kb/tech/02-backend.md`
  - `docs/kb/tech/05-authentication.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/domain/06-recipes.md`

  **Required Repository Context:**

  - `backend/src/functions/instagramRecipe.ts`
  - `backend/src/index.ts`
  - `backend/src/lib/storage.ts`
  - `backend/src/lib/instagramRenderer/recipeAdapter.ts`
  - `backend/src/lib/instagramRenderer/render.ts`
  - `backend/src/lib/repositories/recipesRepository.ts`

  **Required Skills:**

  - None

  **Relevant Acceptance Criteria:**

  - AC-4
  - AC-8
  - AC-10
  - AC-12
  - AC-18
  - AC-19
  - AC-20
  - AC-24
  - AC-25
  - AC-26
  - AC-27
  - AC-28

  **Dependencies:**

  - B-2 Backend-Persistenz;
  - B-4 Detailrenderer.

  B-5 is not a runtime dependency of B-6: the share bundle consumes only the
  persisted, confirmed `exportView`, not the transient preparation response.
  The latest B-6 handoff remains unchanged and is not reopened by this
  response-contract correction.

  **Expected Handoff:**

  - finaler `POST /api/recipes/{id}/share-bundle`-Request-/Response- und
    Fehlervertrag;
  - fehlende oder stale Exportfassung wird mit kontrolliertem Fehler vor
    beiden Renderaufrufen abgelehnt; Current-/Stale-Handler-Tests;
  - serverseitig identische bestätigte Zeit und Schwierigkeit aus dem aktuellen
    `exportView` in beiden Renderpfaden; Client-Metadaten werden ignoriert bzw.
    im strict Bundle-Request abgewiesen;
  - atomischer Erfolg ohne partielle PNG-Antwort und ohne KI-Aufruf;
  - Bundle-Handler-, Contract- und Legacy-Instagram-Regressionstests;
  - aktualisierte API-Dokumentation für F-1 bis F-3 und QA.

### Subtask B-6A: Conditional Transport Redesign

  **Agent:** Backend

  **Goal:** Nur dann ausführen, wenn dein post-QA-U-1-Test mit dokumentierten
  Messwerten nachweist, dass das Base64-JSON-Transportbudget auf Android oder
  im Function-Response-Pfad nicht genügt. Ein nicht verfügbarer Test und ein
  noch nicht erhobener Messwert lösen B-6A nicht aus. Der Redesign-Pfad ersetzt
  den Transport durch temporäre Datei-URLs oder presignete Referenzen, behält
  das atomare PNG-Paar sowie genau einen nativen Share-Aufruf bei und durchläuft
  anschließend automatisierte Regressionstests, QA-Review und einen erneuten
  U-1-Test.

  **Required Knowledge Base:**

  - `docs/kb/tech/02-backend.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/domain/06-recipes.md`

  **Required Repository Context:**

  - `backend/src/functions/instagramRecipe.ts`
  - `backend/src/lib/storage.ts`
  - `backend/src/index.ts`

  **Required Skills:**

  - None

  **Relevant Acceptance Criteria:**

  - AC-20
  - AC-21
  - AC-22
  - AC-27
  - AC-28

  **Dependencies:**

  - B-6 Share-Bundle;
  - F-2 und F-3 abgeschlossen;
  - initiales Q-1 abgeschlossen;
  - U-1 TECH-2 `FAIL` mit dokumentierter Messung, nicht `UNVERIFIED`.

  **Expected Handoff:**

  - strukturell umgebauter Transport mit temporären Datei-URLs oder presigneten
    Referenzen statt Base64-JSON;
  - unverändertes atomares PNG-Paar und genau ein nativer Share-Call;
  - betroffene automatisierte Unit-/Handler-/Contract-/Typecheck-Ergebnisse;
  - aktualisierte API-/Release-Dokumentation und gezielter QA-Review-Handoff;
  - keine Behauptung eines Android-Gerätepasses vor erneutem U-1.

  ## 13. Frontend Work Package

  **Agent:** Frontend

  **Goal:** Den vorhandenen Recipe-Wizard und den US-09-Share-Flow in drei
  sequenziellen Subtasks um Exportbestätigung, Bildpaar, Media-Rollback und
  nativen Ein-Aufruf-Share erweitern.

  **Dependencies:** B-6 Share-Bundle; F-1a Native Candidate Preflight
  entscheidet nur über die native Kandidaten-/Config-Vorbereitung, nicht über
  den Gerätepass. Die reale Gerätefähigkeit prüft der Nutzer in U-1 nach Q-1;
  I-1 ist die anschließende Infrastructure-Dokumentationskorrektur und kein
  Geräte- oder Build-Gate. Die Frontend-Subtasks liefern ihre Ergebnisse in der
  unten angegebenen Reihenfolge.

  Dieses Work Package hat keinen separat ausführbaren Parent-Schritt.

### Subtask F-1: Wizard

  **Agent:** Frontend

  **Goal:** Den Create-/Edit-Wizard um lokalen Export-Draft, gemeinsame
  Zeit-/Schwierigkeitsbestätigung, KI-Review, bestehende-Rezept-Fallback,
  explizite Preparation-Aktion, editierbare Zutatenauswahl und Save-Gate
  erweitern. Nur die ausdrückliche Nutzeraktion fügt
  `exportViewAction: 'confirm'` und die bestätigten Exportfelder zum Create-/
  Update-Request hinzu. Die bestehende Rezept-Preparation verwendet V2 mit dem
  beim Laden empfangenen ETag; ihre Antwort muss dieselbe `sourceEtag`-Revision
  tragen. Eindeutige Matches bleiben editierbare Review-Vorschläge. Mehrdeutige
  Matches werden ohne Vorauswahl mit sämtlichen Backend-Kandidaten und deren
  unterscheidbaren Quellangaben angezeigt; der Nutzer ordnet ausdrücklich
  genau einen Kandidaten zu oder schließt den Key sichtbar aus. Bei einem
  Nichttreffer kann er eine food-Zutat aus dem geladenen eigenen Rezept manuell
  zuordnen oder den Key ausdrücklich ausschließen. Solange ein Key keine
  Entscheidung hat, dieselbe Ingredient-ID mehreren Keys zugeordnet wäre oder
  die Preparation-Revision nicht mit dem Wizard-ETag übereinstimmt, ist die
  Exportbestätigung gesperrt. Beim Speichern gehen nur die normalen bestätigten
  `includedIngredientIds` mit dem vorhandenen `exportViewAction: 'confirm'`-
  und ETag/If-Match-Vertrag an den Server; die Resolution-UI wird nicht
  persistiert. Die Wizard-Dokumentation wird in
  `docs/kb/tech/03-mobile.md` aktualisiert.

  **Required Knowledge Base:**

  - `docs/kb/tech/03-mobile.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/tech/04-shared-library.md`
  - `docs/kb/domain/06-recipes.md`
  - `docs/kb/product/02-navigation.md`
  - `docs/kb/product/03-design-system.md`
  - `docs/kb/product/05-ux-patterns.md`

  **Required Repository Context:**

  - `mobile/src/modules/recipes/RecipeWizardScreen.tsx`
  - `mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx`
  - `mobile/src/modules/recipes/recipeWizardTypes.ts`
  - `mobile/src/modules/recipes/recipeWizardEditBootstrap.ts`
  - `mobile/src/shared/api/recipeApi.ts`
  - `mobile/src/shared/api/recipeApi.test.ts`
  - `mobile/src/shared/api/aiApi.ts`
  - `shared/types/recipeExport.ts`
  - `shared/types/recipes.ts`
  - `mobile/src/modules/recipes/recipeWizardExportView.ts`
  - `mobile/src/modules/recipes/recipeWizardExportView.test.ts`
  - `mobile/src/modules/recipes/recipeWizardEditBootstrap.test.ts`
  - `mobile/src/shared/components/InfoOverlay.tsx`
  - `mobile/src/shared/components/ConfirmSheet.tsx`
  - `mobile/src/shared/components/Snackbar.tsx`

  **Required Skills:**

  - None

  **Relevant Acceptance Criteria:**

  - AC-1
  - AC-2
  - AC-3
  - AC-5
  - AC-6
  - AC-7
  - AC-11
  - AC-19
  - AC-25
  - AC-28

  **Dependencies:**

  - B-6 Share-Bundle mit finalen Shared-Typen, Preparation-/Bundle-Verträgen,
    einschließlich V2 `ingredientResolutions`, Legacy-V1-Fail-closed-
    Fehlersemantik, `sourceEtag`/Preparation-`If-Match` und serverseitiger
    finaler ID-Validierung;
  - F-1 benötigt keinen nativen Gerätebeweis. F-1 handofft nach den
    automatisierten Wizard-/API-Checks an F-2; weder I-1 noch ein Build-
    Ergebnis ist dafür erforderlich.

  **Expected Handoff:**

  - Wizard- und Review-State mit ausdrücklicher Bestätigung für Zeit,
    Schwierigkeit und Exportfelder;
  - `exportViewAction: 'confirm'` wird ausschließlich nach der sichtbaren
    Review-Aktion erzeugt; gewöhnliche Recipe-Edits senden weder Marker noch
    `exportView` und behalten bei Bedarf den ETag;
  - bestehende-Rezept-Fallback ohne `30`-/`Einfach`-Default und ohne stille
    Auswahl beziehungsweise Kürzung;
  - API-Client sendet `{ contractVersion: 2 }` und den geladenen ETag für
    Preparation; behandelt `428`/`412` fail-closed und akzeptiert die Antwort
    nur mit exakt passendem `sourceEtag`;
  - `resolved` zeigt einen editierbaren AI-Vorschlag; `ambiguous` hat keine
    vorausgewählte ID und zeigt alle Quellkandidaten; `unmatched` verlangt
    manuelle Zuordnung zu einer eigenen food-Zutat oder sichtbaren Ausschluss;
  - alle AI-Included-Keys müssen vor Bestätigung entschieden sein. Auswahl
    mehrerer Kandidaten, ein unaufgelöster Key, doppelte Zuordnung derselben
    ID, unbestätigte Zutat oder veraltete Preparation blockieren den Save-Gate;
  - finale Request enthält nur eindeutige, ausgewählte
    `includedIngredientIds`; kein `analysisKey`, Kandidatenobjekt oder
    Resolutionstatus wird persistiert;
  - Bestehende Bestätigung bleibt an den beim GET geladenen ETag gebunden;
    `412` erfordert Reload und vollständige erneute Review statt Auto-Retry;
  - Tests für eindeutige/mehrdeutige/Nichttreffer-Auflösung, explizite
    Auswahl/Ausschluss, sourceEtag mismatch, stale-revision reload,
    ID-Kollisionen und den unveränderten Confirmation-Body;
  - automatisierter Wizard-/API-Handoff für F-2, ohne native
    Gerätepass-Aussage;
  - aktualisierte Wizard-Dokumentation für F-2 und QA.

### Subtask F-1a: Native Candidate Preflight

  **Agent:** Frontend

  **Goal:** Den Android-native Candidate sowie Package-/Config-Pfad
  implementieren und vor QA automatisiert prüfen. Ein Test mit gemockter
  nativer Bridge übergibt zwei gültige lokale PNG-Datei-URIs und bestätigt
  exakt einen Aufruf von `Share.open({ urls: [...] })` mit beiden URIs. Dieser
  Test belegt den Aufrufvertrag, nicht die Android-System- oder Gerätefähigkeit;
  ein Device-Build ist kein F-1a- oder QA-Voraussetzung.

  **Required Knowledge Base:**

  - `docs/kb/tech/03-mobile.md`
  - `docs/kb/tech/07-infrastructure.md`
  - `mobile/app.config.js`
  - `mobile/package.json`

  **Required Repository Context:**

  - `mobile/package.json`
  - `mobile/app.config.js`
  - `mobile/eas.json`
  - `mobile/src/services/nativeShareCandidate.ts`
  - `mobile/src/services/recipeShareMediaService.ts`

  **Required Skills:**

  - None

  **Relevant Acceptance Criteria:**

  - AC-22
  - AC-23
  - AC-27
  - AC-28

  **Dependencies:**

  - B-6 Share-Bundle;
  - F-1 Wizard;
  - automatisierte Mobile-Testumgebung und Android-only candidate;
  - kein Infrastructure-Build, Gerätetest oder I-1-Pass als Voraussetzung.

  **Expected Handoff:**

  - automatisierter Bridge-Test mit zwei lokalen PNG-URIs und exakt einem
    `Share.open({ urls: [...] })`-Aufruf;
  - dokumentierte Android candidate-/Package-/Config-Option und automatischer
    Konfigurations-/Typecheck-Nachweis;
  - Übergabe der noch unverified Android-Geräteprüfung an U-1 nach QA;
  - keine Dual-Dialog-Fallback- oder Gerätepass-Behauptung.

### Subtask F-2: Share-Draft/Preview

  **Agent:** Frontend

  **Goal:** Den Share-Draft von einer einzelnen URI auf ein vollständiges,
  race-sicheres Instagram-/Detailpaar erweitern, zwei feste Vorschauen und das
  aktuelle-Export-Gate integrieren sowie Retry-, Stale- und Fehlerzustände
  anzeigen. Der produktive `RecipeDetailScreen` ruft den Bundle-Endpunkt statt
  des Single-Image-Endpunkts auf. Beide unterschiedlichen PNG-Antworten werden
  in getrennte lokale URIs dekodiert; Pair-Readiness, beide Vorschauen und der
  Speichern-/Teilen-CTA hängen vom vollständigen Paar ab. Die UX-Dokumentation
  wird in `docs/kb/product/05-ux-patterns.md` aktualisiert.

  **Required Knowledge Base:**

  - `docs/kb/tech/03-mobile.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/product/03-design-system.md`
  - `docs/kb/product/05-ux-patterns.md`

  **Required Repository Context:**

  - `mobile/src/modules/recipes/RecipeDetailScreen.tsx`
  - `mobile/src/modules/recipes/RecipeInstagramPreview.tsx`
  - `mobile/src/modules/recipes/recipeShareDraftState.ts`
  - `mobile/src/shared/api/recipeApi.ts`
  - `mobile/src/shared/api/recipeInstagramRenderContract.ts`
  - `mobile/src/shared/components/InfoOverlay.tsx`
  - `mobile/src/shared/components/Snackbar.tsx`

  **Required Skills:**

  - None

  **Relevant Acceptance Criteria:**

  - AC-4
  - AC-8
  - AC-20
  - AC-21
  - AC-23
  - AC-24
  - AC-25
  - AC-28

  **Dependencies:**

  - F-1 Wizard;
  - B-6 Share-Bundle;
  - F-1a Native Candidate Preflight mit bestandenem automatisiertem
    One-call-Contract-Test;
  - weder ein I-1-Pass noch ein Android-Gerätetest ist Voraussetzung. Die
    reale native Geräte- und Transportprüfung erfolgt in U-1 nach QA.

  **Expected Handoff:**

  - atomarer Pair-State mit Revision, Abort, verspäteter-Antwort-Prüfung und
    Erhalt des letzten gültigen Paars;
  - produktive Bundle-API-Verdrahtung; kein Single-Image-Renderpfad für den
    US-10-Share;
  - zwei unterschiedliche lokale PNG-URIs und zwei tatsächlich angezeigte
    Vorschauen; ein fehlendes, doppeltes oder fehlgeschlagenes Asset lässt den
    Pair-State nicht `ready` werden;
  - zwei feste, klar beschriftete `1080:1350`-Vorschauen und CTA-Gate;
  - Retry-/Stale-/Renderer-Fehlerzustände mit deutscher App-UI;
  - State-, API- und Komponenten-Tests sowie aktualisierte UX-Dokumentation;
  - Einhaltung des One-call-/No-fallback-Vertrags; tatsächliches Android-
    Verhalten bleibt bis U-1 `UNVERIFIED`.

### Subtask F-3: Media/Native

  **Agent:** Frontend

  **Goal:** Den Zwei-Dateien-Media-Service mit temporärem Schreiben,
  FitTrack-Album-Rollback, Permissions, genau einem nativen Multi-Image-Share,
  Retry und Cleanup implementieren und den automatisiert gegen den One-call-
  Vertrag geprüften Android-native Candidate in den bestehenden
  bundle-verdrahteten Share-Flow einfügen. Speichern und Teilen bleiben
  gesperrt, bis beide verschiedenen PNG-Dateien lokal bereit und im Paar
  vorhanden sind. Der mobile Media-/Build-Status wird in
  `docs/kb/tech/03-mobile.md` festgehalten.

  **Required Knowledge Base:**

  - `docs/kb/tech/03-mobile.md`
  - `docs/kb/tech/09-api-reference.md`
  - `docs/kb/product/05-ux-patterns.md`

  **Required Repository Context:**

  - `mobile/src/services/recipeShareMediaService.ts`
  - `mobile/src/modules/recipes/recipeShareDraftState.ts`
  - `mobile/src/modules/recipes/RecipeInstagramPreview.tsx`
  - `mobile/package.json`
  - `mobile/app.config.js`
  - `mobile/eas.json`

  **Required Skills:**

  - None

  **Relevant Acceptance Criteria:**

  - AC-22
  - AC-23
  - AC-24
  - AC-27
  - AC-28

  **Dependencies:**

  - F-2 Share-Draft/Preview;
  - F-1a Native Candidate Preflight;
  - keine I-1- oder Gerätevoraussetzung für F-3; automatisierte Frontend- und
    Backend-Checks laufen vor QA;
  - `B-6A` ist nur nach einer tatsächlichen U-1-TECH-2-Fehlmessung erforderlich
    und führt dann zu Regressionstests, QA-Review und erneutem U-1.

  **Expected Handoff:**

  - atomarer Zwei-Dateien-Write-/Album-Rollback-/Cleanup-Nachweis;
  - automatisierte Tests für genau einen nativen Share-Aufruf mit beiden URIs,
    Retry ohne Duplikate und die Media-State-Übergänge;
  - Mobile-Service-, Permission- und Regressionstests;
  - Liste tatsächlich verwendeter nativer Packages und geänderter Konfiguration
    für Infrastructure und QA;
  - aktualisierte Mobile-Dokumentation;
  - keine Dual-Dialog-Fallback-Implementierung;
  - ausdrücklicher Status `UNVERIFIED` für nicht durch Tests belegtes
    Android-Geräteverhalten; kein vollständiger Done-Claim vor U-1.

## 14. Infrastructure & Release Work Package

**Agent:** Infrastructure

**Goal:** Den vorhandenen I-1-Datensatz nach abgeschlossenem Q-1 und vor U-1
ausschließlich als Dokumentations-/Evidenzdatensatz redaktionell aktualisieren.
Die frühere SDK-/ADB-/Build-/Device-Entdeckung bleibt historische Beobachtung,
kein Vor-QA-Blocker. TECH-1/TECH-2 bleiben bis U-1 `UNVERIFIED`; Infrastructure
führt weder U-1 noch eine Geräteprüfung, Transportmessung, einen Build oder ein
Deployment aus. `Dev Build Required` bleibt bis zur bekannten U-1-Testumgebung
`NOT DETERMINED`.

**Required Knowledge Base:**

- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

**Required Repository Context:**

- `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- `infra/release-records/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern_I-1-Tech-Gates.md`

**Required Skills:**

- None; für Infrastructure & Release existiert kein spezialisierter Skill.

**Relevant Acceptance Criteria:**

- AC-22, AC-23, AC-24, AC-26, AC-27, AC-28

**Dependencies:**

- B-6, F-1a und F-3 Handoffs mit automatisierter Evidence;
- abgeschlossener Q-1-Bericht;
- keine Android-Geräte-, Build- oder Transportmessung als Voraussetzung für
  Q-1 oder diesen Dokumentationshandoff.

**Expected Handoff:**

- aktualisierter `infra/release-records/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern_I-1-Tech-Gates.md`;
- vorherige fehlende SDK-/ADB-/Build-/Device-Voraussetzungen bleiben als
  historische Umgebungsbeobachtung kenntlich, nicht als QA-Blocker;
- TECH-1/TECH-2 bleiben bis U-1 `UNVERIFIED`; kein pass/fail wird erfunden;
- `Dev Build Required: NOT DETERMINED`; nur bewerten, wenn die vom User
  vorbereitete U-1-Testumgebung einen neuen Dev Build tatsächlich erfordert;
- die redaktionelle I-1-Korrektur behauptet keine neuen Tests, Builds,
  Deployments oder Transportmessungen;
- kein Build-, Deploy-, Healthcheck- oder operativer Release-Report wird ohne
  separaten expliziten Auftrag erzeugt.

### Infrastructure-/Release-Schritte

1. Q-1 läuft ohne I-1-, Build-, Geräte- oder Transportgate.
2. Nach Q-1 den I-1-Datensatz ausschließlich redaktionell angleichen; damit
  ist kein TECH-1/TECH-2-Gate ausgeführt oder bestanden.
3. Danach führst du U-1 auf Android aus und erfasst natives Teilen sowie die
  reale Transportmessung. Dies ist der erste Geräte-/System-Share- und
  Transportmessungsschritt; er liegt vollständig nach Q-1 und in deiner
  Verantwortung.
4. Nur falls U-1 einen neuen nativen Build benötigt, forderst du separat
  `New Dev Build` an. Ein Build wird nicht automatisch durch
  `Mobile Build Impact` oder diese Planrevision gestartet.
5. Kein Backend-Deployment ist durch diese Planrevision autorisiert. Falls
  das gewählte Testsetup ein Deployment erfordert, ist dafür ebenfalls eine
  separate explizite operative Anforderung nötig.
6. Keine Bicep- oder Cosmos-Änderung ist vorgesehen. Alpha- und
  Production-Deployments sind nicht Teil dieses Plans.

## 15. QA Work Package

**Agent:** QA

**Goal:** Die Implementierung gegen diese Planrevision, die unveränderte
Story US-10 und alle 29 Acceptance Criteria im hier festgelegten Android-only
Umfang re-reviewen. Der einzige aktuell offene Blocking-Punkt ist
FT-QA-2026-037 / AC-11. QA verifiziert diesen mit V1-/V2-Contract- und
End-to-end-Review-Evidence und bestätigt, dass FT-QA-2026-038 bis -043
weiterhin geschlossen sowie FT-QA-2026-044 im scoped Eval-Gate nicht
actionable sind. QA replant nicht und ergänzt keine stillschweigenden
Anforderungen. Q-1 ist eine automatisierte und dokumentarische Review, keine
Geräteprüfung; kein Android-Geräte- oder Real-User-End-to-End-Test beginnt
vor Q-1.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/domain/08-quota-system.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**

- `docs/User Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- `backend/src/functions/ai.ts`
- `backend/src/functions/recipes.ts`
- `backend/src/functions/instagramRecipe.ts`
- `backend/src/lib/openai.ts`
- `backend/src/lib/prompts/recipeAnalyze.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`
- `backend/src/lib/repositories/cosmosRecipesRepository.ts`
- `backend/src/lib/instagramRenderer/`
- `shared/types/recipes.ts`
- `shared/types/recipeExport.ts`
- `shared/types/recipes.test.ts`
- `mobile/src/modules/recipes/`
- `mobile/src/shared/api/`
- `mobile/src/shared/api/recipeApi.test.ts`
- `mobile/src/services/recipeShareMediaService.ts`
- `docs/qa/reports/README.md`

**Required Skills:**

- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**

- AC-1 through AC-29

**Dependencies:**

- Backend-, Frontend- und automatisierte Test-/Typecheck-/Build-Handoffs;
- aktualisierte API-, Domain-, Mobile- und UX-Dokumentation;
- automatisierter TECH-3-Probe-Render und sämtliche vor Q-1 ausführbaren
  Checks;
- kein TECH-1-/TECH-2-Gerätepass, Android-Gerät, Dev Build oder Deployment.

**Expected Handoff:**

- `fittrack-qa-v1`-Report unter `docs/qa/reports/`;
- vollständige AC-Matrix mit Evidence;
- explizite Re-Review-Tabelle für FT-QA-2026-037 bis FT-QA-2026-044: neuer
  Evidence-Nachweis für FT-QA-2026-037; Bestätigung der von der letzten
  Re-Review geschlossenen/non-actionable Status der übrigen Findings oder
  konkreter Nachweis, falls ein anderer Befund wieder auftritt;
- PASS, PASS WITH ISSUES oder FAIL;
- getrennte `UNVERIFIED`-/`MANUAL VALIDATION REQUIRED`-Liste für Azure-
  Credentials und nicht vor Q-1 ausführbare Android-Geräteprüfungen;
- keine stillschweigend ausgelassenen Kriterien.

### Erforderlicher Review-Kontext

- vollständiger freigegebener Plan und US-10-Story;
- Backend- und Frontend-Handoffs;
- Skill `azure-openai-feature-integration`;
- Skill `cosmos-data-model-and-migration`;
- alle vor Q-1 ausgeführten automatisierten Test-/Build-Handoffs;
- erwarteter Report-Pfad unter `docs/qa/reports/`.

### QA-Prüfungen

- vollständige AC-Matrix AC-1 bis AC-29;
- B-5 preparation contract: legacy `{}` success shape only for a complete set
  of distinct unique mappings; V1 `409` upgrade error for any ambiguous,
  unmatched, or colliding mapping; V2 request/response discriminants,
  `If-Match`/`sourceEtag`, authenticated recipe-only candidates, and no
  persistence;
- ingredient mapping matrix: unique exact, duplicate exact, exact priority
  over fuzzy, unique fuzzy, overlapping fuzzy, zero match, seasoning exclusion,
  duplicate AI keys resolving to one source ID, and candidates from no other
  recipe/user;
- Mobile review: no default choice for ambiguity; explicit select, manual
  mapping or visible exclusion; unresolved/colliding IDs block confirmation;
  only final unique IDs are submitted; preparation ETag and confirm ETag stay
  bound to the loaded revision;
- confirmation rejects absent, duplicate, foreign, removed, seasoning, and
  non-member IDs without persistence; stale ETag/write race returns `412`;
- Recipe-Create/Edit/GET/PUT und alte Cosmos-Dokumente;
- Bestätigungsmarker-/Body-Paarvalidierung, GET-ETag, erforderliches
  `If-Match` für bestätigende PUTs, `428`-/`412`-Fehler ohne Teilpersistenz,
  In-Memory- und Cosmos-CAS einschließlich Write-Race;
- Fingerprint/Stale-Verhalten bei Name, Beschreibung, Portionen, Zutaten,
  Schritten, Tags und Nutrition; gewöhnliches PUT ohne Action bewahrt den
  Export-Snapshot und kann ihn nicht re-fingerprinten;
- AI Review, gemeinsamer Zeit-/Schwierigkeits-Structured-Output,
  Plausibilität, Quota, Prompt-Version und Eval;
- ausdrückliche bestehende-Rezept-KI-Vorbereitung versus kein Call bei Open/
  Share;
- Renderer-Grenzen, Probe-Render, reale PNG-Dimension, Motivregeln,
  Spaltenverteilung und fehlende Truncation;
- zwei PNGs im Share-Draft, Preview-Gate, Berechtigungen, Album-Rollback,
  Cleanup und automatisierter Nachweis, dass exakt ein nativer
  `Share.open({ urls: [...] })`-Aufruf beide URIs erhält;
- Bundle-API-Aufruf vom produktiven Screen, zwei unterschiedliche PNG-URIs,
  beide angezeigte Vorschauen und CTA-Gate für ein vollständiges Paar;
- US-09-Kompatibilität für Crop, Tags, Highlight, Primary Image, Back/Cancel
  und Retry;
- keine Secrets, keine clientseitige Rezeptdatenautorität, keine neuen
  Cosmos-Container und keine unreviewten Scope-Erweiterungen.

### QA-Report und Verifikationszustände

Der QA-Report folgt dem bestehenden `fittrack-qa-v1`-Vertrag und enthält pro
Kriterium Ergebnis und Evidence. Nicht ausführbare Gerätematrix-, Azure-
Credential- oder Native-Share-Prüfungen werden als `UNVERIFIED` oder `MANUAL
VALIDATION REQUIRED` außerhalb der Finding-Liste dokumentiert. Fehlende
Android-Verfügbarkeit blockiert weder Q-1 noch dessen automatisierten Verdict;
das tatsächliche TECH-1-/TECH-2-Ergebnis bleibt bis U-1 offen. Ein fehlendes
fehlgeschlagener scoped Recipe-Analyze-Eval ist ein US-10-Blocker. Fehlende
Credentials bleiben `UNVERIFIED`. Ein Fehler nur in den nicht in-scope Daily-
oder Weekly-Evals wird mit echtem Aggregate-Ergebnis dokumentiert, blockiert
US-10 nicht und autorisiert keine fremden Promptänderungen.

### U-1: Finaler Android- und Real-User-End-to-End-Test (nach Q-1)

**Owner:** User

U-1 wird erst nach abgeschlossenem Q-1-Bericht und ohne unresolved Blocking
findings ausgeführt. Bei QA-FAIL oder einem Blocking Finding geht die
Implementierung an den zuständigen Agenten zurück; nach Fix folgen die
betroffenen automatisierten Checks und QA-Review, bevor U-1 beginnt.

Der Nutzer führt auf einem realen Android-Gerät den integrierten Flow mit einem
Rezept und aktueller, bestätigter Exportfassung aus:

1. App mit der Testumgebung öffnen und den vollständigen Share-Flow bis zur
  Vorschau ausführen; beide PNGs und ihre `1080 x 1350`-Formate prüfen.
2. `Speichern & teilen` einmal ausführen und bestätigen, dass beide Bilder im
  lokalen Album `FitTrack` gespeichert werden.
3. Bestätigen, dass Android genau ein natives Share-Sheet mit beiden PNGs
  erhält und kein zweiter Dialog oder sequenzieller Share-Aufruf auftritt.
4. Den End-to-End-Handoff an einen auf dem Testgerät verfügbaren, mehrere
  Bilder unterstützenden Empfänger abschließen und prüfen, dass beide Bilder
  gemeinsam übergeben werden. Das behauptet keinen Instagram-Upload oder
  externe Zustellgarantie.
5. Mit realistischen Bildgrößen die tatsächliche Bundle-Größe, Decode/Parse-
  Laufzeit, Speicherverhalten und Timeouts für TECH-2 festhalten.

Als Evidence festhalten: Testdatum, Android-Gerät/Version, App-Buildkennung,
Testumgebung, Ergebnis für TECH-1 und die gemessenen TECH-2-Werte. Bei
Fehlschlag konkrete Logs/Messwerte ohne Secrets sichern. Besteht kein
geeigneter Dev Build, ist ein neuer Dev Build nur dann erforderlich, wenn dein
Test ihn braucht; du musst ihn separat explizit anfordern. Ein Deployment ist
ebenfalls nicht impliziert.

**Ergebnis:** U-1-PASS setzt TECH-1/TECH-2 entsprechend den Messwerten auf
bestanden. TECH-1-Fehler lösen Frontend-Fix, automatisierte Regressionstests,
QA-Review und U-1-Wiederholung aus. Nur eine gemessene TECH-2-Budgetverletzung
löst B-6A aus; danach folgen automatisierte Regressionstests, QA-Review und
U-1-Wiederholung. Ohne U-1-Evidence bleiben die Gates `UNVERIFIED` und die
Story ist nicht vollständig abgeschlossen.

## 16. Shared Package Changes

### Geplante Änderungen

- `shared/types/recipes.ts`: vorhandene `RecipeExportView`,
  `RecipeExportStep`, `RecipeExportViewInput`, Status-/Response-Typen und
  `Recipe.exportView?` erhalten; request-only
  `RecipeExportViewAction = 'confirm'` und die Request-/Response-Grenze
  bleiben unverändert. `shared/types/recipeExport.ts` ist vorhanden und wird
  um die Preparation-V2-Request-/Response-Typen, die discriminated
  `resolved | ambiguous | unmatched`-Resolution und die minimalen
  Same-recipe-Kandidatenfelder ergänzt; der Re-Export erfolgt wie bisher aus
  `recipes.ts`.
- Pure, package-neutrale Strukturvalidatoren nur dann in `shared/lib`, wenn
  sie keine Backend-Authentifizierung, Storage- oder Node-Crypto-Abhängigkeit
  benötigen.
- Keine Secrets, Promptstrings oder Cosmos-Implementierung in Shared.

### Persistenzgrenze

Der Hash/Fingerprint darf im Backend erzeugt werden, auch wenn die fachlichen
Types shared sind. Dadurch bleibt die Client-App unfähig, die Serverautorität
über aktuelle Rezeptdaten zu ersetzen.

### Tests

- Schema-/Grenztests für 0/1/4/5/6 Schritte;
- 0/1/8/9/14/15/20/21 Zutaten;
- Seasoning-ID, doppelte ID, fremde ID, fehlende Legacy-Kategorie;
- positive/0/negative/nichtfinite Zeit;
- optionales Feld und alte Recipe-Objekte ohne Exportfassung;
- Bestätigungsmarker-/Input-Paarvalidierung; `sourceFingerprint` bleibt im
  Clientinput ausgeschlossen;
- Typ-/Contracttests für V2-Request und -Response, die drei Resolutionstatus,
  Kandidatenangaben und das Fehlen einer v2-ID-only-Auswahlliste;
- Shared-Typecheck und Vitest.

## 17. Infrastructure and Configuration

### Cosmos und Azure

- Kein neuer Container, keine Partition-Key-Änderung, keine Migration.
- Das bestehende `recipes`-Dokument erhält ein optionales Feld.
- Dev und Alpha bleiben read-kompatibel; Infrastructure muss keine neue
  Bicep-Ressource erzeugen.
- Ein Backend- oder Azure-Deployment ist durch diesen Plan nicht autorisiert.
  Falls es separat beauftragt wird, gilt der bestehende Clean-Build-,
  `build:verify`-, `_deploy_staging`- und `func publish --build remote`
  Workflow.
- Alpha wird nicht automatisch deployt. Ein Alpha-Deploy ist ein separater
  operativer Auftrag.

### Native Mobile / EAS

Frontend dokumentiert und prüft vor QA die Android-only Packages,
Config-Plugin-/`app.config.js`-Änderungen und den automatisierten
One-call-Vertrag. Das belegt keine native Gerätefähigkeit. Du führst TECH-1
und TECH-2 ausschließlich in U-1 nach Q-1 aus; Infrastructure aktualisiert
den I-1-Datensatz nach Q-1 und vor U-1, führt U-1 aber nicht aus.

`Dev Build Required` bleibt `NOT DETERMINED` und wird nur bewertet, wenn die
Testumgebung für das von dir vorbereitete U-1 bekannt ist. Eine Bewertung
autorisiert keinen Build. Jeder erforderliche Dev Build wird separat und
explizit angefordert. Die Planrevision autorisiert weder einen EAS-Build noch
ein Backend-/Azure-Deployment.

Wenn ein neues Package hinzukommt, muss die stabile Version vor Aufnahme in
`mobile/package.json` geprüft werden. Eine veraltete Version benötigt eine
Begründung im Plan/Release-Handoff.

### Production-Konflikt und Release-Gates

Der Code und die API müssen ohne Dev-spezifische Sonderlogik
produktionsfähig sein. Trotzdem wird kein Produktionsdeploy durchgeführt oder
behauptet, solange der dokumentierte Production-Environment-Status das nicht
zulässt. Vor einem späteren Production-Release müssen mindestens folgende
Gates erneut bestätigt werden:

- Function- und Mobile-Konfiguration;
- nativer Android-Multi-Image-Share mit genau einem Share-Call;
- Bundle-Antwortgröße und Timeouts auf Android;
- Renderer-Assets einschließlich Garniturmotiv und Fonts;
- Cosmos-Legacy-Read-Kompatibilität;
- Prompt-Version/Eval und Quota;
- Album-Rollback und Cleanup auf echten Android-Geräten.

## 18. Documentation Updates

Die Dokumentationsänderungen erfolgen als Teil der jeweils benannten
Implementierungs- oder Release-Subtask und beschreiben nur bestätigte
Ist-Funktionalität. Geplantes Verhalten wird als `[Planned]` markiert. Es
gibt keinen separaten Dokumentationsschritt in der Ausführungsqueue.

| Subtask und Agent | Dokumentationsverantwortung | Erwarteter Inhalt |
|---|---|---|
| B-1 Shared-Vertrag — Backend | `docs/kb/tech/04-shared-library.md` | versioniertes `exportView`, request-only Bestätigungsmarker, Input-/Response-Grenzen und Shared-Grenzen |
| B-2 Backend-Persistenz — Backend | `docs/kb/domain/06-recipes.md`; `docs/kb/tech/09-api-reference.md` | bestätigte Zeit/Schwierigkeit, Fingerprint/Stale, ETag-/If-Match-/CAS-Regeln, stabile `400`/`412`/`428`-Fehler und read-kompatible Cosmos-Evolution ohne Migration |
| B-3 AI-Eval — Backend | `docs/kb/domain/07-ai-features.md` | bestehender Recipe-Analyze-v11-Output, `analysisKey`, Exportverdichtung, Review, Quota, scoped Eval-Evidence und Aggregate-Eval-Abgrenzung |
| B-5 Bestehende-Rezept-Preparation — Backend | `docs/kb/tech/04-shared-library.md`; `docs/kb/tech/09-api-reference.md` | V1-`{}`-Kompatibilität und V2-Request/Response, `If-Match`/`sourceEtag`, exakte/mehrdeutige/keine Zutatentreffer, Candidate-Scope, Upgradefehler, serverseitige Confirm-ID-Mitgliedschaft, Fehlercodes, Quota und keine Persistenz |
| B-6 Share-Bundle — Backend | `docs/kb/tech/09-api-reference.md` | Recipe-Body-Erweiterung, Share-Bundle-Request/Response, Fehlercodes, serverseitige Datenautorität und direkter Instagram-Kompatibilitätsvertrag |
| F-1 Wizard — Frontend | `docs/kb/tech/03-mobile.md` | V2-Preparation mit ETag, Anzeige/Auswahl mehrdeutiger Kandidaten, manuelle Klärung oder sichtbarer Ausschluss bei Nichttreffer, Bestätigungssperre, final nur IDs, ETag-Aufbewahrung, `412`-Reload/Re-Review und bestehende-Rezept-Fallback |
| F-2 Share-Draft/Preview — Frontend | `docs/kb/product/05-ux-patterns.md` | Export-Review, Stale-Zustand, duale Preview, CTA-Gate und Fehler-/Retry-Semantik |
| F-3 Media/Native — Frontend | `docs/kb/tech/03-mobile.md` | Bundle-Verdrahtung, zwei unterschiedliche Renderassets, Album-Rollback, exakt ein nativer Multi-Image-Share und tatsächlicher Mobile-Status |
| I-1 Release-Datensatzkorrektur — Infrastructure | `infra/release-records/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern_I-1-Tech-Gates.md` | Nach Q-1 und vor U-1: post-QA-User-Testreihenfolge, TECH-1/TECH-2 `UNVERIFIED`, historische Umgebungslimitation und bedingter Buildbedarf; nach U-1: tatsächliche Nutzerevidence ergänzen |
| Separat autorisierte Betriebsaktion — Infrastructure | `infra/release-records/` | Nur nach gesonderter expliziter Anforderung; kein automatischer Build oder Deploy aus diesem Plan |

Jeder aufgeführte Dokumentationsanteil hat damit genau einen verantwortlichen
Agenten innerhalb der ausführbaren Subtask. Der Konflikt "US-10 fordert
Production, KB sagt Production nicht verfügbar" bleibt als technischer
Dokumentationshinweis erhalten; daraus wird keine offene Product-Owner-
Entscheidung und kein nicht erfolgter Deploy behauptet.

FT-QA-2026-043 wird damit aufgeteilt statt einem fiktiven
Dokumentations-Agenten zugewiesen: Backend aktualisiert den API-/Domainvertrag;
Frontend aktualisiert die Mobile- und UX-Dokumentation, sobald der Pair-Flow
produktiv verdrahtet ist. QA prüft beide Dokumentationsbereiche in Q-1.

## 19. Test Strategy

### Automatisierte Vor-QA-Prüfungen und Verantwortliche

Alle aufgeführten automatisierten Checks und ihre Exit-Codes gehören vor den
Q-1-Handoff. Backend führt Backend-/Prompt-Prüfungen aus, Frontend führt
Mobile-/Native-Candidate-/Konfigurationsprüfungen aus, und QA wiederholt bei
Q-1 die betroffenen automatisierten Suiten gemäß QA-Anweisung. Kein physisches
Android-Gerät, natives Share-Sheet, manueller Empfänger-Test oder EAS-Build ist
Voraussetzung für diese Vorprüfungen oder für Q-1.

| Owner | Automatisierte Checks vor Q-1 | Begrenzung / Statusnachweis |
|---|---|---|
| Backend | Backend Unit-/Handler-/Renderer-/Bundle-Tests, Typecheck, `build:verify`, Cosmos-Contract-Tests im Emulator und scoped Recipe-Analyze-Eval | Handoff enthält Command, Exit-Code und Ergebnis; fehlende Live-Credentials für den scoped Eval werden als `UNVERIFIED` gemeldet, nicht als Pass |
| Frontend | Mobile Vitest-Suite, Mobile Typecheck, API-/Wizard-/Pair-/Media-Tests, gemockter Native-Bridge-Test für genau einen `Share.open({ urls: [...] })`-Aufruf mit beiden PNG-URIs und Android-Expo-Konfigurationsprüfung | Tests prüfen Aufrufvertrag, Statusübergänge und Konfiguration, nicht Android-Systemverhalten |
| QA | Relevante betroffene Test-Suiten erneut ausführen, CI- und Handoff-Evidence prüfen, vollständige AC-Matrix und Dokumentationsreview | QA-Report trennt Ergebnisse von `UNVERIFIED` / `MANUAL VALIDATION REQUIRED`; fehlendes Gerät allein ändert den automatisierten Verdict nicht |

Die vorhandene CI führt Shared-/Backend-/Mobile-Typechecks, Offline-Prompt-Guard
und Backend-Unit-Tests aus; Cosmos-Contract-Tests laufen nach erfolgreicher
Tier-1-Stufe mit dem Emulator. Mobile-Vitest ist laut bestehender Teststrategie
nicht Teil der CI und muss daher durch Frontend/QA im Mobile-Paket ausgeführt
werden. Der scoped Recipe-Analyze-Eval bleibt ein expliziter automatisierter
Live-Check und ist der US-10-Prompt-Gate. `npx expo config --type public --json`
prüft die Android-Konfiguration ohne nativen Build.

### Shared

```text
cd shared
npx vitest run
npx tsc --noEmit
```

### Backend Unit und Build

```text
cd backend
npx vitest run
npm run build:verify
npx tsc --noEmit
```

Abgedeckt werden Handler, Schema, Fingerprint, gemeinsames Zeit-/Schwierigkeits-
AI-Mapping, Quota-Reihenfolge, Renderer, Layoutmessung, Fehlercodes und
Bundle-Atomizität. Der B-5-Korrektursatz deckt zusätzlich exakte eindeutige,
doppelte exakte, fuzzy eindeutige, überlappende fuzzy und fehlende
Ingredient-Treffer, exact-before-fuzzy, Seasoning-Ausschluss,
Recipe-/User-Scope, doppelte AI-Key-zu-ID-Auflösung, V1-Kompatibilität,
V2-If-Match/`sourceEtag`, V1-409-Fail-Closed, Quota/Tracking-Reihenfolge
sowie finale Confirm-ID-Mitgliedschaft ohne Write ab.

### Backend Cosmos Contract

Nur gegen den Cosmos Emulator:

```text
cd backend
npx vitest run --config vitest.contract.config.mts
```

Der Contract-Test verifiziert alte Dokumente ohne `exportView`, neue
Dokumente mit `exportView`, Roundtrip, Update ohne Feld und Stale-Erkennung.
Keine Tests gegen echtes Azure Cosmos.

### Prompt Eval

```text
cd backend
npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts
```

Der scoped Recipe-Analyze-Eval ist der verpflichtende US-10-Gate; alle acht
Recipe-Analyze-Eval-Assertions müssen bestehen. Exit-Code 2 wegen fehlender
Credentials wird mit Ursache als `UNVERIFIED` gemeldet und darf nicht als Pass
berichtet werden. Eine fehlgeschlagene Recipe-Analyze-Assertion ist Blocking.
Der optionale Diagnose-Lauf `npm run test:eval` führt das Aggregat aus; sein
Status muss exakt mit Pass-/Fail-Zahl berichtet werden. Bereits bekannte
Daily-/Weekly-Fehler außerhalb von US-10 blockieren US-10 nicht, werden nicht
als Aggregate-Pass umgedeutet und autorisieren keine Änderungen an diesen
Prompts.

### Mobile

```text
cd mobile
npx vitest run
npx tsc --noEmit
```

Die Mobile-Suite enthält automatisierte Tests für Permissions, Album-/Rollback-
Zustände, zwei lokale PNG-URIs, genau einen gemockten nativen Share-Aufruf,
Abbruch, Retry und Cleanup. Der F-1-Korrektursatz deckt V2-Request-Header,
V2-Response-Mapping, gleiche/differente `sourceEtag`-Revision,
Mehrdeutigkeitsauswahl ohne vorausgewählten Kandidaten, manuelle Klärung oder
sichtbaren Ausschluss, unresolved-/doppelte-ID-Save-Blockierung und die nur-
IDs-Confirmation-Payload ab. Die reale Android-Systemannahme und der native
End-to-End-Flow gehören ausschließlich zu U-1 nach Q-1. Ihre Abwesenheit
blockiert Q-1 nicht. Es gibt keine iOS-Gerätematrix oder iOS-Release-Gate.

### Preparation Contract Regression Matrix

| Request-/Mapping-Fall | Erwartetes Ergebnis vor Q-1 |
|---|---|
| V2 `{ "contractVersion": 2 }` mit geladener ETag-Vorbedingung | V2-Antwort mit `sourceEtag` und genau einer Resolution je Included-Key |
| V2 ohne `If-Match` | `428 recipe_precondition_required`, kein Quota-/Provider-Aufruf |
| V2 mit altem `If-Match` | `412 recipe_revision_conflict`, kein Quota-/Provider-Aufruf |
| Legacy `{}`; jeder Key hat einen unterschiedlichen eindeutigen Treffer | unveränderte V1-Erfolgsform mit eindeutigen IDs |
| Legacy `{}` mit Mehrdeutigkeit, Nichttreffer oder ID-Kollision | `409 export_preparation_contract_upgrade_required`, kein Suggestion-Feld und kein persistierter Export |
| Ein exakter Treffer sowie zusätzliche fuzzy Kandidaten | nur der exakte Treffer entscheidet; genau ein exakter Treffer ist `resolved`, mehrere exakte Treffer sind `ambiguous` |
| Kein exakter Treffer, ein fuzzy Treffer | `resolved` mit genau einer singularen `ingredientId` |
| Kein exakter Treffer, mehrere fuzzy Treffer | `ambiguous` mit allen eligible Same-recipe-Kandidaten und ohne vorgewählte ID |
| Kein Treffer | `unmatched` mit leerer Kandidatenliste; Mobile verlangt manuelle Zuordnung oder expliziten Ausschluss |
| Seasoning, andere Recipe oder anderer Benutzer als Namens-/ID-Treffer | kein Kandidat und kein zurückgegebener Fremdwert |
| Confirm enthält nicht vorhandene/entfernte/fremde/Seasoning-ID oder eine mehrfach vorkommende Source-ID | `400 invalid_export_view_ingredient`, ohne Persistierung |
| Confirm ETag ist stale oder CAS verliert Race | `412 recipe_revision_conflict`, ohne Teilpersistenz |

### Renderer-Testmatrix

Mindestens:

| Fall | Erwartung |
|---|---|
| 1, 8 Zutaten | große Einspaltenansicht |
| 9 Zutaten | kompakt, 5 links / 4 rechts, Motiv |
| 10, 14 Zutaten | kompakt, Motiv |
| 15 Zutaten | kompakt, kein Motiv |
| 20 Zutaten | kompakt, 10 links / 10 rechts, kein Motiv |
| 21 Zutaten | kontrollierter Exportfehler, keine Kürzung |
| 1 bis 4 Schritte | große Darstellung |
| genau 5 Schritte | kompakte Darstellung |
| 6 Ausgangsschritte | validierte KI-Verdichtung oder kontrollierter Block |
| Seasonings | nicht in Zutatenkarte, dürfen in Schritten vorkommen |
| Titel/Teaser/Menge/Name/Schritt über Grenze | feldbezogener Fehler |
| tatsächlicher Satori-/Resvg-Overflow | feldbezogener Fehler |
| gültige Daten | PNG exakt `1080 x 1350` |

### Share-/Media-Testmatrix

- erstes Renderpaar vollständig;
- Instagram fehlt oder Detail fehlt;
- initialer/finaler Request race-safe;
- zweiter PNG-Schreibfehler;
- zweites Albumasset schlägt fehl und erstes wird zurückgerollt;
- vorbestehende Albuminhalte bleiben erhalten;
- ein nativer Share-Aufruf mit zwei URIs;
- Share-Fehler behält beide Assets und erlaubt Retry ohne Duplikat;
- Cleanup erst nach Share-Abschluss oder Flow-Close;
- keine zwei Share-Dialoge;
- Permission retryable versus settings-only;
- Back/Cancel verwirft nur transienten Draft.

### Encoding und Diff-Hygiene

Vor Q-1 laufen `node scripts/check-encoding.mjs` und `git diff --check`.
Keine Secrets, Credentials oder lokalen Settings dürfen in Plan, Tests, Logs
oder Quelltext gelangen.

## 20. Acceptance Criteria

Die folgende Matrix übernimmt AC-1 bis AC-29 vollständig aus US-10. QA muss
jedes Kriterium mit Implementierungs- und Test-Evidence bewerten.

| AC | Abnahmeanforderung | Plan-/Testnachweis |
|---|---|---|
| 1 | Im Create-/Edit-Workflow existiert eine sichtbare Exportansicht mit Teaser, Gesamtzeit, Exportschritten und Exportzutaten-Auswahl. | Mobile Wizard; Komponenten-/Flow-Test für Zeit und Schwierigkeit |
| 2 | Die Exportansicht ist vor dem Speichern editierbar und muss ausdrücklich bestätigt werden. | Draft-Reducer, Save-Gate, UI-Test |
| 3 | Neue Recipe-Analyze-Antwort liefert Exportinformationen im selben KI-Aufruf wie die übrigen Rezeptinformationen. | Structured Output mit Zeit/Schwierigkeit, Prompt-Eval, Handler-Test |
| 4 | Teilen löst keinen weiteren KI-Aufruf aus. | Bundle-Handler ohne AI; Mobile API-Mock/Spy |
| 5 | Bestätigte Exportfassung wird versioniert am Rezept gespeichert und bei GET/PUT korrekt gelesen/geschrieben; nur explizite Bestätigung darf den Fingerprint neu berechnen. | Shared-/Repository-/Handler-/Cosmos-Contract-Test für Action-Paar, ETag, Compare-and-Replace und serverseitigen Fingerprint |
| 6 | Bestehende Rezepte ohne Exportfassung bleiben lesbar und können über lokalen Fallback vorbereitet werden. | Legacy-Cosmos-Test; offene Zeit/Schwierigkeit ohne Default im Edit-Fallback |
| 7 | Bei bestehenden Rezepten startet KI nur nach ausdrücklicher Nutzeraktion. | Preparation-Endpoint; ein Aufruf für Zeit/Schwierigkeit und Mobile Interaction Test |
| 8 | Gewöhnliche Updates bewahren die alte Exportfassung als stale; eine erneute Bestätigung erfordert explizite Review und den ETag der geprüften Recipe-Revision; ein stale Export kann nicht geteilt werden. | Ordinary-update preservation, `428` missing precondition, `412` stale/racing revision with no write, Mobile reload/re-review, stale bundle rejection tests |
| 9 | 1 bis 8 Zutaten erscheinen einspaltig; 9 bis 20 kompakt zweispaltig mit höchstens zehn Zeilen je Spalte; 9 exakt als 5/4. | Renderer-Layout- und Pixel/Bounds-Tests |
| 10 | Menge und Name jeder ausgewählten Zutat bleiben sichtbar; keine stille Kürzung. | Detailadapter, Overflow-Test, Fixture-Matrix |
| 11 | Bei mehr als 20 Nicht-Gewürz-Zutaten wählt der Nutzer höchstens 20 selbst aus. Bei bestehender-Rezept-Preparation wird nur ein eindeutiger Quelltreffer als ID-Vorschlag geliefert; null oder mehrere Treffer werden mit AI-Key/-Name und leerer beziehungsweise vollständiger Kandidatenliste explizit dargestellt. Ambige oder fehlende Treffer benötigen vor Bestätigung eine sichtbare Nutzerzuordnung oder einen ausdrücklichen Ausschluss; kein beliebiger Match und kein stilles Weglassen sind zulässig. | Backend duplicate-exact/overlapping-fuzzy/no-match tests; V1 fail-closed/V2 contract tests; Mobile select/manual-map/exclude and save-gate tests; server-side effective-recipe ID validation under `If-Match`/CAS |
| 12 | Gewürze erscheinen nicht in der Zutatenkarte, dürfen aber in Schritten genannt werden. | Adapter-/Renderer-Test |
| 13 | 1 bis 4 Exportschritte werden groß gerendert. | Renderer-Fixture-Tests |
| 14 | Genau 5 Exportschritte werden kompakt gerendert. | Renderer-Fixture-Test |
| 15 | Mehr als 5 Ausgangsschritte werden semantisch auf höchstens 5 verdichtet oder kontrolliert blockiert. | AI-Validation-/Fallback-Test |
| 16 | Verdichtung erhält Reihenfolge, Handlungen, Zutatenbezug, Temperatur, Dauer und Wendepunkte. | Traceability-/Anchor-Tests und Prompt-Eval |
| 17 | Teaser, Titel, Zutaten und Schritte werden inhaltlich, per Zeichenlimit und per tatsächlichem Layout geprüft. | Validator plus Satori/Resvg Probe-Render |
| 18 | Gültige Daten erzeugen ein PNG mit exakt `1080 x 1350`. | Renderer-Dimension-/PNG-Test |
| 19 | Ungültige Exportdaten geben verständliche feldbezogene Fehler und kürzen nicht still. | Fehlercode-/Mobile-Overlay-Tests für Zeit und Schwierigkeit |
| 20 | Instagram-Render und Detailbild werden gemeinsam im Share-Draft aus einer aktuellen serverbestätigten Exportfassung erzeugt. | Bundle-API vom produktiven Screen; stale rejection; beide Renderer verwenden identische kanonische Zeit/Schwierigkeit; Pair-State-Test |
| 21 | Vorschau unterscheidet beide unterschiedlichen Bilder und sperrt `Speichern & teilen`, solange das vollständige Paar fehlt/fehlschlägt. | Zwei-URI-/Preview-/CTA-Test einschließlich fehlender oder doppelter URI |
| 22 | Beide PNGs werden in `FitTrack` gespeichert und über genau einen nativen `Share.open({ urls: [...] })`-Aufruf gemeinsam übergeben. | Automatisierter Call-Contract-/Media-Test vor QA; tatsächliche Android-Annahme durch U-1 nach QA |
| 23 | Abbruch, Permissions, Albumfehler, Renderfehler, Retry und Cleanup funktionieren für beide Dateien ohne falsche oder unvollständige Erfolgsmeldung. | Automatisierte State-/Media-Tests; nicht mockbare Android-Geräteaspekte in U-1 nach QA |
| 24 | US-09-Teilen, Speichern, Crop, Tag und Highlight bleiben für Instagram kompatibel. | Regression suite und US-09 smoke tests |
| 25 | Neue KI-Ausgaben unterliegen Review, Structured Output, Plausibilität und `recipe-analyze`-Quota; Usage wird nur nach gültigem Erfolg getrackt und nichts ohne Bestätigung persistiert. | Scoped Recipe-Analyze-v11-Eval, Preparation handler tests für Quota/Tracking/Fehler sowie Mobile confirmation tests |
| 26 | Alte Rezepte/Cosmos-Dokumente ohne Exportfassung bleiben kompatibel; kein neuer Container. | Cosmos contract and infra review |
| 27 | Tests decken neue/alte Rezepte, editierte Exportdaten, ETag-/CAS-Rennen, Schrittgrenzen, Zutatenmengen, Seasonings, Overflow, beide unterschiedlichen PNGs und Multi-Share ab. | Test inventory; concurrency-, quota-, stale-bundle-, two-URI- und QA matrix |
| 28 | KB sowie API-/Domain- und Mobile-Dokumente beschreiben Persistenz, Bestätigung/Concurrency, KI, Grenzen und Legacy-Kompatibilität. | Backend API/domain- und Frontend Mobile/UX-Dokumentationsreview |
| 29 | 9 bis 14 Zutaten zeigen das dezente Garniturmotiv; 15 bis 20 nicht. | Renderer visual/bounds regression tests |

Ein Kriterium darf nicht als erledigt markiert werden, nur weil die
entsprechende Implementierungsdatei geändert wurde; es braucht ausführbare
Tests oder eine klar dokumentierte manuelle Verifikation.

## 21. Risks and Edge Cases

| Risiko / Edge Case | Gegenmaßnahme |
|---|---|
| Android-native Multi-Image-Fähigkeit ist nicht gegeben | U-1 nach QA; bei TECH-1-Fehler Frontend-Fix, automatisierte Regressionstests, QA-Review und erneuter U-1; niemals zwei Dialoge als Fallback |
| Neue native Dependency hat falsche SDK-Version | Stable-Version und Expo-Kompatibilität vor Package-Änderung automatisiert/konfigurationsseitig prüfen; Dev Build nur bei tatsächlichem U-1-Bedarf und nach separater Anforderung |
| Base64-Bundle überschreitet ein Transportbudget | Aktueller Status bleibt `UNVERIFIED`; nur eine tatsächliche U-1-Messung kann `B-6A` auslösen. Nach Redesign folgen automatisierte Regressionstests, QA-Review und U-1-Wiederholung; weiterhin ein nativer Share |
| KI behält mechanisch nur erste fünf Schritte | `sourceStepOrders`, Anchor-Validierung, Prompt-Eval und kontrollierter Block |
| KI entfernt fachlich wichtige Zutat | Ingredient-Key-/Inhaltsprüfung, Review-Warnung, kein automatisches Save |
| Legacy-Zutat hat keine Kategorie | Bestehende Regel behandelt sie als `food`; Backend prüft sie entsprechend |
| Exakte oder fuzzy Ingredient-Namen matchen mehrere Quellen | B-5 gibt keinen First-Match zurück; V2 liefert alle eigenen Rezeptkandidaten als `ambiguous`, Mobile wählt nichts voraus und blockiert Confirm bis zur Nutzerentscheidung |
| AI-Key hat keinen Recipe-Treffer | V2 liefert `unmatched` samt AI-Key/-Name und ohne Kandidaten; Mobile verlangt eine manuelle Zuordnung aus dem geladenen eigenen Rezept oder einen expliziten sichtbaren Ausschluss |
| Mehrere AI-Keys landen auf derselben eindeutigen Source-ID | Mobile setzt keine mehrfach verwendbare finale ID voraus und verlangt explizite Klärung/Ausschluss; V1 liefert in diesem Fall keinen ID-only-Erfolg |
| Alter Mobile-Client kann keine Resolutionstates darstellen | Legacy `{}` behält die alte Erfolgsgestalt nur für eine vollständige Menge verschiedener eindeutiger IDs; sonst `409 export_preparation_contract_upgrade_required` ohne Suggestion und ohne Persistenz |
| Preparation-Kandidat ist zwischen Laden und Confirm veraltet/gefälscht/fremd | V2 Preparation muss denselben geladenen `If-Match`-ETag erfüllen; Confirm prüft jede ID genau einmal gegen die effektive Recipe des authentifizierten Besitzers und nutzt bestehenden CAS/Fingerprint. Stale Revision gibt `412`, Nichtmitgliedschaft `400`, jeweils ohne Write |
| Auswahl enthält gelöschte/fremde Ingredient-ID | 400, kein Teilupdate, Nutzer muss Exportansicht neu bestätigen |
| Rezept ändert sich während Share-Vorbereitung | aktueller user-scoped GET plus Fingerprint; stale Bundle wird 422 |
| Rezept ändert sich zwischen Review-GET und Bestätigungs-PUT | verpflichtendes `If-Match`, atomarer Cosmos-/In-Memory-CAS, `412` ohne Teilpersistenz und Mobile-Reload mit erneuter Review |
| Zwei Backend-Writes konkurrieren nach demselben Repository-Read | bedingtes Replace gegen die gelesene Revision; genau ein Write gewinnt, der andere gibt `412` ohne Snapshotverlust zurück |
| Export wird separat von Rezeptdaten geändert | atomischer PUT und serverseitige effektive Fingerprint-Berechnung |
| Stale Fassung wird versehentlich geteilt | Bundle verweigert stale; Mobile zeigt Re-Review/Preparation |
| Titel/Teaser passt trotz Zeichenlimit nicht | Probe-Render mit Produktionsfonts und feldbezogener Blockierung |
| Template `slice` umgeht Validator | slices aus Produktionspfad entfernen; direkte Template-Tests |
| 21 Zutaten werden still auf 20 gekürzt | Backend- und Frontend-Validierung, kein Default auf erste 20 |
| Seasoning wird trotz Auswahl angezeigt | doppelte Serverfilterung und Renderer-Test |
| Fehlende Zeit oder Schwierigkeit wird defaulted | `null`/offener Draft, gemeinsamer Dialog, Save-Gate und kein `30`-/`Einfach`-Client- oder Server-Default im neuen Flow |
| Zeit und Schwierigkeit stammen aus unterschiedlichen Quellen | gemeinsame `recipe-analyze`-Antwort, gemeinsame bestätigte `exportView` und serverseitiger Bundle-Adapter für beide Renderer |
| Detail-Render gelingt, Instagram scheitert oder umgekehrt | Bundle-Ergebnis atomar; kein `ready` bei Teilpaar |
| Zweite Datei/Albumzuordnung scheitert | neu angelegte erste Asset-Instanz zurückrollen; alte Inhalte schützen |
| Share-Call schlägt fehl | beide Assets/URIs behalten, Retry ohne Neuanlage |
| Cleanup läuft zu früh | Promise-Auflösung und explizites Close als einzige Cleanup-Gates |
| Permission kann nicht erneut gefragt werden | `canAskAgain` unterscheiden; Settings-Link über InfoOverlay |
| Kein Rezeptbild | kontrollierter Renderfehler; Rezept bleibt unverändert |
| Prompt-Eval-Credentials fehlen | `UNVERIFIED`, niemals als PASS verschleiern |
| Production ist nicht verfügbar | produktionsfähige Verträge dokumentieren, aber keinen Deploy behaupten |

## 22. Recommended Execution Order

Die Orchestrator-Queue ist strikt sequentiell und bleibt bis zur expliziten
Freigabe `APPROVE US-10 AC-11 replan 2026-09-30` vollständig gestoppt. Die
letzte Q-1-Re-Review hat die bestehende Implementierung für alle Kriterien
außer AC-11 bewertet; FT-QA-2026-038 bis -043 bleiben laut Bericht resolved,
FT-QA-2026-044 ist im scoped Eval-Gate nicht actionable. Unveränderte
B-1/B-2/B-3/B-4/B-6- und F-1a/F-2/F-3-Handoffs werden nicht erneut geöffnet.
Nur B-5 und der abhängige F-1-Klärungspfad werden für FT-QA-2026-037 geändert.
Der fehlgeschlagene B-5-Korrekturversuch änderte keine Dateien; sein gezielter
`recipes.test.ts`-Baseline-Lauf bestand 63 Tests und ersetzte keine fehlende
Contract-Implementierung.

1. **B-5 Preparation-V2 und serverseitige ID-Prüfung — Backend:** nach
   Freigabe Shared-Typen, strict Request-/Response-Schema und Matching wie in
   Abschnitt 11 festlegen/implementieren. Legacy `{}` bleibt bei ausschließlich
   eindeutigen, verschiedenen IDs erfolgreich und fail-closed sonst mit `409`.
   V2 bindet Analyse an den geladenen ETag; bestehende Quota-/Tracking-Regeln
   bleiben. Jede finale Export-ID wird beim Confirm gegen die effektive,
   user-scoped Recipe geprüft; Fingerprint/CAS-Vertrag aus B-1/B-2 bleibt.
2. **F-1 Preparation-Klärung — Frontend:** nach dem B-5-Handoff V2 samt
   `If-Match`/`sourceEtag` integrieren. Eindeutige IDs bleiben überprüfbare
   Vorschläge; ambige und unmatched Keys erfordern manuelle Zuordnung oder
   sichtbaren Ausschluss. Unaufgelöste Keys, ID-Kollisionen oder eine
   abweichende Recipe-Revision sperren Confirm. Persistiert wird ausschließlich
   die bestehende bestätigte Exportansicht mit normaler ID-Liste.
3. **Automatisierte Vor-QA-Prüfungen:** Backend führt Shared-Vitest/Typecheck,
   vollständige Backend-Unit-Suite, Backend-Typecheck und `build:verify` aus;
   zusätzlich müssen die fokussierten `recipes.test.ts`- und
   `recipeValidation.test.ts`-Regressionen für V1/V2, Mehrfachmatches,
   Quota/Preconditions und Confirm-Mitgliedschaft nachweislich laufen.
   Frontend führt die vollständige Mobile-Vitest-Suite und Mobile-Typecheck
   aus, einschließlich API-, Bootstrap-, UI-Resolution- und Save-Gate-Tests.
   Encoding und `git diff --check` laufen automatisiert. Alle Commands,
   Exit-Codes und Ergebnisse werden vor Q-1 übergeben. Diese Korrektur ändert
   keinen Prompt; der letzte scoped Recipe-Analyze-Eval 8/8 bleibt die gültige
   Evidence. Kein Geräteschritt, Share-Sheet, manueller Empfänger, Real-User-
   E2E, Build, Deployment oder Base64-Messung läuft vor Q-1.
4. **Q-1 AC-11 Re-Review — QA:** nach allen automatisierten Handoffs die volle
   AC-1-bis-AC-29-Matrix anhand der letzten QA-Evidence und der geänderten
   Regressionen prüfen; FT-QA-2026-037 schließen oder mit konkretem Evidence-
   Gap als Blocking belassen. Die bereits geschlossenen/non-actionable
   FT-QA-2026-038 bis -044 erneut abgleichen, Dokumentation prüfen und einen
   aktualisierten `fittrack-qa-v1`-Report liefern. Cosmos Contract bleibt
   `UNVERIFIED` mangels Emulator-Evidence; U-1/TECH-1/TECH-2 bleiben
   `UNVERIFIED`. Q-1 verlangt keine manuelle oder native Prüfung.
5. **I-1 Release-Datensatzkorrektur — Infrastructure:** ausschließlich nach
   abgeschlossenem Q-1 ohne unresolved Blocking Finding und vor U-1 den
   bestehenden Datensatz redaktionell aktualisieren. Die frühere
   SDK-/ADB-/Build-/Device-Discovery bleibt historische Beobachtung; TECH-1
   und TECH-2 sind bis U-1 `UNVERIFIED`. Keine neue Prüfung, kein Build, kein
   Deployment und kein Messwert wird behauptet oder ausgeführt.
6. **U-1 — User:** erst nach Q-1 ohne unresolved Blocking Finding und nach
   I-1 führst du selbst den realen Android- und Real-User-End-to-End-Test
   gemäß Abschnitt 15 aus. Kein iOS-Test. Ein erforderlicher Dev Build oder
   ein erforderliches Deployment bedarf eines separaten direkten Auftrags und
   wird nicht durch dieses Re-Plan impliziert.

**Bedingte Remediation nach U-1:**

- **TECH-1-FAIL — Frontend:** nur nach tatsächlich fehlgeschlagenem U-1 die
  native Android-Implementierung korrigieren, betroffene automatisierte
  Regressionstests ausführen, QA-Review abschließen und danach U-1 wiederholen.
- **TECH-2-FAIL mit dokumentierter U-1-Budgetmessung — Backend:** nur dann
  `B-6A` ausführen. Danach folgen automatisierte Regressionstests,
  fokussiertes QA-Review und eine erneute U-1-Messung.
- `UNVERIFIED`, fehlende Messwerte oder ein nicht verfügbares Gerät lösen
  keinen Fixpfad und insbesondere kein `B-6A` aus.

### Definition of Done für die Planübergabe

aus dem aktuellen Workflow bleiben gemeldete Handoffs und werden nicht als in
Diese Revision invalidiert `APPROVE US-10 replan 2026-09-30` und ist pending.
Bis der User exakt `APPROVE US-10 AC-11 replan 2026-09-30` antwortet, sind
B-5/F-1-Korrekturarbeit und deren Checks gestoppt. Nach Freigabe gehen alle
geänderten Shared-/Backend-/Mobile-Checks automatisiert vor Q-1; Q-1 ist
automatisiert/dokumentarisch und verlangt keinen Android-Gerätenachweis. I-1
ist eine redaktionelle Evidenzkorrektur nach Q-1 und vor U-1. U-1 führt der
User nach erfolgreichem Q-1 und I-1 selbst auf Android durch. Die Story gilt
erst dann als vollständig abgeschlossen, wenn die Acceptance-Evidence und
QA-Review vorliegen und U-1 bestanden ist. Cosmos-Contract, TECH-1 und TECH-2
bleiben `UNVERIFIED`, bis entsprechende Evidence vorliegt. Kein iOS-Gate, kein
automatischer EAS-Build und kein implizites Build-/Deployment sind Teil dieses
Plans.
