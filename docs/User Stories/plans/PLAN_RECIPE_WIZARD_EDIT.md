# Technischer Plan: Rezeptbearbeitung im RecipeWizard

**Status:** Genehmigt  
**User Story:** None  
**Infrastructure Impact:** Dev  
**Mobile Build Impact:** None  

## 1. Requirement Assessment

Der bestehende RecipeWizard wird auch für die Rezeptbearbeitung verwendet.

Im Edit-Modus:

- öffnet `Bearbeiten` direkt den Wizard,
- wird das bestehende Rezept vollständig geladen,
- startet der Wizard bei „Zutaten bestätigen“,
- wird die generelle Recipe-AI-Analyse niemals aufgerufen,
- bleibt die einzelne Food-AI über den Search Hub erlaubt,
- darf kein Rezept-Hub-Pfad einen Tagebucheintrag erzeugen,
- werden Metadaten, Zutaten, Schritte und Bilder bearbeitet,
- wird der alte `RecipeCreateScreen` vollständig entfernt.

Es existiert keine passende User Story. Daher wird dieser Plan nach dem dokumentierten Fallback unter `docs/User Stories/plans/` abgelegt.

## 2. Product Decisions

- Bilder: anzeigen, hinzufügen, löschen und neu sortieren.
- Beschreibung und Tags: editierbar.
- `RecipeStep.notes`: keine Produktfunktion; bestehende Notes dürfen vollständig entfernt werden.
- Zutaten: Suche, Favoriten, Recents, Mengenbearbeitung und Food-AI über den Search Hub.
- Recipe-AI-Analyse: im Edit-Modus verboten.
- Diary-Operationen: im Rezeptkontext verboten.

## 3. Current Behaviour

- Der Wizard unterstützt aktuell hauptsächlich die Rezeptneuanlage.
- `RecipeDetailScreen` öffnet zum Bearbeiten noch `RecipeCreateScreen`.
- `RecipeCreate` ist weiterhin im Navigator registriert.
- Bestehende Wizard-, Hub-, Schritt- und Bildfunktionen werden als Ausgangsbasis wiederverwendet.
- Bestehende Bilder können noch nicht vollständig im Wizard bearbeitet und sortiert werden.
- Eine Bild-Reorder-API fehlt.
- `RecipeStep.notes` existiert noch im Shared-Typ und im Backend-Vertrag.

## 4. Scope

- `RecipeWizard({ editId?: string })`
- Edit-Bootstrap per `GET /api/recipes/{id}`
- Start direkt bei „Zutaten bestätigen“
- Vollständiges Mapping bestehender Rezeptdaten
- `PUT`-Speichern im Edit-Modus
- Bearbeitung von Zutaten, Metadaten, Schritten und Bildern
- Rezeptfähiger Search Hub ohne Diary-Seiteneffekte
- Erlaubte Food-AI für einzelne Zutaten
- Verbot der generellen Recipe-AI-Analyse
- Bild-Reorder-API
- Entfernung von `RecipeCreateScreen`, Route und ausschließlich daran hängenden Komponenten
- Entfernung von `RecipeStep.notes` aus Typen, API-Vertrag und Persistenz-Mapping
- Aktualisierung der Dokumentation und Tests

## 5. Out of Scope

- Neue Recipe-AI-Prompts oder Recipe-AI-Endpunkte
- Änderungen an Diary-APIs
- Tagebuch-Logging aus dem Rezepteditor
- Neue Cosmos- oder Blob-Container
- Änderung des Partition Keys
- Globale Migration aller bestehenden Rezeptdokumente
- Neue native Module oder Expo-Konfiguration
- Wiederherstellung oder Anzeige von Notes

## 6. Persistence Impact

- Bilddateien bleiben in Azure Blob Storage.
- Bildmetadaten wie ID, Blob-Name und Reihenfolge bleiben in Cosmos DB.
- Die Bild-Reorder-API ändert nur `images[].order`.
- `RecipeStep.notes` wird als Class-2-Lazy-Cleanup behandelt:
  - alte Dokumente bleiben zunächst lesbar,
  - Read-Mappings geben Notes nicht mehr aus,
  - neue und aktualisierte Dokumente enthalten keine Notes,
  - beim nächsten Update werden bestehende Notes entfernt,
  - keine globale Migration ist erforderlich.
- Der bestehende `recipes`-Container und `/userId` bleiben unverändert.

## 7. Proposed API Change

```text
PUT /api/recipes/{id}/images/order
```

Request:

```json
{
  "imageIds": ["image-id-2", "image-id-1"]
}
```

Regeln:

- Authentifizierung über `requireUser()`
- Rezept muss dem Benutzer gehören
- IDs müssen vollständig, eindeutig und dem Rezept zugeordnet sein
- Reihenfolge wird serverseitig auf `1..n` normalisiert
- Blob-Daten werden nicht vom Client verändert

## 8. Backend Work Package B-1

**Agent:** Backend

**Goal:** Rezeptvertrag, Notes-Bereinigung und Bild-Reorder-API umsetzen.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`

**Required Repository Context:**

- `backend/src/functions/recipes.ts`
- `backend/src/functions/recipes.test.ts`
- `backend/src/lib/repositories/recipesRepository.ts`
- `backend/src/lib/repositories/cosmosRecipesRepository.ts`
- `shared/types/recipes.ts`

**Required Skills:**

- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**

- AC-9
- AC-10
- AC-11
- AC-12

**Dependencies:** None

**Expected Handoff:**

- finaler `PUT`-Vertrag
- implementierter Bild-Reorder-Endpoint
- Notes-freies Step-Mapping
- aktualisierte Backend- und Contract-Tests
- Bestätigung: keine Cosmos-Migration und keine Infrastrukturänderung

## 9. Frontend Work Package F-1

**Agent:** Frontend

**Goal:** Navigation und Edit-Bootstrap im RecipeWizard umsetzen.

**Required Knowledge Base:**

- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/domain/06-recipes.md`

**Required Repository Context:**

- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/modules/recipes/RecipeDetailScreen.tsx`
- `mobile/src/modules/recipes/RecipeWizardScreen.tsx`
- `mobile/src/modules/recipes/recipeWizardTypes.ts`
- `mobile/src/shared/api/recipeApi.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-3
- AC-4

**Dependencies:**

- Backend-Handoff aus B-1

**Expected Handoff:**

- `RecipeWizard: { editId?: string }`
- Navigation von Detail zu Wizard
- Lade-, Fehler- und Retry-Zustand
- Recipe-to-Wizard-Mapping
- Edit-Start bei der Zutatenphase

## 10. Frontend Work Package F-2

**Agent:** Frontend

**Goal:** Vollständige Bearbeitung und Speicherung des Wizard-Drafts umsetzen.

**Required Knowledge Base:**

- `docs/kb/domain/06-recipes.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**

- `mobile/src/modules/recipes/RecipeWizardScreen.tsx`
- `mobile/src/modules/recipes/RecipeWizardIngredientsPhase.tsx`
- `mobile/src/modules/recipes/RecipeWizardStepsPhase.tsx`
- `mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx`
- `mobile/src/modules/recipes/recipeWizardTypes.ts`
- `mobile/src/shared/api/recipeApi.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10

**Dependencies:**

- B-1
- F-1

**Expected Handoff:**

- vollständig vorbefüllter Edit-Draft
- editierbare Beschreibung und Tags
- Zutaten- und Schrittbearbeitung
- Bild-Draft mit Hinzufügen, Löschen und Sortieren
- korrekte PUT-, Upload-, Delete- und Reorder-Reihenfolge

## 11. Frontend Work Package F-3

**Agent:** Frontend

**Goal:** Rezeptfähigen Search Hub mit erlaubter Food-AI und ohne Diary-Operationen umsetzen.

**Required Knowledge Base:**

- `docs/kb/product/04-food-entry-hub.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/domain/07-ai-features.md`

**Required Repository Context:**

- `mobile/src/modules/nutrition/hub/useFoodEntryHubStore.ts`
- `mobile/src/modules/nutrition/hub/FoodEntryHub.tsx`
- `mobile/src/modules/nutrition/hub/SearchState.tsx`
- `mobile/src/modules/nutrition/hub/QuantityView.tsx`
- `mobile/src/modules/nutrition/hub/AISubFlow.tsx`
- `mobile/src/modules/nutrition/hub/LabelSubFlow.tsx`
- `mobile/src/modules/nutrition/hub/ManuellerSubFlow.tsx`
- `mobile/src/modules/nutrition/hub/BarcodeSubFlow.tsx`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-5
- AC-6
- AC-13

**Dependencies:**

- F-1
- F-2

**Expected Handoff:**

- expliziter Rezeptkontext im Hub
- Zutaten-Callbacks zum Wizard
- Food-AI über `onEstimateIngredient`
- keine Diary-Mutationen im Rezeptkontext
- unverändertes Verhalten für Diary-Aufrufe

## 12. Frontend Work Package F-4

**Agent:** Frontend

**Goal:** Alten Rezeptbearbeitungsfluss vollständig entfernen.

**Required Knowledge Base:**

- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/domain/06-recipes.md`

**Required Repository Context:**

- `mobile/src/modules/recipes/RecipeCreateScreen.tsx`
- `mobile/src/modules/recipes/AddIngredientModal.tsx`
- `mobile/src/modules/recipes/RecipeIngredientAmountView.tsx`
- `mobile/src/shared/components/QuantityInputRow.tsx`
- `mobile/src/app/navigation/RootNavigator.tsx`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-14

**Dependencies:**

- F-2
- F-3

**Expected Handoff:**

- entfernte `RecipeCreate`-Route
- entfernte `RecipeCreateScreen`
- entfernte ausschließlich ungenutzte Legacy-Komponenten
- keine aktiven Legacy-Imports
- weiterhin verwendete Shared-Komponenten bleiben erhalten

## 13. Documentation Work Package F-5

**Agent:** Frontend

**Goal:** Dokumentation an den tatsächlichen Implementierungsstand anpassen.

**Required Knowledge Base:**

- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/04-food-entry-hub.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/tech/04-shared-library.md`

**Required Repository Context:**

- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/modules/recipes/RecipeWizardScreen.tsx`
- `mobile/src/modules/nutrition/hub/FoodEntryHub.tsx`
- `backend/src/functions/recipes.ts`
- `shared/types/recipes.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-15

**Dependencies:**

- B-1
- F-4

**Expected Handoff:**

- aktualisierte Navigations-, Rezept-, Hub- und API-Dokumentation
- dokumentierte Bild-Reorder-API
- dokumentierte Notes-Entfernung
- dokumentierte Trennung von Recipe-AI und Food-AI

## 14. QA Work Package Q-1

**Agent:** QA

**Goal:** Vollständige Prüfung von Navigation, Persistenz, AI-Trennung, Diary-Isolation, Bildverwaltung und Legacy-Entfernung.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/product/04-food-entry-hub.md`

**Required Repository Context:**

- alle geänderten Backend-, Shared- und Mobile-Dateien
- `backend/src/functions/recipes.test.ts`
- Cosmos-Repository-Contract-Tests
- `mobile/src/modules/nutrition/hub/hubReducer.test.ts`
- vorhandene RecipeWizard- und Preview-Tests

**Required Skills:**

- `azure-openai-feature-integration`
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:**

- AC-1 bis AC-15

**Dependencies:**

- B-1
- F-1
- F-2
- F-3
- F-4
- F-5

**Expected Handoff:**

- `PASS`, `PASS WITH ISSUES` oder `FAIL`
- Testergebnisse
- Acceptance-Criteria-Matrix
- reproduzierbare Befunde und offene Restpunkte

## 15. Infrastructure Work Package I-1

**Agent:** Infrastructure

**Goal:** Release-Bereitschaft und Dev-Auslieferung prüfen.

**Required Knowledge Base:**

- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

**Required Repository Context:**

- `backend/package.json`
- `infra/main.bicep`
- `infra/modules/cosmos.bicep`
- `mobile/app.config.js`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-15

**Dependencies:**

- erfolgreicher QA-Handoff

**Expected Handoff:**

- Bestätigung: keine Bicep-, Container- oder Native-Änderung
- Dev-Deployment-Sequenz
- Health-Check und Release-Report
- Entscheidung `Dev Build Required: NO`

## 16. Acceptance Criteria

**AC-1:** `Bearbeiten` öffnet den RecipeWizard mit der korrekten `editId`.

**AC-2:** Das Rezept wird geladen und der Wizard startet direkt bei „Zutaten bestätigen“.

**AC-3:** Input- und Analysephase sind im Edit-Modus nicht erreichbar.

**AC-4:** Metadaten, Zutaten, Schritte und bestehende Bilder werden vollständig vorbefüllt.

**AC-5:** Zutaten können über den Search Hub geöffnet, ersetzt, ergänzt, entfernt und mengenmäßig bearbeitet werden.

**AC-6:** Food-AI-Ergebnisse werden über rezeptfähige Callbacks in den Wizard-State übernommen.

**AC-7:** Schritte können bearbeitet, hinzugefügt, gelöscht und sortiert werden.

**AC-8:** Beschreibung und Tags können geändert und geleert werden.

**AC-9:** Der Edit-Save verwendet `PUT /api/recipes/{id}`; Nährwerte werden serverseitig neu berechnet.

**AC-10:** Bestehende Bilder bleiben ohne Bildänderung unverändert; neue Bilder werden hochgeladen.

**AC-11:** Bilder können gelöscht und über eine abgesicherte Reorder-API sortiert werden.

**AC-12:** Die generelle Recipe-AI-Analyse ruft im Edit-Modus niemals `/api/ai/recipe-analyze` auf. Die erlaubte Food-AI im Search Hub bleibt verfügbar.

**AC-13:** Kein Rezept-Hub-Pfad ruft Diary-Mutationen auf oder erzeugt einen Tagebucheintrag.

**AC-14:** `RecipeStep.notes` ist nicht mehr Bestandteil des Shared-Typs, Backend-Vertrags oder API-Mappings. Bestehende Notes werden beim nächsten Rezept-Update entfernt.

**AC-15:** Alte Route, alter Screen, relevante Dokumentation und Tests entsprechen dem neuen Create-/Edit-Wizard-Verhalten.

## 17. Test Strategy

- Backend Unit- und Contract-Tests für Rezept-Update, Notes-Bereinigung und Bild-Reorder
- Shared-Typecheck und Tests
- Mobile Typecheck und Tests
- Tests für fehlende, doppelte und fremde Bild-IDs
- Tests für fehlende Kategorie und bestehende Legacy-Rezeptdokumente
- Tests, dass Edit niemals `recipe-analyze` aufruft
- Tests, dass Food-AI im Hub erlaubt bleibt
- Tests, dass der Rezept-Hub keine Diary-API aufruft
- Manuelle Prüfung:
  - Detail → Bearbeiten
  - Start bei Zutaten
  - Zutat ersetzen und hinzufügen
  - Food-AI verwenden
  - Beschreibung und Tags leeren
  - Schritte ändern und sortieren
  - Bilder hinzufügen, löschen und sortieren
  - ohne Bildänderung speichern
  - Create- und Diary-Flows prüfen

## 18. Recommended Execution Order

1. B-1 — Backend-Vertrag, Notes-Bereinigung und Bild-Reorder
2. F-1 — Navigation und Edit-Bootstrap
3. F-2 — Wizard-Draft und Speichern
4. F-3 — Rezeptfähiger Search Hub
5. F-4 — Entfernung des alten Flows
6. F-5 — Dokumentation
7. Q-1 — QA
8. I-1 — Dev-Release-Prüfung
