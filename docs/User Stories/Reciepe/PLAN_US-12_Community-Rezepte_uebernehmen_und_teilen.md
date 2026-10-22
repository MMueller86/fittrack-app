# PLAN_US-12 — Community-Rezept kopieren

Status: Draft — Story und Plan sind nicht freigegeben. Diese Überarbeitung ist keine Umsetzungsfreigabe.

Infrastructure Impact: Alpha
Mobile Build Impact: None

## 1. Requirement Assessment

**Einstufung: Akzeptieren mit Vereinfachung.** Ziel ist eine private, unabhängig bearbeitbare Kopie des aktuell veröffentlichten Community-Snapshots. Es gibt genau eine Kopie je authentifiziertem Nutzer und Quellrezept. Eine explizite Aktion für weitere Kopien löst weder das Duplikatproblem noch die geforderte Netzwerkwiederholung und entfällt.

## 2. Current Behaviour and Code-Level Finding

- Die Community-GET-Routen verlangen `requireUser()` und `getCommunityById()` liefert nur aktuell veröffentlichte Datensätze. Private und fehlende Quellen ergeben denselben 404-Vertrag. Ein Copy-Endpunkt existiert noch nicht.
- `CosmosRecipesRepository.get(userId, id)` liest owner-scoped in der `/userId`-Partition. `items.create()` legt ohne Upsert an; ein ID-Konflikt kann deshalb auf dieselbe Owner-ID aufgelöst werden. Ein deterministischer Recipe-ID-Ableiter muss das UUID-Format des Recipe-Modells einhalten.
- Das normale Create berechnet Aggregate und löst Provenienz über Katalog-/Bibliotheks-Repositories auf. Das normale PUT berechnet Aggregate erneut. `nutritionSource` ist kein öffentliches Schreibfeld. Der interne Copy-Pfad muss den vollständigen vertrauenswürdigen Quellrecord samt Provenienz und Nährwert-Snapshot direkt persistieren.
- Der RecipeWizard-Edit-Bootstrap erhält Ingredient-ID und Snapshot. Bei gleicher ID, Links, AI-Kennzeichnung und `nutritionPer100g` bewahrt `resolveRecipeIngredientProvenance()` die bestehende Provenienz. Amount-only Edits können so weiter über den normalen PUT gespeichert werden; dieser berechnet Beiträge und Rezeptaggregate wie bisher neu.
- Das Owner-Rezept-DELETE löscht aktive Bild-Blobs mit `deleteIfExists()` vor dem Cosmos-Dokument. Blob Soft Delete ist in `infra/modules/storage.bicep` für sieben Tage aktiviert. Uploads verwenden aktuell zufällige Bild-IDs; der Copy-Pfad braucht stabile Owner-Zielpfade und bedingtes Anlegen.
- Geprüfte Implementierung: `backend/src/functions/communityRecipes.ts`, `backend/src/lib/repositories/cosmosRecipesRepository.ts`, `backend/src/functions/recipes.ts`, `backend/src/lib/repositories/recipeIngredientProvenance.ts`, `backend/src/lib/storage.ts`, `infra/modules/storage.bicep`, `mobile/src/modules/recipes/recipeWizardEditBootstrap.ts`, `mobile/src/modules/recipes/RecipeWizardScreen.tsx`.

## 3. Recommended Behaviour and Scope

- Eine Aktion in Community-Liste und -Detail kopiert die aktuell veröffentlichte Quelle. Pro authentifiziertem Nutzer und Quell-ID gibt es eine private Owner-Kopie; ein erneuter Aufruf öffnet dieselbe Rezept-ID.
- Der Copy-Endpunkt liest die deterministische ID owner-scoped zuerst. Eine vorhandene Kopie wird sofort zurückgegeben, auch wenn die Quelle inzwischen privat oder gelöscht ist. Ohne Kopie wird die Quelle aktuell geladen und auf `visibility: 'community'` geprüft. Bei fehlender Quelle erfolgt ein letzter Owner-Read, um eine parallel fertiggestellte Kopie zurückzugeben; sonst gilt 404.
- Eine bei der Quellenprüfung veröffentlichte Quelle darf als geladener Snapshot fertig kopiert werden, ohne nachträgliche Veröffentlichungsprüfung. Wird eine Quelle parallel gelöscht und ein Quellbild ist nicht mehr lesbar, scheitert der Vorgang ohne Recipe-Commit. Sind die Bildbytes bereits geladen, darf der Snapshot abgeschlossen werden.
- Der vollständige interne Snapshot bleibt beim Kopieren exakt: Zutaten, gespeicherte Nährwertbasis und Beiträge, Aggregate, Provenienz, Reihenfolge, Schritte und Bilddarstellung. Kein Copy-Zeit-Katalogzugriff, keine Nährwertberechnung und kein AI-Aufruf.
- Kein fremdes privates `linkedReusableItemId`. `linkedProductId` bleibt nur bei kanonischem globalem `openFoodFacts:<barcode>`-Format als Identität bestehen; andere Werte werden entfernt. Es entstehen keine Food- oder ReusableItem-Dokumente. Community-Projektionen bleiben unverändert.
- Die Provenienz bleibt intern serverseitig erhalten; `nutritionSource` wird kein öffentliches POST-/PUT-Schreibfeld. Mengenänderungen laufen weiter über den bestehenden Editor und PUT.
- Keine Änderung an Kontolöschung, ownerless Transfer, bestehender Aufbewahrung oder Rechtstexten.

## 4. API, Idempotency, and Images

`POST /api/community-recipes/{id}/copy` ist authentifiziert und bodyless. Eine feste, domänenseparierte SHA-256-Ableitung aus verifizierter Nutzer-ID und Quell-ID wird auf ein gültiges UUID-Format abgebildet. Der Ableitungsalgorithmus ist stabil zu halten und mit Testvektoren abzusichern; es kommt keine Abhängigkeit hinzu.

Reihenfolge: (1) owner-scoped `get(userId, deterministicId)` und sofortige `200 { "recipeId": "..." }` bei Treffer; (2) `getCommunityById(sourceId)` und aktuelle Veröffentlichungsprüfung; (3) bei nicht verfügbarer Quelle erneuter Owner-Read, dann `200` bei mittlerweile vorhandener Kopie oder bestehender `404`-Vertrag; (4) Snapshot und Bilder laden, Bildziele bedingt anlegen, anschließend Recipe per Cosmos `create` persistieren. Eine neue Anlage liefert `201`; vorhandene oder durch parallelen Aufruf angelegte Kopien liefern `200`. Beide Erfolgsantworten haben denselben Body. Bei Cosmos-Konflikt wird owner-scoped erneut gelesen; nur der erfolgreiche Owner-Datensatz wird zurückgegeben. Ein unklarer Commit-Ausgang wird ebenfalls per Owner-Read aufgelöst; bleibt er unklar, Fehlerantwort ohne Bildbereinigung.

Die Kopie setzt `ownerUserId` auf den JWT-`sub`, `visibility` auf `private` und bewahrt den vertrauenswürdigen gespeicherten Snapshot. Sie entfernt `linkedReusableItemId`, bereinigt `linkedProductId` wie oben beschrieben und verwendet weder öffentliche Create-/Update-Schemas noch den Provenienzresolver. Öffentliche POST-/PUT-Verträge bleiben unverändert.

Owner-Zielpfad je Bild: `{userId}/{deterministicRecipeId}/{sourceImageId}.{jpg|png}`. Bildtyp und Größe werden wie bei Community-Bilddownloads validiert; Reihenfolge und `heroCrop` bleiben erhalten. Upload erfolgt mit `If-None-Match: *` (create-only). Bei `409`/`412` wird das vorhandene Ziel gelesen und nur bei identischem Inhalt und Typ wiederverwendet; andernfalls Abbruch ohne Überschreiben. Kein Fehlerpfad löscht ein Zielbild: Ohne Status-/Lease-Modell ist nicht beweisbar, dass ein paralleler Aufruf es nicht gerade für seinen erfolgreichen Recipe-Commit benötigt.

Nach abgeschlossener Owner-DELETE-Anfrage ist die deterministische Recipe-ID wieder frei. Ein späterer Copy-Aufruf erfordert erneut eine veröffentlichte Quelle, erstellt dieselbe Recipe-ID und übernimmt den dann aktuellen Snapshot. Er verwendet dieselben Zielnamen für dieselben Bild-IDs; die normale bedingte Anlage erzeugt wieder aktive Blobs, während die vorhandene Soft-Delete-Wiederherstellung bis zu sieben Tage unverändert bleibt. Die Azure-Recreation nach Soft Delete wird im Alpha-Speicher-Smoke-Test geprüft, da die bestehende Azurite-Abdeckung diese Kontorichtlinie nicht belegt.

Bewusster Trade-off: Ein Fehler vor dem Recipe-Commit kann unreferenzierte aktive Zielbilder hinterlassen. Pro deterministischem Bildziel gibt es höchstens ein aktives Objekt; Retries können es wiederverwenden. Ohne persistierten Status, Lease oder Journal ist sichere automatische Bereinigung nicht möglich. Verwaiste Ziele können bis zur vorhandenen Owner-Präfixbereinigung bestehen bleiben; es wird kein zusätzlicher Bereinigungs- oder Aufbewahrungsmechanismus eingeführt.

**Persistence Impact:** Kein Schemafeld, Container, Index oder Partition wird ergänzt. Die normale Recipe-ID ist deterministisch statt zufällig; vorhandene Owner-Dokumente bleiben unverändert lesbar (Class 0, keine Migration). Die Persistenz bleibt im `recipes`-Container mit `/userId`.

## 5. Privacy Impact

Privacy Impact: Policy covered
Data flow: Bereits veröffentlichte Rezeptfelder und Bilder → authentifizierter Backend-Aufruf → private Owner-Rezeptkopie und unabhängige Bildblobs im bestehenden Owner-Speicher. Keine neue Datenkategorie, Empfängergruppe, externe Übermittlung oder Aufbewahrungsregel.
Policy sections affected: Welche Daten verarbeiten wir?; Wo und womit werden die Daten verarbeitet?; Wer sieht meine Daten?; Speicherdauer und Löschen (bestehende Regel, unverändert).
Proposed text: N/A. Die Erklärung umfasst Rezepte und Bilder, private Owner-Daten, ausdrücklich veröffentlichte Community-Rezepte und die bestehende Löschung aktiver persönlicher FitTrack-Daten. Die Kopie bleibt privat und folgt dem vorhandenen Owner-Lebenszyklus.
Open questions: Keine für den beschriebenen Umfang. Keine Änderung der Erklärung oder gesonderte Policy-Arbeit.

## 6. Backend Work Package — BP-1

Agent: Backend

Goal: Authentifizierte, idempotente Snapshot-Kopie mit deterministischer Owner-/Quell-ID und unabhängigen Bildblobs implementieren.

Required Knowledge Base:
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`

Required Repository Context:
- `backend/src/functions/communityRecipes.ts`
- `backend/src/lib/communityRecipes.ts`
- `backend/src/lib/repositories/recipesRepository.ts`
- `backend/src/lib/repositories/cosmosRecipesRepository.ts`
- `backend/src/lib/repositories/recipeIngredientProvenance.ts`
- `backend/src/lib/storage.ts`
- `backend/src/functions/communityRecipes.test.ts`
- `backend/src/functions/recipes.test.ts`

Required Skills:
- `cosmos-data-model-and-migration`
- `privacy-impact-review`

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9

Dependencies: Ausdrückliche Freigabe von Story und Plan.

Expected Handoff:
- Authentifizierter bodyless Endpoint mit Owner-Read vor Quellenprüfung, stabiler UUID-Ableitung, `201`/`200` und identischem `{ recipeId }`-Body.
- Exakter Snapshot mit serverseitiger Provenienz, Link-Sanitierung und unveränderten öffentlichen Create-/Update-Verträgen.
- Bedingte deterministische Bildanlage, Konfliktprüfung ohne Überschreiben oder Fehlerbereinigung sowie fokussierte Handler-, Repository- und Storage-Tests; aktualisierte API-/Rezeptdokumentation.

## 7. Frontend Work Package — FP-1

Agent: Frontend

Goal: Eine Copy-Aktion in Liste und Detail; nach `201` oder `200` dieselbe Owner-Rezept-ID öffnen. Kein Ablauf für zusätzliche Kopien.

Required Knowledge Base:
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/05-ux-patterns.md`

Required Repository Context:
- `mobile/src/modules/recipes/RecipeListScreen.tsx`
- `mobile/src/modules/recipes/CommunityRecipeDetailScreen.tsx`
- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/modules/recipes/RecipeListScreen.test.tsx`
- `mobile/src/modules/recipes/CommunityRecipeDetailScreen.test.tsx`

Required Skills:
- `privacy-impact-review`

Relevant Acceptance Criteria:
- AC-1
- AC-6
- AC-9

Dependencies: BP-1 API contract and ausdrückliche Story-/Planfreigabe.

Expected Handoff:
- Liste/Detail rufen dieselbe Copy-Operation auf und navigieren bei beiden Erfolgsstatus zum zurückgegebenen Owner-Rezept.
- Fokussierte UI-Tests und Mobile-Typecheck; die Community-Quelle bleibt unverändert.

## 8. QA Work Package — QP-1

Agent: QA

Goal: Story vollständig prüfen, insbesondere Snapshottreue, Idempotenz, Bildunabhängigkeit, Privacy-Grenzen und Editierbarkeit.

Required Knowledge Base:
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`

Required Repository Context:
- `backend/src/functions/communityRecipes.test.ts`
- `backend/src/functions/recipes.test.ts`
- `backend/src/lib/repositories/cosmosRecipesRepository.contract.test.ts`
- `backend/src/lib/repositories/recipesRepository.test.ts`
- `backend/src/lib/storage.test.ts`
- `mobile/src/modules/recipes/RecipeListScreen.test.tsx`
- `mobile/src/modules/recipes/CommunityRecipeDetailScreen.test.tsx`
- `mobile/src/modules/recipes/recipeWizardEditBootstrap.test.ts`

Required Skills:
- `cosmos-data-model-and-migration`
- `privacy-impact-review`

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9

Dependencies: BP-1 and FP-1 handoffs.

Expected Handoff:
- QA-Bericht zu AC-1–AC-9 mit Befehlen, Exitcodes und nicht ausführbaren Prüfungen als `UNVERIFIED`.
- Nachweis für Lookup-Reihenfolge, Retry nach Quellenentzug, Löschen-und-erneutes-Kopieren, parallele Creates, bedingte Bildanlage ohne gefährliche Bereinigung sowie AI-/OFF-Provenienz und Mengenänderung per PUT.

## 9. Documentation, Infrastructure, and Verification

Vor QA die Copy-API in `docs/kb/tech/09-api-reference.md`, Snapshot-/Edit-Verhalten in `docs/kb/domain/06-recipes.md` und die betroffene Community-UX-Dokumentation aktualisieren. Keine Food-Catalog-, Account-Deletion- oder Legal-Dokumentation ändern.

Keine Bicep-, Cosmos-, Index- oder Abhängigkeitsänderung. `Infrastructure Impact: Alpha` gilt für den neuen Backend-Endpunkt; kein Infrastructure-&-Release-Feature-Work-Package und kein nativer Mobile-Build sind vorgesehen. Der Azure-Speicher-Smoke-Test prüft, dass ein Owner-Bildpfad nach abgeschlossener Löschung trotz Soft Delete wieder aktiv angelegt werden kann.

Test gates: fokussierte Backend-Tests und `npm run build:verify`; Cosmos-Contract-Tests bei verfügbarem Emulator; fokussierte Mobile-Tests und `npx tsc --noEmit`; Azure-Speicher-Smoke-Test für Wiederanlage nach Soft Delete. Nicht verfügbare Gates als `UNVERIFIED` melden.

## 10. Acceptance Criteria

1. **Zugriff und Lookup:** Authentifizierte Liste und Detail können ein veröffentlichtes Community-Rezept kopieren. Der Endpoint liest die deterministische Owner-ID vor der Quelle; ein Treffer liefert die eigene private Kopie auch nach Unpublish oder Quellenlöschung. Nur ohne Treffer wird die Quelle aktuell autorisiert; private, entfernte oder unbekannte Quellen ergeben 404, sofern beim abschließenden Owner-Read keine parallele Kopie vorliegt.
2. **Snapshot:** Die private Owner-Kopie enthält den geladenen Rezept- und Bild-Snapshot einschließlich Reihenfolge, `heroCrop`, gespeicherten Nährwerten, Provenienz und Aggregaten. Spätere Quellenänderungen wirken sich nicht aus.
3. **Link-Sanitierung:** Kein fremdes `linkedReusableItemId` wird gespeichert. Nur kanonische globale `openFoodFacts:<barcode>`-IDs bleiben als Identität erhalten; andere Werte werden entfernt. Es entstehen keine Food-/ReusableItem-Dokumente; Community-Projektionen bleiben unverändert.
4. **Copy-Treue:** Copy greift weder auf Food-/OFF-Kataloge noch AI zu und berechnet keine Nährwerte neu. Snapshot-Beiträge und Aggregate bleiben beim Kopieren unverändert. `nutritionSource` bleibt serverintern und ist kein öffentliches Schreibfeld.
5. **Editierbarkeit:** Regressionstests laden, ändern die Menge und speichern per normalem PUT für unverbundene manuelle, Label-Scan-, `unknown`- und AI-Zutaten sowie OFF-Zutaten mit kanonischer globaler `linkedProductId`. AI behält `isAiEstimate` und AI-Provenienz ohne `linkedReusableItemId`; OFF behält beim Kopieren seine Nährwertbasis und Provenienz ohne Copy-Zeit-Katalogzugriff. Ein Amount-only Edit mit gleicher Ingredient-ID und Nährwertbasis bewahrt die Provenienz. Der normale PUT berechnet Beiträge und Aggregate wie bisher aus Menge und Nährwertbasis neu; bei Änderungen an Herkunftsfeldern kann der bestehende Resolver wie bisher Katalogdaten lesen.
6. **Eine Kopie und erneutes Kopieren:** Stabile UUID aus authentifiziertem Nutzer und Quell-ID; `201` bei Anlage, `200` bei vorhandener oder parallel angelegter Kopie, stets derselbe `{ recipeId }`-Body. Erfolgreiches Recipe-DELETE entfernt den aktiven Datensatz und seine referenzierten Bilder, aber keinen dauerhaften Idempotenzmarker. Ein Copy-Aufruf nach abgeschlossenem DELETE kann dieselbe ID erneut anlegen und übernimmt den dann verfügbaren Quell-Snapshot.
7. **Bilder und Parallelität:** Owner-Bildpfade sind deterministisch und unabhängig von Quellpfaden. `If-None-Match: *` verhindert Überschreiben; `409`/`412` wird nur bei identischem Typ und Inhalt wiederverwendet. Fehlerpfade löschen keine Zielbilder. Ein Fehler vor Recipe-Commit kann daher verwaiste Ziele hinterlassen; es gibt keine Teilkopie-Erfolgsmeldung. Soft-Delete-Pfadwiederanlage wird gegen Azure geprüft.
8. **Quellenrennen und Privacy:** Nach dem Laden einer veröffentlichten Quelle darf der geladene Snapshot ohne erneute Sichtbarkeitsprüfung abgeschlossen werden; nicht mehr lesbare Quellbilder führen vor Commit zum Fehler. Eine vorhandene Kopie wird ausschließlich owner-scoped aus dem JWT-`sub`-Partition gelesen und gibt keine Quell- oder fremden Nutzerdaten preis.
9. **Begrenzter Umfang:** Keine Änderung an Kontolöschung, ownerless Transfer, bestehender Aufbewahrung, Rechtstexten, Community-Projektionen oder sonstigen bestehenden Community-Aktionen.

## 11. Risks and Execution Order

- Die deterministische ID-Bildung ist nach Release dauerhaft stabil zu halten; eine absichtliche zweite Kopie je Quelle ist nicht möglich. Das ist der bewusste Trade-off für einfache, retry-sichere Duplikatvermeidung.
- Gespeicherte Zutaten und Aggregate sind Copy-Zeit-Autorität, auch wenn ein altes Aggregat von einer frischen Berechnung abweicht. Ein späterer normaler Nutzer-Edit folgt weiterhin dem bestehenden PUT-Verhalten.
- Fehlgeschlagene oder mehrdeutige Vorgänge können unreferenzierte aktive Zielbilder hinterlassen. Ohne Status-/Lease-Modell ist ihre automatische Bereinigung nicht sicher; das ist der bewusst akzeptierte, auf deterministische Bildziele begrenzte Speicherrest.
- Das erneute Kopieren ist nach abgeschlossenem Recipe-DELETE garantiert. Ein gleichzeitig laufender DELETE- und Copy-Aufruf wird durch bestehende Routen nicht serialisiert und ist nicht Teil dieses kleinen Vertrags.
- Product Owner gibt beide Drafts ausdrücklich frei; danach Backend, Frontend anhand des API-Handoffs, anschließend QA. Merge/Alpha-Release erst nach erfolgreicher QA; kein Infrastruktur-Deploy und kein nativer Mobile-Build.