# PLAN_US_Profil-und-Konto-dauerhaft-loeschen

**Stand:** 2026-10-22  
**Status:** Überarbeiteter Planvorschlag; wartet auf erneutes explizites `APPROVE`. Der letzte QA-Bericht bleibt **FAIL**. F1 hat zwei Korrekturversuche ausgeschöpft; diese Planrevision autorisiert keine Implementierung. Bestehende Änderungen und QA-Historie bleiben unangetastet.
**User Story:** [US_Profil-und-Konto-dauerhaft-loeschen.md](US_Profil-und-Konto-dauerhaft-loeschen.md)

Infrastructure Impact: Alpha  
Mobile Build Impact: None

## Plan Revision 2026-10-22 — authoritative for local cleanup

Diese Revision ersetzt alle früheren Aussagen zu AC-10, lokaler Wiederherstellung, Login nach Cleanup-Fehlern und lokalem Datenschutztext. Sie ändert weder den API-Vertrag noch die Backend-Löschgrenze, Community-Rezeptwahl oder den akzeptierten Late-Write-Rest.

**Approval boundary:** Das ist eine wesentliche Planänderung gegenüber dem zuvor genehmigten Ziel einer restart-sicheren lokalen Bereinigung. Vor jeder weiteren F1-/D2-Implementierung oder Korrektur ist ein neues explizites `APPROVE` erforderlich. Die PO-Klarstellung vom 2026-10-22 autorisiert den Best-Effort-Umfang und einen einfachen Gerätehinweis; dafür wird keine weitere Produktentscheidung eingeholt. Eine Änderung unter `docs/legal/` braucht weiterhin eine separate ausdrückliche Freigabe des Policy-Texts.

**Retained work:** B1, Dev-only I1, B2 und die bestehende serverseitige Löschung einschließlich ihres strikten Request-Vertrags bleiben gültig. Community-Transfer, Community-Reads, der TTL-Parallelitäts-Lock, Fehler-/Retry-Verhalten vor Backend-Erfolg sowie der akzeptierte vor-Lock-Late-Write-Rest werden nicht wieder geöffnet. Die mobile Löschbestätigung, der Aufruf nur nach Bestätigung und die Reihenfolge `204` vor lokalem Cleanup bleiben gültig. Keine Alpha-Infrastruktur oder kein Backend wurde deployed.

**F1 disposition:** Die vorhandenen lokalen Cleanup-Aufrufe und der In-Memory-Logout bleiben als Grundlage erhalten. Der persistente Schlüssel `fittrack:account_deletion_cleanup_pending`, Startup-Auth-Gate, dauerhafte Login-Wiederherstellungsanzeige und lokale Retry-Aktion sind nicht mehr erforderlich und werden im neuen F1-Auftrag de-scoped. Die beiden bisherigen F1-Versuche bleiben historisch 2/2 ausgeschöpft; eine spätere Umsetzung ist ein neu freigegebener Korrekturauftrag, kein automatischer dritter Versuch. Der eigenständige Full-Mobile-Testfehler zur veralteten Legal-Copy-Assertion bleibt ein QA-Gate.

**Concrete local state and effects:** Die aktuelle Löschroutine zielt auf `fittrack:skip_wizard`, `hc:weight:sync`, `hc:nutrition:sync`, `hc:sync:log` sowie `fittrack_access_token` und `fittrack_refresh_token`. Die beiden Health-Connect-Queues sind AsyncStorage-weite App-Daten ohne Entra-`sub`-Namespace. Die Gewichtsqueue kann vollständige `WeightEntry`-Werte/Datum enthalten; die Ernährungsqueue vollständige MealItem-Snapshots mit Namen und Makros sowie Datum, Typ und Retry-Fehlerdaten. Das lokale Diagnoseprotokoll hält bis zu 150 Zeitstempel-, Tag-, Meldungs- und Fehlerdetails; es ist in der Health-Connect-Ansicht in Debug-Builds lesbar. SecureStore-Tokens können eine gültige Sitzung erhalten.

Wenn ein Queue-Schlüssel nach fehlgeschlagenem Cleanup erhalten bleibt und eine gültige Sitzung beim nächsten Start geladen wird, drainiert `App.tsx` diese Queue beim Aktivieren der App. Die Queue-Worker rufen dabei Health Connect auf, nicht FitTrack-API oder Cosmos. Upserts enthalten `clientRecordId`; dadurch kann Health Connect einen passenden Eintrag aktualisieren, aber dieses Repository beweist keine plattformweite Duplikatfreiheit für alle Rest-/Restore-Fälle. Ein veralteter Upsert oder Delete kann dennoch einen Health-Connect-Eintrag erstellen/ändern oder löschen. Diese Gerätedaten und bestehenden Berechtigungen werden durch die Kontolöschung nicht entfernt. Weil lokale Schlüssel nicht nach Nutzer getrennt sind, kann ein verbliebener Log-/Queue-Inhalt auch in einer späteren Sitzung auf derselben Installation sichtbar oder ausführbar sein.

Bei Anmeldung mit derselben noch bestehenden Entra-Identität bleibt der verifizierte `sub` gleich; die serverseitige Löschung stellt frühere Cosmos-Daten nicht wieder her. `GET /api/profile/me` liefert bis zum erneuten Anlegen eines Profils `null`, und ein neuer Profil-/Diary-Aufbau beginnt ohne gelöschte Dokumente. Der App-Wizard wird allerdings nur gestartet, wenn `fittrack:skip_wizard` nicht mehr auf `1` steht. Überlebt dieser Schlüssel, kann der Wizard ausbleiben. Überleben Token und Queue, kann der Token nach App-Neustart die Sitzung wiederherstellen und die Queue erneut nach Health Connect drainieren. Es gibt keinen Clientpfad, der diese Queue-Daten zu FitTrack hochlädt. Bereits vor Lock-Erwerb zugelassene Backend-Arbeit kann gemäß dem akzeptierten Residual weiterhin nach `204` schreiben.

**Android uninstall / backup caveat:** Das Manifest setzt `android:allowBackup="true"`; im Repository ist keine `dataExtractionRules`-/Backup-Ausschlussdatei und keine entsprechende Expo-Konfiguration sichtbar. Android entfernt gewöhnlich den App-Sandbox-Inhalt bei Deinstallation, aber erlaubte Sicherung/Wiederherstellung kann abhängig von Android-Version, Gerät und Backup-Anbieter Daten bei einer späteren Installation zurückbringen. Das Repository belegt das konkrete Sicherungs-/Wiederherstellungsverhalten nicht. Die Warnung verspricht daher keine automatische Entfernung durch Deinstallation. Sie betrifft ausschließlich App-Daten; Health-Connect-Datensätze, Medienexporte und Berechtigungen sind nicht umfasst.

**Recommended behavior:** Nach bestätigtem `204` versucht die App einmal, dieselben lokalen Schlüssel und beide Tokens zu entfernen, setzt die laufende Sitzung auf ausgeloggt und zeigt Login. Fehler in diesem Best-Effort-Schritt ändern den Backend-Erfolg nicht, lösen weder einen zweiten `DELETE /api/profile`-Aufruf noch ein dauerhaftes Cleanup-Journal/einen Retry aus. Erkennt die laufende App einen Cleanup-Fehler, zeigt sie einmalig den unten festgelegten Hinweis. Nach Force-Close gibt es absichtlich keine persistente Garantie, dass der Hinweis wiederkommt oder Tokens/Queues weiter bereinigt werden; bei verbleibendem gültigem Token ist Auth-Hydration beim Neustart möglich. Das ist die akzeptierte lokale Residualgrenze unter der PO-Priorität.

**Transient user notice (not policy text):** `Einige private App-Daten von FitTrack konnten auf diesem Gerät nicht gelöscht werden. Du kannst die App-Daten in den Android-Einstellungen entfernen.` Der Hinweis wird nach erfolgreicher Backend-Löschung genau einmal in der laufenden Löschsitzung angezeigt, wenn mindestens ein lokaler Cleanup-Schritt fehlschlägt. Keine Retry-Aktion, kein Hinweis auf Health-Connect-Inhalte oder Entra. Die frühere vorgeschlagene Formulierung mit „bei einer Deinstallation ... automatisch gelöscht“ wird verworfen, weil `allowBackup="true"` die absolute Zusage im Repository nicht trägt.

**Privacy Impact:** Die bestehende Policy behauptet derzeit die erfolgreiche Entfernung lokaler Tokens, Warteschlangen und des Logs. Das ist nach dieser Änderung zu absolut und benötigt eine vorgeschlagene Aktualisierung unter `Speicherdauer und Löschen`. Die Warnung selbst ist flüchtige UI und ersetzt den Policy-Text nicht. Es wird keine Rechtskonformität behauptet; Privacy Impact Review ist keine Rechtsberatung.

**Scope locks retained:** Kein Microsoft Graph/Entra-Automation; kein Alpha-Deployment; keine Emulator-Einrichtung; keine Remote-Inventur; keine Änderung des Backend-/Cosmos-Vertrags; kein Android-Backup- oder Expo-Config-Umbau; keine Löschung von Health-Connect-Daten/Berechtigungen/Medienexporten; kein Drain oder Koordinieren von vor Lock-Erwerb zugelassener Backend-Arbeit.

**Execution Status (reported through 2026-10-22):** B1, Dev-only I1 and B2 remain reported complete as stated in the historical handoffs below; Alpha was not applied. F1 is implemented in the worktree but the latest QA is **FAIL**, not accepted: the marker-write failure path can leave a surviving token restorable after restart. The revised plan intentionally de-scopes restart-safe local recovery, pending fresh approval. The full Mobile suite also remains **FAIL** on one stale legal-copy assertion. QA report and findings register are not modified by this task. Cosmos contract verification remains **UNVERIFIED**; no emulator setup or remote inventory is requested. The accepted no-drain behavior remains unchanged.

**Latest PO override (2026-10-21):** The approved User Story remains immutable. Where its AC-2/AC-5/AC-11 wording says the end user must manually delete Entra or describes that follow-up as part of the user's flow, this plan records the newer explicit direction: from the user's perspective, successful FitTrack account deletion is complete. Do not expose Entra follow-up or request-lifecycle details in dialog, privacy policy, or other user-facing copy. No Microsoft Graph automation is requested; the existing Entra identity is an internal manual follow-up owned by the Product Owner. This override applies only to user-facing wording and ownership of that follow-up; it does not authorize Graph work or change the technical deletion boundary.

**Accepted technical residual:** Operations admitted before acquisition of the deletion lock are not drained, awaited, cancelled, or coordinated. They may write after `204` or after lock release. `204` confirms this request's selected deletion and cleanup steps only; it does not guarantee that older admitted work cannot write later. This residual is accepted and must remain accurately documented in internal technical planning and implementation evidence, not in end-user copy. The lock continues to reject protected work that begins while it is active. No durable deletion journal, tombstone, operation drain, or new architecture option is authorized or required.

`Infrastructure Impact: Alpha` ergibt sich aus dem neuen Cosmos-Container für erhaltene, vom Eigentümer entkoppelte Community-Rezepte. Die Ressource muss in Dev und Alpha vorhanden sein, bevor Backend-Code sie dort verwendet; Dev wird zuerst validiert. `Mobile Build Impact: None`, weil nur Mobile-JavaScript/TypeScript vorgesehen ist und keine nativen Module, Plugins oder `app.config.js`-Änderungen geplant sind.

## 1. Requirement Assessment

**Classification:** Accept with the explicitly authorized PO scope clarification.

Die automatisierte Funktion löscht aktive FitTrack-Fachdaten. Sie ruft Microsoft Graph nicht auf. Der erfolgreiche Abschluss gilt für den Nutzer als abgeschlossene Kontolöschung. Der Dialog enthält keine Anweisung zu Entra und keine internen Details zu bereits gestarteten Vorgängen; die dafür genehmigte Formulierung steht in AC-2.

Die ursprüngliche Lösch- und UI-Anforderung bleibt im Übrigen bestehen. Freundschaften werden entfernt, weil sie eine Zukunftsfunktion sind. Für Wiederholungen wird kein dauerhaftes Löschjournal angelegt: Ein Nutzer-Retry wiederholt denselben vollständigen, idempotenten API-Aufruf von vorn. Bis der Server den vollständigen Erfolg meldet, bleiben App-Sitzung, Tokens und lokale Daten erhalten.

**PO scope decision:** Resolved. Already-started requests/operations are outside the deletion completion boundary and do not need draining, waiting, or coordination. This explicitly accepts the possibility of a late write after `204`; do not reopen options A/B/C or present them as pending.

**Approval state:** The Product Owner's explicit instruction on 2026-10-21 authorizes the privacy and dialog wording in Section 20 and continuation of the existing flow. No further approval is a prerequisite for D1/D2. QA remains outstanding; this plan does not mark QA or implementation as complete beyond the reported package handoffs.

**User Story artifact:** Keep `US_Profil-und-Konto-dauerhaft-loeschen.md` immutable. This plan records the latest PO override and its limited scope; no replacement-story decision is required. The plan is authoritative for implementation of the changed user-facing wording.

## 2. Feature Summary

Nutzer können aus dem Profil heraus die Löschung ihrer aktiven FitTrack-Fachdaten anfordern und exakt `DELETE` eingeben. Falls eigene veröffentlichte Community-Rezepte existieren, wählen sie zusätzlich, ob diese erhalten bleiben. Erhaltene Rezepte werden nach erfolgreicher Entkopplung als `Anonymous` angezeigt und in aktiver FitTrack-Persistenz ohne Nutzer-ID-, Anzeigenamen- oder persönliche Eigentümerzuordnung abgelegt. Auf ausdrückliche Auswahl werden veröffentlichte Rezepte und ihre ausschließlich dafür benötigten Dateien gelöscht.

Die Löschung ist synchron für die vom Löschrequest eingeschlossenen Backend-Schritte: `204` wird nach deren Abschluss zurückgegeben. Die technische Ausnahme für vor Lock-Erwerb gestartete Vorgänge bleibt intern dokumentiert; sie werden nicht abgewartet und können nach `204` noch Daten schreiben. Ein Backend-Fehler lässt Sitzung und lokale Daten bestehen und erlaubt einen vollständigen Retry des API-Aufrufs. Nach `204` versucht die App einmal, ihre bekannten lokalen Schlüssel und Tokens zu entfernen und meldet die laufende Sitzung ab. Lokale Fehler heben den Backend-Erfolg nicht auf und führen weder zu einem zweiten DELETE-Aufruf noch zu einem dauerhaften lokalen Retry.

## 3. Current Behaviour

- `mobile/src/modules/profile/ProfileEditScreen.tsx` enthält die aktive Bestätigungs-/Retry-UI und ruft nach `204` `completeAccountDeletionLocally()` auf. F1 ergänzt derzeit einen persistenten Cleanup-Marker, Startup-Gate und lokalen Retry; QA bewertet F1 wegen eines Marker-Write-Fehlerpfads als **FAIL**.
- `backend/src/functions/profile.ts` akzeptiert `DELETE /api/profile` mit exakt `{ confirmation: "DELETE", deleteCommunityRecipes: boolean }`, löscht anhand des verifizierten `sub` und liefert nach den ausgewählten Backend-Schritten `204`. Ein lokaler Cleanup-Fehler folgt erst danach und darf diesen Request nicht wiederholen.
- Aktive nutzerbezogene Cosmos-Daten liegen in `profiles`, `weights`, `nutritionDiaryMeals` (Meals, DayMeta und Hint-State), `reusableMealItems`, `recipes`, `aiUsage`, `aiInsights` und `userFoodRelations`. Die ebenfalls provisionierten Container `users` und `nutritionProfiles` werden von aktuellen Fach-Repositorys nicht verwendet. „Mögliche ältere Dokumente“ meint nur denkbare frühere Nutzer-/Profil-Einträge dort; ihr Vorhandensein in Dev oder Alpha ist nicht belegt. Der vorhandene Löschpfad zielt in `users` auf `id = sub` und in `nutritionProfiles` auf die Partition `userId = sub`; eine Remote-Inventur oder globale Suche ist nicht vorgesehen.
- `foodProducts` ist globaler Katalogbestand und wird nicht gelöscht.
- `recipes` ist aktuell ownergebunden (`/userId`, `userId`, `ownerUserId`). Eine Owner-ID lässt sich nicht in place in einen neutralen Partition-Key ändern.
- Community-Responses blenden Eigentümerdaten bereits aus und setzen den Autor bei fehlender Namensfreigabe auf `Anonymous`; diese Response-Projektion entfernt aber keine Eigentümerdaten aus gespeicherten Dokumenten.
- `deleteRecipeImage()` und `deleteProductImage()` verwenden `deleteIfExists()`; fehlende Blobs sind damit wiederholbar löschbar. Bilder liegen aktuell unter nutzerbezogenen Blob-Pfaden.
- Die Enrichment-Queue speichert `{ userId, itemId }`. Worker und Scheduler können Items weiterverarbeiten bzw. erneut einstellen; beide benötigen Sperr-/Existenzchecks, damit Löschziele nicht neu geschrieben werden.
- Mobile speichert OAuth-Tokens in SecureStore. AsyncStorage enthält den Wizard-Marker `fittrack:skip_wizard`, Health-Connect-Wiederholungsqueues und das lokale Diagnoseprotokoll.
- Mobile speichert OAuth-Tokens in SecureStore. Die Löschroutine zielt auf `fittrack:skip_wizard`, `hc:weight:sync`, `hc:nutrition:sync`, `hc:sync:log` und beide SecureStore-Tokens. Die beiden Queues enthalten wiederholbare Health-Connect-Operationen einschließlich persönlicher Werte/Snapshots; sie sind nicht nach Entra-`sub` getrennt.
- Der Axios-Client versucht bei `401` eine Token-Erneuerung und löscht danach standardmäßig Tokens. Für einen fehlgeschlagenen Löschaufruf muss die Sitzung bis zum bestätigten Servererfolg erhalten bleiben.
- Blob Soft Delete ist in `infra/modules/storage.bicep` mit 7 Tagen konfiguriert. Application Insights/Log Analytics hat 30 Tage Retention. Cosmos-Backup-Retention ist im Repository nicht spezifiziert.

## 4. Desired Behaviour

- Profilaktion öffnet ein app-eigenes Bestätigungs-Overlay mit dem Titel `Profil endgültig löschen?`, dem verbindlichen Warntext, der exakten Eingabe `DELETE` und den Aktionen `Abbrechen` und `Endgültig löschen`.
- Der Community-Rezept-Toggle erscheint ausschließlich bei eigenen veröffentlichten Community-Rezepten, startet bei jedem Öffnen auf `Nein` und ist bei fehlenden Veröffentlichungen samt erklärendem Text ausgeblendet.
- Während ein Löschlauf aktiv ist, sind Eingaben und Aktionen gesperrt, Fortschritt ist sichtbar und Doppeltaps lösen keinen parallelen Lauf aus.
- Ein Serverfehler zeigt eine verständliche Meldung und eine Retry-Aktion. Der Retry sendet denselben vollständigen Request-Body erneut; es gibt keine persistente Job-/Tombstone-Tabelle. Erfolg bedeutet Abschluss der vom Löschrequest ausgeführten Schritte, nicht das Abwarten bereits zuvor gestarteter Vorgänge.
- User-facing dialog and privacy copy contain no reference to Entra follow-up or to already-started requests. The accepted technical residual is internal-only and does not change the user's completion state.
- Backend-Fehler löschen weder lokale Daten noch Tokens und erlauben den bestehenden vollständigen API-Retry. Erst nach bestätigtem `204` startet die einmalige Best-Effort-Bereinigung der lokalen Schlüssel und Tokens.
- Lokale Cleanup-Fehler ändern den bestätigten Backend-Erfolg nicht. Die App meldet die laufende Sitzung ab und zeigt einmalig den festgelegten Hinweis; es gibt keine dauerhafte Cleanup-Sperre oder Retry-Aktion. `DELETE /api/profile` wird bei lokalem Fehler niemals erneut aufgerufen.
- Erfolgreiche Community-Rezept-Beibehaltung entfernt die persönliche Verknüpfung aus aktiver FitTrack-Persistenz; der Community-Autor lautet `Anonymous`.

## 5. Scope

- Profilaktion und Bestätigungs-Overlay mit Toggle, case-sensitiver `DELETE`-Eingabe, Fortschritt, Fehler und Retry.
- Geschützter, strikt validierter `DELETE /api/profile`-Vertrag; JWT-`sub` ist das einzige Löschziel. Keine Ziel-ID aus dem Request.
- Idempotentes Löschen aktiver FitTrack-Dokumente und persönlicher Dateien. Falls in `users` oder `nutritionProfiles` ein Datensatz für genau den authentifizierten Nutzer existiert, wird er über dessen ID/Partition mitgelöscht; keine Bestandsmigration und keine globale Inventur.
- Wahlweises Überführen eigener veröffentlichter Community-Rezepte in ein ownerloses Modell samt erforderlichen Bildern oder vollständiges Löschen dieser Rezepte und Bilder.
- Schutz vor parallelen Löschläufen und vor nutzerbezogenen Handler-/Queue-Vorgängen, die während der aktiven Löschsperre neu beginnen, mit einem kurzlebigen TTL-Lock statt eines Löschjournals. Vor Erwerb der Sperre gestartete Vorgänge werden nicht drainiert, abgewartet oder mit der Löschung koordiniert und können danach noch schreiben.
- Löschen eigener Favoriten/Recents, eigener Cosmos-`aiInsights`-Dokumente (Daily-/Weekly-Caches und Feedback) und eigener Tagebuchdaten. Fremde Favoriten und Tagebuch-Snapshots bleiben unverändert.
- Einmaliger Best-Effort-Reset nach Servererfolg: SecureStore-Tokens, Wizard-Marker, beide Syncqueues, Diagnoseprotokoll und In-Memory-Synczustände entfernen; Login im laufenden Prozess zeigen. Bei lokalem Fehler einmalig den freigegebenen Hinweis anzeigen. Health Connect selbst nicht verändern; keinen dauerhaften Marker, Startup-Gate, Retry-Dialog oder erneuten Backend-DELETE-Aufruf anlegen.
- Aktualisierung der API-, Domain-, Mobile-, Infrastruktur- und Privacy-Dokumentation im genehmigten Umsetzungsschritt.

## 6. Out of Scope

- Microsoft Graph-Aufrufe oder automatisierte Löschung, Deaktivierung oder Widerruf einer Entra External ID/CIAM-Identität. Ein verbleibender Identitäts-Folgeschritt ist ausschließlich interne, manuelle PO-Arbeit und kein Teil der Nutzerführung oder Datenschutzerklärung.
- Graph-App-Rollenzuweisung, Admin-Consent, Graph-Live-Delete-Test und Neuregistrierung mit gleicher E-Mail als Implementierungs- oder QA-Blocker.
- Freundschaften/Haushaltsbeziehungen; sie sind Zukunftsfunktion.
- Löschen bereits exportierter Health-Connect-Daten oder Aufruf einer Health-Connect-Delete-API.
- Gezieltes Löschen von Application-Insights-/Log-Analytics-Ereignissen. Sie folgen der bestehenden Retention.
- Ändern bestehender Backups, Cosmos-Backup-Policy, Azure Blob Soft Delete/Retention oder globaler Storage-Konfiguration; kein Permanent-Purge und kein `allowPermanentDelete`.
- Änderung des globalen Produktkatalogs, fremder Nutzerrelationen oder fremder Tagebuch-Snapshots.
- Automatische Wiederaufnahme nach Geräte-, Sitzungs- oder Tokenverlust. Nutzer-Retry gilt bei weiterhin verwendbarer Session.
- Restart-sichere lokale Bereinigung und lokale Cleanup-Retry-Journale. Ein nach Force-Close verbliebener Token oder eine Queue kann beim Neustart weiterwirken; dieser Rest ist unter der PO-Best-Effort-Grenze ausdrücklich nicht durch einen persistenten Marker abgesichert.
- Drain, Warten oder sonstige Koordination bereits vor Erwerb des Lösch-Locks gestarteter HTTP-, Queue- oder Scheduler-Vorgänge; diese können nach `204` noch nutzerbezogene Daten schreiben.
- Expo Dev Build, Preview Build, EAS-Konfigurationsänderung oder neue native Berechtigung.

## 7. Confirmed Facts

- Backend-Identität stammt aus dem verifizierten JWT-Claim `sub`; persönliche Cosmos-Daten sind anhand dieses Werts partitioniert oder gefiltert.
- `nutritionDiaryMeals` enthält neben Meals auch `DayMeta` und Hint-State. Diese Dokumente müssen gemeinsam gelöscht werden.
- Die bestehenden Repositorys bieten keine gemeinsame Löschoperation über alle Container und keine generische idempotente Partitionsbereinigung.
- Fremde Tagebuch-Snapshots und Favoriten bleiben bestehen, auch wenn das veröffentlichte Rezept gelöscht wird.
- Eigene Favoriten/Recents liegen in `userFoodRelations`; fremde Nutzerrelationen werden nicht angerührt.
- Application-Insights-Logs (30 Tage) sind von Cosmos-Nutzerdokumenten in `aiInsights` zu unterscheiden. Letztere gehören zum aktiven persönlichen FitTrack-Datenbestand und werden gelöscht.
- Storage-IaC aktiviert sieben Tage Blob Soft Delete. Die normale Anwendungs-Löschung entfernt die aktive Datei; eine Plattform-Wiederherstellungskopie kann gemäß bestehender Konfiguration noch bis zu sieben Tage vorhanden sein.
- Bereits exportierte Health-Connect-Daten und bestehende Backups bleiben bestehen.
- `ConfirmSheet` ist das vorhandene app-eigene Muster für destruktive Bestätigungen, unterstützt derzeit aber weder Eingabefeld/Body-Slot noch blockierenden Ladezustand. Erweiterung eng begrenzen oder einen lokalen Dialog mit minimalem gemeinsamem Impact verwenden.

## 8. Assumptions and Open Questions

**Product questions:** None.

**Technische Voraussetzungen:**
- Für `users` und `nutritionProfiles` ist kein Remote-Inventar erforderlich. Das Vorhandensein möglicher früherer Einträge ist unbekannt; falls vorhanden, darf die Löschung nur Datensätze mit der exakten authentifizierten Nutzer-ID treffen (`users`: `/id`; `nutritionProfiles`: `/userId`). Keine globale Suche oder Löschung.
- Backend bestätigt den synchronen Löschlauf mit repräsentativem Volumen innerhalb des konfigurierten Azure-Functions-Zeitlimits. Ein Timeout oder Teilabschluss darf niemals als Erfolg gelten.
- Zielmodell für erhaltene Community-Rezepte ist ein zusätzlicher `communityRecipes`-Container mit Partition-Key `/id`. Kein globaler Backfill.
- Die Dev-Container-Provisionierung ist laut I1-Handoff abgeschlossen. Keine Azure-Bestandsprüfung für mögliche ältere Nutzer-/Profil-Einträge; keine Zugangsdaten in Dateien oder Chat übernehmen.

## 9. Existing Components to Reuse

- `profile.ts`, `profileRepository.ts` und bestehende Factory-/Repository-Grenzen.
- Cosmos-Container und Repositorys; Löschmethoden idempotent halten und bestehende Partition-Keys nicht verändern.
- `recipesRepository.ts`, `cosmosRecipesRepository.ts`, `communityRecipes.ts` und Community-Handler.
- `storage.ts` mit `deleteIfExists()` und RecipeImage-Metadaten.
- `ConfirmSheet`, Theme-Tokens, `profileApi`, `apiClient`, `authService`, `useAuthStore`, `SKIP_WIZARD_KEY`, `healthSyncService`, `nutritionSyncService` und `syncLogger`.
- Bestehende Vitest-Unit-/Handler-Tests. Die Cosmos-Emulator-Contract-Suite ist ohne Emulator nicht ausführbar; ihr Status bleibt **UNVERIFIED** und sie ist nach Abschnitt 18 kein pauschales Feature-Gate. Contract-Tests niemals gegen Remote-Azure Cosmos ausführen.

## 10. Proposed Technical Solution

### API und orchestrierter Löschlauf

`DELETE /api/profile` bleibt der authentifizierte Route-Einstieg und erhält einen strikt validierten Body:

```json
{
  "confirmation": "DELETE",
  "deleteCommunityRecipes": false
}
```

Beide Felder sind erforderlich; unbekannte Felder werden abgewiesen. `userId` ist kein Request-Feld und stammt ausschließlich aus `requireUser().userId`. Erfolg (`204`) wird erst nach allen eingeschlossenen Backend-Schritten zurückgegeben. Fehlerantworten enthalten einen stabilen Code, eine verständliche deutsche Nachricht und `retryable: true`, aber keine internen Fehlermeldungen oder Datenwerte.

Nutzerbezogene Container werden paginiert und in begrenzten Batches verarbeitet. Fehlende IDs/Blobs gelten als erledigt. Fehler stoppen den Lauf und geben keinen Erfolg zurück; nach Freigabe des Locks darf der vollständige Lauf erneut gestartet werden. Community-Rezept-/Blob-Übernahmen verwenden deterministische Ziel-IDs und -Dateinamen: vorhandene Ziele werden wiederverwendet, bevor Quelldokumente/-blobs entfernt werden. Fremde Partitionen werden nicht beschrieben.

### Kurzlebige Parallelitätskontrolle ohne Löschjournal

Ein In-Memory-Mutex reicht bei mehreren Azure-Functions-Instanzen nicht. Deshalb wird je Nutzer ein einzelner kurzlebiger Lock-Datensatz in der bestehenden `aiInsights`-Cosmos-Partition gespeichert (`_docType: accountDeletionLease`, zufälliges Lease-Token und Ablauf/TTL). Er enthält keine Rezeptauswahl, Phasen oder Fortschrittsdaten. Der Container unterstützt per-Dokument-TTL. Der Lock wird bei normalem Erfolg/Fehler explizit freigegeben und läuft nach Prozessabbruch ab. Ein zweiter aktiver Löschlauf erhält `409 ACCOUNT_DELETION_IN_PROGRESS` mit retryablem Fehlerstatus.

Der gemeinsame Auth-/Handlerpfad weist während des Locks neue geschützte Operationen ab. Lang laufende Handler und Queue-Worker prüfen die Sperre vor persistenten Writes erneut. Der Enrichment-Scheduler stellt für gesperrte Nutzer keine neuen Aufträge ein; der Worker überspringt gesperrte oder gelöschte Items und darf kein gelöschtes Dokument neu anlegen. Der Lock wird nach erfolgreicher Fachdatenlöschung zuletzt entfernt. Es gibt keinen gespeicherten Wiederaufnahmezustand und keine automatische Fortsetzung nach Sessionausfall.

### Erhaltene Community-Rezepte

Neues internes Persistenzmodell `communityRecipes` speichert nur Community-Rezeptdaten und nicht-personenbezogene Bildpfade. Es enthält weder `userId`, `ownerUserId`, `communityPublication`, persönlichen Anzeigenamen noch persönliche Bibliotheks-IDs. Die API-Projektion gibt für ownerlose Dokumente immer `Anonymous` aus. Bestehender `recipes`-Container und `/userId`-Partition-Key bleiben unverändert.

Bei `deleteCommunityRecipes: false` werden ausschließlich veröffentlichte eigene Community-Rezepte idempotent in das ownerlose Modell kopiert, benötigte Bilder in einen neutralen Pfad übertragen und erst dann ursprüngliche Owner-Dokumente sowie persönliche Bildpfade entfernt. Private eigene Rezepte und nicht mehr benötigte persönliche Bilder werden gelöscht. Bei `true` werden auch eigene veröffentlichte Rezepte und ihre Bilder gelöscht. Fremde Favoriten und gespeicherte Tagebuch-Snapshots bleiben erhalten.

Community-Reads unterstützen während der Migration bestehende veröffentlichte Owner-Rezepte und ownerlose Dokumente. Listen führen Quellen dedupliziert und deterministisch zusammen. Detail-, Bild-, Favoriten- und Diary-Flows behandeln ownerlose Rezepte als Community-Inhalt ohne Owner-Counter-Update. Ein gelöschtes Rezept ist über einen fremden Favoriten nicht wieder abrufbar; der Fremdverweis bleibt bestehen.

### Persistence Impact

**Migration class:** Class 3 für die beim konkreten Löschlauf erhaltenen veröffentlichten Rezeptdokumente: explizite, idempotente Copy-and-remove-Migration in ein neues ownerloses Community-Modell. Kein globaler Backfill. Bestehende Rezepte bleiben bis zur Löschung ihres Eigentümers im bisherigen Container lesbar. Wiederholung erkennt bereits angelegte Zielkopien und fehlende Quelldokumente als erledigte Schritte.

**Backward compatibility:** Bestehende `recipes`-Dokumente, `/userId`-Partition-Key und Owner-Routen bleiben unverändert. Community-Reads unterstützen alte und ownerlose Dokumente. Neues `communityRecipes` verwendet `/id`; `backend/src/lib/cosmos.ts` und `infra/modules/cosmos.bicep` werden ergänzt. Dev wurde laut I1-Handoff vor Alpha provisioniert und geprüft. Emulator-Vertragstests sind in dieser Umgebung nicht verfügbar; ihr Status bleibt **UNVERIFIED**, ohne die Umsetzung allein deshalb zu blockieren. Es gibt keine Tests gegen Dev-/Alpha-Cosmos.

### Retention und ausdrücklich nicht gelöschte Daten

- Blob-Löschung verwendet normale Anwendungsoperationen. Azure Blob Soft Delete kann Wiederherstellungskopien gemäß bestehender 7-Tage-IaC-Retention vorhalten. Kein Permanent-Purge und keine globale Änderung.
- Application Insights/Log Analytics wird nicht pro Nutzer bereinigt; vorhandene und künftige Logs folgen der regulären Retention von derzeit 30 Tagen und können technische IDs enthalten.
- Bereits nach Health Connect exportierte Werte bleiben dort. Lokale FitTrack-Wiederholungsqueues und Sync-Logs werden nach Erfolg entfernt; kein externer Löschaufruf.
- Bestehende Backups bleiben unangetastet. Keine Behauptung sofortiger physikalischer Entfernung aus Backups.
- Kein Graph-Token, keine Graph-Rolle und kein Graph-Aufruf. Eine etwaige manuelle Entra-Nacharbeit ist interne PO-Aufgabe und wird nicht in der Nutzerführung oder Datenschutzerklärung erwähnt.
- Fremde Diary-Snapshots und User-Favoriten bleiben bestehen. Wird ein Community-Rezept gelöscht, bleibt ein Fremdverweis bestehen und zeigt das Rezept als nicht verfügbar.

### Mobile-Abschlussverhalten

Dialog hält den Request-Body während Backend-Fehler/Retry lokal fest; Auswahl und `DELETE`-Bestätigung ändern sich zwischen Backend-Versuchen nicht. Abbrechen, Backdrop und Plattform-Back vor Beginn schließen ohne Request. Während des Laufs sind Eingabe, Toggle und Aktionen gesperrt.

Netzwerk-, Timeout-, Backend- oder Lock-Fehler löschen weder SecureStore-Tokens noch AsyncStorage oder Auth-Store. Für den Löschrequest unterdrückt der Axios-401-Pfad ein automatisches Logout/Clear vor Servererfolg. Ein Backend-Retry führt den vollständigen Request erneut aus.

Nach bestätigtem `204` versucht Mobile einmal, beide Sync-Service-In-Memory-Zustände, die bekannten persönlichen AsyncStorage-Schlüssel und SecureStore-Tokens zu entfernen. Es setzt den aktuellen Auth-Store auf unangemeldet und zeigt Login, unabhängig davon, ob einzelne lokale Operationen fehlschlagen. Bei mindestens einem erkannten Fehler zeigt die laufende App einmalig den Warnhinweis; es gibt keine persistente Cleanup-Markierung, keinen Startup-Gate und keine lokale Retry-Aktion. Ein bei Force-Close verbliebener gültiger Token kann beim nächsten Start wieder authentifizieren; dann kann `App.tsx` eine verbliebene Queue nach Health Connect drainieren. Health-Connect-Daten und Berechtigungen werden nicht verändert.

## 11. Backend Work Package

### B1 — Ownerloses Community-Modell

Agent: Backend

**Goal:** Ownerloses Community-Rezept-Modell, Repository-Leseunterstützung und idempotente Rezept-/Bildübernahme vorbereiten; bestehenden Owner-Datenpfad rückwärtskompatibel halten.

Required Knowledge Base: `docs/kb/tech/02-backend.md`, `docs/kb/tech/07-infrastructure.md`, `docs/kb/tech/08-testing.md`, `docs/kb/domain/06-recipes.md`, `docs/kb/tech/09-api-reference.md`.

Required Repository Context: `backend/src/lib/cosmos.ts`, `backend/src/lib/repositories/recipesRepository.ts`, `backend/src/lib/repositories/cosmosRecipesRepository.ts`, `backend/src/lib/repositories/recipePublication.ts`, `backend/src/lib/communityRecipes.ts`, `backend/src/functions/communityRecipes.ts`, `backend/src/lib/storage.ts`, `infra/modules/cosmos.bicep`.

Required Skills: `cosmos-data-model-and-migration`, `privacy-impact-review`.

Relevant Acceptance Criteria:
- **AC-6: Bilder und Dateien löschen.** Zugehörige persönliche Bilder und Dateien werden mit den normalen FitTrack-Anwendungsoperationen aus den aktiven Storage-Pfaden gelöscht. Dateien, die für erhaltene Community-Rezepte benötigt werden, werden in einen neutralen Community-Pfad übertragen und bleiben erhalten. Azure Blob Soft Delete wird nicht gezielt umgangen oder global geändert. Eine Plattform-Wiederherstellungskopie kann gemäß bestehender IaC-Konfiguration noch bis zu sieben Tage vorhanden sein.
- **AC-7: Erhaltene Community-Rezepte anonym anzeigen.** Bei Toggle **„Nein“** bleiben die veröffentlichten Community-Rezepte einschließlich ihrer Inhalte und benötigten Bilder für die Community nutzbar. Die aktive FitTrack-Persistenz enthält keine persönliche Nutzer-ID-/Owner-/Namenszuordnung zum gelöschten Nutzer. Persönliche Bibliotheksverknüpfungen werden aus den erhaltenen Community-Dokumenten entfernt. Der Autor wird als **„Anonymous“** angezeigt.

Dependencies:
- None.

**Expected Handoff:**
- Container-Spezifikation mit `containerName: communityRecipes`, `partitionKey: /id` und `indexPolicyNote`.
- Ownerlose Dokumentform ohne persönliche Nutzer-/Owner-/Namens-/Bibliothekszuordnung.
- Idempotente Copy-/Bildstrategie und Community-Read-Verhalten für bestehende und ownerlose Dokumente.
- Nachweis der fokussierten Unit-/Handler-Tests und des Build-Checks; Cosmos-Emulator-Contract-Verifikation separat als **UNVERIFIED** ausweisen, nicht als fehlgeschlagen oder bestanden.
- Backend schreibt keine Bicep-Datei.

### B2 — Vollständige FitTrack-Löschung

Agent: Backend

**Goal:** `DELETE /api/profile` zum vollständigen, authentifizierten, idempotenten FitTrack-Löschlauf erweitern; aktive Datencontainer, gegebenenfalls exakt zuordenbare Datensätze in den nicht mehr fachlich genutzten Containern `users`/`nutritionProfiles`, Storage, Community-Option und Queue-/Handler-Verhalten abdecken. Der kurzlebige TTL-Lock dient ausschließlich der Parallelitätskontrolle, speichert keinen Fortschritt oder Wiederaufnahmezustand und ist kein Löschjournal. Kein Graph-Aufruf.

**Status:** Reported complete (2026-10-21). The exact request-contract correction, no-drain behavior, focused unit/handler tests, and build verification are reported complete. Preserve the existing implementation and evidence. Emulator contract verification stays **UNVERIFIED** and is not a blanket completion gate; no remote legacy inventory is required. The latest PO wording override is handled by D1/D2 and is not a reason to reopen B2.

**Binding API contract (authoritative for B2 and the F1 handoff):** `DELETE /api/profile` is authenticated. Its body is exactly:

```json
{
  "confirmation": "DELETE",
  "deleteCommunityRecipes": false
}
```

Both fields are required. `confirmation` must equal the case-sensitive literal `DELETE`; `deleteCommunityRecipes` must be a boolean. Reject missing fields, wrong values/types, and every unknown field. In particular, `deletePublishedCommunityRecipes` is not an accepted alias. The deletion target comes only from the verified JWT `sub`, never from the request. Return `204` after every selected deletion and cleanup step in this request has completed. This response does not wait for operations admitted before lock acquisition and does not guarantee that they cannot write afterward. Invalid request bodies return `400`; missing/invalid authentication returns `401`; an active deletion lease returns retryable `409`; retryable storage or deletion failures return `503`. Failure responses use stable machine-readable codes and a safe German message, without internal details or user data. Hand the exact response schema and codes to F1 before F1 starts.

**Binding lock and already-running-write behavior:** The short-lived per-user lease remains an admission gate and concurrency control for deletion; do not add a persistent journal, phase/progress state, recipe choice, or resume state. Protected HTTP operations that begin while the lease is active are rejected through the shared auth/handler path (the deletion operation is the sole exception). Operations admitted before lock acquisition are outside the deletion completion boundary: do not cancel them, wait for them to settle, drain their operation tokens, or add post-await write guards that coordinate them with deletion. They may continue and their writes may commit after `204`.

Queue scheduling must not enqueue work that begins for a locked user. A queue worker that begins processing while the lock is active must not process or recreate a deleted item. A queue/scheduler operation already running before lock acquisition is not drained or awaited and may finish afterward; any later worker processing still follows the locked-user and missing-item checks. Release the deletion lock after this request's selected cleanup steps finish. The lock blocks newly admitted work during that interval but provides no guarantee against writes from older admitted work after the lock is released.

Required Knowledge Base: `docs/kb/tech/02-backend.md`, `docs/kb/tech/05-authentication.md`, `docs/kb/tech/08-testing.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/domain/02-diary.md`, `docs/kb/domain/06-recipes.md`.

Required Repository Context: `backend/src/functions/profile.ts`, `backend/src/lib/auth.ts`, `backend/src/lib/cosmos.ts`, `backend/src/lib/repositories/`, `backend/src/lib/storage.ts`, `backend/src/functions/reusableItemsEnrich.ts`, `backend/src/functions/reusableItemsEnrichScheduler.ts`, `backend/src/lib/queueClient.ts`, `backend/src/lib/http.ts`.

Required Skills: `cosmos-data-model-and-migration`, `privacy-impact-review`.

Relevant Acceptance Criteria:
- **AC-5: Aktive FitTrack-Fachdaten löschen.** Nach Bestätigung löscht die automatisierte Funktion sämtliche dem authentifizierten Nutzer zugeordneten aktiven FitTrack-Fachdaten in den ermittelten Datenbanken und Speichern. Das Löschziel stammt ausschließlich aus der serverseitig geprüften Identität. Die automatisierte Funktion ruft Microsoft Graph nicht auf. Eine etwaige Entra-Nacharbeit bleibt interne manuelle PO-Aufgabe und wird nicht in der Nutzerführung oder Datenschutzerklärung erwähnt. Freundschaften sind Zukunftsfunktion und nicht Teil dieser Story.
- **AC-6: Bilder und Dateien löschen.** Zugehörige persönliche Bilder und Dateien werden mit den normalen FitTrack-Anwendungsoperationen aus den aktiven Storage-Pfaden gelöscht. Dateien, die für erhaltene Community-Rezepte benötigt werden, werden in einen neutralen Community-Pfad übertragen und bleiben erhalten. Azure Blob Soft Delete wird nicht gezielt umgangen oder global geändert. Eine Plattform-Wiederherstellungskopie kann gemäß bestehender IaC-Konfiguration noch bis zu sieben Tage vorhanden sein.
- **AC-7: Erhaltene Community-Rezepte anonym anzeigen.** Bei Toggle **„Nein“** bleiben die veröffentlichten Community-Rezepte einschließlich ihrer Inhalte und benötigten Bilder für die Community nutzbar. Die aktive FitTrack-Persistenz enthält keine persönliche Nutzer-ID-/Owner-/Namenszuordnung zum gelöschten Nutzer. Persönliche Bibliotheksverknüpfungen werden aus den erhaltenen Community-Dokumenten entfernt. Der Autor wird als **„Anonymous“** angezeigt.
- **AC-8: Ausgewählte Community-Rezepte löschen.** Bei Toggle **„Ja“** werden zusätzlich alle eigenen veröffentlichten Community-Rezepte und ausschließlich dafür benötigten Dateien gelöscht. Die Rezepte sind anschließend über Community-Liste, Detail und Bildroute nicht verfügbar. Fremde Favoriten und bereits gespeicherte Tagebuch-Snapshots bleiben bestehen. Ein fremder Favorit auf ein gelöschtes Rezept bleibt erhalten, öffnet aber kein gelöschtes Rezept.
- **AC-9: Löschvorgang und Fehler behandeln.** Während der Löschung wird ein Fortschrittszustand angezeigt; Eingaben und erneute Auslösung sind gesperrt. Eine Erfolgsmeldung erscheint erst nach vollständigem Abschluss aller eingeschlossenen Backend-Schritte. Bei einem Fehler erhält der Nutzer eine verständliche Meldung und eine Retry-Aktion. Der Retry wiederholt denselben vollständigen Löschaufruf idempotent von vorn. Bis zum bestätigten Servererfolg bleiben angemeldeter Zustand, Tokens und lokale Daten erhalten. Es gibt keine persistente Löschjob-/Tombstone-Tabelle und keine Garantie für eine automatische Wiederaufnahme nach Sitzungsausfall.
- **AC-12: Retention-Ausnahmen.** Application-Insights-/Telemetry-Einträge werden nicht gezielt gelöscht und folgen ihrer konfigurierten Retention, derzeit 30 Tage. Bestehende Backups werden nicht verändert. Azure Blob Soft Delete und seine bestehende 7-Tage-Konfiguration werden nicht geändert; die Story behauptet keine sofortige physikalische Unwiederbringlichkeit.

Package-specific implementation boundary: The TTL lease is only a short-lived concurrency/admission lock. It contains no deletion phase, progress, recipe choice, or resume state; it is not a persistent deletion journal. A client retry with a still-usable session repeats the complete idempotent request from the beginning. The exact `{ "confirmation": "DELETE", "deleteCommunityRecipes": boolean }` contract correction and no-drain behavior are reported complete; do not restore the old alias or add draining. Operations admitted before lock acquisition are not coordinated and may write after `204`; this is the accepted residual. Preserve existing changes and evidence.

Dependencies:
- B1 handoff describing the ownerless container/model and migration/read contract.
- Infrastructure I1 confirms the new container is provisioned in Dev before any Dev deployment or execution uses it.

**Expected Handoff:**
- Strict request/response contract for `DELETE /api/profile`, including validation, status codes, stable error codes, and retry semantics for Frontend.
- Confirmation that cleanup targets only the authenticated user's exact `users` ID and `nutritionProfiles` partition; make no claim that either container currently contains or does not contain such records. No remote inventory is required.
- Idempotent deletion and community-transfer behavior, plus evidence that new protected operations are rejected while the lease is active and queue work starting during deletion does not recreate deleted items. Verify that deletion does not wait for or drain operations admitted before lock acquisition. Do not add a race test or completion claim asserting that such older operations cannot write after `204`; that late-write risk is an accepted scope limitation.
- Backend unit/handler-test and build-verification results; state Cosmos-Emulator-Contract-Test verification as **UNVERIFIED** because no emulator is available, without treating that absence alone as a blocker.
- Updated API/Knowledge Base documentation handoff for D1.

**B2 handoff/status (reported 2026-10-21):** Backend reports the exact two-field request contract is implemented: `{ confirmation: "DELETE", deleteCommunityRecipes: boolean }`; the old alias is rejected. Focused tests (9 files/189 tests), backend `build:verify`, and the full unit suite passed (exit 0). Preserve all existing B2 worktree changes. The accepted residual is that operations admitted before lock acquisition are not drained or awaited and may write after cleanup or `204`; this is not a blocker and is not a guarantee that late writes are impossible. B2 is reported complete under this contract. Emulator contracts remain **UNVERIFIED** and are not a blanket blocker; no remote legacy-document inventory is required.

## 12. Frontend Work Package

Agent: Frontend

**Goal:** Profilaktion und Lösch-UX mit bestätigtem API-Vertrag und wiederholbarem Backend-Fehlerzustand erhalten; nach `204` lokale Bereinigung best-effort versuchen und einen flüchtigen Einmalhinweis statt dauerhafter lokaler Wiederherstellung umsetzen.

Required Knowledge Base: `docs/kb/tech/03-mobile.md`, `docs/kb/tech/05-authentication.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/product/03-design-system.md`, `docs/kb/product/05-ux-patterns.md`.

Required Repository Context: `mobile/src/modules/profile/ProfileEditScreen.tsx`, `mobile/src/modules/profile/ProfileEditScreen.test.tsx`, `mobile/src/shared/api/profileApi.ts`, `mobile/src/shared/api/client.ts`, `mobile/src/services/authService.ts`, `mobile/src/modules/auth/useAuthStore.ts`, `mobile/src/modules/profile/ProfileWizardScreen.tsx`, `mobile/src/app/navigation/RootNavigator.tsx`, `mobile/src/services/health/healthSyncService.ts`, `mobile/src/services/health/nutritionSyncService.ts`, `mobile/src/services/health/syncLogger.ts`, `mobile/src/shared/components/ConfirmSheet.tsx`, `mobile/src/app/theme/`.

Required Skills: `privacy-impact-review`.

Relevant Acceptance Criteria:
- **AC-1: Bestehende Profilaktion aktivieren.** Die derzeit deaktivierte Konto-Löschaktion im Profil ist aktiv und öffnet ein Bestätigungs-Overlay. Sie startet nicht schon beim Öffnen einen Löschrequest.
- **AC-2: Auf die Löschung hinweisen.** Das Overlay trägt den Titel **„Profil endgültig löschen?“** und zeigt den genehmigten Hinweistext:

  > Dein FitTrack-Profil und deine persönlichen FitTrack-Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
  >
  > Gib zur Bestätigung DELETE ein.

  Es gibt keinen separaten Hinweis auf Entra-Nacharbeit oder interne Request-Abläufe. Die Aussage „nicht rückgängig“ bezieht sich auf die in FitTrack verfügbare Anwendungslöschung; sie behauptet keine sofortige physikalische Entfernung von Azure-Plattform-Retention.
- **AC-3: Community-Rezepte optional löschen.** Hat der Nutzer eigene veröffentlichte Community-Rezepte, erscheint der Toggle **„Auch meine Community Rezepte löschen“**. Der Toggle steht bei jedem Öffnen des Overlays standardmäßig auf **„Nein“**. Der ergänzende Hinweis lautet exakt: **„Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten, sofern du sie nicht ebenfalls löschst.“** Nur wenn der Nutzer den Toggle auf **„Ja“** setzt, werden auch seine veröffentlichten Community-Rezepte gelöscht. Ohne eigene veröffentlichte Community-Rezepte werden Toggle und ergänzender Hinweis ausgeblendet.
- **AC-4: Bewusste Bestätigung verlangen.** Das Overlay enthält ein Eingabefeld sowie die Aktionen **„Abbrechen“** und **„Endgültig löschen“**. „Endgültig löschen“ ist erst aktiviert, wenn der Eingabewert exakt `DELETE` in Großbuchstaben entspricht. Erst ein anschließender Klick auf „Endgültig löschen“ startet die Löschung. Abbrechen, Schließen, Backdrop oder Plattform-Back vor dem Start verändern keine Daten und senden keinen Request.
- **AC-9: Löschvorgang und Fehler behandeln.** Während der Löschung wird ein Fortschrittszustand angezeigt; Eingaben und erneute Auslösung sind gesperrt. Eine Erfolgsmeldung erscheint erst nach vollständigem Abschluss aller eingeschlossenen Backend-Schritte. Bei einem Fehler erhält der Nutzer eine verständliche Meldung und eine Retry-Aktion. Der Retry wiederholt denselben vollständigen Löschaufruf idempotent von vorn. Bis zum bestätigten Servererfolg bleiben angemeldeter Zustand, Tokens und lokale Daten erhalten. Es gibt keine persistente Löschjob-/Tombstone-Tabelle und keine Garantie für eine automatische Wiederaufnahme nach Sitzungsausfall.
- **Revidiertes AC-10: Lokale Bereinigung best-effort.** Erst nach `204` versucht Mobile einmal, `fittrack:skip_wizard`, `hc:weight:sync`, `hc:nutrition:sync`, `hc:sync:log` und beide SecureStore-Tokens zu entfernen und die laufenden Sync-Services zurückzusetzen. Es meldet die aktuelle Sitzung unabhängig von Teilerfolgen ab und zeigt Login. Bei mindestens einem erkannten Fehler erscheint der freigegebene Hinweis genau einmal in der laufenden App. Kein dauerhafter Marker, keine Startup-Sperre, kein lokaler Retry und kein zweiter `DELETE /api/profile`-Aufruf. Force-Close kann einen Restzustand zurücklassen; ein überlebender Token kann beim Neustart authentifizieren, und eine überlebende Queue kann beim nächsten aktiven App-Zustand erneut nach Health Connect drainiert werden. Health-Connect-Datensätze, Berechtigungen und Medienexporte werden nicht entfernt.

Dependencies:
- B2 handoff containing the exact request/response contract, error codes, and retry semantics.

**Expected Handoff:**
- Dialog/API behavior matching AC-1 through AC-4.
- Backend-Fehler-Retry sendet unverändert den vollständigen Body; bis zum `204` bleiben Sitzung und lokale Daten bestehen. Nach `204` werden alle lokalen Cleanup-Schritte einmal versucht; ein lokaler Fehler führt zu Login plus genau einem flüchtigen Hinweis und niemals zu einem zweiten `DELETE /api/profile`.
- Bericht der Fälle, die nach Force-Close bei überlebendem Token/Queue eintreten können, einschließlich Same-`sub`-Login, ausbleibendem Wizard bei erhaltenem `fittrack:skip_wizard` und Health-Connect-Queue-Drain. Keine Behauptung, dass lokale Reste ausgeschlossen sind.
- Mobile unit-test and `npx tsc --noEmit` results for the affected package.
- Privacy handoff states which local deletion operations were attempted and which failed; it does not claim complete device cleanup. Health Connect exports/permissions remain outside deletion scope.

## 13. Infrastructure & Release Work Package

Agent: Infrastructure

**Goal:** Neues `communityRecipes`-Cosmos-Containerresource nach Backend-Spezifikation in IaC ergänzen und zuerst in Dev bereitstellen. Keine Storage-Retention, Application-Insights-Retention, Backup-Konfiguration oder Entra-Ressource ändern.

Required Knowledge Base: `docs/kb/tech/07-infrastructure.md`, `docs/kb/tech/01-system-overview.md`.

Required Repository Context: `infra/modules/cosmos.bicep`, `infra/parameters/dev.bicepparam`, `infra/parameters/alpha.bicepparam`, `backend/src/lib/cosmos.ts`.

Required Skills: None.

Relevant Acceptance Criteria:
- **AC-6: Bilder und Dateien löschen.** Zugehörige persönliche Bilder und Dateien werden mit den normalen FitTrack-Anwendungsoperationen aus den aktiven Storage-Pfaden gelöscht. Dateien, die für erhaltene Community-Rezepte benötigt werden, werden in einen neutralen Community-Pfad übertragen und bleiben erhalten. Azure Blob Soft Delete wird nicht gezielt umgangen oder global geändert. Eine Plattform-Wiederherstellungskopie kann gemäß bestehender IaC-Konfiguration noch bis zu sieben Tage vorhanden sein.
- **AC-7: Erhaltene Community-Rezepte anonym anzeigen.** Bei Toggle **„Nein“** bleiben die veröffentlichten Community-Rezepte einschließlich ihrer Inhalte und benötigten Bilder für die Community nutzbar. Die aktive FitTrack-Persistenz enthält keine persönliche Nutzer-ID-/Owner-/Namenszuordnung zum gelöschten Nutzer. Persönliche Bibliotheksverknüpfungen werden aus den erhaltenen Community-Dokumenten entfernt. Der Autor wird als **„Anonymous“** angezeigt.
- **AC-12: Retention-Ausnahmen.** Application-Insights-/Telemetry-Einträge werden nicht gezielt gelöscht und folgen ihrer konfigurierten Retention, derzeit 30 Tage. Bestehende Backups werden nicht verändert. Azure Blob Soft Delete und seine bestehende 7-Tage-Konfiguration werden nicht geändert; die Story behauptet keine sofortige physikalische Unwiederbringlichkeit.

Dependencies:
- B1 handoff with `containerName`, partition key, and index-policy note.

Stop Conditions:
- Do not provision until the B1 container specification is complete and matches the backend container definition.
- Apply only the additive Dev infrastructure change in I1; do not apply Alpha infrastructure or deploy backend code to Alpha in this package.
- Stop and report an authentication or deployment failure; do not proceed as if the container exists.

**Expected Handoff:**
- Bicep change and successful Dev provisioning confirmation.
- Confirmation that container name, `/id` partition key, and index policy match B1's handoff.
- Confirmation that Alpha was not applied. Alpha requires a separate explicit `Deploy to Alpha` request; apply Alpha infrastructure before deploying backend code that uses the container.

## 14. Documentation Work Package

### D1 — Backend, Domain, API und Privacy

Agent: Backend

**Goal:** Backend-, Domain-, API- und Privacy-Dokumentation auf bestätigte Datenpfade, Community-Modell, API-Vertrag und Retention aktualisieren. Die neue Policy-Fassung aus Abschnitt 20 ist vorgeschlagen und benötigt vor einer Änderung unter `docs/legal/` ausdrückliche Freigabe. Interne technische Dokumentation bleibt hinsichtlich des akzeptierten Late-Write-Risikos wahrheitsgemäß; dieses Detail erscheint nicht in Legal- oder In-App-Texten.

Required Knowledge Base: `docs/kb/README.md`, `docs/kb/tech/01-system-overview.md`, `docs/kb/tech/02-backend.md`, `docs/kb/tech/07-infrastructure.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/domain/06-recipes.md`.

Required Repository Context: `docs/kb/tech/02-backend.md`, `docs/kb/tech/07-infrastructure.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/domain/06-recipes.md`, `docs/legal/datenschutzerklaerung-alpha.md`, `backend/src/functions/profile.ts`, `backend/src/lib/cosmos.ts`, `backend/src/lib/repositories/cosmosRecipesRepository.ts`, `infra/modules/cosmos.bicep`, `infra/modules/storage.bicep`, `infra/modules/appinsights.bicep`.

Required Skills: `privacy-impact-review`, `cosmos-data-model-and-migration`.

Relevant Acceptance Criteria:
- **AC-5: Aktive FitTrack-Fachdaten löschen.** Nach Bestätigung löscht die automatisierte Funktion sämtliche dem authentifizierten Nutzer zugeordneten aktiven FitTrack-Fachdaten in den ermittelten Datenbanken und Speichern. Das Löschziel stammt ausschließlich aus der serverseitig geprüften Identität. Die automatisierte Funktion ruft Microsoft Graph nicht auf. Eine etwaige Entra-Nacharbeit bleibt interne manuelle PO-Aufgabe und wird nicht in der Nutzerführung oder Datenschutzerklärung erwähnt. Freundschaften sind Zukunftsfunktion und nicht Teil dieser Story.
- **AC-6: Bilder und Dateien löschen.** Zugehörige persönliche Bilder und Dateien werden mit den normalen FitTrack-Anwendungsoperationen aus den aktiven Storage-Pfaden gelöscht. Dateien, die für erhaltene Community-Rezepte benötigt werden, werden in einen neutralen Community-Pfad übertragen und bleiben erhalten. Azure Blob Soft Delete wird nicht gezielt umgangen oder global geändert. Eine Plattform-Wiederherstellungskopie kann gemäß bestehender IaC-Konfiguration noch bis zu sieben Tage vorhanden sein.
- **AC-7: Erhaltene Community-Rezepte anonym anzeigen.** Bei Toggle **„Nein“** bleiben die veröffentlichten Community-Rezepte einschließlich ihrer Inhalte und benötigten Bilder für die Community nutzbar. Die aktive FitTrack-Persistenz enthält keine persönliche Nutzer-ID-/Owner-/Namenszuordnung zum gelöschten Nutzer. Persönliche Bibliotheksverknüpfungen werden aus den erhaltenen Community-Dokumenten entfernt. Der Autor wird als **„Anonymous“** angezeigt.
- **AC-8: Ausgewählte Community-Rezepte löschen.** Bei Toggle **„Ja“** werden zusätzlich alle eigenen veröffentlichten Community-Rezepte und ausschließlich dafür benötigten Dateien gelöscht. Die Rezepte sind anschließend über Community-Liste, Detail und Bildroute nicht verfügbar. Fremde Favoriten und bereits gespeicherte Tagebuch-Snapshots bleiben bestehen. Ein fremder Favorit auf ein gelöschtes Rezept bleibt erhalten, öffnet aber kein gelöschtes Rezept.
- **AC-9: Löschvorgang und Fehler behandeln.** Während der Löschung wird ein Fortschrittszustand angezeigt; Eingaben und erneute Auslösung sind gesperrt. Eine Erfolgsmeldung erscheint erst nach vollständigem Abschluss aller eingeschlossenen Backend-Schritte. Bei einem Fehler erhält der Nutzer eine verständliche Meldung und eine Retry-Aktion. Der Retry wiederholt denselben vollständigen Löschaufruf idempotent von vorn. Bis zum bestätigten Servererfolg bleiben angemeldeter Zustand, Tokens und lokale Daten erhalten. Es gibt keine persistente Löschjob-/Tombstone-Tabelle und keine Garantie für eine automatische Wiederaufnahme nach Sitzungsausfall.
- **AC-12: Retention-Ausnahmen.** Application-Insights-/Telemetry-Einträge werden nicht gezielt gelöscht und folgen ihrer konfigurierten Retention, derzeit 30 Tage. Bestehende Backups werden nicht verändert. Azure Blob Soft Delete und seine bestehende 7-Tage-Konfiguration werden nicht geändert; die Story behauptet keine sofortige physikalische Unwiederbringlichkeit.

Dependencies:
- B1, B2, F1, and Dev-only I1 handoffs are reported complete; document only behavior confirmed by those handoffs and repository/infrastructure facts.
- Internal API/domain documentation must describe the success boundary and accepted possibility that pre-lock work writes after `204`; reconcile the current `[Partial]` technical warning in `docs/kb/domain/06-recipes.md`. Do not copy that internal detail into the privacy policy or user-facing copy.
- The 2026-10-21 approval covered the earlier wording, which is now inaccurate for best-effort local cleanup. Obtain explicit approval of the proposed replacement in Section 20 before editing `docs/legal/`; update the policy date only in that approved edit. The 2026-10-22 transient notice itself is authorized and needs no further product wording decision.

**Expected Handoff:**
- Updated backend, domain, API, and infrastructure Knowledge Base pages with implemented behavior marked as current only after confirmation.
- Confirmed retention facts and a concise documentation diff summary.
- If policy wording is explicitly approved, update the German policy and date to match Section 20; otherwise leave `docs/legal/` unchanged and report the approval as pending.

### D2 — Mobile und In-App Privacy

Agent: Frontend

**Goal:** Mobile-KB, In-App-Datenschutzhinweis und Löschdialog mit dem revidierten Best-Effort-Verhalten synchronisieren. Dialog und Datenschutztext enthalten weder Entra-Nacharbeit noch interne Details zu bereits gestarteten Vorgängen; die Warnung bleibt von der dauerhaften Policy getrennt.

Required Knowledge Base: `docs/kb/tech/03-mobile.md`, `docs/kb/product/05-ux-patterns.md`.

Required Repository Context: `docs/kb/tech/03-mobile.md`, `docs/kb/product/05-ux-patterns.md`, `mobile/src/modules/profile/ProfileEditScreen.tsx`, `mobile/src/modules/legal/legalTexts.ts`, `mobile/src/modules/legal/`, `mobile/src/services/authService.ts`, `mobile/src/modules/auth/useAuthStore.ts`, `mobile/src/services/health/healthSyncService.ts`, `mobile/src/services/health/nutritionSyncService.ts`, `mobile/src/services/health/syncLogger.ts`, `docs/legal/datenschutzerklaerung-alpha.md`.

Required Skills: `privacy-impact-review`.

Relevant Acceptance Criteria:
- **AC-1: Bestehende Profilaktion aktivieren.** Die derzeit deaktivierte Konto-Löschaktion im Profil ist aktiv und öffnet ein Bestätigungs-Overlay. Sie startet nicht schon beim Öffnen einen Löschrequest.
- **AC-2: Auf die Löschung hinweisen.** Das Overlay trägt den Titel **„Profil endgültig löschen?“** und zeigt den genehmigten Hinweistext:

  > Dein FitTrack-Profil und deine persönlichen FitTrack-Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
  >
  > Gib zur Bestätigung DELETE ein.

  Es gibt keinen separaten Hinweis auf Entra-Nacharbeit oder interne Request-Abläufe. Die Aussage „nicht rückgängig“ bezieht sich auf die in FitTrack verfügbare Anwendungslöschung; sie behauptet keine sofortige physikalische Entfernung von Azure-Plattform-Retention.
- **AC-3: Community-Rezepte optional löschen.** Hat der Nutzer eigene veröffentlichte Community-Rezepte, erscheint der Toggle **„Auch meine Community Rezepte löschen“**. Der Toggle steht bei jedem Öffnen des Overlays standardmäßig auf **„Nein“**. Der ergänzende Hinweis lautet exakt: **„Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten, sofern du sie nicht ebenfalls löschst.“** Nur wenn der Nutzer den Toggle auf **„Ja“** setzt, werden auch seine veröffentlichten Community-Rezepte gelöscht. Ohne eigene veröffentlichte Community-Rezepte werden Toggle und ergänzender Hinweis ausgeblendet.
- **AC-4: Bewusste Bestätigung verlangen.** Das Overlay enthält ein Eingabefeld sowie die Aktionen **„Abbrechen“** und **„Endgültig löschen“**. „Endgültig löschen“ ist erst aktiviert, wenn der Eingabewert exakt `DELETE` in Großbuchstaben entspricht. Erst ein anschließender Klick auf „Endgültig löschen“ startet die Löschung. Abbrechen, Schließen, Backdrop oder Plattform-Back vor dem Start verändern keine Daten und senden keinen Request.
- **AC-5: Aktive FitTrack-Fachdaten löschen.** Nach Bestätigung löscht die automatisierte Funktion sämtliche dem authentifizierten Nutzer zugeordneten aktiven FitTrack-Fachdaten in den ermittelten Datenbanken und Speichern. Das Löschziel stammt ausschließlich aus der serverseitig geprüften Identität. Die automatisierte Funktion ruft Microsoft Graph nicht auf. Eine etwaige Entra-Nacharbeit bleibt interne manuelle PO-Aufgabe und wird nicht in der Nutzerführung oder Datenschutzerklärung erwähnt. Freundschaften sind Zukunftsfunktion und nicht Teil dieser Story.
- **AC-6: Bilder und Dateien löschen.** Zugehörige persönliche Bilder und Dateien werden mit den normalen FitTrack-Anwendungsoperationen aus den aktiven Storage-Pfaden gelöscht. Dateien, die für erhaltene Community-Rezepte benötigt werden, werden in einen neutralen Community-Pfad übertragen und bleiben erhalten. Azure Blob Soft Delete wird nicht gezielt umgangen oder global geändert. Eine Plattform-Wiederherstellungskopie kann gemäß bestehender IaC-Konfiguration noch bis zu sieben Tage vorhanden sein.
- **AC-7: Erhaltene Community-Rezepte anonym anzeigen.** Bei Toggle **„Nein“** bleiben die veröffentlichten Community-Rezepte einschließlich ihrer Inhalte und benötigten Bilder für die Community nutzbar. Die aktive FitTrack-Persistenz enthält keine persönliche Nutzer-ID-/Owner-/Namenszuordnung zum gelöschten Nutzer. Persönliche Bibliotheksverknüpfungen werden aus den erhaltenen Community-Dokumenten entfernt. Der Autor wird als **„Anonymous“** angezeigt.
- **AC-8: Ausgewählte Community-Rezepte löschen.** Bei Toggle **„Ja“** werden zusätzlich alle eigenen veröffentlichten Community-Rezepte und ausschließlich dafür benötigten Dateien gelöscht. Die Rezepte sind anschließend über Community-Liste, Detail und Bildroute nicht verfügbar. Fremde Favoriten und bereits gespeicherte Tagebuch-Snapshots bleiben bestehen. Ein fremder Favorit auf ein gelöschtes Rezept bleibt erhalten, öffnet aber kein gelöschtes Rezept.
- **AC-9: Löschvorgang und Fehler behandeln.** Während der Löschung wird ein Fortschrittszustand angezeigt; Eingaben und erneute Auslösung sind gesperrt. Eine Erfolgsmeldung erscheint erst nach vollständigem Abschluss aller eingeschlossenen Backend-Schritte. Bei einem Fehler erhält der Nutzer eine verständliche Meldung und eine Retry-Aktion. Der Retry wiederholt denselben vollständigen Löschaufruf idempotent von vorn. Bis zum bestätigten Servererfolg bleiben angemeldeter Zustand, Tokens und lokale Daten erhalten. Es gibt keine persistente Löschjob-/Tombstone-Tabelle und keine Garantie für eine automatische Wiederaufnahme nach Sitzungsausfall.
- **AC-12: Retention-Ausnahmen.** Application-Insights-/Telemetry-Einträge werden nicht gezielt gelöscht und folgen ihrer konfigurierten Retention, derzeit 30 Tage. Bestehende Backups werden nicht verändert. Azure Blob Soft Delete und seine bestehende 7-Tage-Konfiguration werden nicht geändert; die Story behauptet keine sofortige physikalische Unwiederbringlichkeit.

Dependencies:
- F1-R3 implementation and test handoff after fresh plan approval.
- Der Warnhinweis ist durch die PO-Klarstellung autorisiert. Der vorgeschlagene dauerhafte Legal-Policy-Text in Section 20 ist vor einer tatsächlichen Änderung unter `docs/legal/` separat ausdrücklich freizugeben.

**Expected Handoff:**
- Aktualisierte Mobile-/UX-KB mit Best-Effort-Grenze, Restart-/Queue-Rest und korrekter Entra-Eigentümerschaft; keine Änderung an QA-Historie.
- Transienter Warnhinweis entspricht AC-13. Dauerhafter Policy-Text wird erst nach separater ausdrücklicher Policy-Freigabe geändert und nennt keine automatische Deinstallation-Löschung.
- Legal-Copy-Test wird auf den aktuellen Text ausgerichtet; komplette Mobile-Suite muss anschließend grün sein.

## 15. QA Work Package

Agent: QA

**Goal:** Story-Akzeptanz über Backend, verfügbare Persistenz-Evidence, Mobile, Community-Verweise, Retention-Dokumentation sowie Backend- und lokale Best-Effort-Fehlerpfade prüfen. Kein Entra-Graph-Live-Delete und keine fremde Nutzerdatenlöschung. Keine Emulator-Einrichtung und keine Remote-Inventur.
- **AC-13: Hinweis und Backup-/Deinstallationsgrenze.** Verifiziere den PO-freigegebenen transienten Hinweis genau einmal bei erkanntem lokalem Cleanup-Fehler. Er darf keine automatische Löschung bei Deinstallation behaupten und darf Health-Connect-Datensätze, Berechtigungen oder Medienexporte nicht als gelöscht darstellen.

Required Knowledge Base: `docs/kb/tech/08-testing.md`, `docs/kb/tech/05-authentication.md`, `docs/kb/tech/07-infrastructure.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/tech/03-mobile.md`, `docs/kb/domain/02-diary.md`, `docs/kb/domain/06-recipes.md`, `docs/kb/product/03-design-system.md`, `docs/kb/product/05-ux-patterns.md`.

Required Repository Context: `backend/src/functions/profile.ts`, `backend/src/functions/profile.test.ts`, `backend/src/lib/repositories/profileDeletionRepository.ts`, `backend/src/lib/repositories/profileDeletionRepository.test.ts`, `backend/src/lib/repositories/profileDeletionRepository.contract.test.ts`, `backend/src/functions/reusableItemsEnrich.ts`, `backend/src/functions/reusableItemsEnrichScheduler.ts`, corresponding queue/scheduler tests, `infra/modules/cosmos.bicep`, `infra/modules/storage.bicep`, `infra/modules/appinsights.bicep`, `mobile/src/modules/profile/ProfileEditScreen.tsx`, `mobile/src/modules/profile/ProfileEditScreen.test.tsx`, `mobile/src/shared/api/client.test.ts`, `mobile/src/services/health/healthSyncService.test.ts`, `mobile/src/services/health/nutritionSyncService.ts`, `mobile/src/services/health/syncLogger.ts`, `mobile/src/modules/legal/legalTexts.ts`, `docs/legal/datenschutzerklaerung-alpha.md`, and the `docs/kb/` pages listed above.

Required Skills: `privacy-impact-review`, `cosmos-data-model-and-migration`.

Relevant Acceptance Criteria:
- **AC-1: Bestehende Profilaktion aktivieren.** Die derzeit deaktivierte Konto-Löschaktion im Profil ist aktiv und öffnet ein Bestätigungs-Overlay. Sie startet nicht schon beim Öffnen einen Löschrequest.
- **AC-2: Auf die Löschung hinweisen.** Das Overlay trägt den Titel **„Profil endgültig löschen?“** und zeigt den genehmigten Hinweistext:

  > Dein FitTrack-Profil und deine persönlichen FitTrack-Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
  >
  > Gib zur Bestätigung DELETE ein.

  Es gibt keinen separaten Hinweis auf Entra-Nacharbeit oder interne Request-Abläufe. Die Aussage „nicht rückgängig“ bezieht sich auf die in FitTrack verfügbare Anwendungslöschung; sie behauptet keine sofortige physikalische Entfernung von Azure-Plattform-Retention.
- **AC-3: Community-Rezepte optional löschen.** Hat der Nutzer eigene veröffentlichte Community-Rezepte, erscheint der Toggle **„Auch meine Community Rezepte löschen“**. Der Toggle steht bei jedem Öffnen des Overlays standardmäßig auf **„Nein“**. Der ergänzende Hinweis lautet exakt: **„Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten, sofern du sie nicht ebenfalls löschst.“** Nur wenn der Nutzer den Toggle auf **„Ja“** setzt, werden auch seine veröffentlichten Community-Rezepte gelöscht. Ohne eigene veröffentlichte Community-Rezepte werden Toggle und ergänzender Hinweis ausgeblendet.
- **AC-4: Bewusste Bestätigung verlangen.** Das Overlay enthält ein Eingabefeld sowie die Aktionen **„Abbrechen“** und **„Endgültig löschen“**. „Endgültig löschen“ ist erst aktiviert, wenn der Eingabewert exakt `DELETE` in Großbuchstaben entspricht. Erst ein anschließender Klick auf „Endgültig löschen“ startet die Löschung. Abbrechen, Schließen, Backdrop oder Plattform-Back vor dem Start verändern keine Daten und senden keinen Request.
- **AC-5: Aktive FitTrack-Fachdaten löschen.** Nach Bestätigung löscht die automatisierte Funktion sämtliche dem authentifizierten Nutzer zugeordneten aktiven FitTrack-Fachdaten in den ermittelten Datenbanken und Speichern. Das Löschziel stammt ausschließlich aus der serverseitig geprüften Identität. Die automatisierte Funktion ruft Microsoft Graph nicht auf. Eine etwaige Entra-Nacharbeit bleibt interne manuelle PO-Aufgabe und wird nicht in der Nutzerführung oder Datenschutzerklärung erwähnt. Freundschaften sind Zukunftsfunktion und nicht Teil dieser Story.
- **AC-6: Bilder und Dateien löschen.** Zugehörige persönliche Bilder und Dateien werden mit den normalen FitTrack-Anwendungsoperationen aus den aktiven Storage-Pfaden gelöscht. Dateien, die für erhaltene Community-Rezepte benötigt werden, werden in einen neutralen Community-Pfad übertragen und bleiben erhalten. Azure Blob Soft Delete wird nicht gezielt umgangen oder global geändert. Eine Plattform-Wiederherstellungskopie kann gemäß bestehender IaC-Konfiguration noch bis zu sieben Tage vorhanden sein.
- **AC-7: Erhaltene Community-Rezepte anonym anzeigen.** Bei Toggle **„Nein“** bleiben die veröffentlichten Community-Rezepte einschließlich ihrer Inhalte und benötigten Bilder für die Community nutzbar. Die aktive FitTrack-Persistenz enthält keine persönliche Nutzer-ID-/Owner-/Namenszuordnung zum gelöschten Nutzer. Persönliche Bibliotheksverknüpfungen werden aus den erhaltenen Community-Dokumenten entfernt. Der Autor wird als **„Anonymous“** angezeigt.
- **AC-8: Ausgewählte Community-Rezepte löschen.** Bei Toggle **„Ja“** werden zusätzlich alle eigenen veröffentlichten Community-Rezepte und ausschließlich dafür benötigten Dateien gelöscht. Die Rezepte sind anschließend über Community-Liste, Detail und Bildroute nicht verfügbar. Fremde Favoriten und bereits gespeicherte Tagebuch-Snapshots bleiben bestehen. Ein fremder Favorit auf ein gelöschtes Rezept bleibt erhalten, öffnet aber kein gelöschtes Rezept.
- **AC-9: Löschvorgang und Fehler behandeln.** Während der Löschung wird ein Fortschrittszustand angezeigt; Eingaben und erneute Auslösung sind gesperrt. Eine Erfolgsmeldung erscheint erst nach vollständigem Abschluss aller eingeschlossenen Backend-Schritte. Bei einem Fehler erhält der Nutzer eine verständliche Meldung und eine Retry-Aktion. Der Retry wiederholt denselben vollständigen Löschaufruf idempotent von vorn. Bis zum bestätigten Servererfolg bleiben angemeldeter Zustand, Tokens und lokale Daten erhalten. Es gibt keine persistente Löschjob-/Tombstone-Tabelle und keine Garantie für eine automatische Wiederaufnahme nach Sitzungsausfall.
- **Revidiertes AC-10:** Verifiziere einmaligen Best-Effort-Cleanup aller genannten Schlüssel/Tokens, Login im laufenden Prozess bei lokalen Fehlern, genau einen flüchtigen Hinweis und dass lokaler Cleanup niemals den Backend-DELETE wiederholt. Verifiziere die dokumentierte Neustartgrenze bei überlebendem Token/Queue, ohne eine vollständige lokale Löschung zu verlangen.
- **AC-11: Erneute Anmeldung derselben Entra-Identität.** Verifiziere, dass ein Login mit demselben `sub` serverseitig keine gelöschten Dokumente wiederherstellt; `GET /api/profile/me` bleibt bis zur neuen Profilerstellung `null`. Prüfe die möglichen lokalen Reste: Skip-Wizard-Flag, app-weite Queues/Logs und tokenbasierte Auth-Hydration. Queue-Operationen dürfen nur als Health-Connect-Aufrufe beschrieben werden, nicht als FitTrack-Upload.
- **AC-12: Retention-Ausnahmen.** Application-Insights-/Telemetry-Einträge werden nicht gezielt gelöscht und folgen ihrer konfigurierten Retention, derzeit 30 Tage. Bestehende Backups werden nicht verändert. Azure Blob Soft Delete und seine bestehende 7-Tage-Konfiguration werden nicht geändert; die Story behauptet keine sofortige physikalische Unwiederbringlichkeit.

Dependencies:
- Latest QA remains **FAIL**; the current F1 marker-write defect and stale LegalDocumentView assertion remain in the preserved report/findings history. B1, Dev-only I1 and B2 handoffs remain reported complete. Re-review follows fresh approval of this plan revision and F1-R3/D2 work.
- No emulator or remote Cosmos test is required. Record Cosmos-specific contract verification as **UNVERIFIED**; do not make absence of an emulator a blocker by itself. If review identifies a concrete persistence risk not covered by existing unit/handler tests and the Dev infrastructure handoff, report that specific risk rather than requiring emulator setup generically.

**Expected Handoff:**
- Criteria matrix for AC-1 through AC-12 with result and workspace-relative evidence; distinguish implemented/tested behavior from Cosmos persistence semantics that remain **UNVERIFIED**.
- Criteria matrix for AC-1 through AC-13 with result and workspace-relative evidence; distinguish implemented/tested behavior from Cosmos persistence semantics that remain **UNVERIFIED**.
- Relevant existing test/build/typecheck commands, exit codes, and results; actionable findings with the QA-required fields; `UNVERIFIED` and manual checks separated from findings. No emulator setup or remote inventory.
- Verify that the deletion dialog and user-facing copy contain no instruction to manually manage Entra and no disclosure of already-started request handling. After any separately approved policy edit, verify the policy and in-app copy match the proposed best-effort behavior.
- Verify that dialog, proposed policy text, in-app copy and transient warning distinguish backend deletion from best-effort local deletion; no uninstall/backup guarantee, no instruction to manage Entra, and no disclosure of internal request timing. Keep the existing QA report and findings history intact.
- Verify same-`sub` re-login against the current code path: deleted FitTrack documents are not restored, `/profile/me` is null until a new profile is created, a surviving skip-wizard flag can suppress onboarding, and a surviving token plus enabled queue can drain to Health Connect. Confirm that these queues do not call FitTrack APIs. Record the potential stale Health Connect operation and app-wide local-state residual; do not claim platform duplicate-free behavior beyond repository evidence.
- Durable report at `docs/qa/reports/PLAN_US_Profil-und-Konto-dauerhaft-loeschen_aktualisiert.md` using the `fittrack-qa-v1` report contract.
- No claim that Entra deletion is automated.

## 16. Shared Package Changes

Keine Änderungen an `shared/` vorgesehen. Request-/Error-Typen können in Backend-/Mobile-API-Modulen lokal definiert werden, sofern kein bestehender Shared-Vertrag passt. Keine neue Drittanbieter-Abhängigkeit.

## 17. Infrastructure and Configuration

- Backend ergänzt `backend/src/lib/cosmos.ts` um `communityRecipes`, Partition-Key `/id`; die vorhandene Emulator-Testinfrastruktur wird für diese Arbeit nicht eingerichtet oder vorausgesetzt.
- Infrastructure ergänzt `infra/modules/cosmos.bicep`; keine bestehende Partition wird geändert.
- Reihenfolge: Der Dev-Container ist laut I1-Handoff provisioniert und geprüft. Backend-Unit-/Handler-Tests und Build-Verifikation sind die verfügbaren Code-Gates; kein Remote-Cosmos-Vertragstest. Alpha benötigt denselben Container vor einem späteren Backend-Deployment.
- Alpha-Infrastruktur/Backend-Deployment sind operative `Deploy to Alpha`-Aktionen und erfolgen nur nach ausdrücklicher Anforderung. Infrastructure vor Backend-Code anwenden.
- Keine Änderung an `storage.bicep` Soft Delete, `appinsights.bicep` Retention, Cosmos-Backups oder Entra-/Graph-Ressourcen.
- Keine neuen Secrets, App Settings oder nativen Berechtigungen.

## 18. Test Strategy

**Backend unit/handler tests:**
- JWT-`sub` ist einziges Löschziel; fehlender/ungültiger JWT bleibt abgewiesen.
- Strikte Body-Validierung für exakt `confirmation: DELETE` und boolesche Community-Option.
- Jedes aktive nutzerbezogene Inventar einschließlich DayMeta/Hint-State; bei `users`/`nutritionProfiles` ausschließlich exakte Nutzer-ID-/Partitionsbereinigung, falls passende Dokumente existieren. Globale Produkte und fremde Partitionen bleiben unverändert; ihre Existenz in diesen beiden Containern wird nicht behauptet.
- Wiederholung nach simuliertem Teilfehler; fehlende Dokumente/Blobs gelten als erledigt.
- Lease: paralleler Lauf erhält retrybaren Konflikt, Fehler gibt frei, abgelaufener Lock ist übernehmbar; keine Phasen-/Auswahldaten.
- Admission/queue behavior: newly beginning protected HTTP operations are rejected while the deletion lock is active; queue work beginning during the lock does not process or recreate deleted items. An operation admitted before lock acquisition is not drained or awaited.
- Community-Erhaltung entfernt Owner-/Partition-/Consent-/Namen-/Bibliotheks-IDs aus aktivem Zieldatensatz; neutrale Bilder bleiben lesbar. `true` entfernt Quelle/Ziel/Bilder idempotent.
- Fremde Tagebuch-Snapshots und Favoriten bleiben unverändert; gelöschte Community-Rezepte sind nicht abrufbar.
- Fehlerantworten enthalten keine IDs, Tokens, Exception-Details oder Rezept-/Gesundheitsinhalte.

**Cosmos persistence verification:** Die vorhandenen `*.contract.test.ts`-Suites benötigen einen lokalen Cosmos Emulator. Da laut Nutzer keiner verfügbar ist, wird keiner installiert oder konfiguriert und es wird nicht gegen Dev/Alpha Cosmos getestet. Status der Cosmos-spezifischen Vertragsprüfung: **UNVERIFIED**. Das ist allein kein Feature-Blocker: Die vorhandenen Unit-/Handler-Tests prüfen Request-Validierung, exakte Nutzerzuordnung, Idempotenz, Fehlerpfade und Handler-Verhalten; `build:verify` prüft den Backend-Build, und I1 bestätigt die Dev-Container-Provisionierung. QA meldet nur dann einen konkreten Blocker, wenn ein bestimmtes Persistenzrisiko damit nicht abgedeckt ist; keine pauschale Emulator-Pflicht.

**Concurrency unit/handler checks:** Verify that new protected work is rejected while the lock is active, that a queue worker starting during the lock does not recreate a deleted item, and that deletion completes its own cleanup without waiting for operations admitted before lock acquisition. Do not assert that a late write from an older operation is impossible; it is an accepted residual, not a release blocker. Cosmos Emulator contract verification remains **UNVERIFIED** and is not a blanket B2/QA gate. No remote legacy-document inventory is required or claimed.

**Mobile unit tests:** Toggle-Verfügbarkeit/Default `Nein`; exakte Dialogtexte; `DELETE` nur exakt in Großbuchstaben; Cancel/Backdrop/Back ohne Request; doppelte Auslösung gesperrt; Backend-Retry nutzt gleiche Payload; Backend-Fehler behält Tokens/AsyncStorage/Auth-State. Nach `204` werden alle lokalen Schritte trotz einzelner Fehler versucht, Auth-State wird im laufenden Prozess auf Login gesetzt, Fehlerhinweis erscheint einmal und ein lokaler Fehler ruft `DELETE /api/profile` nicht erneut auf. Keine persistente Marker-/Retry-UI; keine Health-Connect-Datenlöschung. Ergänze Neustart-/Same-`sub`-Checks für überlebenden Token, `fittrack:skip_wizard` und Queue-Drain als dokumentierten Residualpfad.

**Required commands:** `npm test --workspace=backend`, `npm run build:verify --workspace=backend`, betroffene Mobile-Vitest-Suite und `npx tsc --noEmit` aus `mobile/`. Contract-Tests mit Emulator sind nicht erforderlich und werden ohne vorhandenen Emulator nicht ausgeführt. Vollständige Mobile-Tests bei paketweiter Änderung von API-Interceptor/Auth-Store.

**Manual / external:** Alpha-Prüfung nur mit entbehrlichen Testdaten und ausdrücklicher Release-Autorisierung. Kein Entra-Graph-Delete-Test, Graph-Rollen-Setup oder Same-E-Mail-Test als Gate. Native Health-Connect-Daten werden nicht gelöscht.

## 19. Acceptance Criteria

**Plan-specific scope interpretation (applies to every repeated AC below):** At lock acquisition, operations already admitted by the backend are excluded from the deletion's completion boundary. The server does not drain, wait for, cancel, or coordinate those operations. `204` means all selected deletion/cleanup steps in the deletion request completed; it does not mean older operations have settled or guarantee that they cannot write afterward. A late user-scoped write after `204` is an explicitly accepted residual. Protected work that begins while the lock is active remains rejected or skipped.

### AC-1: Bestehende Profilaktion aktivieren

Die derzeit deaktivierte Konto-Löschaktion im Profil ist aktiv und öffnet ein Bestätigungs-Overlay. Sie startet nicht schon beim Öffnen einen Löschrequest.

### AC-2: Auf die Löschung hinweisen

Das Overlay trägt den Titel **„Profil endgültig löschen?“** und zeigt den genehmigten Hinweistext:

> Dein FitTrack-Profil und deine persönlichen FitTrack-Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
>
> Gib zur Bestätigung DELETE ein.

Es gibt keinen separaten Hinweis auf Entra-Nacharbeit oder interne Request-Abläufe. Die Aussage „nicht rückgängig“ bezieht sich auf die in FitTrack verfügbare Anwendungslöschung; sie behauptet keine sofortige physikalische Entfernung von Azure-Plattform-Retention.

### AC-3: Community-Rezepte optional löschen

Hat der Nutzer eigene veröffentlichte Community-Rezepte, erscheint der Toggle **„Auch meine Community Rezepte löschen“**.

- Der Toggle steht bei jedem Öffnen des Overlays standardmäßig auf **„Nein“**.
- Der ergänzende Hinweis lautet exakt: **„Deine Community-Rezepte bleiben ohne deine persönliche Namensanzeige erhalten, sofern du sie nicht ebenfalls löschst.“**
- Nur wenn der Nutzer den Toggle auf **„Ja“** setzt, werden auch seine veröffentlichten Community-Rezepte gelöscht.
- Ohne eigene veröffentlichte Community-Rezepte werden Toggle und ergänzender Hinweis ausgeblendet.

### AC-4: Bewusste Bestätigung verlangen

Das Overlay enthält ein Eingabefeld sowie die Aktionen **„Abbrechen“** und **„Endgültig löschen“**.

- „Endgültig löschen“ ist erst aktiviert, wenn der Eingabewert exakt `DELETE` in Großbuchstaben entspricht.
- Erst ein anschließender Klick auf „Endgültig löschen“ startet die Löschung.
- Abbrechen, Schließen, Backdrop oder Plattform-Back vor dem Start verändern keine Daten und senden keinen Request.

### AC-5: Aktive FitTrack-Fachdaten löschen

Nach Bestätigung löscht die automatisierte Funktion sämtliche dem authentifizierten Nutzer zugeordneten aktiven FitTrack-Fachdaten in den ermittelten Datenbanken und Speichern. Das Löschziel stammt ausschließlich aus der serverseitig geprüften Identität. Die automatisierte Funktion ruft Microsoft Graph nicht auf. Eine etwaige Entra-Nacharbeit bleibt interne manuelle PO-Aufgabe und wird nicht in der Nutzerführung oder Datenschutzerklärung erwähnt. Freundschaften sind Zukunftsfunktion und nicht Teil dieser Story.

### AC-6: Bilder und Dateien löschen

Zugehörige persönliche Bilder und Dateien werden mit den normalen FitTrack-Anwendungsoperationen aus den aktiven Storage-Pfaden gelöscht. Dateien, die für erhaltene Community-Rezepte benötigt werden, werden in einen neutralen Community-Pfad übertragen und bleiben erhalten.

Azure Blob Soft Delete wird nicht gezielt umgangen oder global geändert. Eine Plattform-Wiederherstellungskopie kann gemäß bestehender IaC-Konfiguration noch bis zu sieben Tage vorhanden sein.

### AC-7: Erhaltene Community-Rezepte anonym anzeigen

Bei Toggle **„Nein“** bleiben die veröffentlichten Community-Rezepte einschließlich ihrer Inhalte und benötigten Bilder für die Community nutzbar.

- Die aktive FitTrack-Persistenz enthält keine persönliche Nutzer-ID-/Owner-/Namenszuordnung zum gelöschten Nutzer.
- Persönliche Bibliotheksverknüpfungen werden aus den erhaltenen Community-Dokumenten entfernt.
- Der Autor wird als **„Anonymous“** angezeigt.

### AC-8: Ausgewählte Community-Rezepte löschen

Bei Toggle **„Ja“** werden zusätzlich alle eigenen veröffentlichten Community-Rezepte und ausschließlich dafür benötigten Dateien gelöscht. Die Rezepte sind anschließend über Community-Liste, Detail und Bildroute nicht verfügbar.

Fremde Favoriten und bereits gespeicherte Tagebuch-Snapshots bleiben bestehen. Ein fremder Favorit auf ein gelöschtes Rezept bleibt erhalten, öffnet aber kein gelöschtes Rezept.

### AC-9: Löschvorgang und Fehler behandeln

Während der Löschung wird ein Fortschrittszustand angezeigt; Eingaben und erneute Auslösung sind gesperrt. Eine Erfolgsmeldung erscheint erst nach vollständigem Abschluss aller eingeschlossenen Backend-Schritte.

Bei einem Fehler erhält der Nutzer eine verständliche Meldung und eine Retry-Aktion. Der Retry wiederholt denselben vollständigen Löschaufruf idempotent von vorn. Bis zum bestätigten Servererfolg bleiben angemeldeter Zustand, Tokens und lokale Daten erhalten. Es gibt keine persistente Löschjob-/Tombstone-Tabelle und keine Garantie für eine automatische Wiederaufnahme nach Sitzungsausfall. Die technische Abschlussgrenze und das akzeptierte Late-Write-Risiko sind ausschließlich in der internen technischen Scope-Interpretation oben dokumentiert.

Plan implementation clarification: A short-lived TTL lease may be used to prevent concurrent deletions and reject newly beginning protected work while deletion is active. It contains no phase, progress, selected-recipe, or resume state; it is not a persistent deletion journal. A retry with a still-usable session resends the complete idempotent request from the beginning. The lease does not drain or fence work admitted before it was acquired.

### AC-10: Lokale Bereinigung best-effort

Erst nach bestätigtem `204` versucht die App einmal, `fittrack:skip_wizard`, `hc:weight:sync`, `hc:nutrition:sync`, `hc:sync:log` und beide SecureStore-Tokens zu entfernen und beide Health-Sync-Services im Speicher zurückzusetzen. Sie meldet den aktuellen Auth-Store unabhängig von lokalen Teilerfolgen ab und zeigt Login. Ein lokaler Fehler ändert den Backend-Erfolg nicht, erzeugt keine Backend-Retry-Aktion und führt niemals zu einem zweiten `DELETE /api/profile`-Aufruf.

Wenn mindestens ein lokaler Schritt fehlschlägt, zeigt die laufende App einmalig: **„Einige private App-Daten von FitTrack konnten auf diesem Gerät nicht gelöscht werden. Du kannst die App-Daten in den Android-Einstellungen entfernen.“** Es gibt keinen persistenten Cleanup-Marker, keine Startup-Sperre und keine lokale Retry-Aktion. Nach Force-Close kann ein verbleibender gültiger Token beim nächsten Start die Sitzung wiederherstellen. Eine verbliebene Queue kann dann beim App-Aktivieren erneut Health-Connect-Operationen ausführen. Diese Best-Effort-Grenze ist ausdrücklich akzeptiert.

Bereits nach Health Connect exportierte Datensätze, Health-Connect-Berechtigungen und außerhalb des App-Sandboxes gespeicherte Medienexporte werden nicht durch diese Kontolöschung entfernt oder geändert.

### AC-11: Erneute Anmeldung derselben Entra-Identität

Eine Anmeldung mit derselben weiterhin bestehenden Entra-Identität verwendet denselben verifizierten `sub`; sie stellt keine zuvor gelöschten FitTrack-Dokumente wieder her. `GET /api/profile/me` liefert bis zum erneuten Erstellen eines Profils `null`. Ein vorhandener `fittrack:skip_wizard`-Wert kann den Erstnutzungs-Wizard weiterhin überspringen. Überlebende lokale Warteschlangen und Logs sind nicht nach `sub` getrennt. Bei überlebendem Token und aktivem Sync kann eine Queue nach Neustart wieder zu Health Connect schreiben/löschen; Queue-Inhalte werden nicht an FitTrack hochgeladen. Derselbe Entra-Account kann damit neu beginnen, aber lokale Health-Connect-Reste können veraltet sein. Diese lokale Restmöglichkeit wird nicht durch serverseitige Wiederherstellung behoben.

### AC-12: Retention-Ausnahmen

- Application-Insights-/Telemetry-Einträge werden nicht gezielt gelöscht und folgen ihrer konfigurierten Retention, derzeit 30 Tage.
- Bestehende Backups werden nicht verändert.
- Azure Blob Soft Delete und seine bestehende 7-Tage-Konfiguration werden nicht geändert; die Story behauptet keine sofortige physikalische Unwiederbringlichkeit.

### AC-13: Hinweis und Backup-/Deinstallationsgrenze

Der Einmalhinweis aus AC-10 ist flüchtige Benutzeroberfläche und kein dauerhafter Policy-Text oder Wiederherstellungsjournal. Er sagt nicht, dass eine Deinstallation alle Daten sicher entfernt. Das Android-Manifest enthält `android:allowBackup="true"`; konkrete Sicherungs-/Wiederherstellungseffekte sind im Repository nicht belegt. Der Hinweis empfiehlt ausschließlich das Entfernen der App-Daten über Android-Einstellungen. Er verspricht nicht die Löschung bereits exportierter Health-Connect-Daten, Berechtigungen oder Medien.

## 20. Privacy Impact

Privacy Impact: Policy update proposed; this is not legal advice and does not assert legal compliance. The Product Owner has authorized the best-effort behavior and transient notice, not a silent edit to `docs/legal/`.  
Data flow: Authentifizierter FitTrack-Nutzer → API mit `DELETE`-Bestätigung → aktive nutzerbezogene Cosmos-Dokumente und persönliche Blobs werden im bestätigten Backend-Lauf entfernt. Bei Auswahl zur Beibehaltung verbleiben Community-Rezepte ohne aktive Nutzer-/Eigentümerzuordnung und werden als `Anonymous` angezeigt. Nach `204` versucht Mobile einmal, lokale Wizard-/Health-Connect-Queue-/Diagnose-Schlüssel und SecureStore-Tokens zu löschen; lokale Fehler werden nicht dauerhaft protokolliert oder automatisch wiederholt. Application-Insights-/Log-Analytics-Einträge werden nicht gezielt gelöscht und folgen der konfigurierten Retention (derzeit 30 Tage). Bestehende Backups bleiben unverändert. Blob Soft Delete kann gelöschte Bilder bis zu sieben Tage als Plattform-Wiederherstellungskopien vorhalten. Kein Microsoft-Graph-Aufruf. Health-Connect-Daten, -Berechtigungen und Medienexporte sind nicht Teil der Kontolöschung.  
Policy sections affected: `Speicherdauer und Löschen` und die identische In-App-Kopie in `mobile/src/modules/legal/legalTexts.ts`. Die bestehenden Health Connect- und Anmeldung-Abschnitte bleiben ansonsten unberührt.  
Proposed replacement for the local-device note: `Nach erfolgreicher Kontolöschung versucht die App, FitTrack-Anmeldetokens, lokale Sync-Warteschlangen und das lokale Diagnoseprotokoll von deinem Gerät zu entfernen. Wenn das auf deinem Gerät nicht klappt, zeigt FitTrack dir einen Hinweis. Bereits in Health Connect gespeicherte Einträge und Berechtigungen bleiben davon unberührt.`  
Transient warning text (not a substitute for the policy paragraph): `Einige private App-Daten von FitTrack konnten auf diesem Gerät nicht gelöscht werden. Du kannst die App-Daten in den Android-Einstellungen entfernen.` Do not state that uninstall automatically removes all data: `android:allowBackup="true"` is present and no backup exclusion rules are visible; actual backup/restore behavior depends on platform/device configuration and is not proven here.  
Open questions: No unresolved product choice for the transient notice. Explicit approval of the proposed durable privacy-policy wording is required before editing/publishing `docs/legal/`; policy wording is not updated by this planning task. Legacy `users`/`nutritionProfiles` contents remain unknown; cleanup targets only the exact authenticated user ID/partition and requires no remote inventory.

## 21. Risks and Edge Cases

- Cosmos-Containerlöschungen sind nicht containerübergreifend atomar. Korrektheit hängt von idempotenten Einzelschritten, sichtbarem Fehlerstatus und vollständigem Retry ab.
- Function-/Client-Timeout kann nach Teillöschung Retry erfordern. Vor Release Volumentest innerhalb Laufzeitlimit; Teilabschluss darf nie als Erfolg erscheinen.
- Cosmos/Blob-Transfer ist nicht atomar. Zielbild/-dokument zuerst idempotent sichern, Quelle danach entfernen; Fehler zwischen jedem Schritt testen.
- TTL-Lock ist kurzlebige Konkurrenzkontrolle, kein Löschjournal. Nach Ablauf/Sessionverlust keine automatische Fortsetzung; Nutzer-Retry startet von vorn.
- **Accepted residual:** An operation admitted before lock acquisition is not drained or coordinated and may write after cleanup or `204`. This is technically possible and explicitly accepted by the PO scope decision; the plan makes no no-repopulation guarantee for these operations. Do not turn this into a blocker or reopen A/B/C.
- Newly beginning requests are rejected while the deletion lock is active. Queue work that begins during the lock must not process or recreate deleted items. Work already running before lock acquisition is not awaited and may finish later.
- Application-Insights-Logs können technische Verknüpfungen gemäß regulärer Retention enthalten; dies muss Privacy-Text wahrheitsgemäß nennen.
- Azure Soft Delete kann Plattformkopien wiederherstellbar halten; keine Behauptung sofortiger physikalischer Unwiederbringlichkeit.
- Mögliche ältere Dokumente in `users`/`nutritionProfiles` sind nicht als vorhanden belegt. Die Bereinigung ist auf `id = sub` beziehungsweise `userId = sub` begrenzt; keine Remote-Inventur und keine fremden Partitionen.
- Cosmos-spezifische Persistence-Verträge bleiben ohne Emulator **UNVERIFIED**. QA prüft die vorhandene Unit-/Handler-Evidence und meldet nur ein konkret ungedecktes Persistenzrisiko als Blocker.
- A failed local key/token removal can leave private queue, diagnostic, wizard-preference, or token state in the app sandbox. Local state is app-wide rather than Entra-sub-scoped; a later session on the same installation may expose local diagnostics or execute a stale queue.
- A valid surviving token can be hydrated after restart because the revised behavior has no persistent cleanup marker. If a queue also survives and sync is enabled, activation drains it to Health Connect. Queue code does not upload old queue snapshots to FitTrack, but may perform stale Health Connect upserts/deletes. Health Connect's platform-level duplicate/update behavior is not asserted beyond the `clientRecordId` supplied by this repository.
- `android:allowBackup="true"` and the absence of visible backup exclusion rules mean uninstall is not suitable wording for a guaranteed permanent local purge. Android Settings app-data clearing is the concise user instruction; restored backup behavior remains an assumption/open platform detail.
- The transient warning can be lost if the app is force-closed before it is shown; by design there is no durable warning/retry journal. This follows the explicitly authorized best-effort boundary.

## 22. Recommended Execution Order

1. **Fresh approval gate:** Obtain explicit `APPROVE` for this revised plan before any code, test, in-app legal-text, Knowledge Base, or policy correction starts. No implementation was performed in this task.
2. **F1-R3 — Mobile best-effort correction:** On fresh approval, retain server-first sequencing and existing cleanup attempts; remove the persistent cleanup marker/startup gate/local retry UI. Attempt every local cleanup target once, log out in the current process, show the AC-13 transient warning once on failure, and never repeat `DELETE /api/profile` for local cleanup failure. Treat this as a newly approved work package, not automatic F1 attempt 3.
3. **D2 — Mobile privacy copy and test:** Update the in-app privacy copy only after the separate policy wording approval; update the stale `LegalDocumentView.test.tsx` assertion and any mobile documentation to the final approved wording and best-effort boundary. The notice text itself is already PO-authorized.
4. **D1 — Backend/domain/API documentation follow-up:** Preserve the accepted pre-lock late-write wording internally and align the authentication KB ownership wording with internal PO ownership. Do not alter backend behavior, Cosmos persistence, Alpha infrastructure, or QA history.
5. **QA Q1 — Independent re-review:** Re-run AC-1 through AC-13 and the complete Mobile suite. Verify one backend DELETE only, warning once, no local durable retry, exact key/token attempts, same-`sub` login and queue behavior, current policy/copy consistency, no Graph, and the accepted late-write boundary. Keep Cosmos contract verification **UNVERIFIED**; no emulator, remote inventory, Alpha deployment, or Android emulator setup.
6. **Release boundary:** No Alpha deployment or Expo build is part of this revision. Any later release request must separately sequence Alpha infrastructure before backend code using the new container. No Graph automation, Entra live-delete, or changes to Health Connect data/permissions are authorized.

**Externe Voraussetzungen:** Keine Remote-Bestandsaufnahme und kein Cosmos Emulator. Die Dev-Container-Provisionierung ist laut I1-Handoff abgeschlossen. Für Alpha bleibt eine ausdrückliche `Deploy to Alpha`-Anforderung nötig; in diesem Plan wird nichts deployed. Eine etwaige Entra-Nacharbeit ist interne PO-Aufgabe und keine Nutzeranforderung oder Release-Gate.
