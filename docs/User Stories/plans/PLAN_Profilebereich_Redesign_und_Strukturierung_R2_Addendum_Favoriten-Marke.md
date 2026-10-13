# Technischer Plan (Addendum zu R2): Favoriten verlieren die Marke beim Loggen ins Tagebuch

**Status:** Ready for implementation. Keine offenen Produktfragen, alle Work Packages sind ausführbar.
**Basis:** Addendum zu [`PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md`](PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md) (R2, freigegeben, umgesetzt bis F-2.4; F-2.5 und Q-2 stehen aus). R2 bleibt unverändert; wo dieses Addendum und R2 abweichen, gilt das Addendum (siehe „Verhältnis zu R2“).
**User Story:** None — Rückmeldung des Users zum R2-Ergebnis vom 2026-10-12.
**Infrastructure Impact:** Alpha (reine Backend-Code-Änderung, kein neues Deploy-Artefakt; wirkt in Alpha erst nach einem separaten `Deploy to Alpha`, der nur auf ausdrückliche User-Anweisung erfolgt. In Dev wirkt sie nach Neustart des lokalen Backends.)
**Mobile Build Impact:** None (keine Mobile-Änderung)
**Persistence Impact:** Verhaltensänderung der Schreib-Semantik auf dem bestehenden optionalen Feld `UserFoodRelation.displayBrand`. Klasse 0 (no migration): kein neues Feld, kein neuer Container, keine Formänderung am Dokument. Bestehende Dokumente bleiben gültig. Kein Backfill (Begründung in Abschnitt 4.3). Dev und Alpha getrennt betroffen, aber ohne Migrationsschritt.

## Open Product Owner Decisions

Keine offenen Fragen. Die Backfill-Entscheidung (Abschnitt 4.3) ist eine technische Bewertung nach dem Cosmos-Skill; sie wird nur neu geöffnet, wenn der User in Alpha viele betroffene Bestandsfavoriten meldet.

## 1. Requirement Assessment

**Classification:** Accept with modifications.

| Anforderung / Vermutung | Bewertung |
|---|---|
| „Favoriten sehen nicht wie Hub-Ergebnisse aus; vermutlich fehlt die Marke“ | Vermutung bestätigt, mit präzisierter Ursache: Das Frontend ist korrekt. Das Backend löscht `displayBrand`, sobald ein Favorit ins Tagebuch geloggt wird (siehe Abschnitt 3). |
| Bestehende Favoriten ohne Marke bleiben im Frontend ohne Marke (kein Lookup, keine Zusatzrequests) | Accept. Entspricht R2-AC-10. Heilung erfolgt über die Schreibpfade, nicht über Leselogik. |
| Minimaler, rückwärtskompatibler Backend-Fix | Accept. Zwei Repositories, ein Handler-Aufruf; kein Vertrag, kein Shared-Typ, keine Mobile-Änderung. |
| Diary-Request soll Marke tragen | Nicht empfohlen: `AddItemSchema` kennt kein Markenfeld; ein neues Feld wäre eine Vertragsänderung auf Backend und Mobile für ein Problem, das die Merge-Semantik allein löst. |

Health-/Domänenrisiko: keines (reine Anzeigedaten). Keine AI-Beteiligung (`azure-openai-feature-integration` nicht relevant).

## 2. Verhältnis zu R2

R2 schließt Backend-, Shared- und API-Änderungen aus (Abschnitt 1, „Backend-/API-Bedarf: keiner“ in 4.2, Abschnitt 6, F-2.2, R2-AC-10, R2-AC-17). Dieses Addendum definiert **eine begrenzte Ausnahme**:

| R2-Stelle | Wirkung des Addendums |
|---|---|
| R2-AC-10 | Bleibt gültig für die Frontend-Änderung „Favoriten“ (kein Zusatzrequest, kein API-Vertrag). Ausnahme: Die in R2A erlaubten Backend-Dateien dürfen geändert werden; Verträge, Shared-Typen und Responses bleiben unverändert. |
| R2-AC-17 | Ausnahme nur für die Dateien aus Abschnitt 5 (Scope). Weiterhin unverändert: `shared/`, `infra/`, `mobile/`, `backend/scripts/`, native Konfiguration, `package.json`/Lockfiles, neue Dependencies. Mobile Build Impact bleibt `None`. |
| R2 Abschnitt 1 und 6, 4.2 „Backend-/API-Bedarf: keiner“, F-2.2 „keine Backend-Änderung“ | Gelten für die R2-Frontend-Pakete weiter; werden durch die Ausnahme oben nicht inhaltlich geändert. Der Orchestrator führt beide Dokumente gemeinsam aus. |
| R2 Abschnitt 8/15 „Favoriten-Datenqualität: ältere Favoriten ohne `nutritionPer100g`“ | Unverändert. Zusätzlich gilt: Favoriten, die bereits ihre Marke verloren haben, bleiben ohne Marke, bis sie erneut favorisiert werden (Abschnitt 4.3). |
| Q-2 (R2) | Wird um R2A-AC-1 bis R2A-AC-9 und die Backend-Prüfung erweitert (Abschnitt 10). |

## 3. Current Behaviour (aus dem Code verifiziert, nicht am laufenden System nachgestellt)

**Hauptursache (bestätigt):**

- `backend/src/functions/diary.ts` (Fire-and-forget in `addItemHandler`, ca. Zeile 494) ruft `recordUsage` mit `displayBrand: undefined` auf. `AddItemSchema` enthält kein Markenfeld; der Request kann die Marke also nicht liefern.
- Beide Repositories überschreiben im Zweig „bestehende Relation“ und `foodRefType !== 'recipe'` das Feld bedingungslos: `...(input.foodRefType !== 'recipe' ? { displayBrand: input.displayBrand } : {})`.
  - Cosmos: `cosmosUserFoodRelationRepository.ts`, `recordUsage` (ca. Zeile 154). `JSON`-Serialisierung lässt `undefined` weg, der `upsert` ersetzt das ganze Dokument, die Marke ist danach in Cosmos **nicht mehr vorhanden**.
  - In-Memory: `userFoodRelationRepository.ts`, `recordUsage` (ca. Zeile 236): `displayBrand` wird mit `undefined` überschrieben.
- Folge: Favorit mit Marke (aus dem Hub gesetzt) → einmal ins Tagebuch loggen → `GET /api/favorites` liefert keine Marke mehr. Ein bis dahin nie geloggter Favorit behält die Marke. Das erklärt, warum die Darstellung in der Favoritenliste je nach Nutzungsverlauf vom Hub abweicht.

**Weitere Schreibpfade (geprüft):**

| Pfad | `displayBrand` | `displayName`, `imageUrl`, `nutritionPer100g`, `portion`, `isComplete` |
|---|---|---|
| `recordUsage` aus `diary.ts` (Add-Item, Typen `catalog`/`personal`) | **überschreibt mit `undefined`** (Fehler) | `displayName` wird bewusst mit dem aktuellen Namen aktualisiert; `imageUrl` nur bei `!= null` überschrieben (korrekt); `nutritionPer100g`, `portion`, `isComplete` bleiben über das Spread des Bestands erhalten (korrekt). Dieselbe Ursache betrifft **keine weiteren** Anzeigefelder. |
| `recordUsage` aus `diaryItemUsage.ts` (Bulk-Copy) und `recipeDiary.ts` | `diaryItemUsage` übergibt keine Marke → **gleicher Fehler** bei Katalog/Personal-Relationen; Rezepte entfernen die Marke ohnehin (`stripRecipeRelationCache`) | wie oben |
| `setFavorite` (`POST /api/favorites`, beide Repositories) | überschreibt bedingungslos (`displayBrand` ohne Guard); `imageUrl`, `nutritionPer100g`, `portion` sind mit `!== undefined` geschützt. Auswirkung nur, wenn ein Client beim erneuten Favorisieren keine Marke sendet (z. B. `QuantityView` mit Produkt ohne Marke) — selten, aber dieselbe Fehlerklasse | geschützt |
| `DELETE /api/favorites/:foodRef` | übergibt `existing.displayBrand` → Marke bleibt erhalten (korrekt) | — |
| `upsert` (beide Repositories) | überschreibt, hat aber **keinen Produktivaufrufer** (nur in Tests) → außerhalb des Scopes | — |
| `updateNutritionDenormalized` | berührt nur `nutritionPer100g`/`portion` | — |

**Weitere mögliche Backend-Ursachen für „Favoriten sehen anders aus“ (geprüft, nicht gefunden):** `GET /api/favorites` (`favorites.ts`) und `…/grouped` projizieren für Nicht-Rezepte nichts weg (`projectRecipeReferenceAccess` verändert nur Rezept-Relationen). `listFavorites` liefert das volle Dokument. `POST /api/favorites` akzeptiert und speichert `displayBrand`, `imageUrl`, `nutritionPer100g`, `portion` (Zod-Schema ca. Zeile 22). Es gibt keine weitere Backend-Ursache.

**Nicht-Backend-Ursachen (unverändert, siehe R2):** Favoriten ohne `nutritionPer100g` haben keine Nährwertzeile; Fotos eigener Lebensmittel zeigen den Avatar (PO-1 in R2); Rezepte haben keinen Bild-/Marken-Cache.

**Nicht verifiziert:** Ob der Fehler am laufenden Dev-/Alpha-System die vom User gesehenen Favoriten tatsächlich betrifft (Bestandsdokumente nicht eingesehen). B-A.1 beginnt deshalb mit einem fehlschlagenden Test, der den Verlust reproduziert.

## 4. Desired Behaviour

### 4.1 Merge-Semantik für Anzeigefelder

`recordUsage` und `setFavorite` aktualisieren `displayBrand` bei einer **bestehenden** Nicht-Rezept-Relation nur, wenn ein nicht leerer String geliefert wird. `undefined`, `null`, fehlender Wert und leerer String lassen den gespeicherten Wert unverändert. Ein gesetzter Wert überschreibt den gespeicherten (Aktualisierung bleibt möglich). Löschen einer Marke über diese Pfade ist nicht vorgesehen (kein bestehender Anwendungsfall).

Unverändert bleiben: `displayName`-Aktualisierung in `recordUsage` und `setFavorite`, die `imageUrl`-Regel („nie mit `null` überschreiben“), die Rezept-Behandlung (`stripRecipeRelationCache`, kein `displayBrand`/`imageUrl`/`nutritionPer100g`/`portion`/`isComplete`/`recipeAccess` am Rezept), Neuanlage-Zweige, `usageCount`, `lastUsedAt`, `usageDates`, EMA/Score-Logik, `isFavorite`, `favoritedAt`.

### 4.2 Diary-Pfad

`diary.ts` übernimmt **keine** Marke aus dem Request (kein Feld im Schema, nichts wird erfunden). Die explizite Zeile `displayBrand: undefined` im `recordUsage`-Aufruf entfällt; das Verhalten ergibt sich aus 4.1. Wird beim Loggen eine Relation neu angelegt (kein Favorit, kein Vorgänger), hat sie wie bisher keine Marke.

### 4.3 Altdaten: keine Migration, Heilung über Schreibpfade

- **Klassifizierung:** Klasse 0 (no migration). Kein neues Feld, optionale Felder bleiben optional, Lesepfade unverändert.
- **Backfill: nicht geplant.** Die verlorene Marke steht nicht mehr in der Relation. Eine explizite Migration (Klasse 3) müsste sie pro Relation aus `foodProducts` (Katalog) bzw. `reusableItems` (Personal) nachladen, in Dev und Alpha getrennt laufen und wäre für eine reine Anzeigeoptimierung unverhältnismäßig. Ein Lesezeit-Lookup pro Zeile in `GET /api/favorites` wäre N Zusatzreads und widerspricht der R2-Vorgabe (keine zusätzlichen Requests).
- **Heilung:** Favorit im Such-Hub entfernen und neu setzen (`SearchState.ResultRow` und `QuantityView` senden `displayBrand`); `setFavorite` schreibt die Marke wieder. Danach bleibt sie durch 4.1 erhalten. Das Loggen allein heilt nicht (der Diary-Request trägt keine Marke).
- **Dev:** Eigene Testfavoriten können so geheilt werden. **Alpha:** nach Deploy keine Aktion nötig; bereits betroffene Favoriten zeigen keine Marke, bis sie neu favorisiert werden. Das ist als Known limitation zu dokumentieren.

## 5. Scope und Out of Scope

**Scope (einzige erlaubte Backend-Änderungen):**

- `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts` und `backend/src/lib/repositories/userFoodRelationRepository.ts`: Merge-Semantik für `displayBrand` in `recordUsage` (Pflicht) und `setFavorite` (gleiche Fehlerklasse, ein Guard je Repository)
- `backend/src/functions/diary.ts`: Entfernen der Zeile `displayBrand: undefined`
- Tests (Abschnitt 7) und KB-Anpassung (Abschnitt 6, B-A.1)

**Out of Scope:**

- `shared/` (kein Typ-, Feld- oder Vertragswechsel; `UpsertUserFoodRelationInput`/`RecordUserFoodRelationUsageInput` unverändert), `mobile/`, `infra/`, `cosmos.ts`, `cosmos.bicep`, API-Verträge (`AddItemSchema`, `AddFavoriteBodySchema`), Responses
- Backfill-/Migrationsskript, Lesezeit-Lookup, Änderungen an `upsert` (ohne Produktivaufrufer), `displayName`-Semantik
- `diaryItemUsage.ts`, `recipeDiary.ts` (profitieren automatisch von der Repository-Änderung)
- Deployment nach Alpha (nur auf separate User-Anweisung)
- Pre-existing Beobachtung, nicht Teil des Fixes: Cosmos-`getByFoodRef` schluckt Lesefehler und liefert `null`; `recordUsage` würde dann ein neues Dokument anlegen. Als Finding an QA/Backlog melden, nicht hier beheben.

## 6. Work Packages

Alle Work Packages laufen streng nacheinander.

### B-A.1 Merge-Semantik für `displayBrand` (Cosmos und In-Memory), Diary-Aufruf, Tests, KB

**Agent:** Backend  
**Goal:** Reproduzierenden Test zuerst rot schreiben, dann `recordUsage` und `setFavorite` in beiden Repositories auf die Merge-Semantik aus 4.1 umstellen, die Zeile `displayBrand: undefined` in `diary.ts` entfernen, Tests ergänzen und die KB-Aussagen aktualisieren. Keine Vertrags-, Shared- oder Mobile-Änderung.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/domain/03-food-catalog.md`

**Required Repository Context:**

- `backend/src/lib/repositories/userFoodRelationRepository.ts`
- `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts`
- `backend/src/lib/repositories/userFoodRelationRepository.test.ts`
- `backend/src/lib/repositories/cosmosUserFoodRelationRepository.contract.test.ts`
- `backend/src/lib/repositories/cosmosRecipesRepository.test.ts` (Mock-Container-Muster mit `vi.hoisted` und `vi.mock('../cosmos')`)
- `backend/src/functions/diary.ts`, `backend/src/functions/diary.test.ts` (Block „addItemHandler — recordUsage foodRefType mapping“)
- `backend/src/functions/favorites.ts`, `backend/src/functions/favorites.test.ts`
- `shared/types/userFoodRelation.ts` (nur lesen)

**Required Skills:**

- `cosmos-data-model-and-migration` (Klasse 0, Invarianten, Testanforderungen)

**Relevant Acceptance Criteria:**

- R2A-AC-1 bis R2A-AC-9

**Dependencies:** Keine (R2 F-2.1 bis F-2.4 sind umgesetzt; kein Code-Konflikt, da R2 nur `mobile/` ändert).

**Vorgehen (Reihenfolge):**

1. In-Memory-Test schreiben, der den Verlust zeigt: `setFavorite` mit Marke → `recordUsage` ohne Marke → Marke fehlt (rot).
2. Beide Repositories: im Zweig „bestehende Relation, `foodRefType !== 'recipe'`“ in `recordUsage` die Zeile durch einen Guard ersetzen, der `displayBrand` nur bei nicht leerem String setzt. In `setFavorite` (Nicht-Rezept, bestehende Relation) denselben Guard auf `displayBrand` anwenden. Neuanlage-Zweige und Rezept-Zweige bleiben unverändert. Beide Implementierungen müssen identisch verhalten; kein neuer geteilter Helfer nötig (zwei Einzeiler, analog zu den bestehenden Spread-Mustern).
3. `diary.ts`: Zeile `displayBrand: undefined,` aus dem `recordUsage`-Aufruf entfernen; sonst nichts ändern.
4. Tests aus Abschnitt 7 ergänzen; Rest der Suite grün halten.
5. KB: `docs/kb/domain/03-food-catalog.md` (Abschnitt „Favorites and Quick Entry“) um die Merge-Regel ergänzen (`recordUsage`/`setFavorite` überschreiben `displayBrand` nur mit einem gesetzten Wert; Diary-Add trägt keine Marke; Bestandsfavoriten ohne Marke werden durch erneutes Favorisieren geheilt, [Known limitation]). `docs/kb/tech/02-backend.md` (Absatz zu `recordUsage`) um einen Satz ergänzen. **Keine** Änderung an `09-api-reference.md` und `04-shared-library.md` (kein Vertrags-/Typwechsel).

**Expected Handoff:**

- Liste der geänderten Dateien (nur Scope aus Abschnitt 5 plus Tests/KB)
- Bestätigung, dass der Reproduktionstest vor dem Fix rot war
- Testergebnisse: `npm test --workspace=@fittrack/backend`, `npm run typecheck --workspace=@fittrack/backend`; Contract-Test (`npm run test:contract --workspace=@fittrack/backend`) ausgeführt oder als „Emulator nicht verfügbar“ gemeldet
- Aussage zu Altdaten (Abschnitt 4.3) und Hinweis „kein Deploy durchgeführt“
- Beobachtung zu `getByFoodRef`-Fehlerschlucken als separates Finding (nicht behoben)

### F-2.5 (R2) Knowledge-Base-Abgleich — Ergänzung

Reihenfolge: **nach** B-A.1. Inhalt von R2 F-2.5 unverändert. Ergänzung: In der Favoriten-Dokumentation (`03-mobile.md`/`05-ux-patterns.md`) nur auf die Backend-Regel verweisen (Favoriten ohne Marke bleiben ohne Marke, Heilung durch erneutes Favorisieren); die Backend-Regel selbst steht in `03-food-catalog.md` (B-A.1). Keine Doppeldokumentation, keine Kollision mit den Dateien aus B-A.1.

### Q-2 (R2) QA — Ergänzung

Siehe Abschnitt 10. Reihenfolge: nach F-2.5.

## 7. Test Strategy

Gemäß `docs/kb/tech/08-testing.md` (Unit-Tests mit `vi.mock()` für Cosmos, Contract-Tests ausschließlich gegen den Emulator, nie gegen Azure-Cosmos).

**In-Memory-Repository (`userFoodRelationRepository.test.ts`, ergänzen):**

- Bestehender Favorit mit Marke, `recordUsage` ohne `displayBrand` (fehlend, `undefined`, `''`) → Marke unverändert; `usageCount`, `lastUsedAt`, `usageDates` aktualisiert; `isFavorite`, `favoritedAt`, `nutritionPer100g`, `portion`, `imageUrl` unverändert (R2A-AC-1, R2A-AC-3).
- `recordUsage` mit neuem nicht leeren `displayBrand` → gespeicherte Marke wird aktualisiert (R2A-AC-2).
- `recordUsage` mit `displayName` → wird weiterhin aktualisiert; `imageUrl` `undefined` überschreibt nicht (R2A-AC-3).
- Rezept-Relation mit Alt-Cache (`displayBrand`, `imageUrl`, `nutritionPer100g`) plus `recordUsage` mit `displayBrand` → kein `displayBrand` am Ergebnis (R2A-AC-4); der bestehende Test „recipe relation cache“ bleibt grün.
- `setFavorite` Nicht-Rezept: erneutes Favorisieren ohne Marke behält Marke; mit Marke aktualisiert; Unfavorite-Zyklus (`false` mit `existing.displayBrand`) behält Marke (R2A-AC-5).
- Neuanlage über `recordUsage` ohne Marke → keine Marke, kein erfundener Wert (R2A-AC-6).

**Cosmos-Repository, Mock-Container (neue Datei `cosmosUserFoodRelationRepository.test.ts`, Muster aus `cosmosRecipesRepository.test.ts`):**

- `getCosmos` per `vi.hoisted`/`vi.mock('../cosmos')` ersetzen; Container-Mock mit `item(id, userId).read` (liefert Bestandsdokument) und `items.upsert` (Spy).
- Dieselben Fälle wie In-Memory für `recordUsage` und `setFavorite`; Assertions auf das an `upsert` übergebene Dokument (`displayBrand` bleibt `'Kölln'`; `usageCount` +1). Rezept-Zweig prüft `stripRecipeRelationCache`-Verhalten unverändert (R2A-AC-1 bis R2A-AC-5).
- Fehlerverhalten unverändert: `recordUsage` ohne `usageDate` legt nichts an (bestehendes Verhalten, nicht erweitern).

**Contract-Test (`cosmosUserFoodRelationRepository.contract.test.ts`, ergänzen):** `makeInput` um optionales `displayBrand` erweitern; Fall: `setFavorite` mit Marke, `recordUsage` ohne Marke, Rohdokument aus dem Emulator hat weiterhin `displayBrand` (beweist die echte JSON-Serialisierung, in der `undefined` das Feld entfernt hätte). Läuft in CI Tier 2; lokal nur mit Emulator.

**Handler-Test (`diary.test.ts`, im Block „addItemHandler — recordUsage foodRefType mapping“):**

- Favorit mit Marke (`catalog`, `openFoodFacts:…`) per `setFavorite` anlegen, `addItemHandler` mit `sourceType: 'openFoodFacts'`, `productId` und `calculatedNutrition` aufrufen, Fire-and-forget abwarten (`setTimeout(0)`-Muster des Blocks), danach `getByFoodRef` und `listFavoritesHandler`: `displayBrand` vorhanden, `usageCount` 1, `isFavorite` true, `usageDates` korrekt (R2A-AC-6, R2A-AC-7).
- Dasselbe für `personal`/`reusableItem` (R2A-AC-6).
- Kein Vorgänger: nach dem Loggen existiert die Relation ohne `displayBrand`; ein zusätzliches Body-Feld `displayBrand`/`brand` im Request erzeugt keine Marke (Zod verwirft unbekannte Felder; belegt „nichts erfunden“).
- Regression der bestehenden Rezept-Tests im Block (Relation `recipe`, `stripRecipeRelationCache`) bleibt grün (R2A-AC-4).

**Regression:** gesamte Backend-Suite, insbesondere `favorites.test.ts` (Rezept-Projektion, `GET /api/favorites`), `communityRecipes.test.ts`, `diary.test.ts`. Typecheck des Backends.

**Manuelle Prüfung (MANUAL VALIDATION REQUIRED, Dev, lokales Backend neu gestartet):** Produkt mit Marke im Such-Hub favorisieren → ins Tagebuch loggen → Profil > Favoriten & Eigene Lebensmittel > Favoriten: Marke und `OFF`-Badge wie im Hub. Einen Bestandsfavoriten ohne Marke entfernen und im Hub neu setzen → Marke erscheint.

## 8. Risks and Edge Cases

- **Marke kann nicht mehr über `recordUsage`/`setFavorite` gelöscht werden.** Es gibt keinen Anwendungsfall; Markenänderungen eigener Produkte laufen über `reusableItems`. Aktualisierung mit neuem Wert bleibt möglich.
- **Stale Marke:** Ändert der User die Marke eines eigenen Produkts, wird die Relation beim nächsten Favorisieren mit der neuen Marke aktualisiert, nicht beim Loggen. Pre-existing (es gibt keine Brand-Sync-Funktion analog `updateNutritionDenormalized`); nicht Teil des Fixes, bei Bedarf eigenes Backlog-Item.
- **Bestandsdaten bleiben ohne Marke** (Abschnitt 4.3). Sichtbar nur in Alpha/Dev-Daten, in denen Favoriten bereits geloggt wurden. Als Known limitation dokumentiert.
- **Read-Modify-Write ohne ETag:** Fire-and-forget-`recordUsage` und gleichzeitiges `setFavorite` können sich überschreiben (pre-existing, unverändert).
- **`getByFoodRef` schluckt Lesefehler** (siehe Out of Scope): bei transientem Fehler könnte `recordUsage` ein frisches Dokument schreiben. Pre-existing; als Finding melden.
- **Zwei Implementierungen:** Drift zwischen Cosmos und In-Memory ist die Hauptfehlerquelle; deshalb identische Testfälle auf beiden Seiten plus Contract-Test.
- **Rezept-Zweig:** Der Guard darf `stripRecipeRelationCache` nicht umgehen; abgedeckt durch R2A-AC-4.

## 9. Acceptance Criteria

- **R2A-AC-1:** In beiden Repositories lässt `recordUsage` für eine bestehende Nicht-Rezept-Relation `displayBrand` unverändert, wenn `input.displayBrand` fehlt, `undefined`, `null` oder `''` ist. Der gespeicherte Cosmos-Dokumentinhalt enthält danach weiterhin die Marke.
- **R2A-AC-2:** Wird `recordUsage` mit einem nicht leeren `displayBrand` aufgerufen, ersetzt dieser die gespeicherte Marke (beide Repositories).
- **R2A-AC-3:** `recordUsage` verändert außer den dokumentierten Nutzungsfeldern (`lastUsedAt`, `usageCount`, `usageDates`, Input-Mode/EMA-Felder) und `displayName` keine Anzeigefelder: `imageUrl` (nie mit leerem Wert überschrieben), `nutritionPer100g`, `portion`, `isComplete`, `isFavorite`, `favoritedAt` bleiben erhalten; bestehende Tests zu `usageCount`/`lastUsedAt`/`usageDates` bleiben unverändert grün.
- **R2A-AC-4:** Rezept-Relationen verhalten sich unverändert: Nach `recordUsage` und `setFavorite` mit `foodRefType: 'recipe'` enthalten sie kein `displayBrand`, `imageUrl`, `nutritionPer100g`, `portion`, `isComplete`, `recipeAccess` (`stripRecipeRelationCache`), auch wenn Marke oder Bild geliefert werden.
- **R2A-AC-5:** `setFavorite` (Nicht-Rezept, bestehende Relation) behält die Marke bei fehlendem/leerem `displayBrand`, aktualisiert sie bei gesetztem Wert; `DELETE /api/favorites/:foodRef` behält die Marke. Neuanlage-Verhalten von `setFavorite` bleibt unverändert.
- **R2A-AC-6:** Das Loggen eines favorisierten Katalog- oder personal-Lebensmittels über `POST /api/diary/meals/:id/items` erhält dessen `displayBrand`. Der Diary-Request liefert keine Marke und der Handler erfindet keine; eine dabei neu angelegte Relation hat keine Marke. Die Zeile `displayBrand: undefined` im `recordUsage`-Aufruf ist entfernt.
- **R2A-AC-7:** `GET /api/favorites` liefert nach dem Loggen für Nicht-Rezepte weiterhin `displayBrand`, `imageUrl`, `nutritionPer100g`, `portion` aus dem Dokument (Handler-Test); Response-Form, Sortierung und Rezept-Projektion bleiben unverändert.
- **R2A-AC-8:** Es gibt keine Änderung an `shared/`, `mobile/`, `infra/`, `backend/src/lib/cosmos.ts`, `AddItemSchema`, `AddFavoriteBodySchema`, API-Verträgen, `package.json`/Lockfiles; kein neues Feld, kein neuer Container, kein Backfill-/Migrationsskript, kein Deploy. Persistence Impact: Klasse 0, im Handoff bestätigt.
- **R2A-AC-9:** Tests laut Abschnitt 7 existieren und sind grün (In-Memory, Cosmos-Mock-Container, Handler-Test, Contract-Test geschrieben und, falls Emulator verfügbar, ausgeführt); der Reproduktionstest war vor dem Fix nachweislich rot; Backend-Suite und Typecheck sind grün. `docs/kb/domain/03-food-catalog.md` und `docs/kb/tech/02-backend.md` beschreiben die Merge-Regel und die Known limitation (Bestandsfavoriten ohne Marke); `09-api-reference.md` und `04-shared-library.md` sind unverändert.

## 10. Q-2 Anpassung (Ergänzungen zu R2 Q-2; nicht gelistete Felder bleiben wie in R2)

**Agent:** QA  
**Goal (zusätzlich):** R2A-AC-1 bis R2A-AC-9 prüfen; bestätigen, dass die Backend-Ausnahme den R2-Scope nicht überschreitet (R2-AC-17 nur um die Dateien aus Abschnitt 5 erweitert); dass Favoriten nach dem Loggen die Marke behalten (Tests und, soweit möglich, manueller Dev-Ablauf); Abgleich Cosmos-Merge gegen Klasse 0 des Skills.

**Required Knowledge Base (zusätzlich):**

- `docs/kb/domain/03-food-catalog.md`
- `docs/kb/tech/02-backend.md`

**Required Repository Context (zusätzlich):**

- `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts`, `userFoodRelationRepository.ts` und deren Tests inkl. Contract-Test
- `backend/src/functions/diary.ts`, `diary.test.ts`, `favorites.ts`, `favorites.test.ts`
- Diff-Beleg: keine Änderungen in `shared/`, `mobile/` (außer R2-Umfang), `infra/`, `backend/scripts/`

**Required Skills (zusätzlich):**

- `cosmos-data-model-and-migration` (Abschnitt 9 des Skills, QA-Checkliste)

**Relevant Acceptance Criteria:** R2-AC-1 bis R2-AC-20 und R2A-AC-1 bis R2A-AC-9

**Dependencies:** F-2.1 bis F-2.5 und B-A.1.

**Expected Handoff (zusätzlich):** Kriterienmatrix um R2A-AC-1 bis R2A-AC-9; Ausweis, ob der Contract-Test ausgeführt wurde (sonst `MANUAL VALIDATION REQUIRED` oder CI-Evidenz); manuelle Dev-Prüfliste aus Abschnitt 7; Known limitation für Bestandsfavoriten bestätigt; Finding zu `getByFoodRef`-Fehlerschlucken und zur fehlenden Brand-Synchronisation bei Produktänderung (Suggestion) an das Register nach Orchestrator-Vorgabe; kein Deploy ausgelöst.

## 11. Recommended Execution Order

1. **Backend B-A.1:** roter Reproduktionstest, Merge-Semantik in beiden Repositories (`recordUsage`, `setFavorite`), `diary.ts`-Zeile entfernen, Tests (In-Memory, Cosmos-Mock, Contract, Handler), KB (`03-food-catalog.md`, `02-backend.md`).
2. **Frontend F-2.5 (R2):** KB-Abgleich wie in R2, mit der Ergänzung aus Abschnitt 6 (Verweis, keine Doppeldokumentation). Läuft nach B-A.1, damit der dokumentierte Zustand dem Endstand entspricht.
3. **QA Q-2 (R2, erweitert):** R2-AC-1 bis R2-AC-20 plus R2A-AC-1 bis R2A-AC-9; der Backend-Teil von Q-2 ist nur gültig, wenn B-A.1 abgeschlossen ist.

Infrastructure & Release: kein Work Package. Deployment: Dev lokal wirksam nach Neustart des Backends; **Alpha** erhält den Fix erst durch ein separates `Deploy to Alpha` (Funktions-App `func-fittrack-alpha-ppf5sc`), das nur auf ausdrückliche User-Anweisung erfolgt. Kein neuer Mobile-Build, kein Infrastruktur-Deploy, keine Migration.
