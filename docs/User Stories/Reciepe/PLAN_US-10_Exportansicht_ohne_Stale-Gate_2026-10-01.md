# US-10: Exportansicht ohne Stale-Gate

**Status:** AUTO-APPROVED / EXECUTION AUTHORIZED — user confirmed 2026-10-01  
**Infrastructure Impact:** None  
**Mobile Build Impact:** None

## 1. Entscheidung und Abgrenzung

Dieser neue Plan setzt ausschliesslich die zuletzt bestaetigte Vereinfachung
um. Das normale Rezept bleibt die kanonische Quelle und wird durch
Exporttexte weder ueberschrieben noch mit ihnen vermischt. Teaser und
verkuerzte Exportschritte bleiben eigenstaendige Exportdaten.

Die aktuelle Nutzerentscheidung setzt fuer diesen eng begrenzten Punkt die
Stale-/Erneut-bestaetigen-Regel aus US-10 und dem bestehenden Plan ausser
Kraft: Ein stale Fingerprint darf das Teilen nicht blockieren. Die
User-Story und der bestehende US-10-Plan bleiben unveraendert; alle anderen
US-10-Anforderungen bleiben ausserhalb dieses Plans unberuehrt.

Keine offene Produktentscheidung. Die exportierte Fassung darf nach einer
normalen Rezeptaenderung inhaltlich vom normalen Rezept abweichen; sie wird
nicht automatisch aktualisiert und beim Teilen nicht durch KI neu erzeugt.

## 2. Bestaetigter Ist-Zustand

- Backend leitet `exportViewStatus` aus dem gespeicherten Fingerprint ab.
  `shareBundleHandler` verlangt aktuell `current` und liefert andernfalls
  `422 STALE_EXPORT_VIEW`.
- Die Exportvorbereitung akzeptiert bereits ausschliesslich den strikten
  V2-Body `{ "contractVersion": 2 }`, verlangt aber `If-Match`. Mobile sendet
  den ETag und vergleicht `sourceEtag` in der Antwort.
- Die explizite Exportbestaetigung verlangt im Backend und Mobile ebenfalls
  einen Client-ETag. Der Repository-Pfad verwendet ausserdem
  `compareAndReplace` mit dem serverseitig gelesenen Cosmos-/In-Memory-ETag.
- Der Detailrenderer verwendet die aktuelle Rezeptentitaet fuer kanonische
  Angaben und `exportView` fuer Teaser, Zeit, Schwierigkeit, Exportzutaten-IDs
  und Exportschritte. Die gespeicherten IDs werden nicht per Name oder
  KI-Schluessel neu zugeordnet.
- `FT-QA-2026-037` ist im Register aktuell geschlossen. Der letzte Q-1-Bericht
  beschreibt die damalige V2-Kandidatenaufloesung; QA muss die Anwendbarkeit
  dieser alten Erwartung unter dem hier bestaetigten Text-only-V2-Vertrag neu
  bewerten.

## 3. Zielverhalten

- Ein vorhandener `exportView` darf trotz `exportViewStatus: 'stale'` geteilt
  werden. Der Share-Bundle-Handler entfernt nur den Freshness-Gate; die
  bestehende Pruefung auf eine fehlende Exportfassung sowie Bild-, Auth- und
  Renderer-Validierung bleiben bestehen.
- Backend laedt beim Rendern das aktuelle Rezept serverseitig. Normale
  Rezeptfelder bleiben kanonisch. Ausschliesslich exportbezogene Felder
  stammen aus `exportView`; sie werden nie in `Recipe.description` oder
  `Recipe.steps` geschrieben. Zutatenwerte werden aus dem aktuellen Rezept
  ueber die gespeicherten IDs gelesen. Es gibt kein KI-Key-/Namens-Matching.
- Vorbereitung bleibt V2-only mit exakt `{ "contractVersion": 2 }`; kein
  leerer Body und kein V1-Fallback. Die Vorbereitung bleibt transient und
  liefert Exporttextfelder, nicht neue Zutatenzuordnungen. Gespeicherte
  Zutaten-IDs und -Werte werden dadurch nicht veraendert.
- Exportvorbereitung und Exportbestaetigung benoetigen keinen Client-ETag.
  Mobile sendet keinen `If-Match` und verlangt weder einen ETag beim Laden noch
  einen passenden `sourceEtag` zur Annahme der Vorbereitung. Die bestehende
  V2-Antwortform einschliesslich `sourceEtag` bleibt fuer Kompatibilitaet
  erhalten; Mobile behandelt das Feld nicht als Freigabebedingung.
- Repository-`compareAndReplace` bleibt als interne Schreibsicherung erhalten.
  Bei einem echten Konflikt zwischen serverseitigem Lesen und Schreiben wird
  der bestehende `recipe_revision_conflict` kontrolliert zurueckgegeben; es
  erfolgt kein stilles Ueberschreiben oder automatischer Wiederholungsversuch.
  Mobile bietet fuer diesen seltenen Konflikt einen wiederherstellbaren
  Reload-/Retry-Pfad, nicht die Meldung „Exportansicht nicht aktuell“.

**ETag-Abwaegung:** Ein Client-ETag schuetzt konkret, wenn dasselbe Rezept auf
zwei Geraeten/Screens offen ist und ein aelterer Stand nach einer neueren
Aenderung gespeichert wird. Die interne CAS-Sicherung erkennt dagegen nur
einen Schreibkonflikt nach dem serverseitigen Lesen, nicht jeden bereits
veralteten Client-Entwurf. Dieser seltene Lost-Update-Fall ist der Trade-off
der bestaetigten ETag-freien Export-UX; ein allgemeiner Merge-/Repositoryumbau
ist nicht Teil des Plans.

## 4. Persistenz, Release und Dokumentation

**Persistence Impact:** Keine Aenderung an Dokumentfeldern oder Cosmos-
Containern. Das optionale `exportView`, sein serverseitiger Fingerprint und
der abgeleitete response-only Status bleiben erhalten. Bestehende Fingerprints
werden weder migriert noch zurueckgeschrieben; stale Werte bleiben
lesekompatibel und werden vom Share-Gate ignoriert. Keine Migration, keine
Aenderung an `cosmos.ts` oder `infra/modules/cosmos.bicep`.

Keine neue Route, kein Prompt-/Schema-/Quota-Umbau, keine native Mobile-
Aenderung. Die Knowledge Base muss die neue Share- und ETag-Semantik abbilden.
Kein Build, Deploy oder Release ist durch diesen Plan autorisiert; solche
Operationen benoetigen eine separate Anfrage.

## 5. Akzeptanzkriterien

- **AC-1:** Vorbereitung und Exportbestaetigung ueberschreiben oder veraendern
  `Recipe.description` und normale `Recipe.steps` nicht. Export-Teaser und
  Exportschritte bleiben ausschliesslich in `exportView`.
- **AC-2:** Ein Rezept mit vorhandenem, aber stale `exportView` liefert beim
  Share-Bundle weiterhin das vollstaendige Instagram-/Detailbild-Paar. Es
  gibt weder `STALE_EXPORT_VIEW` noch eine stale-spezifische Mobile-Meldung
  oder erzwungene Neubestaetigung. Aktuelle kanonische Angaben und getrennte
  Exporttexte werden aus den jeweiligen Serverfeldern gerendert.
- **AC-3:** Ein fehlendes `exportView` behaelt das bisherige kontrollierte
  `MISSING_EXPORT_VIEW`-Verhalten. Teilen loest keine KI aus; das Bundle bleibt
  atomar und liefert nie nur eines der beiden Bilder.
- **AC-4:** Vorbereitung akzeptiert exakt V2 und weist leere, fehlende,
  zusaetzliche oder ungueltige Felder bzw. andere Versionen mit dem
  bestehenden Validierungsfehler zurueck. Vorbereitung aendert weder Rezept
  noch gespeicherte Exportzutaten-IDs/-Werte und fuehrt kein Mapping von
  KI-Schluesseln auf Rezeptzutaten ein.
- **AC-5:** Vorbereitung und Exportbestaetigung funktionieren ohne
  Client-`If-Match`; Mobile sendet und vergleicht dafuer keine ETags. Ein
  tatsaechlicher interner CAS-Konflikt schreibt keine Daten und wird als
  `recipe_revision_conflict`, nicht als stale Export, behandelt.
- **AC-6:** Bestehende Paar-Share-Tests bleiben gueltig; Fehler eines Renderers
  erzeugen weiterhin kein Teil-Bundle. Authentifizierung und serverseitige
  Rezept-/Bildauswahl bleiben unveraendert.
- **AC-7:** QA bewertet `FT-QA-2026-037` gegen den neuen V2-Vertrag und haelt im
  QA-Bericht fest, ob die historische Mehrdeutigkeitsanforderung noch
  anwendbar ist. `docs/qa/findings.md` wird nicht geaendert.

## 6. Work Packages

### Backend

**Agent:** Backend  
**Goal:** Stale-Status als Share-Sperre entfernen, Exportvorbereitung und
Bestaetigung ohne Client-ETag-Prerequisite ermoeglichen, interne CAS-Sicherung
beibehalten und die API-/Backend-KB aktualisieren.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `backend/src/functions/instagramRecipe.ts` und `instagramRecipe.test.ts`
- `backend/src/functions/recipes.ts` und `recipes.test.ts`
- `backend/src/lib/instagramRenderer/recipeAdapter.ts`
- `backend/src/lib/repositories/recipesRepository.ts`
- `backend/src/lib/repositories/cosmosRecipesRepository.ts`
- `shared/types/recipes.ts`

**Required Skills:**
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:** AC-1 bis AC-6  
**Dependencies:** Keine.  
**Expected Handoff:** Geaenderte Handler- und Regressionstests, bestaetigte
CAS-Konfliktsemantik sowie aktualisierte API-, Backend- und Rezept-KB. Keine
Schema-/Infrastrukturmigration.

### Frontend

**Agent:** Frontend  
**Goal:** V2-Vorbereitung und Exportbestaetigung ohne ETag-Zwang abbilden,
stale Share-Fehlertext entfernen und einen echten CAS-Konflikt getrennt und
wiederherstellbar behandeln.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/product/05-ux-patterns.md`

**Required Repository Context:**
- `mobile/src/shared/api/recipeApi.ts` und `recipeApi.test.ts`
- `mobile/src/modules/recipes/RecipeWizardScreen.tsx`
- `mobile/src/modules/recipes/recipeWizardEditBootstrap.ts`
- `mobile/src/modules/recipes/recipeWizardExportView.ts`
- `mobile/src/modules/recipes/recipeShareRenderNotice.ts` und Test

**Required Skills:** None  
**Relevant Acceptance Criteria:** AC-1 bis AC-5  
**Dependencies:** Backend-Handoff mit finalem Header-/Fehlervertrag.  
**Expected Handoff:** ETag-freier V2-Aufruf und Export-Save, keine stale-
Share-Sperrmeldung, Regressionstests und aktualisierte Mobile-KB. Kein
UI-Redesign und keine native Aenderung.

### QA

**Agent:** QA  
**Goal:** Alle ACs gegen die Backend-/Mobile-Handoffs pruefen, den
Zwei-Bilder-Share und die normale Rezeptdatenquelle regressionspruefen sowie
`FT-QA-2026-037` neu einordnen.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- Backend- und Mobile-Dateien aus den vorigen Work Packages
- `docs/qa/findings.md` (nur FT-QA-2026-037; nicht bearbeiten)
- `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`

**Required Skills:**
- `cosmos-data-model-and-migration`

**Relevant Acceptance Criteria:** AC-1 bis AC-7  
**Dependencies:** Backend- und Frontend-Handoffs abgeschlossen.  
**Expected Handoff:** QA-Bericht
`docs/qa/reports/PLAN_US-10_Exportansicht_ohne_Stale-Gate_2026-10-01.md` mit
Kriterienmatrix, Testbelegen und expliziter Neubewertung von FT-QA-2026-037.
Das zentrale Findings-Register bleibt unangetastet.

## 7. Ausfuehrungsreihenfolge und Gates

1. Backend implementiert AC-1 bis AC-6, aktualisiert Backend/API-Dokumentation
   und fuehrt mindestens `cd backend && npx vitest run` sowie
   `cd backend && npm run build:verify` aus.
2. Frontend uebernimmt den Backend-Handoff, implementiert den ETag-freien
   Exportablauf, aktualisiert die Mobile-KB und fuehrt Mobile-Tests sowie
   `cd mobile && npx tsc --noEmit` aus.
3. QA prueft alle Kriterien. Vorhandene Cosmos-Contracttests duerfen nur gegen
   den lokalen Emulator laufen; ist dieser nicht verfuegbar, wird der Check
   als `UNVERIFIED` ausgewiesen. Kein Azure-Zugriff, Build oder Deploy.

Alle Arbeitspakete laufen strikt nacheinander: Backend -> Frontend -> QA.