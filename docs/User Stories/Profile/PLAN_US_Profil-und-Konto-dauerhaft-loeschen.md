# PLAN_US_Profil-und-Konto-dauerhaft-loeschen

**Stand:** 2026-10-21  
**Status:** Veralteter Klärungstext; die Entscheidungen sind inzwischen geschlossen. Der vollständige aktualisierte Umsetzungsplan steht in [PLAN_US_Profil-und-Konto-dauerhaft-loeschen_aktualisiert.md](PLAN_US_Profil-und-Konto-dauerhaft-loeschen_aktualisiert.md). Die Umsetzung bleibt bis zur ausdrücklichen Freigabe durch den Orchestrator gesperrt.

<!-- Der nachfolgende Inhalt ist archivierter Klärungstext und nicht mehr maßgeblich.
**Vorgesehener Story-Pfad:** `docs/User Stories/Profile/US_Profil-und-Konto-dauerhaft-loeschen.md`  
**Plan-Pfad:** `docs/User Stories/Profile/PLAN_US_Profil-und-Konto-dauerhaft-loeschen.md`

Infrastructure Impact: Alpha  
Mobile Build Impact: None

`Infrastructure Impact: Alpha` ist vorläufig: Cosmos- und Storage-Daten liegen getrennt in Dev und Alpha; jede spätere Persistenzänderung muss erst in Dev validiert und anschließend nach Alpha gebracht werden. `Mobile Build Impact: None` gilt nur unter der Annahme, dass keine nativen Module, Plugins oder `app.config.js` geändert werden.

## Requirement Assessment

**Classification:** Accept with modifications; the complete implementation plan and story remain blocked only on the three product choices in PO-1/PO-2. The Entra setup/live-test gate is an external implementation and release prerequisite, not a planning blocker.

Die Antworten schließen die inhaltlichen Fragen zu anonym veröffentlichten Rezepten, fremden Tagebuch-Snapshots/Favoriten, Health Connect, bestehenden Backups und Freundschaften. Die neue Aussage „Es ist mein Entra Tenant, wir können dort alle notwendige bereitstellen“ klärt Tenant-Eigentum und Admin-Bereitschaft, aber weder tatsächlichen Tenant-Zugriff in dieser Sitzung noch die erfolgreiche Graph-Rollenzuweisung. Diese Schritte gehören als externes technisches Setup-/Release-Gate in den späteren Plan.

Die ursprüngliche Story muss präzisiert werden: Freundschaften entfallen; ausgewählte Rezeptlöschungen ändern keine bereits gespeicherten Snapshots oder fremden Favoriten; Health-Connect-Daten und ausdrücklich ausgenommene bestehende Backups werden nicht gelöscht. Die Formulierung „was gelöscht ist, ist gelöscht“ bedeutet mindestens, dass nach erfolgreichem Abschluss kein Löschauftrag zurückbleibt. Sie beantwortet nicht, ob die für ein zuverlässiges Fortsetzen notwendige minimale Zuordnung ausschließlich während eines noch laufenden oder fehlgeschlagenen Vorgangs gespeichert werden darf.

„Anonymous“ als öffentliche Projektion genügt nicht allein: Nach Kontolöschung darf in der aktiven FitTrack-Persistenz keine persönliche Nutzer-ID-/Namensverknüpfung zu erhaltenen Rezepten zurückbleiben. Das derzeitige Cosmos-Modell speichert die Nutzer-ID zwingend als Partition-Key und zusätzlich als `ownerUserId`; das Modell muss deshalb vor dem vollständigen Plan technisch migriert werden.

## Antworten und bestätigter Scope

1. **Erhaltene Community-Rezepte:** Öffentliche Anzeige als `Anonymous` genügt. Die aktive Persistenz muss trotzdem ohne Nutzer-ID und persönlichen Anzeigenamen auskommen.
2. **Fremde Tagebuch-Snapshots und Favoriten:** Bestehen auch dann unverändert, wenn das veröffentlichte Rezept gelöscht wird. Rezept-Snapshots bleiben historische Kopien; ein Favorit darf nicht zur Wiederherstellung oder Öffnung eines gelöschten Rezepts führen.
3. **Health Connect:** Bereits exportierte Health-Connect-Einträge werden nicht gelöscht. FitTrack-eigene lokale Tokens, Warteschlangen und persönliche App-Zustände sollen nach erfolgreichem Vorgang entfernt werden.
4. **Bestehende Backups:** Der Product Owner hat festgelegt, bestehende Backups nicht zu verändern. Das wird als Ausnahme für vorhandene Backup-Bestände behandelt. Die Repository-Konfiguration nennt keine Cosmos-Backup-Frist. Blob-Soft-Delete ist laut Storage-Konfiguration eine 7-tägige Wiederherstellungsfunktion im aktiven Storage-Konto und kein unabhängiges Backup oder Replikat. Application-Insights-Ereignisse sind Diagnose-/Betriebsprotokolle, keine Backups. Die Backup-Aussage entscheidet deren Behandlung daher nicht.
5. **Löschjournal:** Nach erfolgreichem Abschluss sollen keine Löschauftragsdaten zurückbleiben. Ein minimaler, personenbezogener Status nur bis zum vollständigen Abschluss wurde nicht ausdrücklich freigegeben; die Frage bleibt offen, weil die geforderte sichere Fortsetzung nach Teilfehlern sonst nicht zuverlässig gewährleistet werden kann. Technische Analyse und Empfehlung siehe unten.
6. **Entra External ID:** Der Nutzer bestätigt, dass er den Tenant besitzt und erforderliche Voraussetzungen bereitstellen kann. Das ist keine Bestätigung, dass diese Sitzung Zugriff hat oder die konkrete Rolle bereits erteilt ist. Graph-App-Rollenzuweisung, nicht geheime Konfigurationsprüfung und ein zerstörender Test mit einem entbehrlichen Testkonto sind technische Gates, keine Product-Owner-Recherchefrage.
7. **Freundschaften:** Zukünftige Funktion; aus dieser Story entfernen. Im aktuellen Backend wurden keine Freundschafts-/Haushaltsentitäten gefunden.

## Für die spätere Story erforderliche Präzisierungen

- Der öffentliche Community-Autor bleibt nach gelöschtem Nutzer `Anonymous`; weder `userId` noch der frühere Anzeigename dürfen in der aktiven Community-Rezept-Persistenz erhalten bleiben.
- Bereits gespeicherte Rezept-Snapshots in Tagebüchern und Favoriten anderer Nutzer bleiben bei beiden Toggle-Auswahlen bestehen. Gelöschte Rezepte sind über solche Favoriten nicht mehr abrufbar.
- Bereits nach Health Connect exportierte Daten bleiben bestehen; die Kontolöschung widerruft oder löscht diese externen Einträge nicht.
- Bestehende Backups bleiben unverändert. Blob-Soft-Delete (aktive Wiederherstellung binnen 7 Tagen) und Application-Insights-Logs (Diagnosedaten mit 30 Tagen Retention) sind keine Backups und benötigen jeweils eine konkrete Lösch-/Aufbewahrungsentscheidung.
- Freundschaften werden nicht als heutige Daten oder Akzeptanzkriterium aufgeführt.

Die ursprünglichen UI-Bestätigungen (Overlay, Toggle standardmäßig „Nein“, exakt `DELETE`, Lade-/Fehlerzustand, keine automatische Wiederanmeldung) bleiben unverändert. Die Story-Datei wird erst nach Klärung der offenen Punkte erzeugt.

## Entra External ID — technische Prüfung

### Unterstützter Löschablauf

Microsoft Graph unterscheidet zwischen dem normalen Löschen eines Benutzers und dem endgültigen Entfernen eines zuvor gelöschten Verzeichniseintrags:

1. `DELETE /users/{id}` löscht den Benutzer zunächst in den wiederherstellbaren Zustand (`deletedItems`); das ist für „dauerhaft löschen“ allein nicht ausreichend.
2. `DELETE /directory/deletedItems/{id}` entfernt diesen Eintrag endgültig. Der Backend-Ablauf muss daher beide Operationen ausführen und den Erfolg der endgültigen Entfernung verifizieren.
3. Eine erneute Registrierung mit derselben E-Mail darf nicht auf die Soft-Delete-Stufe gestützt werden. Nach endgültiger Entfernung ist die bisherige eindeutige Identität nicht mehr vorhanden; eine erneute Registrierung über denselben unterstützten Identitätsanbieter sollte ein neues Entra-Benutzerobjekt und damit einen neuen `sub` erzeugen. Das konkrete Verhalten der Sign-up-/Google-Konfiguration im geteilten Tenant ist noch nicht praktisch verifiziert.

Microsoft-Referenzen:
- [Delete user — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/user-delete?view=graph-rest-1.0)
- [List deleted items — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/directory-deleteditems-list?view=graph-rest-1.0)
- [Permanently delete a directory item — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/directory-deleteditems-delete?view=graph-rest-1.0)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)

### Backend-Identität und Berechtigungen

- `backend/src/lib/auth.ts` validiert aktuell nur JWT-Signatur, Issuer und Audience und verwendet `sub` als `userId`. Es gibt keinen Graph-Aufruf und keinen Entra-Löschclient.
- `infra/modules/functionapp.bicep` konfiguriert bereits eine system-assigned Managed Identity und gibt deren `principalId` aus. Eine Microsoft-Graph-Anwendungsrolle ist im Repository/IaC nicht zugewiesen.
- Der vorgesehene Flow ist app-only gegen Microsoft Graph mit einem von der Function Managed Identity bezogenen Token für `https://graph.microsoft.com/.default`; es ist kein Client-Secret in Mobile oder Backend-Konfiguration erforderlich.
- Die gemeinsame Graph-Berechtigung für den zweistufigen Ablauf ist nach den im Artefakt referenzierten Endpoint-Verträgen `Directory.ReadWrite.All` als breite App-only-Rolle für das endgültige Löschen aus `deletedItems`; sie deckt auch das vorherige Löschen des Benutzers ab. Keine zusätzliche Rolle wie `User.ReadWrite.All` vergeben. Vor Admin-Consent sind die aktuellen Permission-Tabellen beider Endpunkte erneut zu vergleichen und eine engere gemeinsame App-Rolle zu bevorzugen, falls Microsoft sie für beide Operationen dokumentiert. Die Graph-App-Rolle wird dem Service Principal der Function Managed Identity zugewiesen; Azure-RBAC auf Function App, Storage oder Resource Group genügt nicht.
- Graph-Berechtigungen wirken tenantweit und nicht nur auf den FitTrack-Aufrufer. Der API-Handler darf keine Ziel-ID vom Client akzeptieren. Die FitTrack-Partition-ID stammt derzeit aus dem verifizierten JWT-`sub`; Graph-Aufrufe müssen jedoch die tatsächlich verifizierte Graph-Benutzerobjekt-ID verwenden. Vor Implementierung ist im Test-Tenant festzustellen, ob `sub` und Graph-`id` identisch sind oder ob eine sichere serverseitige Zuordnung erforderlich ist.

### Tenant Setup- und Release-Gate

Der Nutzer hat Eigentum/Admin-Bereitschaft zugesagt. Tenant-Zugriff oder eine erfolgte Berechtigungsvergabe wird daraus nicht abgeleitet. Die Freigabe ist als externe technische Voraussetzung im späteren Plan zu führen. Keine Geheimnisse, Zugangsdaten, Client-Secrets, Zertifikate oder vollständigen Tokens im Chat anfordern oder übermitteln.

Minimale Reihenfolge für eine autorisierte spätere Prüfung:

1. **Zielidentität und Laufzeit festlegen.** Der Tenant-Administrator und Infrastructure-Agent identifizieren die tatsächlich zu testende Azure Function App (für den Live-Test vorzugsweise Alpha) und lesen deren system-assigned Managed Identity `principalId` aus der Function-App-Ressource bzw. deren Deployment-Output (`infra/modules/functionapp.bicep`). Lokale Tests mit dem Cosmos-Emulator ersetzen diesen Gate nicht; lokale Entwickleridentitäten sind kein Ersatz für die produktive Function-Identität.
2. **Graph-App-Rolle minimal zuweisen.** Ein dazu berechtigter Entra-Tenant-Administrator (sicherer Weg: Global Administrator; alternativ nur eine Rolle, die im Tenant tatsächlich das Zuweisen dieser Microsoft-Graph-App-Rolle erlaubt) weist der Enterprise-Application/service principal genau dieser Managed Identity die Microsoft-Graph **Application permission** `Directory.ReadWrite.All` zu und erteilt Admin-Consent. Sie ist für `DELETE /directory/deletedItems/{id}` die dokumentierte breite App-only-Berechtigung und umfasst auch das vorherige Löschen des Benutzers; `User.ReadWrite.All` nicht zusätzlich vergeben, sofern die vor dem Setup erneut geprüften Graph-Permission-Tabellen keine engere, für beide Operationen ausreichende App-Rolle ausweisen. Vor Umsetzung die aktuellen Permission-Tabellen beider Endpunkte prüfen und die kleinste gemeinsame Rolle verwenden. Azure-RBAC auf Function App, Storage oder Resource Group ersetzt keine Microsoft-Graph-App-Rolle. Die Rolle ist tenantweit wirksam und deshalb nur an die konkrete Backend-MI zu vergeben.
3. **Nicht geheime Konfiguration lesen und abgleichen.** Autorisiert prüfen: CIAM-Tenant-ID; OIDC discovery `issuer`/`jwks_uri`; tatsächliche Token-Claims `sub` und, falls vorhanden, `oid` des Testkontos; Graph-Benutzerobjekt `id`; die Zuordnung zwischen dem vom Backend derzeit als `userId` verwendeten Claim und Graph-`id`; Function-App-Name/Umgebung, aktivierte MI und deren `principalId`; Graph-Service-Principal-App-Rollenzuweisung/Admin-Consent; verwendete CIAM-Sign-up-User-Flow(s), Identitätsanbieter und E-Mail-Eindeutigkeits-/Wiederverwendungsregeln. Nur erforderliche Metadaten einsehen, keine Secrets aus App Settings exportieren. `sub === Graph id` nicht voraussetzen: falls sie nicht übereinstimmen, muss vor Implementierung eine sichere serverseitige Identitätsauflösung geplant werden.
4. **Entbehrliches Testkonto bereitstellen.** Im selben CIAM-Tenant ein ausschließlich für diesen Test bestimmtes Konto über genau den in Mobile angebotenen User Flow/Identitätsanbieter anlegen. Keine echten Profil-, Ernährungs- oder Gesundheitsdaten verwenden. E-Mail und Claim-Werte dürfen lokal für den Test verglichen, aber nicht in Telemetrie geschrieben oder im Chat geteilt werden.
5. **End-to-End-Zerstörungstest ausführen.** Über die deployte Function und den später implementierten Löschflow mit dem Testkonto erst `DELETE /users/{id}` und anschließend `DELETE /directory/deletedItems/{id}` ausführen. Den Zwischenzustand „soft deleted“ und danach das Fehlen in `deletedItems` autorisiert gegen Graph prüfen. Danach mit demselben User Flow und derselben E-Mail neu registrieren und bestätigen, dass ein neues Graph-Objekt/neue Backend-Identität entsteht und keine alten FitTrack-Daten oder Rezeptzuordnungen zurückkehren. Den Testlauf ohne personenbezogene Claim-/E-Mail-Werte protokollieren.
6. **Gate schließen.** Handoff enthält nur Ergebnis, geprüfte Rollenbezeichnung/-ID, getestete Umgebung, Bestätigung der Claim-zu-Graph-ID-Zuordnung und anonymisierte Resultate. Wenn MI-Zuweisung oder endgültiges Löschen im CIAM-Tenant nicht funktioniert, ist das ein technischer Blocker; keine stillschweigende Abschwächung der Story.

Dieses Setup-/Release-Gate darf im späteren Plan als externe Voraussetzung stehen, obwohl noch kein Tenant-Zugriff besteht. Tenant-Besitz/Admin-Bereitschaft selbst wird nicht erneut als PO-Frage gestellt.

## Fortsetzbarkeit ohne verbleibende persönliche Daten

### Was idempotent wiederholbar ist

- Cosmos-Daten lassen sich pro Container und Partition in wiederholbaren Löschschritten entfernen; es existiert derzeit aber keine zentrale, containerübergreifende Löschoperation.
- `deleteRecipeImage` und `deleteProductImage` verwenden `deleteIfExists` und sind für fehlende Blobs idempotent.
- Das Löschen des Entra-Benutzers und das endgültige Entfernen aus `deletedItems` sind zwei getrennte Provideroperationen. Der `deletedItems`-Zustand kann einen Soft-Delete erkennen, benötigt zum sicheren Zugriff aber weiterhin die Entra-Benutzer-ID.
- Enrichment-Nachrichten enthalten `userId` und `itemId`; ein Queue-Handler kann nach dem Lesen noch KI aufrufen und ein Element zurückschreiben. Der Scheduler kann fehlende Enrichment-Aufträge erneut einstellen. Ein reiner Cosmos-/Blob-Durchlauf verhindert deshalb keine konkurrierenden oder späteren Writes.
- JWT-Prüfung ist stateless. Bereits ausgestellte Access Tokens können bis zu ihrem Ablauf kryptografisch gültig bleiben; die aktuelle Backend-Auth prüft nicht live, ob das CIAM-Konto noch existiert.

### Ergebnis

Ein dauerhaft resumierbarer, gegen parallele Writes abgesicherter Ablauf ist mit den vorhandenen Komponenten **nicht zuverlässig ohne vorübergehend persistierte, personenbezogene Zuordnung** möglich. Ein Retry durch den Client kann viele Schritte von vorn wiederholen, solange ein gültiges Token vorliegt und die Identität noch für die nächste Anmeldung nutzbar ist. Das garantiert aber keine Fortsetzung nach Prozess-/Geräteverlust, Tokenablauf oder einem Abbruch zwischen Graph-Soft-Delete und endgültigem Entfernen. Außerdem fehlt ohne Sperr-/Tombstone-Zustand eine verteilte Schranke gegen andere aktive Geräte und bereits ausgestellte JWTs.

Ein zufälliger Auftragsbezeichner ohne Zuordnung löst das Problem nicht: ein Backend-Finalizer muss wissen, welche `sub`-Partitionen, Blob-Präfixe und Entra-Identität zu bearbeiten sind. Ein Hash/HMAC von `sub` ist weiterhin pseudonyme, verknüpfbare Information und damit keine belastbare „nicht-personenbezogene“ Lösung. Das Auflisten und endgültige Löschen beliebiger Entra-`deletedItems` ist keine sichere Alternative, weil damit auch fremde Tenant-Identitäten betroffen sein könnten.

Die technisch robuste Variante benötigt mindestens einen vorübergehenden Eintrag mit dem `sub` (oder einem weiterhin rückführbaren Wert), der gewählten Community-Rezept-Option und dem Status des Auftrags. Er muss außerdem als Sperre für weitere normale Handler und Queue-/Scheduler-Writes dienen. Kein Anzeigename, keine E-Mail, keine Ernährungs-/Gesundheitswerte und keine Rezeptinhalte sind dafür nötig. Der Eintrag darf erst entfernt werden, nachdem aktive FitTrack-Daten, erforderliche Dateien und die Entra-Identität endgültig gelöscht sowie ausstehende Hintergrundverarbeitung ausgeschlossen sind. Bei einem dauerhaft fehlerhaften Auftrag müsste der Status bis zur erfolgreichen manuellen oder automatischen Fortsetzung bestehen bleiben.

Eine Alternative ohne persistentes Journal wäre, AC 9 auf Retry innerhalb der laufenden Anfrage bzw. mit noch gültigem Client-Token zu begrenzen. Das schwächt die geforderte garantierte Fortsetzung nach Teilfehlern und löst die Sperre gegen andere Sitzungen nicht; sie wird daher nicht empfohlen.

## Repository Findings

### Profil, Authentifizierung und Mobile

- `mobile/src/modules/profile/ProfileEditScreen.tsx` enthält im aktuellen Stand den deaktivierten Platzhalter „Konto löschen — Wird später verfügbar“; der aktive Story-Button „Profil löschen“ ist nicht vorhanden.
- `backend/src/functions/profile.ts` registriert `DELETE /api/profile`, authentifiziert den Aufrufer, löscht aber nur das Profil-Dokument. Die API-Referenz dokumentiert diese Route nicht vollständig; Repository-Code ist maßgeblich.
- Mobile speichert Access-/Refresh-Tokens in Expo SecureStore. `authService.clearTokens()` entfernt nur diese Tokens. `AsyncStorage` enthält zusätzlich Wizard-Marker, Sync-Warteschlangen/Snapshots und Health-Connect-Diagnosedaten; ein erfolgreicher Löschabschluss muss den FitTrack-lokalen Zustand bereinigen, ohne Health-Connect-Exporte zu löschen.
- Die Registrierung verwendet den vorhandenen CIAM-PKCE-Flow; Mobile zeigt den Google-Identitätsanbieter. Ein separater Konto-Neuanlageflow ist nicht implementiert. `RootNavigator` kann wegen `SKIP_WIZARD_KEY` den Erstnutzungszustand überspringen; dieser Marker ist beim Reset zurückzusetzen.

### Persistenz, Rezepte und Dateien

- Nutzerbezogene Container verwenden `/userId`: `profiles`, `weights`, `nutritionDiaryMeals` (Meals, DayMeta und Hint-State), `reusableMealItems`, `recipes`, `aiUsage`, `aiInsights` und `userFoodRelations`.
- `foodProducts` ist globaler Katalogbestand und darf nicht gelöscht werden. `users` und `nutritionProfiles` sind provisioniert, werden aber in aktuellen Repository-Quellen nicht verwendet; mögliche Legacy-Dokumente müssen vor der Definition des Löschinventars geprüft werden.
- `userFoodRelations` enthält nutzereigene Favoriten/Recents. Bei Löschung des eigenen Kontos werden die eigenen Relationen gelöscht; Relationen anderer Nutzer auf Rezept-IDs bleiben gemäß Bestätigung bestehen.
- `recipes` verlangt aktuell `userId === ownerUserId`; Dokumente ohne diese Felder sind ungültig. Die `userId`-Partition kann nicht in place geändert werden. Erhaltene Community-Rezepte benötigen deshalb eine ownerlose Community-Persistenz, voraussichtlich einen getrennten Container mit global geeigneter Partitionierung, sowie eine idempotente Übernahme veröffentlichter Dokumente und Bilder. Die konkrete Schema-/Containerentscheidung bleibt Teil des späteren Plans.
- `backend/src/lib/communityRecipes.ts` projiziert den Anzeigenamen bereits als `Anonymous`, wenn keine ausdrückliche Namensfreigabe vorliegt. Diese Response-Projektion löscht aber nicht die persistierten Felder `ownerUserId`, `userId` und `communityPublication`.
- Rezeptbilder liegen unter `{userId}/{recipeId}/...` im Container `recipe-images`; Produktbilder unter `{userId}/{itemId}...` in `product-images`. Die Infrastruktur setzt Blob-Soft-Delete auf sieben Tage. Ein verschobenes Community-Bild braucht einen nicht personenbezogenen aktiven Blob-Pfad; die alte Soft-Delete-Kopie bleibt bis zur geklärten Ausnahme wiederherstellbar.
- Bereits gespeicherte Tagebuch-Rezept-Snapshots sind laut Domain-Regel unabhängig von späterer Änderung/Löschung. Bestehende Favoriten anderer Nutzer dürfen nicht gelöscht werden; die API muss gelöschte Rezepte für diese Verweise als nicht verfügbar behandeln.

### Hintergrundverarbeitung und Protokolle

- Queue `reusable-items-enrich` enthält `{ userId, itemId }`; der Handler kann nach dem Queue-Lesen noch KI aufrufen und aktualisieren. Der nächtliche Scheduler stellt fehlende Enrichments erneut ein. Löschsperre und Queue-Verhalten sind Teil des späteren Backend-Designs.
- Application Insights ist auf 30 Tage Retention konfiguriert (`infra/modules/appinsights.bicep`). Bestehende strukturierte Ereignisse speichern `userId` und teils `recipeId`, `mealId` oder `itemId` (zum Beispiel Diary-, Rezept- und Community-Aufrufe); Queue-Logs enthalten ebenfalls Nutzer- und Item-ID. Diese Historie wird durch die aktuelle Kontolöschung nicht entfernt.
- Die Alpha-Datenschutzerklärung nennt 30 Tage Betriebsprotokolle, erklärt aber aktuell, dass Kontolöschung noch nicht verfügbar ist. Die wortgleiche In-App-Fassung ist `mobile/src/modules/legal/legalTexts.ts`.
- Cosmos-Backup-Retention ist im Repository nicht festgelegt. Es wird keine Annahme über deren Frist oder Rechtsgrundlage getroffen.

## Persistence Impact

**Voraussichtlich Class 3 — explizite Migration für erhaltene Community-Rezepte**, noch nicht abschließend geplant. Das bestehende `recipes`-Container-/`/userId`-Modell kann die geforderte ownerlose Persistenz nicht durch bloßes Ändern der Response-Projektion erfüllen. Ein getrenntes Community-Modell/-Container mit nicht personenbezogener Partitionierung würde Änderungen an `backend/src/lib/cosmos.ts`, `infra/modules/cosmos.bicep`, den Repositorys und eine idempotente Daten-/Blob-Übernahme erfordern. Dev muss vor Alpha validiert werden. Die Klassifikation, Rückwärtskompatibilität und genaue Containerwahl sind nach den Antworten zu Soft-Delete-Aufbewahrung und Löschjournal im vollständigen Plan festzulegen.

Normale eigene Daten werden aus bestehenden `/userId`-Partitionen gelöscht; bestehende Container und Partition-Keys werden nicht verändert. Legacy-Daten in `users`/`nutritionProfiles` müssen als Teil der Bestandsprüfung berücksichtigt werden.

## Privacy Impact

Privacy Impact: Open question  
Data flow: Nutzerprofil, Gewicht, Ernährungstagebuch, persönliche Lebensmittel, Favoriten/Recents, Rezepte, KI-Nutzung/Insights/Feedback und eigene Dateien werden aus aktiven FitTrack-Speichern gelöscht. Bei beibehaltenen Community-Rezepten bleiben Rezeptinhalt und benötigte Bilder verfügbar, aber ohne aktive Nutzer-ID-/Namenszuordnung. Der neue Entra-Graph-Aufruf übermittelt den verifizierten Graph-Zielbezeichner an Microsoft Graph. Bereits nach Health Connect exportierte Werte und ausdrücklich ausgenommene bestehende Backups bleiben bestehen. Storage Bicep aktiviert für Blob-Daten eine 7-tägige Soft-Delete-Wiederherstellung; ein normaler Blob-Delete lässt eine Wiederherstellungskopie im selben Storage-Konto zurück. Application Insights/Log Analytics behält Daten 30 Tage; vorhandene strukturierte Logs enthalten teils `userId` und Objekt-IDs. Diese zwei aktiven Retentionsarten sind keine Backup-Kopien. Ein temporärer Löschauftrag würde mindestens eine rückführbare Nutzerzuordnung bis zum vollständigen Abschluss speichern.

Policy sections affected: `Welche Daten verarbeiten wir?`, `Wo und womit werden die Daten verarbeitet?`, `Wer sieht meine Daten?`, `Speicherdauer und Löschen`, `Health Connect (optional, nur Android)` sowie die In-App-Fassung in `mobile/src/modules/legal/legalTexts.ts`.  
Proposed text: Noch nicht freigabefähig. Nach PO-Entscheidungen zu temporärem Löschstatus, wiederherstellbaren Blob-Kopien und Application-Insights-Logs ist die bestehende Datenschutzerklärung samt In-App-Fassung abzugleichen. Keine Rechtsgrundlage und keine neue Aufbewahrungsfrist wird angenommen.  
Open questions: PO-1 und PO-2 unten; Rechtsgrundlage und rechtliche Prüfung verbleiben bei Product Owner/Legal. Bestehende Cosmos-Backups bleiben unverändert und sind nicht Teil der offenen Fragen.

## Offene Fragen und Gates

### PO-1 — Minimaler Status nur bis zum Abschluss

Der Hinweis „was gelöscht ist, ist gelöscht“ beantwortet klar, dass nach erfolgreichem Löschabschluss keine Datenreste bleiben dürfen. Er sagt nicht, ob FitTrack während eines noch laufenden oder fehlgeschlagenen Vorgangs einen minimalen Status behalten darf; diese Phase ist gerade noch nicht abgeschlossen und die Speicherung wurde nicht ausdrücklich bestätigt.

**Empfehlung:** Ja zu einem minimalen, zugriffsbeschränkten Löschauftrag ausschließlich für die zuverlässige Fortsetzung. Er enthält nur eine rückführbare Nutzerkennung, die Community-Rezept-Auswahl, technische Phase/Zeitstempel und einen nicht personenbezogenen Fehlercode; keine E-Mail, Namen, Gesundheits-/Rezeptinhalte oder Tokens. Er sperrt neue normale API- und Hintergrundverarbeitung für diese Identität und wird unmittelbar nach verifiziertem Abschluss vollständig gelöscht. Bei einem vorübergehenden oder dauerhaften Fehler bleibt er nur bis erfolgreicher automatischer Fortsetzung oder manueller Fehlerbehebung bestehen; kein TTL, das einen unvollständigen Löschlauf unbemerkt verwaisen lässt. Damit wird das Datenschutzprinzip „keine Reste nach Abschluss“ eingehalten und die geforderte sichere Wiederaufnahme ermöglicht.

**Warum die Alternative nicht gleichwertig ist:** Ohne dauerhaft gespeicherten Status kann ein Retry innerhalb derselben noch laufenden Anfrage oder mit noch gültigem Client-Token den Löschlauf erneut starten. Das übersteht weder Function-Neustart/Timeout noch Geräteverlust oder Tokenablauf. Es verhindert außerdem keine weiteren Writes aus anderen Sitzungen oder Queue-/Timer-Verarbeitung. Eine Queue mit Nutzerkennung wäre ebenfalls persistente Zwischenaufbewahrung, nur weniger transparent und kontrollierbar. Nein würde daher eine bewusste Abschwächung von AC 9 erfordern.

**Entscheidung:** Ist dieser minimale Status ausschließlich bis zum vollständigen Abschluss erlaubt, einschließlich Fortsetzung/administrativer Fehlerbehebung bei einem fehlgeschlagenen Lauf, und wird er danach sofort gelöscht? (Ja/Nein)

### PO-2 — Aktive Wiederherstellung und Diagnoseprotokolle

Die bestätigte Backup-Ausnahme beantwortet diese Frage nicht: Die Storage-Konfiguration aktiviert sieben Tage Blob Soft Delete. Das ist eine Wiederherstellungs-/Undelete-Funktion, die eine gelöschte Datei im selben aktiven Storage-Konto wiederherstellbar hält; es ist weder ein unabhängiges Backup noch Replikation. Application Insights/Log Analytics speichert Betriebs- und Diagnoseereignisse für 30 Tage; Logs sind ebenfalls keine Backups. Die aktuelle Anwendung protokolliert an mehreren Stellen `userId` und Objekt-IDs. Das sind getrennte Systeme und die Auswirkungen unterscheiden sich.

**Empfehlung für möglichst vollständige Löschung:** (a) Bei Kontolöschung auch die Wiederherstellungskopien der betroffenen Nutzerdateien beseitigen, ohne die vom PO ausgenommenen bestehenden Backups anzutasten; (b) vorhandene identifizierbare Telemetrie zum Nutzer löschen/purgen und künftige Logs so ändern, dass keine Nutzer-/Objektkennungen verbleiben. Technische Machbarkeit einer gezielten permanenten Blob-Bereinigung und selektiven Log-Purge muss vor Freigabe des Plans verifiziert werden; Soft-Delete nicht global stillschweigend abschalten, da das die Wiederherstellbarkeit aller Nutzerdateien beeinflussen könnte.

**Entscheidung, getrennt je Datenklasse:**

- **Blob-Wiederherstellung:** Sollen die bestehenden 7-Tage-Soft-Delete-Kopien zu diesem Konto trotz der Backup-Ausnahme bis zum Ablauf wiederherstellbar bleiben, oder ist ihre sofortige permanente Entfernung bei erfolgreicher Kontolöschung erforderlich?
- **Application-Insights-Logs:** Sollen vorhandene Events mit `userId`/Objekt-IDs der bestehenden 30-Tage-Retention folgen, oder sollen sie bei Kontolöschung gezielt entfernt und diese Kennungen künftig nicht mehr protokolliert werden?

Die Empfehlung ist in beiden Fällen die Löschoption. Sollte sie technisch nicht gezielt umsetzbar sein, wird die technische Einschränkung mit dem geringstmöglichen systemweiten Effekt erneut vorgelegt; sie wird nicht als stillschweigende Ausnahme behandelt.

## Planungsgate

Vor Beantwortung von PO-1 und den beiden getrennten Teilen von PO-2 wird **kein vollständiger Umsetzungsplan und keine User-Story-Datei** erstellt. Andernfalls müsste der Plan eine nicht bestätigte personenbezogene Zwischenaufbewahrung oder die Fortgeltung aktiver Wiederherstellungs-/Telemetriedaten als Produktannahme behandeln. Tenant-Zugriff/Admin-Consent ist dagegen kein Planungsblocker mehr: Nutzerbereitschaft ist bestätigt und das oben beschriebene Setup-/Live-Test-Gate wird als externe technische Voraussetzung in den späteren Plan aufgenommen.

Nach Produktklärung sind mindestens Backend, Mobile/Frontend, Infrastruktur & Release und ein dediziertes QA-Workpackage nötig. `privacy-impact-review` ist für Backend, Frontend und QA erforderlich. `cosmos-data-model-and-migration` ist für Backend und QA erforderlich, wenn wie erwartet die ownerlose Community-Persistenz/Migration geändert wird. Der spätere Plan muss Dev vor Alpha festlegen, Graph-Admin-Zuweisung und autorisierten Live-Test mit einem entbehrlichen Konto als Gate ausweisen und Knowledge-Base-/Privacy-Dokumentation vor der QA-Validierung einplanen.
-->
