# Plan HC-4 – Health-Connect-Synchronisation durch Abgleich ersetzen

**User Story:** [HC-4_Health-Connect-Synchronisation-vereinfachen.md](HC-4_Health-Connect-Synchronisation-vereinfachen.md)  
**Status:** Freigegeben (2026-10-23). F2 kann gegen den bestehenden Vier-Felder-Vertrag fortfahren. PO-1 und PO-2 bleiben unverändert bestehen. B1, B2, D1 und F1 werden anhand der übergebenen Handoffs als abgeschlossen geführt; ihre Ergebnisse sind Ist-Stand und kein Scope für F2.
**Requirement Assessment:** Accept with modifications; die queue-basierte Fehleranzeige wird durch eine aggregierte Anzeige der vier vorhandenen `getSyncStatus()`-Felder ersetzt. Nicht bereitgestellte Laufzeit- und Fehlversuchsstatus sind kein F2-Umfang.  
**Infrastructure Impact: Alpha**  
**Mobile Build Impact: None**

## Product Owner Decisions

### PO-1 — Entschieden: lokale Aktivierungs- und Versuchsdaten

**Entscheidung:** Der Product Owner folgt der Planner-Empfehlung. Lokaler Sync-Stand darf pro Datentyp ein Aktivierungsmerkmal und den Zeitpunkt des letzten Vordergrundversuchs enthalten, zusätzlich zu Nutzer-ID, Wasserzeichen und ausstehenden Lösch-IDs. Die Felder und ihr Verhalten sind in Abschnitt 10 festgelegt. Diese Entscheidung konkretisiert die engere lokale Allowlist der unveränderten HC-4-Story; die Storydatei bleibt unverändert. Es werden keine account-weiten Profil- oder API-Felder für Aktivierung oder Drosselung ergänzt.

### PO-2 — Qualifizierte Privacy-Policy-Formulierung

**Entscheidung (2026-10-22):** Der Product Owner stimmt dem qualifizierten deutschen Wortlaut in Abschnitt 17 ausdrücklich zu. Die Zustimmung umfasst die Aussage, dass die Daten jederzeit über Android-Mittel in der App-Speicherverwaltung gelöscht werden können, die qualifizierte Aussage zur üblichen Entfernung lokaler App-Daten bei einer Deinstallation und den Hinweis, dass gesicherte Daten abhängig von Android-Version, Geräteeinstellungen und Backup-Anbieter bei einer späteren Wiederherstellung erneut auf das Gerät gelangen können. D3 setzt ausschließlich diesen Wortlaut um; Q4 prüft ihn.

## 1. Requirement Assessment

HC-4 löst ein reales Datenschutz- und Konsistenzproblem: fehlgeschlagene lokale Queue-Einträge enthalten vollständige Gewichts- oder Mahlzeitendaten, sind nicht an den angemeldeten Nutzer gebunden und werden ohne aktuelle Berechtigungsprüfung erneut gesendet. Weil FitTrack führend ist und die API bereits die aktuellen Einträge liefert, ist ein serverbasierter Delta-Abgleich geeigneter als ein lokaler Snapshot-Retry.

Die Lösung passt zu den Produktregeln „Cloud-only“ und „keine Offline-Warteschlange“. Es werden keine Nährwertberechnungen, medizinischen Aussagen oder KI-Funktionen geändert; externe Fachexpertise ist nicht erforderlich. Die zentrale Änderung ist technisch und datenschutzrelevant, nicht eine neue Gesundheitsfunktion.

Die Statusentscheidung ist im Storytext ausdrücklich dem Planner zugewiesen. Einzelne Einträge erhalten weder Erfolgs-, Wartestatus- noch Fehler-Badges; dafür fehlt nach Wegfall der Queue eine dauerhaft gespeicherte, belastbare Eintragshistorie. F2 zeigt pro Datentyp ausschließlich die bereits von `getSyncStatus()` gelieferten Felder `enabled`, `permissionRevoked`, `pendingDeleteCount` und `lastSuccessfulSyncAt`. Der Vertrag enthält weder einen laufenden Abgleich noch den Fehler des letzten Versuchs; diese Zustände werden nicht angezeigt oder aus anderen Werten abgeleitet. Das bestehende HC-3-Kriterium „keine Statusanzeige an einzelnen Ernährungseinträgen“ bleibt gewahrt. Eine zusätzliche Product-Owner-Entscheidung ist dafür nicht erforderlich.

## 2. Feature Summary

Die Android-App liest für den aktuell authentifizierten Nutzer Änderungen aus den bestehenden Gewicht- und Tagebuchdaten, schreibt nur neue oder geänderte Health-Connect-Datensätze und hält Löschungen als reine IDs vor. Ein serverseitiger UTC-Zeitpunkt wird erst dann als Wasserzeichen übernommen, wenn alle Seiten gelesen und alle zugehörigen Health-Connect-Schreib- und Löschoperationen erfolgreich abgeschlossen sind. Ein fehlgeschlagener Abgleich bleibt über das unveränderte Wasserzeichen erneut abrufbar; fehlgeschlagene Löschungen bleiben als IDs gespeichert.

## 3. Current Behaviour

- `healthSyncService` speichert vollständige `WeightEntry`-Snapshots und Retry-/Fehlerdaten unter `hc:weight:sync`; `nutritionSyncService` speichert vollständige `MealItem`-Snapshots samt Mahlzeitentyp/-datum unter `hc:nutrition:sync`.
- `App.tsx` startet bei jedem Wechsel zu `active` beide Queue-Drains. Ein 15-Minuten-Limit ist nicht implementiert.
- `IHealthPlatformService` und `HealthConnectService` bieten `hasPermissions`; vor bestehenden Schreibzugriffen wird diese Prüfung nicht aufgerufen.
- Gewichtsdokumente enthalten `createdAt`, aber kein `updatedAt`. `updateValue()` patcht nur `/value`. Meals enthalten `createdAt`, aber kein `updatedAt`; Meal-Änderungen schreiben den vollständigen Meal-Datensatz ohne Änderungszeit.
- `GET /api/weights` liefert die vollständige Liste. `GET /api/diary/meals` ist paginiert und wird für den Ernährungs-Voll-Export genutzt. Eine Delta-Abfrage existiert nicht.
- Die Mobile-UI zeigt Queue-basierte Fehlerlisten in HealthConnect/`SyncStatusSheet`. Die aktuelle `ProgressScreen` rendert keine Eintrags-Badges, obwohl HC-2 dies beschreibt. HC-3 schließt Ernährungseintrags-Badges ausdrücklich aus.
- `profile.healthSyncEnabled` ist eine optionale, account-weite Einstellung für Gewicht; für Ernährung gibt es keine entsprechende Profileinstellung.
- `syncLogger` bleibt lokal erhalten, protokolliert derzeit aber unter anderem Gewichtswerte und Fehlerdetails. Der HC-4-Refactor muss diese Inhalte auf nicht-sensitive Diagnoseinformationen begrenzen.

## 4. Desired Behaviour

- Alte Snapshot-Queues werden beim ersten Start mit HC-4 ohne Health-Connect-Aufruf verworfen.
- Alle Upserts stammen aus dem authentifizierten FitTrack-Serverbestand. Lokaler Retry-Stand enthält keine Gesundheitswerte.
- Gewicht und Ernährung werden bei erfolgreicher Nutzeraktion sofort asynchron abgeglichen. App-Vordergrund ist ein begrenztes Sicherheitsnetz. Aktivierung und manueller Voll-Export bleiben vollständige, idempotente Exporte.
- Vor jedem Health-Connect-Schreibzugriff werden Aktivierung, aktuelle Nutzerbindung und Schreibberechtigung geprüft. Abweichende/fehlende Nutzerbindung verwirft den betroffenen lokalen Stand und verhindert jeden Schreibzugriff.
- Lösch-Retries speichern ausschließlich Health-Connect-Client-IDs und bleiben bis zum erfolgreichen Delete erhalten. Bei Deaktivierung bleiben sie lokal erhalten und werden erst nach erneuter Aktivierung sowie aktueller Berechtigungsprüfung verarbeitet.
- UI-Status sind pro Datentyp auf die von `getSyncStatus()` gelieferten Felder `enabled`, `permissionRevoked`, `pendingDeleteCount` und `lastSuccessfulSyncAt` begrenzt; Queue-Begriffe und Eintragsfehlerlisten entfallen. Ein globaler Zustand „Abgleich läuft“ oder „letzter Versuch fehlgeschlagen“ wird nicht ergänzt oder abgeleitet. `syncLogger` bleibt vorhanden, ohne Gewichts-/Mahlzeitenwerte oder rohe Datensatz-Payloads zu protokollieren.

## 5. Scope

- Gewicht: optionales serverseitiges `updatedAt`, Änderung beim Erstellen und Ändern, rückwärtskompatible Reads sowie authentifizierte Delta-Abfrage.
- Ernährung: optionales Meal-`updatedAt` bei allen Meal-Mutationen und authentifizierte, paginierte Delta-Abfrage geänderter Meals.
- Mobile-Sync-State, Queue-Formatmigration, Nutzerbindung, aktuelle Berechtigungsprüfung, sofortige Mutationstrigger, Lösch-ID-Retry, Voll-Export und Vordergrundabgleich.
- Statusanzeige in HealthConnect/`SyncStatusSheet`; Progress-Einträge bleiben ohne Sync-Badges. Vorhandene Statusdarstellung wird an den neuen Zustand angepasst.
- Unit-, API- und Cosmos-Contract-Tests; Health-Connect-Fehler-, Berechtigungs-, Identitätswechsel- und Delta-Fälle.
- Knowledge-Base-Aktualisierung und Privacy-Policy-Prüfung.

## 6. Out of Scope

- Health-Connect-Import, Daten anderer Health-Connect-Apps, serverseitiger Übertragungsstatus pro Gerät und serverseitige Lösch-Tombstones.
- Hintergrunddienst oder Zeitgeber außerhalb der aktiven App.
- Änderungen an Health-Connect-Daten oder Berechtigungen bei Deaktivierung oder Kontolöschung.
- Änderungen am Konto-Löschablauf, dessen Best-Effort-Cleanup, Serververtrag, UI oder Retention-Verhalten. Bestehende `resetForAccountDeletion()`-Methoden und das Entfernen der beiden Sync-Keys bleiben funktionsfähig; die separate Konto-Löschfortsetzung ist nicht Teil dieses Plans.
- Neue Cosmos-Container, neue Azure-Ressourcen, neue native Module, Expo-Plugin- oder `app.config.js`-Änderungen.
- Releaseausführung. Dieser Plan führt weder Dev-/Alpha-Deployments noch Expo-/EAS-Builds aus.

## 7. Confirmed Facts

- JWT-`sub` ist die Backend-Identität; Gewichte und Tagebuchdaten sind nutzerpartitioniert. Jede neue Delta-Abfrage muss `requireUser()` verwenden und auf genau diese Partition begrenzt bleiben.
- `WeightEntry` und `Meal` werden in bestehenden Containern gespeichert. `updatedAt` kann als optionales Class-0-Feld ergänzt werden; ein Backfill ist nicht nötig.
- Der Voll-Export bleibt für erstmalige Aktivierung, Neuinstallation und manuelles Re-Export maßgeblich. Bestehende Gewichte ohne `updatedAt` bleiben über die normale Liste lesbar und werden dadurch exportiert.
- `nutritionDiaryMeals` enthält auch `DayMeta` und `HintState`. Die neue Meal-Delta-Abfrage und der Health-Connect-Voll-Export dürfen nur Meal-Dokumente lesen: `_docType` fehlt oder ist `meal`.
- Das in der jüngsten separaten [Konto-Löschplan-Revision](../Profile/PLAN_US_Profil-und-Konto-dauerhaft-loeschen_aktualisiert.md) festgehaltene Sequencing gilt: HC-4 zuerst vollständig abschließen. Danach kann die Konto-Löschfortsetzung ausschließlich nach ihrem eigenen Plan, dessen aktuellem Status und der dort verlangten erneuten ausdrücklichen Freigabe fortgesetzt werden. Der Plan meldet F1 mit QA **FAIL** und wartet auf neues `APPROVE`; B1, Dev-only I1 und B2 sind als gemeldet abgeschlossen dokumentiert. Dieser Plan ändert oder überschreibt diese Statusangaben nicht.
- Die HC-2-Aussage zu Gewichts-Badges und die aktuelle Implementierung divergieren: In `ProgressScreen` sind solche Badges derzeit nicht vorhanden. Es wird keine neue Eintragsstatus-UI eingeführt.
- Android-Backup-/Deinstallationsprüfung: `mobile/android/app/src/main/AndroidManifest.xml` setzt `android:allowBackup="true"`. `mobile/app.config.js` enthält keine Backup-Konfiguration; `mobile/app.json` enthält keine Backup-Ausnahme. Im Android-Projekt sind keine `dataExtractionRules`- oder `fullBackupContent`-Regeln vorhanden, die eine Sicherung ausschließen. Der Repository-Stand belegt nicht, ob die konkreten AsyncStorage-Sync-Metadaten auf einem Gerät tatsächlich gesichert oder wiederhergestellt werden. Die App-Speicherverwaltung kann lokale App-Daten löschen; Deinstallation entfernt lokale Sandbox-Daten üblicherweise, aber Backup-/Wiederherstellungsverhalten hängt von Android-Version, Gerät und Backup-Anbieter ab und kann Daten später zurückbringen. Daher keine unbedingte Löschzusage.
- B1-Handoff (2026-10-22): `updatedAt` wurde optional zu `WeightEntry` und `Meal` ergänzt; In-Memory- und Cosmos-Delta-Methoden sind auf die Nutzerpartition begrenzt. Meal-Zeitstempel werden bei Create, Item-Add/Update/Delete, Bulk-Delete/Move/Copy und `updateMacrosBySourceId` gesetzt. Legacy-Dokumente verwenden beim Delta-Filtern `createdAt` als Fallback. Unit-/Full-Tests sowie Type-/Build-Checks wurden als bestanden gemeldet. Cosmos-Contract-Tests wurden ergänzt, sind wegen nicht verfügbarer Docker-/Podman-Laufzeit jedoch **UNVERIFIED**. Es gab keine Migration oder Infrastrukturänderung. B2 nutzt diese vorhandenen Repository-Methoden; dessen konkrete API-Verträge stehen verbindlich in Abschnitt 10.
- B2-Handoff (2026-10-23): Die in Abschnitt 10 festgelegten authentifizierten Delta-Endpunkte wurden implementiert. Backend-Handler-/API-Tests decken den Vertrag ab; Backend-, Shared-, Type- und Build-Checks wurden als bestanden gemeldet. Die B1- und B2-Cosmos-Contract-Tests bleiben mangels Emulator **UNVERIFIED** und dürfen nicht als bestanden gemeldet werden. Die bestehenden Voll-Export-Verträge bleiben erhalten.
- D1-Handoff (2026-10-23): Die vier Backend/API/Domain-KB-Dokumente `docs/kb/tech/02-backend.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/domain/02-diary.md` und `docs/kb/domain/05-weight-tracking.md` wurden laut Handoff aktualisiert. Die KB kennzeichnet lokale ID-only-Löschlisten weiterhin als Mobile-seitiges geplantes Verhalten, nicht als implementierte Funktion.
- F1-Handoff (2026-10-23): F1 wurde als abgeschlossen übergeben. Die Services speichern State je Datentyp, nutzen kanonische UTC-ISO-Zeitstempel, die Mutation-Fassade ist für die vorgesehenen Diary-Mutationen verdrahtet, und der Account-Deletion-Ablauf wurde nicht geändert. `healthSyncService.getSyncStatus()` und `nutritionSyncService.getSyncStatus()` liefern jeweils genau `enabled`, `permissionRevoked`, `pendingDeleteCount` und optional `lastSuccessfulSyncAt`; sie liefern weder `syncInProgress` noch `lastAttemptFailed`. Gemeldet wurden `cd mobile && npx vitest run` mit 100 Dateien/936 Tests, `cd mobile && npx tsc --noEmit` bestanden und fokussierte Tests mit 13 Dateien/136 Tests bestanden. Android-Geräteprüfungen bleiben **UNVERIFIED**. F2 wurde nicht ausgeführt; dafür wurden keine Tests gemeldet. Bereits vorhandene Änderungen an `HealthConnectScreen.tsx` und `SyncStatusSheet.tsx` bleiben erhalten und sind nicht Teil dieser Planrevision.

## 8. Assumptions and Open Questions

**Offene Product-Owner-Entscheidungen:** Keine. Andere offene Storypunkte werden wie folgt aufgelöst:

Für die F1/F2-Statusabgrenzung ist keine zusätzliche Product-Owner-Entscheidung nötig: Die Story überträgt die Ableitung der Statuswerte ausdrücklich dem Planner, und diese Revision begrenzt F2 auf den vorhandenen Servicevertrag. Die ausdrückliche Planfreigabe vom 2026-10-23 liegt vor; F2 kann fortfahren.

- `updatedAt` und Wasserzeichen sind UTC-ISO-Zeitpunkte vom Backend. Mobile-Gerätezeit und Zeitzone werden nicht zur Delta-Grenze verwendet. Der Delta-Endpunkt liefert den serverseitigen oberen Checkpoint für den gesamten paginierten Lauf.
- Das 15-Minuten-Intervall ist eine feste Produktkonstante, keine Nutzerkonfiguration.
- Der Vordergrundversuch wird je aktiviertem Datentyp separat gedrosselt. `lastForegroundAttemptAt` ist ein lokal persistierter kanonischer UTC-ISO-Zeitpunkt im Format von `Date.toISOString()` und wird unmittelbar vor Beginn des Delta-Laufs gespeichert. Epoch-Millisekunden sind kein alternatives oder äquivalentes Speicherformat; numerische Werte sind ungültig und werden nicht konvertiert. Fehlgeschlagene oder abgebrochene Läufe zählen als Versuch. Der nächste Vordergrundlauf ist ab genau 15 Minuten nach diesem Zeitpunkt zulässig; ein App-Neustart setzt das Intervall nicht zurück.
- Aktivierung, Deaktivierung und Drosselung sind geräte- und datentypbezogen. Deaktivierung setzt nur `enabled` auf `false`; Nutzerbindung, Wasserzeichen, Lösch-IDs und letzter Vordergrundversuch bleiben erhalten. Im deaktivierten Zustand erfolgen keine Health-Connect-Aufrufe. Erneute Aktivierung führt den vorgesehenen Voll-Export aus und erlaubt danach die Verarbeitung gespeicherter Lösch-IDs nach aktueller Berechtigungsprüfung.
- Aktivierungs-Voll-Export, manueller Voll-Export und Mutationstrigger umgehen die 15-Minuten-Drosselung und verändern `lastForegroundAttemptAt` nicht.
- Ein geändertes Meal gilt als Delta-Einheit. Die App upsertet die aktuellen Items dieses geänderten Meals mit ihren stabilen Item-IDs. Unveränderte Meals erzeugen keine Health-Connect-Schreibzugriffe.
- Physisch gelöschte Weight-/Meal-Daten können nicht aus einer normalen Delta-Abfrage rekonstruiert werden. Löschungen werden daher nach erfolgreicher FitTrack-Mutation vom Mobile-Aufrufer mit IDs an den lokalen ID-Retry übergeben; der Server erhält keinen Tombstone und keinen gerätebezogenen Übertragungsstatus.
- Der lokale Retry garantiert erneute Versuche, sobald die ID-Löschung in AsyncStorage gespeichert ist. Ein Prozessabbruch zwischen erfolgreicher Serverlöschung und Speicherung der ID ist ohne Server-Tombstone nicht dauerhaft rekonstruierbar; dieser technische Restrisiko wird nicht durch eine nicht angeforderte Server-Persistenz kaschiert.
- Die Privacy-Policy-Ergänzung beschreibt keine Rechtsgrundlage oder feste Aufbewahrungsfrist. Eine solche Frist ist im Repository nicht belegt und wird nicht erfunden.

## 9. Existing Components to Reuse

- `HealthConnectService.hasPermissions`, `upsertRecord`, `deleteRecord` und bestehende `clientRecordId`-Ableitung.
- `healthSyncService`, `nutritionSyncService`, `IHealthPlatformService`, `App.tsx` AppState-Listener und `syncLogger`.
- `weightsRepository`/`cosmosWeightsRepository`, `diaryRepository`/`cosmosDiaryRepository`, `weights.ts` und `diary.ts`.
- Vorhandene paginierte `listAllMeals`- und Gewichtslisten für Voll-Export.
- `HealthConnectScreen`, `SyncStatusSheet`, Theme-Tokens, `Icon`, vorhandene Snackbar/Sheet-Komponenten.
- Bestehende per-User-Cosmos-Container `weights` und `nutritionDiaryMeals`; Standardindexierung genügt für die `updatedAt`-Filterung.
- Bestehende Konto-Löschintegration `accountDeletionService` und Sync-Service-Resetmethoden; keine Änderung an ihrem Ablauf.

## 10. Proposed Technical Solution

### Backend- und API-Vertrag

 - Die in B1 ergänzten Felder `WeightEntry.updatedAt?: string` und `Meal.updatedAt?: string` sind optionale UTC-ISO-Zeitpunkte. `createdAt` bleibt unverändert und bestimmt weiterhin den Health-Connect-Erfassungszeitpunkt. B2 verändert weder diese Felder noch die von B1 abgedeckten Schreibpfade.
 - B2 verwendet `WeightsRepository.listUpdatedSince(userId, since)` und `DiaryRepository.listMealsUpdatedSince(userId, since)`. Beide lesen ausschließlich die angegebene Nutzerpartition und liefern Datensätze aufsteigend nach effektivem Änderungszeitpunkt (`updatedAt ?? createdAt`), danach nach `id`. Meal-Ergebnisse schließen `DayMeta` und `HintState` aus. Die Repositories liefern aktuelle Dokumente, keine Ereignisfolge.

#### Gemeinsame Authentifizierungs-, Zeit- und Fehlerregeln

 - Beide Endpunkte sind Azure Functions `authLevel: 'anonymous'` und müssen im Handler `requireUser(request)` aufrufen. Der einzige Nutzer-/Partitionsschlüssel ist `userId` aus dem validierten JWT-`sub`. Kein Request-Parameter, Body-Feld oder Cursor darf einen Nutzer auswählen. Jeder Repository-Aufruf erhält genau diesen `userId`.
 - Beide Endpunkte sind `GET` ohne Request-Body. `since` ist erforderlich und muss ein gültiger UTC-Zeitpunkt im kanonischen `Date.toISOString()`-Format `YYYY-MM-DDTHH:mm:ss.sssZ` sein. Mobile-Gerätezeit, lokale Zeitzone und Offset-Zeitstempel sind unzulässig. `since` muss kleiner oder gleich dem Checkpoint der ersten Seite sein. Der untere Vergleich ist inklusiv. Fehlendes/ungültiges `since`, `since > checkpointAt`, unbekannte oder mehrfach angegebene Query-Parameter sowie ungültige Paging-Parameter liefern `400 { "error": "invalid_delta_query" }`; ein ungültiger, fremder oder mit anderem `since`/`limit` wiederverwendeter Cursor liefert `400 { "error": "invalid_delta_cursor" }`. Weight akzeptiert nur `since`; Meal akzeptiert `since`, `limit` und `cursor`. Fehlende/ungültige Authentifizierung liefert den üblichen `401`-Fehler von `requireUser()`/`withHandler`; unerwartete Fehler bleiben `500 { "error": "Internal server error" }`.
 - Auf der ersten Seite setzt der Server `checkpointAt` genau einmal auf seine aktuelle UTC-Zeit im `Date.toISOString()`-Format. Das Delta-Zeitfenster ist `since <= (updatedAt ?? createdAt) <= checkpointAt`. Ergebnisse mit Zeitstempel nach `checkpointAt` gehören zum nächsten Lauf. Der obere Vergleich ist inklusiv; ein Eintrag genau am Grenzzeitpunkt darf beim nächsten inklusiven Lauf erneut erscheinen und muss aufgrund stabiler Health-Connect-IDs idempotent behandelt werden.
 - Der Checkpoint ist eine feste obere Zeitgrenze für den Lauf, kein Datenbank-Snapshot und kein serverseitiger Sync-Status. Die API verspricht keine transaktionale Momentaufnahme über mehrere HTTP-Aufrufe. Eine während der Seitennavigation erneut geänderte Meal-Zeile mit Zeitstempel nach dem Checkpoint wird in diesem Lauf ausgelassen und durch das unveränderte `since` im nächsten Lauf gefunden.

#### `GET /api/weights/changes`

 - Query: erforderliches `since=<UTC-ISO>`. Weight-Delta ist nicht paginiert und unterstützt keine `limit`- oder `cursor`-Parameter. Die vorhandene B1-Methode liefert alle passenden Weight-Dokumente in der Nutzerpartition.
 - `200` JSON exakt `{ "entries": WeightEntry[], "checkpointAt": "<UTC-ISO>" }`. `entries` enthält die aktuellen Versionen im inklusiven Zeitfenster, aufsteigend nach `(updatedAt ?? createdAt, id)`. Ein leeres Delta liefert `entries: []` und trotzdem einen neuen `checkpointAt`.
 - Die bestehende vollständige Route `GET /api/weights` bleibt unverändert und liefert weiterhin `{ "entries": WeightEntry[] }`.

#### `GET /api/diary/changes/meals`

 - Query: erforderliches `since=<UTC-ISO>`; optional `limit` (Standard `50`, ganzzahlig `1..100`, entsprechend der bestehenden Full-Export-Seitengröße); optional `cursor` (nur ein vom Server für denselben Delta-Lauf ausgegebener opaker Cursor). `since` muss bei jeder Folgeseite identisch wiederholt werden. Der Cursor bindet Nutzer-`sub`, `since`, effektives `limit`, `checkpointAt` und die Position nach dem letzten `(updatedAt ?? createdAt, id)`-Tupel. Mobile darf ihn nicht auswerten oder ändern. Jede Seite führt die JWT-Partitionsbegrenzung erneut aus; der Cursor ist kein Berechtigungsnachweis.
 - `200` JSON exakt `{ "meals": Meal[], "checkpointAt": "<UTC-ISO>", "cursor"?: "<opaque>" }`. `meals` ist aufsteigend nach `(updatedAt ?? createdAt, id)` sortiert und enthält höchstens `limit` Meals. `cursor` ist nur vorhanden, wenn weitere Datensätze im festen Zeitfenster folgen; auf der letzten Seite fehlt das Feld. `checkpointAt` ist auf allen Seiten desselben Laufs identisch. Eine leere erste Seite liefert `meals: []`, `checkpointAt` und keinen Cursor.
 - Die erste Anfrage ohne `cursor` öffnet ein neues Fenster und erzeugt `checkpointAt`. Folgeseiten verwenden denselben Checkpoint und liefern strikt nach der Cursorposition weiter; sie dürfen den Checkpoint nicht neu berechnen. B2 kann die sortierte Ergebnismenge der vorhandenen B1-Methode auf dieses Zeitfenster und die Cursorposition begrenzen; es wird dafür kein dauerhafter serverseitiger Cursor-/Transferstatus angelegt.
 - Der bestehende vollständige Export `GET /api/diary/meals?limit=<n>&cursor=<opaque>` bleibt in Route und Form unverändert: `{ "meals": Meal[], "cursor"?: "<opaque>" }`. Er bleibt der Voll-Export für Aktivierung und manuelles Re-Exportieren; `checkpointAt` wird dort nicht ergänzt.

#### Physische Löschungen ohne Tombstones

 - Beide Delta-Endpunkte sind Änderungsabfragen über aktuell vorhandene Dokumente. Sie liefern weder Löschereignisse noch Tombstones; ein physisch gelöschter Weight- oder Meal-Datensatz kann aus diesen Endpunkten nicht rekonstruiert werden. B2 fügt keine Tombstone-Dokumente, Löschhistorie, serverseitige ID-Liste oder gerätebezogenen Übertragungsstatus hinzu.
 - Nach einer erfolgreichen FitTrack-Löschung hält Mobile die Health-Connect-Client-ID ausschließlich in `pendingDeleteIds` bis Health Connect den Delete bestätigt. Bei Weight-Delete verwendet Mobile die bekannte Weight-ID; bei Item-Delete die beim Request bekannte Item-ID; bei Meal-Delete die Item-IDs des vor dem Request geladenen Meals; Bulk-Delete und Bulk-Move verwenden die bestehenden Response-Felder `deletedItemIds` bzw. `removedItemIds`. Ein fehlgeschlagener FitTrack-Mutationsaufruf erzeugt keine Health-Connect-Löschung. Eine Meal-Löschung mit `204` ändert ihren bestehenden HTTP-Vertrag nicht.
 - Abbruch nach erfolgreichem Server-Delete und vor dauerhafter Speicherung der lokalen ID ist ohne Tombstone nicht rekonstruierbar. Dieser technische Restrisikofall ist akzeptiert und wird nicht durch zusätzliche Serverpersistenz oder eine Änderung des HC-4-Scopes kaschiert.

 - Mobile übernimmt pro Datentyp den vom Delta-Lauf gelieferten `checkpointAt` erst nach erfolgreichem Abschluss aller Seiten und aller zugehörigen Health-Connect-Upserts/Deletes. Bei leerem Delta gibt es null Health-Connect-Schreibzugriffe; nach erfolgreichem Abschluss darf das leere Fenster den Checkpoint aktualisieren. Bei Seiten-, API- oder Health-Connect-Fehlern bleibt das bisherige Wasserzeichen unverändert. Bereits erfolgreiche Upserts des fehlgeschlagenen Laufs werden beim Retry mit stabiler FitTrack-ID idempotent wiederholt.

### Mobile-State und Synchronisation

- Die beiden vorhandenen Storage-Keys werden bei der ersten Migration strikt validiert. Ein alter Zustand mit `pendingOperations` oder vollständigen `entry`-/`item`-Snapshots wird entfernt, ohne ihn zu deserialisieren, zu drainieren oder an Health Connect zu senden. Pro vorhandenem Datentyp-Key ist ausschließlich folgende Allowlist persistierbar: erforderliches `enabled: boolean`, erforderliches `pendingDeleteIds: string[]` (Health-Connect-Client-IDs ohne weitere Eintragsdaten) sowie optionale `userId` (JWT-`sub`), `watermark` (letzter vollständig erfolgreicher kanonischer UTC-ISO-Servercheckpoint) und `lastForegroundAttemptAt` (kanonischer UTC-ISO-Zeitpunkt gemäß `Date.toISOString()`). Numerische Epoch-Millisekunden sind ungültig und werden nicht umgerechnet; ungültiger Zustand folgt dem bestehenden invalid-state reset/Purge-Verhalten. Nicht vorhandene Checkpoints/Zeitpunkte dürfen fehlen; `pendingDeleteIds` darf leer sein. Keine Gesundheitswerte, Nutzdaten, Fehlertexte/-Stacks, Berechtigungs-Caches, Export-Cursor oder account-weiten Profil-/API-Felder werden lokal persistiert. Pagination-Cursor bleiben flüchtig im Arbeitsspeicher.
- Vor jeder einzelnen `upsertRecord`- oder `deleteRecord`-Operation wird geprüft: Datentyp aktiviert, gespeicherter Nutzer entspricht dem aktuellen Token-`sub`, und `hasPermissions()` bestätigt die benötigte Schreibberechtigung. Die Backend-Authentifizierung bleibt maßgeblich; die Client-Sub-Prüfung ist eine zusätzliche Schutzschranke.
- Fehlende/abweichende Nutzerbindung löscht den betroffenen lokalen Sync-Stand und verhindert den Versand bis zur erneuten Aktivierung. Eine fehlende Berechtigung stoppt den Lauf, setzt `enabled` auf `false` und informiert den Nutzer; es wird kein weiterer Health-Connect-Schreibzugriff ausgeführt. Berechtigungsstatus und Fehlerdetails werden nicht im Sync-State gespeichert.
- `nutritionDiaryService` ist die einzige Mobile-Fassade für alle `diaryApi`-Mutationen, die Health-Connect-exportierte Meals/Items ändern. Alle Produktionsaufrufer werden auf diese Fassade umgestellt; direkte mutierende `diaryApi`-Aufrufe außerhalb der Fassade sind nicht zulässig. Die Fassade startet Trigger erst nach erfolgreichem FitTrack-Write fire-and-forget und wartet nicht auf Health Connect. Das separate Rezept-Logging über `recipeApi.log` behält einen expliziten, getesteten Trigger nach dem vollständig erfolgreichen Rezept-Log; seine Diary-API-Aufrufe verwenden ebenfalls die Fassade. Moves löschen alte Health-Connect-IDs und upserten nur die neu erzeugten Item-IDs.
- Lösch-IDs werden ohne Namen, Datum, Makros oder sonstige Eintragswerte gespeichert. Erfolgreiche Deletes entfernen ausschließlich die bestätigten IDs; Fehlschläge lassen IDs stehen. Keine Server-Tombstones und kein Queue-Backfill.
- Aktivierung und manueller Voll-Export verwenden die vollständigen API-Listen und setzen den Checkpoint erst nach vollständigem Erfolg. Neuinstallation hat keinen lokalen Stand und benötigt erneute Aktivierung/Berechtigungsabfrage. Ein manueller Voll-Export bleibt ein Voll-Export, auch wenn ein Wasserzeichen existiert.
- App-Vordergrund startet pro aktiviertem Datentyp einen abgegrenzten Delta-Abgleich nur bei angemeldetem Nutzer. Vor dem Lauf wird `lastForegroundAttemptAt` persistiert; der Lauf ist zulässig, wenn kein Zeitstempel existiert oder seit dem letzten Versuch mindestens 15 Minuten vergangen sind. Das gilt nach App-Neustart unverändert. Fehlgeschlagene Versuche zählen. Mutationstrigger sowie Aktivierungs- und manuelle Voll-Exporte werden nicht gedrosselt und ändern diesen Zeitstempel nicht. Außerhalb aktiver App-Nutzung gibt es keinen Dienst oder Timer.
- Reconciliation-Aufrufe je Datentyp werden serialisiert oder zusammengeführt, damit ältere Läufe kein neueres Wasserzeichen überschreiben.

### Status- und Fehlerdarstellung

- `HealthConnectScreen` und `SyncStatusSheet` verwenden je Datentyp ausschließlich die vier Werte aus `getSyncStatus()`: `enabled` (aktiviert/deaktiviert), `permissionRevoked` (entzogen/nicht als entzogen markiert), `lastSuccessfulSyncAt` (Zeit des letzten vollständig erfolgreichen Abgleichs, andernfalls „Noch kein erfolgreicher Abgleich“) und `pendingDeleteCount` (Anzahl ausstehender Löschungen). `permissionRevoked: false` darf nicht als aktuell erteilte Berechtigung bezeichnet werden.
- Es gibt keinen aggregierten Laufzeitstatus und keinen Status des letzten fehlgeschlagenen Versuchs. Die UI leitet beides weder aus `lastForegroundAttemptAt`, `syncLogger`, Wasserzeichen noch aus ausstehenden IDs ab. Eine Anzeige für laufende oder fehlgeschlagene manuelle Aktionen darf ausschließlich an diese konkrete Nutzeraktion gebunden bleiben und wird nicht als Status für Vordergrund- oder Mutationstrigger dargestellt.
- Queue-Begriffe, per-ID Queue-Fehler und Fehler-Stacks entfallen aus der Statusoberfläche. Erfolgszeit stammt aus dem Wasserzeichen; allgemeine Fehlerstatus werden nicht persistiert oder neu eingeführt.
- Es werden keine neuen Gewichts-Eintragsbadges ergänzt; Nutrition-Einträge erhalten ebenfalls keine Statusbadges. Die UI verwendet vorhandene Tokens und Icons, deutsche Texte und keine Emojis.
- `syncLogger` bleibt als lokales Diagnoseprotokoll bestehen. Keine Gewichts-/Mahlzeitenwerte, Meal-Namen, Nutzdaten, Tokens oder vollständigen Provider-Payloads; nur notwendige Ereignisart, Datentyp, Zeit und stabile technische Fehlerklasse. Fehler-Stacks erscheinen nicht als Nutzerstatus.

## 11. Backend Work Package

Parent goal: rückwärtskompatible Änderungszeitpunkte und sichere, nutzerbezogene Deltadaten für Gewicht und Ernährung bereitstellen. Die Teilaufgaben laufen nacheinander.

### B1 — Persistenzzeitpunkte und Repository-Deltas

Agent: Backend

**Status:** Implementierung laut Backend-Handoff vom 2026-10-22 übergeben. Unit-/Full-Tests sowie Type-/Build-Checks wurden als bestanden gemeldet; Cosmos-Contract-Tests sind mangels Docker-/Podman-Laufzeit **UNVERIFIED**.

**Goal:** Optionale Änderungszeitpunkte und repositoryseitige Delta-Abfragen in den bestehenden Partitionen implementieren; keine Migration und keine neue Ressource.

**Required Knowledge Base:** `docs/kb/tech/02-backend.md`, `docs/kb/tech/04-shared-library.md`, `docs/kb/tech/08-testing.md`, `docs/kb/domain/02-diary.md`, `docs/kb/domain/05-weight-tracking.md`.

**Required Repository Context:** `shared/types/weights.ts`, `shared/types/diary.ts`, `backend/src/lib/repositories/weightsRepository.ts`, `backend/src/lib/repositories/cosmosWeightsRepository.ts`, `backend/src/lib/repositories/diaryRepository.ts`, `backend/src/lib/repositories/cosmosDiaryRepository.ts`, `backend/src/lib/repositories/cosmosWeightsRepository.contract.test.ts`, `backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts`.

**Required Skills:** `cosmos-data-model-and-migration`, `privacy-impact-review`.

**Relevant Acceptance Criteria:** AC-4, AC-7, AC-8, AC-12.

**Dependencies:** None.

**Expected Handoff:** Shared optional field definitions; repository interfaces/implementations; list of every Meal write path that stamps `updatedAt`; partition-scoped delta methods; Unit-/Full-Test- und Type-/Build-Ergebnisse laut Handoff bestanden; Cosmos-Contract-Tests **UNVERIFIED** mangels Docker-/Podman-Laufzeit; Class-0-Kompatibilitätsnachweis.

**Persistence Impact:** Class 0 — optionale additive `updatedAt`-Felder auf bestehenden Weight- und Meal-Dokumenten. Kein Backfill, keine Änderung von `CONTAINER_DEFS`, Bicep, Partition-Key oder Container. Dokumente ohne `updatedAt` bleiben lesbar; alte Gewichte gehen in den bestehenden Voll-Export ein. Delta-Queries umfassen nur Einträge mit Änderungszeit nach dem Checkpoint. Dev und Alpha lesen während des Rollouts alte und neue Dokumente.

### B2 — Authentifizierte Delta-API

Agent: Backend

**Status:** Implementierung und Handoff am 2026-10-23 als abgeschlossen gemeldet. Handler-/API-Vertragstests sowie Backend-, Shared-, Type- und Build-Checks wurden als bestanden gemeldet; B1- und B2-Cosmos-Contract-Tests bleiben mangels Emulator **UNVERIFIED**.

**Goal:** Die nachfolgend vollständig spezifizierten, geschützten Delta-Endpunkte implementieren. Dieser B2-Vertrag ist verbindlich; es gibt keine API-Entscheidung durch den Backend-Agenten.

**Required Knowledge Base:** `docs/kb/tech/02-backend.md`, `docs/kb/tech/05-authentication.md`, `docs/kb/tech/08-testing.md`, `docs/kb/tech/09-api-reference.md`.

**Required Repository Context:** `backend/src/functions/weights.ts`, `backend/src/functions/diary.ts`, `backend/src/functions/weights.test.ts`, `backend/src/functions/diary.test.ts`, `backend/src/index.ts`, `backend/src/lib/http.ts`, `backend/src/lib/repositories/weightsRepository.ts`, `backend/src/lib/repositories/cosmosWeightsRepository.ts`, `backend/src/lib/repositories/diaryRepository.ts`, `backend/src/lib/repositories/cosmosDiaryRepository.ts`, `shared/types/weights.ts`, `shared/types/diary.ts`.

**Required Skills:** `privacy-impact-review`, `cosmos-data-model-and-migration`.

**B1 handoff (completed 2026-10-22; binding input for B2):** B1 added optional `WeightEntry.updatedAt?: string` and `Meal.updatedAt?: string`, set timestamps on weight create/update and all Meal write paths (Create, Item-Add/Update/Delete, Bulk-Delete/Move/Copy, and `updateMacrosBySourceId`), and added partition-scoped `WeightsRepository.listUpdatedSince(userId, since)` and `DiaryRepository.listMealsUpdatedSince(userId, since)`. The methods use `updatedAt ?? createdAt` for legacy documents and return current documents sorted ascending by effective timestamp and then `id`; Meal results exclude `DayMeta` and `HintState`. Unit/full tests and type/build checks were reported passed. Cosmos contract tests remain **UNVERIFIED** because Docker/Podman was unavailable. No migration or infrastructure change was made. B2 consumes these existing fields and repository methods; it does not reimplement B1.

#### Binding B2 API Contract

These routes, query rules, response shapes, and compatibility requirements are the complete B2 contract. Implement them without referring to another plan section or making additional API decisions.

**Shared authentication, query validation, time window, and errors**

- Register both delta endpoints as `GET` Azure Functions routes with `authLevel: 'anonymous'`; each handler must call `requireUser(request)`. The sole user and Cosmos partition key is `userId` from the validated JWT `sub`. Every repository call is scoped to exactly that value. No query parameter, body field, or cursor may select a user. Requests have no body. Every paginated request authenticates independently; a cursor is not an authorization credential.
- `since` is required and must be a valid UTC instant in exactly canonical `Date.toISOString()` form `YYYY-MM-DDTHH:mm:ss.sssZ`. Reject missing values, invalid dates, noncanonical forms, offsets, local/device times, and values later than the request's `checkpointAt`. The time window is inclusive at both ends: `since <= (updatedAt ?? createdAt) <= checkpointAt`.
- Only the query parameters listed for each route below are allowed. Reject unknown or repeated parameters. Missing/invalid `since`, `since > checkpointAt`, unknown/repeated parameters, and invalid `limit` values return `400 { "error": "invalid_delta_query" }`. An invalid, foreign-user, or request-mismatched cursor returns `400 { "error": "invalid_delta_cursor" }`. Missing/invalid authentication returns the normal `401` from `requireUser()`/`withHandler`; unexpected failures return `500 { "error": "Internal server error" }`.
- The server captures `checkpointAt` exactly once for each weight request and exactly once when the first meal page opens a run, as a UTC `Date.toISOString()` value. It must not recalculate that checkpoint on meal continuation pages. Rows timestamped after the checkpoint are excluded from this run and can be returned by a later run using the unchanged lower watermark.
- Results are current stored documents, not an event history or prior versions. Sort ascending by `(updatedAt ?? createdAt, id)`; distinct IDs with equal effective timestamps must all be retained and ordered by ascending `id` (do not deduplicate by timestamp). Meal continuation is strictly after the last tuple, so pages in one run do not overlap. There is no cross-run deduplication state; because the lower bound is inclusive, an exact-boundary row may appear again in a later run and the consumer handles it idempotently using stable Health Connect IDs.
- `checkpointAt` is a fixed upper time boundary only; it is not a database snapshot and makes no transactional snapshot guarantee across HTTP requests. A row changed during pagination to a timestamp later than the fixed checkpoint is not returned as an old version; it is found in a later run from the unchanged watermark. The API creates no snapshots, tombstones, deletion history, durable cursor state, or server-side/device-specific sync or transfer state.

**`GET /api/weights/changes`**

- Allowed query parameters: required `since` only. This endpoint is not paginated; `limit` and `cursor` are not supported.
- Return `200` JSON with the exact shape `{ "entries": WeightEntry[], "checkpointAt": "<UTC-ISO>" }`. `entries` contains the current documents in the inclusive time window, sorted by `(updatedAt ?? createdAt, id)` ascending. An empty result is `{ "entries": [], "checkpointAt": "<UTC-ISO>" }`.
- Preserve the existing full-list route unchanged: `GET /api/weights` remains the full, non-paginated export and returns `{ "entries": WeightEntry[] }`, with no `checkpointAt` added. It continues to include legacy Weight documents without `updatedAt`.

**`GET /api/diary/changes/meals`**

- Allowed query parameters: required `since`; optional `limit`; optional `cursor`. Omitted `limit` defaults to `50`; a supplied `limit` must be one integer from `1` through `100`, inclusive. Do not use the legacy full-export route's permissive limit parsing for this delta endpoint.
- Return `200` JSON with the exact shape `{ "meals": Meal[], "checkpointAt": "<UTC-ISO>", "cursor"?: "<opaque>" }`. Results are sorted by `(updatedAt ?? createdAt, id)` ascending and contain at most `limit` current Meal documents. Include `cursor` only when more rows remain; omit it on the final page. An empty first page returns `{ "meals": [], "checkpointAt": "<UTC-ISO>" }` with no cursor. Never return `DayMeta` or `HintState` documents.
- A first request without `cursor` opens a run and fixes `checkpointAt`. Each continuation repeats the identical `since`; the opaque server-issued cursor binds the validated JWT `sub`, `since`, effective `limit`, fixed `checkpointAt`, and position strictly after the last `(updatedAt ?? createdAt, id)` tuple. Reject a cursor reused with another user, `since`, or effective `limit`. Continuation preserves the original checkpoint and ordering. The cursor may carry continuation data, but B2 must not persist server-side cursor or transfer state.
- Preserve the existing full-export route unchanged: `GET /api/diary/meals?limit=<n>&cursor=<opaque>` remains paginated and returns `{ "meals": Meal[], "cursor"?: "<opaque>" }`; it does not return `checkpointAt`. Keep its existing route, auth, query parsing, pagination, and response behavior unchanged: omitted/invalid/nonpositive `limit` defaults to `50`, positive values are capped at `100`, and `cursor` is the existing continuation token.

**Relevant Acceptance Criteria (verbatim story wording; B2 responsibility follows each):**

- **AC-4:** „Das Wasserzeichen rückt nur nach vollständigem Erfolg vor.“ B2 provides the same server checkpoint on every meal page; Mobile advances its watermark only after the complete run succeeds.
- **AC-6:** „Meldet sich ein anderer Nutzer an, oder fehlt die gespeicherte Nutzer-ID, werden keine Daten gesendet, der lokale Stand wird verworfen und die Synchronisation ist deaktiviert, bis der Nutzer sie erneut aktiviert.“ B2 binds every request and repository query exclusively to the current JWT `sub`; local identity binding remains F1.
- **AC-7:** „Löschungen werden anhand einer reinen ID-Liste bis zum Erfolg wiederholt; die Liste enthält keine Gesundheitswerte.“ B2 creates no tombstones or server-side deletion lists; ID storage and retries remain Mobile responsibility.
- **AC-8:** „Das Gewicht besitzt `updatedAt`, Mahlzeiten und Gewicht bieten eine Delta-Abfrage. Bestandsdaten ohne `updatedAt` bleiben lesbar und werden beim Voll-Export berücksichtigt.“ B2 implements the two delta routes above and preserves both full-export route contracts above.
- **AC-9:** „Aktivierung, manueller Voll-Export und Re-Export nach Neuinstallation bleiben idempotent und funktionsgleich zu HC-2/HC-3.“ B2 preserves the existing full-export routes and does not add delta behavior to them.
- **AC-12:** „Fachlogik, Berechtigungsprüfung, Nutzerbindung, Delta-Abfrage und ID-Löschliste sind durch Unit-Tests abgedeckt.“ B2 covers handler/query/checkpoint/cursor/response and JWT-partition tests; Mobile permission checks, local identity binding, and ID-list retries remain F1/Q2.

**Dependencies:** B1 is completed as stated in the binding handoff above. B2 uses the existing partition-scoped delta methods. The B1 Cosmos contract tests remain **UNVERIFIED** until run against the local emulator and must not be reported as passed.

**Expected Handoff:** Erfüllt laut Handoff vom 2026-10-23: registrierte Handler und Routen entsprechen diesem API-Vertrag; Handler-/API-Tests decken Query-Validierung, beide Delta-Response-Shapes, leere Ergebnisse, inklusive Zeitgrenzen, festen Checkpoint über Meal-Seiten, Sortierung gleicher Zeitstempel ohne Deduplizierung, Cursor-Fortsetzung ohne Seitenüberlappung, ungültige/fremde oder abweichend wiederverwendete Cursor, 401 und JWT-`sub`-Partitionsisolation ab. Beide bestehenden Voll-Export-Verträge wurden als unverändert bestätigt. Backend-/Shared-Tests und Type-/Build-Checks wurden als bestanden gemeldet. B1- und B2-Cosmos-Contract-Tests bleiben separat **UNVERIFIED**.

## 12. Frontend Work Package

Parent goal: den lokalen Snapshot-Retry durch nutzergebundenen Serverabgleich ersetzen und Health-Connect-UI aktualisieren. Die von PO-1 bestätigte lokale Allowlist und Drosselungssemantik gelten für alle Mobile-Teilaufgaben.

### F1 — Sync-Engine, Migration und Mutationstrigger

Agent: Frontend  

**Goal:** Alte Snapshot-Queues ohne Versand entfernen und den neuen serverbasierten Delta-/ID-Retry in Mobile einführen.

**Status:** Laut Handoff vom 2026-10-23 abgeschlossen. Full Mobile-Tests: 100 Dateien/936 Tests bestanden; fokussierte Tests: 13 Dateien/136 Tests bestanden; `npx tsc --noEmit` bestanden. Android-Geräteprüfungen bleiben **UNVERIFIED**. Account-Deletion-Verhalten wurde nicht geändert.

**Completed Handoff Facts:** Beide Sync-Services speichern per-Datentyp-State mit kanonischen UTC-ISO-Zeitstempeln. `nutritionDiaryService` ist die Mutation-Fassade für die vorgesehenen Diary-Mutationen. Die Services stellen für F2 ausschließlich `enabled`, `permissionRevoked`, `pendingDeleteCount` und optional `lastSuccessfulSyncAt` über `getSyncStatus()` bereit. Es gibt kein `syncInProgress` und kein `lastAttemptFailed`; diese Felder sind kein F1-Umfang.

**Resolved F1 Contract:** `lastForegroundAttemptAt` wird ausschließlich als kanonischer UTC-ISO-String persistiert, passend zum aktuellen Typ, Validator und Testassertion in beiden Services. Epoch-Millisekunden werden nicht als gleichwertig interpretiert oder still konvertiert; ein numerischer Wert ist ungültig und muss den festgelegten invalid-state reset/Purge-Pfad nehmen. Das ist eine technische Vertragskorrektur anhand des aktuellen Implementierungsstands, keine neue Product-Owner-Frage.

**Mutation boundary and covered entry points:** Alle produktiven Diary-/Meal-/Item-Mutationen über `diaryApi` müssen `nutritionDiaryService` verwenden. Zu migrieren und durch passende Flow-Tests abzudecken sind `mobile/src/modules/nutrition/AddItemModal.tsx`, `DiaryScreen.tsx`, `EditItemSheet.tsx`, `FoodEstimateReviewScreen.tsx`, `LabelScanReviewScreen.tsx`, `MealEstimateReviewScreen.tsx`, `MealParserReviewScreen.tsx`, `hub/AISubFlow.tsx`, `hub/FoodEntryHub.tsx`, `hub/LabelSubFlow.tsx`, `hub/ManuellerSubFlow.tsx`, `hub/QuantityView.tsx` sowie `mobile/src/modules/recipes/LogRecipeModal.tsx`. Für Rezept-Logging bleibt der Sync nach erfolgreichem `recipeApi.log` explizit; seine Diary-Mutationsaufrufe verwenden trotzdem die Fassade. Bestehende `diaryApi`-Transporttests dürfen direkte API-Aufrufe behalten. Handoff enthält eine Produktionssuche, die bestätigt: keine direkten mutierenden `diaryApi`-Aufrufe außerhalb der Fassade bzw. des vorgesehenen API-Tests.

**Required Knowledge Base:** `docs/kb/tech/03-mobile.md`, `docs/kb/tech/05-authentication.md`, `docs/kb/tech/09-api-reference.md`.

**Required Repository Context:** `mobile/src/services/health/healthSyncService.ts`, `mobile/src/services/health/nutritionSyncService.ts`, `mobile/src/services/health/IHealthPlatformService.ts`, `mobile/src/services/health/HealthConnectService.ts`, `mobile/src/services/health/healthPlatformService.ts`, `mobile/src/services/authService.ts`, `mobile/src/shared/api/diaryApi.ts`, `mobile/src/services/nutritionDiaryService.ts`, `mobile/src/services/nutritionDiaryService.test.ts`, `mobile/src/services/weightsService.ts`, `mobile/src/modules/progress/ProgressScreen.tsx`, `mobile/src/modules/progress/ProgressScreen.test.tsx`, alle oben unter **Mutation boundary and covered entry points** aufgeführten Produktionsdateien, `mobile/src/shared/viewModels/recipeLoggingViewModel.ts`, `mobile/src/app/App.tsx`, `mobile/src/services/health/healthSyncService.test.ts`, `mobile/src/services/health/nutritionSyncService.test.ts`, `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx`, `mobile/src/modules/nutrition/EditItemSheet.test.tsx`, `mobile/src/modules/nutrition/LabelScanReviewScreen.test.tsx`, `mobile/src/modules/nutrition/hub/FoodEntryHub.test.ts`, `mobile/src/modules/nutrition/hub/QuantityView.imageUrl.test.tsx`.

**Required Skills:** `privacy-impact-review`.

**Relevant Acceptance Criteria:** AC-1, AC-2, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-12, AC-13.

**Dependencies:** B2.

**Required Test Gates:**

- `healthSyncService.test.ts` und `nutritionSyncService.test.ts` belegen für beide Datentypen die exakte State-Allowlist und den ISO-Vertrag: Vordergrundversuch wird vor dem Delta-Request als `Date.toISOString()` gespeichert; numerische Epoch-Millisekunden werden nicht konvertiert und als ungültiger Zustand zurückgesetzt.
- Beide Sync-Service-Suites enthalten einen expliziten Permission-denied-Delete-Test: `hasPermissions()` verweigert vor dem Delete, `deleteRecord` wird nicht aufgerufen, die ID bleibt gespeichert und Sync wird gemäß Abschnitt 10 deaktiviert. Ein Upsert-Permission-Test allein genügt nicht.
- Beide Sync-Service-Suites rufen den manuellen `runFullExport()` direkt auf und belegen Full-Export-Datenquelle und -Ergebnis getrennt vom Aktivierungs-Export. Für Weight werden die vollständigen übergebenen Entries exportiert; Nutrition paginiert `listAllMeals` bis zum Ende. Diese Tests dürfen nicht lediglich `enableSync()` ausführen.
- `nutritionDiaryService.test.ts` belegt Trigger erst nach erfolgreicher Mutation für Create/Add/Update/Delete, Meal-Delete und Bulk Delete/Move/Copy; API-Fehler starten keinen Trigger. Die Aufrufer-Tests der gelisteten Flows sichern die Migration auf die Fassade sowie die unveränderte Nutzeraktion. Jeder Trigger bleibt fire-and-forget: der FitTrack-Mutationsabschluss wartet nicht auf Health Connect. Recipe logging synchronisiert erst nach erfolgreichem `recipeApi.log`.
- `ProgressScreen.test.tsx` belegt Weight-Sync nach erfolgreichem Create/Update/Delete und keinen Trigger nach fehlgeschlagener FitTrack-Mutation. Der F1-Handoff meldet den vollständigen Mobile-Testlauf sowie den fokussierten Testlauf als bestanden.
- Vollständige Mobile-Gates müssen mit Ergebnissen übergeben werden: `cd mobile && npx vitest run` und `cd mobile && npx tsc --noEmit`. Ein nicht gelaufener oder nicht verfügbarer Typecheck ist **UNVERIFIED**, kein Pass.
- F1-Handoff enthält außerdem die Produktionssuche aus **Mutation boundary and covered entry points**, State-Allowlist-/Legacy-Purge-Evidence, User-Binding und Permission-Gates vor jedem Write, Checkpoint-/ID-Retry-Verhalten sowie den unveränderten Account-Deletion-Reset-Vertrag.

**Expected Handoff:** Die oben genannten Test-Gates und Suchnachweise sind bestanden und mit konkreten Ergebnissen belegt. Der Handoff trennt automatisierte Tests von etwaigen noch ausstehenden Android-Geräteprüfungen; nicht ausgeführte Checks werden explizit **UNVERIFIED** ausgewiesen.

### F2 — Health-Connect-Statusoberfläche

Agent: Frontend  

**Goal:** Queue-basierte Fehlerlisten durch eine aggregierte Anzeige der bereits von F1 bereitgestellten Statusfelder ersetzen. F2 verändert den F1-Servicevertrag nicht.

**Required Knowledge Base:** `docs/kb/tech/03-mobile.md`, `docs/kb/product/03-design-system.md`, `docs/kb/product/05-ux-patterns.md`.

**Required Repository Context:** `mobile/src/modules/healthConnect/HealthConnectScreen.tsx`, `mobile/src/modules/healthConnect/SyncStatusSheet.tsx`, `mobile/src/modules/healthConnect/healthConnectCopy.ts`, `mobile/src/modules/healthConnect/healthConnectCopy.test.ts`, `mobile/src/modules/progress/ProgressScreen.tsx`, `mobile/src/shared/components/Icon.tsx`, `mobile/src/app/theme/`, `mobile/src/services/health/healthSyncService.ts`, `mobile/src/services/health/nutritionSyncService.ts`.

**Required Skills:** None. F2 presents existing service state only and adds no data collection, storage, logging, or transmission; the HC-4 privacy impact remains covered by F1, D3, and Q2/Q4.

**Relevant Acceptance Criteria:** AC-5, AC-6, AC-10, AC-12.

**Dependencies:** F1 (laut Handoff abgeschlossen). F2 verwendet den vorhandenen `getSyncStatus()`-Vertrag und fügt weder `syncInProgress` noch `lastAttemptFailed` oder persistenten Versuchsergebnis-State hinzu.

**Required Test Gates:**

- UI-Tests decken beide Datentypen unabhängig ab und prüfen `enabled`, `permissionRevoked`, `pendingDeleteCount` sowie `lastSuccessfulSyncAt`, einschließlich Count null und fehlendem Erfolgstimestamp. `permissionRevoked: false` darf nicht als bestätigte Berechtigung erscheinen.
- UI-Tests bestätigen, dass kein aggregierter Status für laufende oder fehlgeschlagene Vordergrund-/Mutationstrigger angezeigt wird. Feedback oder Ladeanzeige für eine manuelle Aktion bleibt auf genau diese Aktion beschränkt und wird nicht als globaler Datentypstatus dargestellt.
- UI-Tests bestätigen, dass Queue-basierte Eintragsfehler, rohe Fehlerdetails, Stacks und Statusbadges in Progress- oder Ernährungseinträgen fehlen.

**Expected Handoff:** Deutsche Labels für die vier bestehenden Felder, aggregierte Anzeige je Datentyp und UI-Test-Evidence zu allen Gates. Keine Queue-/Eintragsfehlertexte, erfundenen Laufzeit-/Fehlversuchsstatus, Stacks oder Emojis. Der F1-Servicevertrag bleibt unverändert.

### F3 — Vordergrundintervall

Agent: Frontend  

**Goal:** Je aktiviertem Datentyp `lastForegroundAttemptAt` vor dem Vordergrund-Delta-Lauf persistieren und einen Lauf erst ohne Zeitstempel oder ab mindestens 15 Minuten seit dem letzten Versuch starten. Das gilt nach App-Neustart; ein fehlgeschlagener Lauf zählt. Aktivierungs-/manuelle Voll-Exporte und Mutationstrigger bleiben ungedrosselt und ändern den Zeitstempel nicht.

**Required Knowledge Base:** `docs/kb/tech/03-mobile.md`, `docs/kb/tech/08-testing.md`.

**Required Repository Context:** `mobile/src/app/App.tsx`, `mobile/src/services/health/healthSyncService.ts`, `mobile/src/services/health/nutritionSyncService.ts`, die betroffenen Health-Service-Tests.

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-3, AC-12.

**Dependencies:** F1.

**Expected Handoff:** Dokumentierte per-datatype Cold-Start-Semantik, persistierter Zeitstempel vor dem Lauf, keine Hintergrundausführung sowie Regressionstests unterhalb, genau an und oberhalb der 15-Minuten-Grenze.

## 13. Shared Package Changes

`shared/types/weights.ts`: `WeightEntry.updatedAt?: string`. `shared/types/diary.ts`: `Meal.updatedAt?: string`. Backend verantwortet die Änderung und Kompatibilität. Keine Berechnungslogik und keine neuen Shared-Utilities.

## 14. Infrastructure and Configuration

- Bestehende `weights`- und `nutritionDiaryMeals`-Container werden verwendet; Cosmos-Standardindizes decken Partition-Key- und `updatedAt`-Filter ab. Keine Cosmos-/Bicep-Änderung und kein Migrationstask.
- `Infrastructure Impact: Alpha` kennzeichnet, dass Backend-Endpunkte nach genehmigter Implementierung für Alpha-Nutzung mit dem Backend ausgeliefert werden müssen. Es wird hier kein Deploy ausgeführt oder als Feature-Subtask geplant.
- `Mobile Build Impact: None`: keine nativen Abhängigkeiten, Permissions, Plugins oder Expo-Konfiguration ändern sich. Ein neuer Dev-/Alpha-Build wird nicht als Feature-Arbeit geplant.
- Kein Infrastructure-&-Release-Work-Package: keine architektonische Ressourcenentscheidung. Ein späterer Routine-Release bleibt außerhalb dieses Planner-Auftrags.

## 15. Documentation Updates

### D1 — Backend-, API- und Domain-Knowledge-Base

Agent: Backend

**Goal:** Nach Implementierung `tech/02-backend.md`, `tech/09-api-reference.md`, `domain/02-diary.md` und `domain/05-weight-tracking.md` auf die Delta-Endpunkte, UTC-Checkpoints, `updatedAt`-Kompatibilität, lokale ID-Löschliste und fehlende Server-Tombstones aktualisieren.

**Status:** Aktualisierung der vier Zielseiten wurde am 2026-10-23 als abgeschlossen gemeldet; lokale ID-only-Löschlisten sind darin als Mobile-seitig geplant, nicht als implementiert, markiert.

**Required Knowledge Base:** `docs/kb/README.md`, `docs/kb/tech/02-backend.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/domain/02-diary.md`, `docs/kb/domain/05-weight-tracking.md`.

**Required Repository Context:** dieselben vier Zielseiten sowie B1/B2-geänderte Repository- und Handlerpfade.

**Required Skills:** `cosmos-data-model-and-migration`, `privacy-impact-review`.

**Relevant Acceptance Criteria:** AC-7, AC-8, AC-11, AC-13.

**Dependencies:** B1, B2.

**Expected Handoff:** Aktualisierte KB ohne als implementiert dargestellte offene PO-Entscheidungen; genaue API- und Class-0-Aussagen.

### D2 — Mobile-Knowledge-Base

Agent: Frontend

**Goal:** `docs/kb/tech/03-mobile.md` nach Implementierung um lokale Speicherung, Legacy-Purge, User-Binding, Berechtigungsprüfung, Trigger, Wasserzeichen, Lösch-IDs und Statusdarstellung ergänzen.

**Required Knowledge Base:** `docs/kb/README.md`, `docs/kb/tech/03-mobile.md`.

**Required Repository Context:** `docs/kb/tech/03-mobile.md`, die geänderten Health-Service-, AppState- und HealthConnect-UI-Dateien.

**Required Skills:** `privacy-impact-review`.

**Relevant Acceptance Criteria:** AC-1, AC-5, AC-6, AC-9, AC-10, AC-11, AC-13.

**Dependencies:** F1 (completed), F2, F3.

**Expected Handoff:** Mobile-KB beschreibt nur verifiziert implementiertes Verhalten und die in Abschnitt 10 festgelegte Allowlist, Aktivierungs- und Persistenzsemantik.

### D3 — Privacy-Policy-Ergänzung

Agent: Frontend  

**Goal:** Nach F1 die Health-Connect-Policy um die minimal gespeicherten lokalen Metadaten und exakt den in Abschnitt 17 freigegebenen deutschen Wortlaut zur Android-Löschung und Backup-Wiederherstellung ergänzen. Die Kontolösch-Aussage und das bestehende Best-Effort-Verhalten werden nicht geändert.

**Required Knowledge Base:** `docs/kb/README.md`, `docs/kb/tech/03-mobile.md`.

**Required Repository Context:** `docs/legal/datenschutzerklaerung-alpha.md`, die implementierte lokale Sync-State- und Logger-Verarbeitung.

**Required Skills:** `privacy-impact-review`.

**Relevant Acceptance Criteria:** AC-11, AC-13.

**Dependencies:** F1.

**Expected Handoff:** Aktualisierte Policy mit exakt freigegebenem deutschem Wortlaut, aktualisiertem `Stand:`-Datum und Bericht, dass keine Rechtsgrundlage oder feste Aufbewahrungsfrist ergänzt wurde.

## 16. QA Work Package

Parent goal: alle ACs gegen freigegebene HC-4-Anforderungen und die bestehenden Codepfade prüfen. QA beginnt nach Backend-/Mobile-Arbeit und den zugehörigen Dokumentationsaufgaben; nicht verfügbare externe Prüfungen werden ausdrücklich als unverified ausgewiesen.

### Q1 — Backend, Persistenz und API

Agent: QA

**Goal:** Gewichts-/Meal-Zeitpunkte, Delta-API, Pagination/Checkpoint, Auth-Partitionierung und Rückwärtskompatibilität verifizieren.

**Required Knowledge Base:** `docs/kb/tech/08-testing.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/domain/02-diary.md`, `docs/kb/domain/05-weight-tracking.md`.

**Required Repository Context:** `backend/src/functions/weights.test.ts`, `backend/src/functions/diary.test.ts`, `backend/src/lib/repositories/cosmosWeightsRepository.test.ts`, `backend/src/lib/repositories/cosmosWeightsRepository.contract.test.ts`, `backend/src/lib/repositories/cosmosDiaryRepository.test.ts`, `backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts`, geänderte Implementierungen.

**Required Skills:** `cosmos-data-model-and-migration`, `privacy-impact-review`.

**Relevant Acceptance Criteria:** AC-4, AC-7, AC-8, AC-12.

**Dependencies:** B1, B2, D1.

**Expected Handoff:** Backend-Unit- und Contract-Test-Ergebnisse; alte Dokumente ohne `updatedAt`; Nutzerpartition-Isolation; Cursor-/Checkpoint-Fälle; Standardindex-/Emulatorstatus getrennt berichtet.

### Q2 — Mobile-Reconcile, UI und Privacy

Agent: QA  

**Goal:** Legacy-Purge, keine PII-/Health-Payloads im Retry-State, identity/permission guards, Mutationstrigger, Lösch-ID-Retry, Voll-Export und die auf den vier vorhandenen `getSyncStatus()`-Feldern beruhende UI prüfen. Keine zusätzlichen Laufzeit- oder Fehlversuchsstatus voraussetzen.

**Required Knowledge Base:** `docs/kb/tech/03-mobile.md`, `docs/kb/tech/05-authentication.md`, `docs/kb/tech/08-testing.md`, `docs/kb/product/03-design-system.md`, `docs/kb/product/05-ux-patterns.md`.

**Required Repository Context:** `mobile/src/services/health/healthSyncService.test.ts`, `mobile/src/services/health/nutritionSyncService.test.ts`, `mobile/src/modules/healthConnect/`, `mobile/src/modules/progress/ProgressScreen.test.tsx`, `mobile/src/app/App.tsx`, `mobile/src/services/health/syncLogger.ts`, `mobile/src/services/accountDeletionService.ts`.

**Required Skills:** `privacy-impact-review`.

**Relevant Acceptance Criteria:** AC-1, AC-2, AC-3, AC-5, AC-6, AC-9, AC-10, AC-12, AC-13.

**Dependencies:** F1, F2, F3, D2.

**Expected Handoff:** Mobile-Unit-/Typecheck-Ergebnisse; UI-Evidence, dass F2 ausschließlich `enabled`, `permissionRevoked`, `pendingDeleteCount` und `lastSuccessfulSyncAt` darstellt und keinen globalen Laufzeit-/Fehlversuchsstatus behauptet; echte Android-Health-Connect-Berechtigung und Vordergrundwechsel als separate manuelle Validierung; Privacy-Datenfluss- und Local-State-Allowlist-Abgleich; Bestätigung, dass die Account-Deletion-Cleanup-Aufrufe und deren Verhalten unverändert sind. Policy-Text-Assertions gehören ausschließlich zu Q4.

### Q3 — Persistiertes 15-Minuten-Fenster

Agent: QA  

**Goal:** Die pro Datentyp persistierte 15-Minuten-Semantik einschließlich App-Neustart anhand messbarer Grenztests prüfen.

**Required Knowledge Base:** `docs/kb/tech/08-testing.md`, `docs/kb/tech/03-mobile.md`.

**Required Repository Context:** `mobile/src/app/App.tsx`, neue Reconcile-Throttle-Implementierung und deren Tests.

**Required Skills:** None.

**Relevant Acceptance Criteria:** AC-3, AC-12.

**Dependencies:** F3.

**Expected Handoff:** Mit kontrollierter Uhr belegte Tests: erster Versuch ohne Zeitstempel; Cold Start unter 15 Minuten unterdrückt; bei genau 15 Minuten wieder zulässig; fehlgeschlagener Versuch zählt; jeder Datentyp wird unabhängig gedrosselt; Mutationstrigger sowie Aktivierungs-/manueller Voll-Export umgehen die Drosselung und ändern den Zeitstempel nicht; keine Hintergrundausführung.

### Q4 — Privacy-Policy-Freigabe

Agent: QA  

**Goal:** Ausschließlich die Policy-Aussagen zum genehmigten lokalen Sync-State und die Android-Lösch-/Backup-Aussage gegen die tatsächlich implementierte Allowlist, Konfiguration und Datenverarbeitung prüfen.

**Required Knowledge Base:** `docs/kb/tech/03-mobile.md`.

**Required Repository Context:** `docs/legal/datenschutzerklaerung-alpha.md`, D3-Ergebnis, implementierte Sync-State- und Logger-Verarbeitung.

**Required Skills:** `privacy-impact-review`.

**Relevant Acceptance Criteria:** AC-11.

**Dependencies:** F1, D3.

**Expected Handoff:** Policy-Wortlaut, Stand-Datum, tatsächliche lokale Daten und qualifizierte Backup-Aussage stimmen überein; keine unbelegte Rechtsgrundlage oder Aufbewahrungsfrist.

## 17. Privacy Impact

**Privacy Impact:** Policy update proposed  
**Data flow:** FitTrack-Gewichts- und Mahlzeitendaten aus der nutzergebundenen API → Mobile-App → Health Connect auf demselben Android-Gerät. AsyncStorage enthält keine Gesundheitswerte mehr, sondern ausschließlich die in Abschnitt 10 festgelegten Sync-Metadaten: Nutzerkennung, Aktivierungsstatus je Datentyp, erfolgreiche Checkpoints, letzter Vordergrundversuch je Datentyp und ausstehende Health-Connect-IDs. Das lokale `syncLogger`-Protokoll bleibt bestehen und darf nach Umsetzung keine Gewichts-/Mahlzeitenwerte oder vollständigen Datensätze enthalten. Keine Übertragung an neue Anbieter; keine Health-Connect-Löschung bei Kontolöschung oder Deaktivierung.  
**Policy sections affected:** `Health Connect (optional, nur Android)`; die Kontolösch-Aussage unter `Speicherdauer und Löschen` bleibt inhaltlich unverändert.  
**Approved text:** `Für den Abgleich speichert FitTrack auf deinem Gerät deine Nutzerkennung, je Datentyp den Aktivierungsstatus, den Zeitpunkt des letzten vollständig erfolgreichen Abgleichs und den Zeitpunkt des letzten Vordergrundversuchs sowie IDs noch ausstehender Löschungen. Gewichts- und Mahlzeitenwerte werden nicht in einer lokalen Wiederholungswarteschlange zwischengespeichert. Ein lokales technisches Diagnoseprotokoll bleibt bestehen. Diese Daten können jederzeit über Android-Mittel in der App-Speicherverwaltung gelöscht werden. Bei einer Deinstallation werden lokale App-Daten üblicherweise entfernt. Da Android-Backups für die App nicht ausgeschlossen sind, können gesicherte Daten abhängig von Android-Version, Geräteeinstellungen und Backup-Anbieter bei einer späteren Wiederherstellung erneut auf das Gerät gelangen.`
**Open questions:** Keine Product-Owner-Entscheidung offen. Eine feste Aufbewahrungsfrist oder Rechtsgrundlage ist durch Story/Repository nicht belegt und wird nicht ergänzt.

Die F2-Statusoberfläche ist eine reine Darstellung der bereits vorhandenen Statuswerte; sie ergänzt keine Erhebung, Speicherung, Protokollierung oder Übertragung von Daten. Die Privacy-Auswirkung und Policy-Aktualisierung dieses Plans ergeben sich aus dem HC-4-Sync-Verhalten, nicht aus zusätzlichem F2-Datenfluss.

`privacy-impact-review` ist für Backend, Frontend und QA verpflichtend. Die lokale Allowlist ist durch PO-1 freigegeben; der qualifizierte deutsche Policy-Wortlaut ist durch PO-2 freigegeben und wird in D3 umgesetzt sowie in Q4 geprüft. Die Nutzerabsicht, Löschen über Android-Mittel zu nennen, bleibt erhalten; die unbedingte Deinstallationszusage wird wegen der Backup-Konfiguration nicht übernommen.

## 18. Test Strategy

- Backend unit tests: Gewicht-create/update-`updatedAt`, Meal-Änderung auf allen Repo-Pfaden, Delta-Filter, feste obere Checkpoint-Grenze, leeres Delta, Pagination und keine DayMeta/HintState-Datensätze.
- Backend handler/API tests: 401 ohne gültigen Nutzer; ausschließlich JWT-`sub`-Partition; fehlendes, ungültiges oder zukünftiges `since`; unbekannte/mehrfach angegebene Query-Parameter; ungültige `limit`-/Cursor-Kombinationen; beide festgelegten Response-Shapes; leeres Delta; feste Checkpoint-Obergrenze und identischer Checkpoint über alle Meal-Seiten; stabile Sortierung ohne Duplikate; fremde Cursor; alte Weight-/Meal-Dokumente; keine Tombstones; unveränderte Voll-Export-Verträge.
- Cosmos Contract Tests ausschließlich gegen den lokalen Cosmos-Emulator: optionales Feld in alten und neuen Weight-/Meal-Dokumenten, `updatedAt`-Queries und Partition-Isolation. Niemals gegen Dev-/Alpha-Cosmos.
- Mobile unit tests: alte Queue wird ohne Health-Connect-Aufruf entfernt; serialisierter Zustand enthält ausschließlich `enabled`, `pendingDeleteIds` und optionale `userId`, `watermark`, `lastForegroundAttemptAt`; Zeitstempel sind kanonische UTC-ISO-Strings und numerische Epoch-Werte werden nicht konvertiert. Keine `WeightEntry`-/`MealItem`-Werte, Fehlerdetails, Berechtigungs-Caches oder Export-Cursor werden persistiert. Deaktivierung erhält Wasserzeichen, Lösch-IDs und Versuchstimestamp, blockiert Writes und erneute Aktivierung verlangt aktuelle Berechtigung. User-ID-Mismatch/fehlende ID verhindert Schreiben und verwirft Zustand; `hasPermissions` wird unmittelbar vor jeder Upsert-/Delete-Operation geprüft. Ein explizit verweigerter Delete erzeugt keinen Health-Connect-Delete und behält die ID; fehlgeschlagene Upserts lassen Checkpoint unverändert; ID-Delete bleibt bei Fehler erhalten und wird nach Erfolg entfernt.
- Mobile event tests für Weight add/update/delete sowie Meal add/update/delete, Meal delete, Bulk Delete/Move/Copy und Food-Library-bedingte Meal-Änderung. Speicheraktion muss nicht auf Health Connect warten.
- Voll-Export-Tests für Erstaktivierung und Neuinstallation sowie direkte Tests des manuellen `runFullExport()` für Weight und Nutrition; die manuellen Tests belegen den vollständigen Datenpfad separat vom Aktivierungs-Export. Ein Delta ohne Änderungen erzeugt null Health-Connect-Schreibzugriffe.
- F2-UI-Tests belegen für beide Datentypen die Darstellung der vier bestehenden `getSyncStatus()`-Felder, einschließlich fehlendem Erfolgstimestamp, `permissionRevoked: false` ohne Behauptung einer erteilten Berechtigung und ausstehender Löschanzahl. Sie belegen außerdem, dass Vordergrund-/Mutationstrigger keinen erfundenen aggregierten Laufzeit- oder Fehlversuchsstatus anzeigen; manuelle Aktionsrückmeldung bleibt aktionsbezogen.
- AppState-Tests mit kontrollierter Uhr je Datentyp: erster Vordergrundversuch wird vor dem Lauf persistiert; wiederholter Vordergrundwechsel und Cold Start vor 15 Minuten werden unterdrückt; bei genau 15 Minuten wird ein neuer Versuch zugelassen; fehlgeschlagene Versuche zählen; deaktivierte Datentypen ändern den Timestamp nicht; Mutationstrigger sowie Aktivierungs-/manuelle Voll-Exporte umgehen die Drosselung und ändern den Timestamp nicht. Geräte-QA separat: Android Health Connect vorhanden, Berechtigung erteilt/entzogen, App im Vordergrund, reale Writes nur in freigegebener Preview-Testumgebung.
- Policy-Text wird in D3 ausschließlich mit dem in Abschnitt 17 freigegebenen Wortlaut aktualisiert; Q4 prüft die Policy-Änderung nach D3. D3/Q4 sind Bestandteil der Ausführung und kein offener PO-2-Gate.
- Pflichtchecks nach Umsetzung: `cd backend && npx vitest run`, `cd backend && npm run build:verify`, `cd backend && npx vitest run --config vitest.contract.config.mts` (Emulator erforderlich), `cd shared && npx vitest run`, `cd mobile && npx vitest run` und `cd mobile && npx tsc --noEmit`. Nur betroffene Suites sind für die jeweilige Übergabe auszuführen; Emulator-/Geräteprüfungen separat als `UNVERIFIED` oder manuell ausweisen.

## 19. Acceptance Criteria

1. Nach Upgrade enthalten `hc:weight:sync` und `hc:nutrition:sync` keine Gewichts-, Meal- oder Item-Werte. Bestehende Snapshot-Queues werden beim ersten Laden ohne Health-Connect-Aufruf gelöscht.
2. Erfolgreiche Gewicht-/Meal-Erstellung, Änderung und Löschung löst unmittelbar einen asynchronen Sync aus; die FitTrack-Mutation wartet nicht auf Health Connect. Alle Mutationstypen inklusive Move/Copy/Bulk sind erfasst.
3. Je aktiviertem Datentyp respektiert der Vordergrundabgleich die persistierte 15-Minuten-Semantik über App-Neustarts hinweg. `lastForegroundAttemptAt` wird als kanonischer UTC-ISO-String gemäß `Date.toISOString()` vor dem Lauf gespeichert; numerische Epoch-Millisekunden sind ungültig und werden nicht konvertiert. Fehlgeschlagene Versuche zählen; ein neuer Lauf ist ab genau 15 Minuten zulässig. Die Zeit ist fix und nicht konfigurierbar; Aktivierungs-/manuelle Voll-Exporte und Mutationstrigger werden nicht gedrosselt und ändern den Timestamp nicht. Kein Hintergrunddienst läuft.
4. Der Checkpoint wird erst nach vollständigem Delta-Lauf einschließlich aller Seiten und aller Health-Connect-Operationen übernommen. Ohne Delta erfolgen null Health-Connect-Schreibzugriffe. Nach einem Fehler bleibt der frühere Checkpoint bestehen.
5. Unmittelbar vor jedem Health-Connect-Upsert und -Delete werden Aktivierung, aktuelle Nutzerbindung und passende Schreibberechtigung verifiziert. Fehlende Berechtigung führt zu null Writes, Deaktivierung und einer deutschen Nutzerinformation.
6. Fehlende oder fremde lokale Nutzer-ID führt vor jedem Write zum Verwerfen des betreffenden lokalen Stands und deaktiviert Sync bis zur erneuten Aktivierung. Kein fremder Nutzer erhält Health-Connect-Daten aus einem alten Zustand.
7. Persistierte ausstehende Löschungen sind ausschließlich IDs. Erfolgreiche Deletes entfernen IDs, fehlgeschlagene Deletes behalten sie. Keine serverseitigen Lösch-Tombstones oder pro-Gerät-Syncstatus werden angelegt.
8. Gewichte und Meals unterstützen eine serverbasierte Delta-Abfrage. Neue/aktualisierte Datensätze erhalten UTC-`updatedAt`; Alt-Dokumente ohne Feld bleiben lesbar. Voll-Export berücksichtigt alte Gewichte. DayMeta/HintState werden nicht als Meals exportiert.
9. Aktivierung, Neuinstallation und manueller Voll-Export bleiben vollständige, idempotente Exporte mit stabilen `clientRecordId`s. Aktivierung und Drosselung bleiben je Datentyp lokal; Deaktivierung setzt `enabled=false`, behält Wasserzeichen, Lösch-IDs und Versuchstimestamp und verursacht keine Health-Connect-Aufrufe. Erneute Aktivierung erfordert aktuelle Berechtigungsabfrage und führt den Voll-Export aus. Es gibt keine account-weiten Profil-/API-Felder für diese Zustände.
10. Queue-basierte Item-Fehlerlisten und veraltete Queue-Begriffe werden aus HealthConnect/`SyncStatusSheet` entfernt. Pro Datentyp zeigt die UI ausschließlich `enabled`, `permissionRevoked`, `pendingDeleteCount` und `lastSuccessfulSyncAt` aus `getSyncStatus()`. Es gibt keinen globalen Status „Abgleich läuft“ oder „letzter Versuch fehlgeschlagen“; diese Werte werden weder in F1 ergänzt noch von F2 abgeleitet. `permissionRevoked: false` wird nicht als bestätigte Berechtigung dargestellt. Keine Ernährungs- oder Gewichts-Eintragsbadges, Emojis oder Fehler-Stacks.
11. Mobile-, Backend-, API- und Domain-KB beschreiben das implementierte Delta-Verfahren und die erlaubten lokalen Daten. D3 ergänzt die Datenschutzerklärung ausschließlich um den in Abschnitt 17 freigegebenen Wortlaut; Q4 bestätigt nach der Änderung die Übereinstimmung mit implementierter Datenverarbeitung und Android-Backup-Einschränkung.
12. Unit-Tests decken Fachlogik, Berechtigung einschließlich verweigertem Delete ohne Health-Connect-Aufruf, Nutzerbindung, Delta-Abfragen, Wasserzeichen und Lösch-ID-Liste ab. Direkte manuelle Voll-Exporte und alle Diary-Mutationseinstiege sind durch Tests belegt; Mobile-Tests und Typecheck sind als konkrete Ergebnisse zu übergeben. Contract-Tests validieren Cosmos-Kompatibilität gegen den Emulator; Geräteprüfungen werden separat ausgewiesen.
13. HC-4 ändert weder den Konto-Löschablauf noch dessen lokale Best-Effort-Cleanup-/Logout-Semantik, API, Retention oder Status. Der separate Konto-Löschplan bleibt unverändert und wird erst nach HC-4 gemäß dessen eigenem Freigabe- und QA-Status fortgesetzt.

## 20. Risks and Edge Cases

- Asynchroner App-Abbruch zwischen serverseitiger Löschung und lokaler Speicherung der zurückgegebenen ID kann ohne serverseitigen Tombstone nicht rekonstruiert werden. Der Plan erweitert den Server ausdrücklich nicht um eine solche Persistenz.
- Eine gescheiterte Upsert-Operation lässt den Checkpoint stehen; dadurch werden bereits erfolgreiche Writes des gleichen Fensters idempotent wiederholt. Tests müssen den Checkpoint als atomare Laufgrenze absichern.
- Ein Nutzerwechsel während eines paginierten oder mehrteiligen Laufs muss vor dem jeweils nächsten HC-Write erkannt werden; ein bereits gestarteter API-Aufruf bleibt serverseitig durch `requireUser()` partitioniert.
- Weight/Meal `updatedAt` muss auf allen Schreibpfaden gesetzt werden; ein ausgelassener Repo-Pfad könnte Änderungen dauerhaft aus Delta-Abfragen ausschließen.
- Die lokale 15-Minuten-Drosselung basiert auf der Geräteuhr; eine manuelle Systemzeitänderung kann den nächsten zulässigen Versuch vor- oder zurückverlegen. Dieser Timestamp wird ausschließlich zur lokalen Drosselung verwendet, niemals als Server-Delta-Grenze.
- Vorhandene Debug-Logs können lokal Gewichtswerte enthalten. Der neue Code darf keine neuen Gesundheitswerte loggen; vorhandene gespeicherte Logs werden durch die HC-4-Queue-Migration nicht automatisch gelöscht. Das lokale Diagnoseprotokoll bleibt ausdrücklich bestehen.
- Cosmos Contract Tests und reale Health-Connect-Berechtigungsprüfungen benötigen Emulator bzw. Android-Gerät. Nicht verfügbare Infrastruktur darf nicht als Pass gewertet werden.

## 21. Recommended Execution Order

1. Backend B1 ergänzt optionale Änderungszeitpunkte und repositoryseitige Delta-Abfragen samt Tests.
2. Backend B2 ergänzt geschützte Delta-APIs, Checkpoint/Pagination und Handler-Tests.
3. Backend D1 aktualisiert API-, Backend- und Domain-KB.
4. F1 ist laut Handoff abgeschlossen: State-Migration, freigegebene lokale Allowlist, User-Binding, Permission-Gates, sofortige Trigger, Voll-Export und ID-Löschretry. Der übergebene F1-Statusvertrag besteht aus den vier genannten `getSyncStatus()`-Feldern.
5. Frontend F2 kann auf Basis der ausdrücklichen Planfreigabe vom 2026-10-23 die UI-Anpassung gegen den abgeschlossenen F1-Vertrag ausführen; F2 erweitert den Status-Service nicht.
6. Frontend F3 ergänzt den persistierten, pro Datentyp geltenden 15-Minuten-Abgleich; F3 bleibt von F2 unabhängig und benötigt weiterhin nur F1.
7. Frontend D2 aktualisiert Mobile-KB.
8. Frontend D3 aktualisiert die Privacy-Policy mit dem in Abschnitt 17 exakt freigegebenen Wortlaut und nach F1 verifizierten lokalen Daten.
9. QA Q1 verifiziert Backend, Persistenz und API.
10. QA Q2 verifiziert Mobile, die vier F2-Statusfelder, Datenfluss und unveränderte Konto-Löschintegration.
11. QA Q3 verifiziert die Cold-Start- und Grenzsemantik.
12. QA Q4 prüft die in D3 aktualisierte Policy gegen den freigegebenen Wortlaut und die implementierte Datenverarbeitung.
13. Nach Abschluss der gelisteten HC-4-Arbeiten und QA werden Ergebnisse an den Orchestrator übergeben. Die separate Konto-Löschfortsetzung beginnt nur nach deren jüngstem Plan, gemeldetem QA-/Implementierungsstatus und erforderlicher erneuter `APPROVE`-Freigabe. Konto-Löschverhalten wird nicht in HC-4 geändert.
