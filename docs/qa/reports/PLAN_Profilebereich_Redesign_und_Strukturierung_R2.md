# QA Report: Profilbereich R2 (Hub verschlanken, Favoriten angleichen, QA-Findings beheben) inkl. Addendum Favoriten-Marke

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md` und `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2_Addendum_Favoriten-Marke.md`
- Verdict: `PASS WITH ISSUES`

## Scope

Geprüft: Q-2 aus R2 (R2-AC-1 bis R2-AC-20) und Q-2-Erweiterung des Addendums (R2A-AC-1 bis R2A-AC-9). Frontend F-2.1 bis F-2.5 (Hub, `ProfileDetails`, `profileTab`, Favoriten, `LibraryFoodCard`, Token-Bereinigung, `LabelScanReviewScreen`, KB) und Backend B-A.1 (Merge-Semantik `displayBrand`). Regression der R1-Teile gemäß R2 Abschnitt 2. Backend-Änderung gegen `cosmos-data-model-and-migration` (QA-Checkliste, Klasse 0).

Nicht geprüft (Out of Scope laut Plan oder nicht ausführbar): Geräte-/Screenreader-Verhalten, Cosmos-Emulator, Deploy (keiner erfolgt), `ProfileWizardScreen`-Redesign, `Gemeinsam`, FT-QA-2026-110.

Hinweis zum Diff-Beleg: R1- und R2-Änderungen liegen unkommittiert im Working Tree (`git diff HEAD` mischt beide). `docs/legal/` und `mobile/src/modules/legal/` sind untracked (R1), ein Diff gegen eine Basis ist nicht möglich. Unveränderheit wird über `legalTexts.test.ts` (Text identisch zu `docs/legal/*.md`) und das Fehlen jeder R2-Referenz belegt.

## Acceptance Criteria

### R2

| ID | Result | Evidence |
|---|---|---|
| R2-AC-1 | PASS | `mobile/src/app/navigation/profileTab.ts` (`PROFILE_TAB_ROUTE = 'Profile'`, `PROFILE_TAB_LABEL = 'Profil'`); `RootNavigator.tsx` nutzt beide (`name={PROFILE_TAB_ROUTE}`, `tabBarLabel: PROFILE_TAB_LABEL`); `profileTab.test.ts` sichert beide Werte. |
| R2-AC-2 | PASS | `ProfileScreen.tsx`: Titel `Profil`, `BasicDataCard` (Geschlecht, Alter, Größe, Gewicht, Zielgewicht via `ProfileSummaryCards.tsx`), danach Gruppen; keine `LifestyleCard`/`GoalCard`/`TargetsSection`, keine `Bearbeiten`-Schaltfläche. `ProfileScreen.test.tsx` „shows title, one Basisdaten card and the groups in fixed order without detail cards“. |
| R2-AC-3 | PASS | `profileHubGroups.ts`: Reihenfolge `profile` → `library` → `integrations` → `shared` (leer, nicht gerendert) → `legal`; Eintrag `Profil & Tagesziele`, Detail `Details ansehen und bearbeiten`, Route `ProfileDetails`; `hasProfile` blendet `profile` aus. `profileHubGroups.test.ts` (5 Tests: Reihenfolge, Eintrag, Ausblenden ohne Profil, leeres `Gemeinsam`, künftiges `Gemeinsam`). |
| R2-AC-4 | PASS | `ProfileDetailsScreen.tsx`: Header Zurück / `Profil & Tagesziele` / `Bearbeiten` (nur bei `ready` + Profil, navigiert mit `{ profile }` zu `ProfileEdit`); `LifestyleCard`, `GoalCard`, `TargetsSection` (`Ruhetag`/`Trainingstag`) mit aus dem Alt-Hub übernommenen Labels; `useProfileData` (Laden, Fehler/Retry, Refresh, Snackbar bei Refresh-Fehler). `ProfileDetailsScreen.test.tsx` (6 Tests). |
| R2-AC-5 | PASS | `ProfileScreen.tsx` rendert Titel und `getProfileHubGroups(...)` in jedem Zustand; Kartenplatz: `ProfileLoadingState` (Label `Profil wird geladen`), `ProfileErrorState`, `ProfileEmptyState` nur bei `status !== 'error'` und `profile === null`; `RefreshControl`/`ScrollView` immer vorhanden. `ProfileScreen.test.tsx` (Laden, Fehler statt „Noch kein Profil“, Leerzustand, Wizard, Refresh-Fehler; `Impressum`/`Datenschutzerklärung` navigieren in allen Zuständen, Z. 112-124). |
| R2-AC-6 | PASS | `ProfileEdit` nur aus `ProfileDetailsScreen.tsx` navigiert (Grep `'ProfileEdit'` in `mobile/src`); `ProfileEditScreen.tsx` Z. 275 `navigation.goBack()` unverändert; `useProfileData` lädt bei Fokus ohne Spinner-Flackern (`hasLoadedRef`); `ProfileDetailsScreen.test.tsx` „shows updated values after a refresh …“. Kein dedizierter Test für Speichern → `goBack` → Details-Reload (Code-Evidenz). Keine Änderung an `profileApi`/Payload. |
| R2-AC-7 | PASS | `FavoritesView.tsx` rendert `FoodProductSummary {...favoriteSummaryProps(item)}`; `favoriteFoodSummary.ts` bildet das Mapping 4.2 ab (Badges `OFF`/`Eigen`/`Rezept`, `incomplete`, `nutritionBasis: 'per100g'`, Rezept-Markenfallback). `favoriteFoodSummary.test.ts` (8 Tests), `LibraryScreen.test.tsx` „renders each favorite with the shared product summary and no usage-count line“. Keine `n× verwendet`-Zeile im Code. |
| R2-AC-8 | PASS | `LibraryFoodCard.tsx` (Aktionsbutton `minWidth/minHeight: spacing.xxl` = 48 pt, `accessibilityLabel` `<Name> aus Favoriten entfernen`); `FavoritesView.tsx` `ConfirmSheet` `Aus Favoriten entfernen?`, Snackbar `Favorit konnte nicht entfernt werden.`. `LibraryScreen.test.tsx` „removes a favorite only after confirmation …“, „offers only the remove action with a 48 pt target and no row tap“, „shows an inaccessible recipe as unavailable … but keeps it removable“. |
| R2-AC-9 | PASS | `FavoritesView.tsx` und `OwnFoodsView.tsx` nutzen beide `LibraryFoodCard`; kein `profileCardStyle` mehr in den Views (Grep). `LibraryScreen.test.tsx` „Eigene Lebensmittel“ (8 Tests: Tap = Bearbeiten, Löschen, Suche, Refresh, Enrichment-Reload) und Lade-/Fehler-/Leerzustände grün. |
| R2-AC-10 | PASS | Keine Änderung an `shared/`, API-Aufrufen oder Requests pro Zeile (`FavoritesView` nur `favoritesApi.listFavorites`/`removeFavorite`). Bildverhalten über `isRemoteImageUri` im `FoodProductSummary`-Thumbnail; `LibraryScreen.test.tsx` „shows the image of a favorite with a remote URL and falls back to the avatar on load error“, „shows the letter avatar … blob path“. PO-1 als `[Open]` in `docs/kb/tech/03-mobile.md` (Known limitations) und `docs/kb/product/05-ux-patterns.md` Z. 469. Ausnahme-Backend laut Addendum separat in R2A. |
| R2-AC-11 | PASS | `SearchState.tsx` Z. 156: `imageUrl: isRemoteImageUri(item.imageUrl) ? item.imageUrl : null`. `SearchState.ResultRow.test.tsx` „never sends a blob path as imageUrl and keeps the heart toggled“ (+ Remote-URL, `null`, Brand, Fehler-Revert). Annahme bestätigt: `backend/src/functions/favorites.ts` Z. 23 `imageUrl: z.string().url()`. Weitere Stellen mit demselben Muster: siehe Finding R2Q-02. |
| R2-AC-12 | PASS WITH ISSUES | Grep auf `rgba`/Hex/`fontSize`/`padding*`/`margin*`/`gap`/`borderRadius`/`hitSlop`/`spacing + n` in `FoodProductSummary.tsx`, `SearchState.tsx`, `SyncStatusSheet.tsx`: nur Token-Werte (`spacing.*`, `radius.*`, `typography.overline.fontSize`); `hitSlop` aus `spacing`; `✕` in `SyncStatusSheet` ersetzt durch `Icon name="x"` (mit `accessibilityLabel` `Schließen`); `colors.overlay` (`theme/index.ts`) in `SyncStatusSheet` und `ConfirmSheet`. Rest: `SearchState.tsx` Z. 215 `Icon size={12}` ist ein Literal, kein Icon-Größen-Token (Finding R2Q-01). |
| R2-AC-13 | PASS | `RelationRow.tsx` nutzt `FOOD_THUMBNAIL_SIZE` (52); `RecentItem.tsx`, `FoodSearchResultList.tsx` (und `MyProductsScreen.tsx`) gelöscht (`git status`: `D`); Grep `RecentItem\|FoodSearchResultList\|MyProductsScreen` in `mobile/src`: keine Treffer. `docs/kb`: nur der erklärende Satz „former `RecentItem` component no longer exists“ (`04-food-entry-hub.md` Z. 216) und die Entfernungsnotiz zu `MyProductsScreen` (`03-mobile.md` Z. 509). |
| R2-AC-14 | PASS | (a) `profileTab.test.ts`; (b) `SearchState.ResultRow.test.tsx`: 52-pt-Thumbnail, Zeilentap nur `onPress`, Herz nur `favoritesApi`, Quick-Accept nur `onQuickAccept`, Blob-Pfad nicht gesendet; (c) `ProfileWizardScreen.test.tsx` „opens the Datenschutz text from the preview step without saving and keeps the inputs“. Alle in der grünen Mobile-Suite. |
| R2-AC-15 | PASS | `LabelScanReviewScreen.tsx`: kein `Alert`-Import (Grep ohne Treffer); `handleEditSave` setzt `historyConfirmOpen`; `ConfirmSheet` mit `Nur Produkt` / `Produkt + Tagebuch-Einträge`, `Abbrechen` eingebaut. `LabelScanReviewScreen.test.tsx` (4 Edit-Tests: `update(..., false)`, `update(..., true)`, Abbrechen ruft nichts auf, Sheet statt Alert; der Test-Mock von `react-native` enthält bewusst kein `Alert`). Wirkung auf Gerät: siehe Verifikationsnotizen. |
| R2-AC-16 | PASS | Unicode-Regex-Grep (Pfeile, Dingbats, Emoji, `‹`, `›`, Variation Selector) in `LabelScanReviewScreen.tsx`: nur `≈` in einer Kcal-Berechnungszeile (Z. 577, Mathematikzeichen, kein UI-Icon). Diff: Ersatz durch `Icon` (`edit-2`, `camera`, `alert-triangle`, `tool`, `chevron-up/down`, `check-circle`, `clock`, `x`, `save`, `refresh-cw`, `chevron-left`); State/Handler/API-Aufrufe der Erfassung unverändert (Diff enthält nur Darstellung plus Sheet-State). Erfassungstests in `LabelScanReviewScreen.test.tsx` („Erfassungsmodus“) und Mobile-Suite grün. |
| R2-AC-17 | PASS | `git status` für `shared/`, `infra/`, `backend/scripts/`, `backend/src/lib/cosmos.ts`, `mobile/app.json`, `app.config.js`, `eas.json`, `android/`, `package.json` (Root, `mobile`, `backend`, `shared`), `package-lock.json`: keine Änderungen. Backend-Änderungen nur die sechs Addendum-Dateien plus neue Testdatei (siehe R2A-AC-8). Theme: additiver Token `overlay`. Keine neue Dependency. |
| R2-AC-18 | MANUAL VALIDATION REQUIRED | Nicht ausführbar (kein Gerät, Simulator, Screenreader). Siehe Verifikationsnotizen. |
| R2-AC-19 | PASS | `02-navigation.md` (Stack-Baum mit `ProfileDetails`, Param-Liste, IA-Tabelle, Abschnitt „Tab-Label Profil“ mit Begründung, Hub-Zustände); `05-ux-patterns.md` (Profil-Hub, Favoritenabschnitt, überholter Satz „separate future story“ entfernt, Grep ohne Treffer); `03-mobile.md` (`ProfileDetailsScreen`, `LibraryFoodCard`, `favoriteFoodSummary`, `profileTab`, `colors.overlay`, Known limitations ohne `LabelScanReviewScreen`/`RecentItem`/`FoodSearchResultList`; PO-1 `[Open]`, `Gemeinsam` `[Planned]`); `04-food-entry-hub.md` `RecentItem`-Verweis korrigiert; `03-design-system.md` ergänzt. Keine Aussage zu Haushaltsrechten. Bereits bestehende KB-Konflikte (nicht aus R2): Finding R2Q-05. |
| R2-AC-20 | PASS | Mobile-Suite 76 Dateien / 741 Tests grün, darunter `legalTexts.test.ts`, `LoginScreen.test.tsx`, `ProfileEditScreen.test.tsx` (Platzhalter `Konto löschen`, kein `deleteProfile`), `ownFoodItems.test.ts`, `healthConnectCopy.test.ts`. `docs/legal/*.md`/`legalTexts.ts` sind untracked (R1), nicht durch R2 referenziert; Textabgleich durch `legalTexts.test.ts`. FT-QA-2026-110 unberührt (siehe Finding-Zuordnung). |

### R2A (Addendum Favoriten-Marke)

| ID | Result | Evidence |
|---|---|---|
| R2A-AC-1 | PASS | `cosmosUserFoodRelationRepository.ts` `recordUsage` und `userFoodRelationRepository.ts` `recordUsage`: `displayBrand` nur bei `typeof === 'string' && length > 0` (und `!== 'recipe'`). Tests: `cosmosUserFoodRelationRepository.test.ts` („keeps displayBrand when omitted …“, `undefined`/`null`/`''`), `userFoodRelationRepository.test.ts` (Block „displayBrand merge semantics (in-memory)“). Gespeichertes Cosmos-Dokument: Assertion auf das an `upsert` übergebene Objekt; echte Serialisierung nur im Contract-Test (nicht ausgeführt). |
| R2A-AC-2 | PASS | Tests „overwrites displayBrand with a non-empty value“ in beiden Repository-Testdateien. |
| R2A-AC-3 | PASS | Tests prüfen `isFavorite`, `favoritedAt`, `nutritionPer100g`, `portion`, `imageUrl` unverändert, `displayName` aktualisiert, `imageUrl: undefined` überschreibt nicht, `usageCount`/`lastUsedAt`/`usageDates` korrekt. Bestehende Tests unverändert grün (Backend 70/70 Dateien). |
| R2A-AC-4 | PASS | Cosmos- und In-Memory-Tests „strips brand and caches for recipe relations“ / „keeps recipe relations free of brand and caches …“ für `recordUsage` und `setFavorite`; `favorites.test.ts` und `communityRecipes.test.ts` (Rezept-Projektion) grün. |
| R2A-AC-5 | PASS | `setFavorite` in beiden Repositories mit Guard im Bestandszweig (`cosmosUserFoodRelationRepository.ts` Z. 73, In-Memory Z. 166; `recordUsage` Cosmos Z. 155, In-Memory Z. 236); Tests: Behalten bei `undefined`/`''`/`null`, Aktualisieren, Unfavorite-Zyklus, Neuanlage mit Marke. `DELETE /api/favorites/:foodRef` unverändert (übergibt `existing.displayBrand`). |
| R2A-AC-6 | PASS | `diary.ts`: Zeile `displayBrand: undefined` entfernt (`git diff`: einzige Änderung, `-1`). `diary.test.ts` Block „displayBrand retention“: Favorit (`catalog` und `personal`) behält Marke nach `addItemHandler`; Neuanlage ohne Marke; Request-Felder `displayBrand`/`brand` erzeugen keine Marke. |
| R2A-AC-7 | PASS | `diary.test.ts`: `listFavoritesHandler` liefert nach dem Loggen `displayBrand`, `imageUrl`, `nutritionPer100g`, `portion`, `usageCount`. `favorites.ts` unverändert (nicht im Diff). |
| R2A-AC-8 | PASS | `git diff HEAD --name-only -- backend shared infra package.json package-lock.json mobile/package.json`: nur `diary.ts`, `diary.test.ts`, `cosmosUserFoodRelationRepository.ts`, `cosmosUserFoodRelationRepository.contract.test.ts`, `userFoodRelationRepository.ts`, `userFoodRelationRepository.test.ts` (+ untracked `cosmosUserFoodRelationRepository.test.ts`). `favorites.ts` (`AddFavoriteBodySchema`), `AddItemSchema`, `cosmos.ts`, `shared/`, `infra/`, `backend/scripts/` unverändert; kein neues Feld/Container/Skript. Klasse 0 bestätigt (siehe Cosmos-Checkliste). Kein Deploy ausgelöst. |
| R2A-AC-9 | PASS | Tests laut Abschnitt 7 vorhanden (In-Memory, Cosmos-Mock-Container, Handler, Contract-Test geschrieben); Backend-Suite und Typecheck grün. KB: `docs/kb/domain/03-food-catalog.md` (Merge-Regel, Known limitation Z. 135) und `docs/kb/tech/02-backend.md` ergänzt; `09-api-reference.md`/`04-shared-library.md` nicht im Diff. Contract-Test wegen fehlendem Emulator nicht ausgeführt; Rot-vor-Fix-Lauf nicht unabhängig reproduziert (Diff zeigt den vorherigen bedingungslosen Überschreibungs-Spread; Handoff-Aussage der Implementierung, `UNVERIFIED`). |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm run typecheck --workspace=@fittrack/mobile` | 0 | `tsc --noEmit` ohne Fehler |
| `npm test --workspace=@fittrack/mobile` | 0 | 76 Testdateien, 741 Tests bestanden |
| `npm test --workspace=@fittrack/backend` | 0 | 70 Testdateien, 1698 Tests bestanden |
| `npm run typecheck --workspace=@fittrack/backend` | 0 | `tsc --noEmit` ohne Fehler |
| `npm run check:encoding` | 0 | `Encoding check passed.` |
| `npm run build:verify --workspace=@fittrack/backend` | 0 | „All checks passed.“ (Pflicht bei Backend-Änderung) |
| `npm run test:contract --workspace=@fittrack/backend` | 1 | Nicht ausgeführt: Cosmos-Emulator nicht erreichbar (`fetch failed` in `ensureEmulatorReachable`, 9 Dateien / 98 Tests übersprungen). Verifikationslimitation, kein Befund; siehe Verifikationsnotizen. |

Die Shared-Suite wurde nicht ausgeführt (keine Änderung in `shared/`).

## Cosmos-Checkliste (Klasse 0, Backend-Änderung)

- Dokumentform: keine Typ-/Feldänderung; `displayBrand` bleibt optional (`shared/` unverändert). Lesepfade (`favoriteSummaryProps`, `FoodProductSummary`) behandeln fehlende Marke (Test „keeps a catalog favorite without stored brand brandless“; Backend-Test „creates a new relation without a brand“).
- Kein Feld entfernt oder umbenannt, Bedeutung des Feldes unverändert; nur die Schreib-Semantik (Überschreiben nur mit gesetztem Wert).
- Partitionsschlüssel/Container: unverändert (`/userId`, kein neuer Container, `cosmos.ts`/`infra/` nicht im Diff).
- Migration: keine, kein Backfill (Begründung im Addendum 4.3, Known limitation in `03-food-catalog.md`).
- Tests: Unit-Tests (In-Memory, gemockter Container für Cosmos-Zweig), Contract-Test gegen Emulator geschrieben (`cosmosUserFoodRelationRepository.contract.test.ts`, nutzt `test-utils/cosmosEmulator`, keine Remote-Cosmos-Verbindung). Ausführung: siehe Verifikationsnotizen.

## Finding-Zuordnung (FT-QA-2026-107 bis -112)

| Finding | Status | Evidenz |
|---|---|---|
| FT-QA-2026-107 | Gelöst (Code und automatisierte Tests); Geräteverhalten `MANUAL VALIDATION REQUIRED` | R2-AC-15/-16: kein `Alert`, keine Emoji/Unicode-Icons in `LabelScanReviewScreen.tsx`, `ConfirmSheet`-Edit-Pfad, `LabelScanReviewScreen.test.tsx`. |
| FT-QA-2026-108 | Gelöst bis auf einen Rest | R2-AC-12: drei Dateien tokenisiert, `colors.overlay` eingeführt. Rest `Icon size={12}` in `SearchState.tsx` Z. 215 (Finding R2Q-01, Non-blocking). |
| FT-QA-2026-109 | Gelöst | R2-AC-5: Hub rendert Titel, `Bibliothek`, `Integrationen`, `Rechtliches` in Laden/Fehler/Leer; `ProfileScreen.test.tsx`. |
| FT-QA-2026-110 | Unberührt (Accepted) | `HealthConnectScreen.tsx` Z. 39-42, 585 (`Log leeren` weiter nur `development`/`preview`); Text in `legalTexts.ts` Z. 70 unverändert; kein R2-Work-Package berührt die Stelle. |
| FT-QA-2026-111 | Gelöst | (a) `profileTab.test.ts`, (b) `SearchState.ResultRow.test.tsx`, (c) `ProfileWizardScreen.test.tsx` (Vorschau-Datenschutzlink, kein `createProfile`). |
| FT-QA-2026-112 | Gelöst | `RelationRow` 52 pt über `FOOD_THUMBNAIL_SIZE`; `RecentItem.tsx` und `FoodSearchResultList.tsx` entfernt, Grep ohne Treffer in `mobile/src`. |

## Verification Notes

Alle Punkte unten sind Verifikationslimitationen, keine Findings, und beeinflussen das Verdict nicht.

1. State: `MANUAL VALIDATION REQUIRED` — Gerät/Emulator (Android und iOS), R2-AC-18
   - Reason: Kein Gerät, kein Simulator verfügbar.
   - Manual action: Preview-/Dev-Build starten, Profil-Tab öffnen. Erwartet: `Basisdaten` sowie Überschriften `Persönliche Daten`, `Bibliothek`, `Integrationen` ohne Scrollen sichtbar, `Rechtliches` höchstens mit minimalem Scrollen. Ergebnis: ______
2. State: `MANUAL VALIDATION REQUIRED` — Schmaler Viewport und größte Systemschrift
   - Reason: Kein Viewport-/Schriftgrößen-Tooling.
   - Manual action: Kleinstes verfügbares Gerät/Simulator, Schriftgröße maximal; Hub, `ProfileDetails`, `ProfileEdit`, Favoriten, `LabelScanReviewScreen` prüfen. Erwartet: Texte brechen um, kein horizontales Scrollen, Touch-Ziele mindestens 48 pt, Navigation `ProfileDetails` → `ProfileEdit` → Zurück korrekt. Ergebnis: ______
3. State: `MANUAL VALIDATION REQUIRED` — TalkBack / VoiceOver
   - Reason: Kein Screenreader verfügbar.
   - Manual action: Hub-Gruppen, Favoritenzeile (Name, Marke, Badge, Nährwerte) und Button `<Name> aus Favoriten entfernen` durchgehen. Erwartet: sinnvolle Reihenfolge und Beschriftung. Ergebnis: ______
4. State: `MANUAL VALIDATION REQUIRED` — Verschachteltes Modal im `LabelScanReviewScreen`
   - Reason: Nur mit gemocktem `ConfirmSheet` getestet; RN-`Modal` in RN-`Modal` ist plattformabhängig.
   - Manual action: Eigenes Lebensmittel bearbeiten (Profil → Bibliothek → Eigene Lebensmittel), `Produkt speichern` tippen. Erwartet (iOS und Android): Sheet erscheint über dem Vollbild-Modal, ist bedienbar, `Nur Produkt`/`Produkt + Tagebuch-Einträge`/`Abbrechen` und Android-Zurücktaste schließen korrekt, danach schließt der Edit-Screen. Bei Problem: Fallback laut R2 Abschnitt 15 (Inline-Panel). Ergebnis: ______
5. State: `MANUAL VALIDATION REQUIRED` — Dev-Ablauf Favorit → Loggen → Marke bleibt
   - Reason: Lokales Backend/Dev-System nicht gestartet; Verhalten nur über Unit-/Handler-Tests belegt.
   - Manual action: Backend neu starten; Produkt mit Marke im Such-Hub favorisieren, ins Tagebuch loggen, Profil → Favoriten & Eigene Lebensmittel → Favoriten öffnen. Erwartet: Marke und `OFF`-Badge wie im Hub. Ergebnis: ______
6. State: `MANUAL VALIDATION REQUIRED` — Bestandsfavorit entfernen und neu setzen
   - Reason: Bestandsdaten von Dev/Alpha nicht eingesehen.
   - Manual action: Bestandsfavorit ohne Marke im Hub entfernen und neu setzen. Erwartet: Marke erscheint in `Favoriten` und bleibt nach Loggen erhalten. Ergebnis: ______
7. State: `UNVERIFIED` / `MANUAL VALIDATION REQUIRED` — Cosmos-Contract-Test ohne Emulator
   - Reason: Emulator nicht erreichbar (`fetch failed`); CI-Evidenz nicht verfügbar. Der Test `cosmosUserFoodRelationRepository.contract.test.ts` („keeps displayBrand in the stored document when recordUsage omits it“) und die übrigen acht Contract-Dateien blieben ungelaufen.
   - Manual action: Emulator mit `backend/scripts/start-cosmos-emulator.ps1` starten, dann `npm run test:contract --workspace=@fittrack/backend`, oder CI-Tier-2-Lauf abwarten. Erwartet: alle Contract-Tests grün, Rohdokument behält `displayBrand`. Ergebnis: ______
8. State: `UNVERIFIED` — Rot-vor-Fix-Beleg des Reproduktionstests
   - Reason: Ein Lauf gegen den Vor-Fix-Code würde Produktivcode ändern; QA ändert keinen Code. Aus dem Diff ergibt sich, dass der Vor-Fix-Code `displayBrand` bei `undefined` überschrieb.
   - Manual action: Optional `git stash` der drei Backend-Quelldateien und Lauf von `userFoodRelationRepository.test.ts`. Erwartet: Merge-Tests schlagen fehl. Ergebnis: ______

## Findings

Finding key: R2Q-01
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md`
Acceptance criterion: R2-AC-12
Description: `SearchState.tsx` verwendet im Quick-Accept-Pill weiterhin `<Icon ... size={12} />` mit Literalwert. R2-AC-12 und Abschnitt 3 (FT-QA-2026-108) nennen genau dieses Literal; zulässig sind nur Icon-Größen-Tokens (`'sm' | 'md' | 'lg'`). Nebenbeobachtung (nicht von der AC-Aufzählung erfasst): `SyncStatusSheet.tsx` `lineHeight: 16`, `maxHeight: 200`.
Criticality: Non-blocking
Owner: Frontend
Evidence: `mobile/src/modules/nutrition/hub/SearchState.tsx` Z. 215; `mobile/src/shared/components/Icon.tsx` (`IconSize = 'sm' | 'md' | 'lg'`, Zahl bleibt erlaubt); `mobile/src/modules/healthConnect/SyncStatusSheet.tsx` Z. 232, 237.
Recommendation: `size="sm"` verwenden (falls optisch akzeptabel) oder einen benannten Größen-Token ergänzen; Rest-Literale in `SyncStatusSheet` bei Bedarf per Token abbilden.

Finding key: R2Q-02
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md` (Risiken „Blob-Pfad bei Favorit/Diary“, Q-2-Handoff)
Acceptance criterion: R2-AC-11 (Randbereich), R2-AC-10
Description: Der Blob-Pfad-Guard existiert nur in `SearchState.ResultRow`. Weitere Stellen senden `imageUrl` ungefiltert an Endpunkte, die `z.string().url()` validieren; ein Blob-Pfad (`<userId>/<itemId>.jpg`, von `food-search` für eigene Lebensmittel mit Foto geliefert) würde dort mit 400 abgelehnt: (a) `QuantityView.tsx` Z. 312 (`favoritesApi.addFavorite`, Herz-Toggle in der Mengenansicht), (b) `QuantityView.tsx` Z. 380 und `FoodEntryHub.tsx` Z. 767/804 (`diaryApi.addItem`; `diary.ts` Z. 130 validiert `imageUrl` mit `.url()`). Ableitung aus Code und Schemas; am laufenden System nicht reproduziert. Wirkung (a) stiller Revert des Herzens, (b) möglicherweise fehlschlagendes Loggen eigener Lebensmittel mit Foto.
Criticality: Non-blocking
Owner: Frontend
Evidence: `backend/src/functions/diary.ts` Z. 130; `backend/src/functions/favorites.ts` Z. 23; `backend/src/functions/foodSearch.ts` Z. 56 (reicht `item.imageUrl` durch); `backend/src/functions/reusableItems.ts` Z. 346-348 (speichert `blobName` als `imageUrl`); `mobile/src/modules/nutrition/hub/QuantityView.tsx` Z. 312, 380; `mobile/src/modules/nutrition/hub/FoodEntryHub.tsx` Z. 767, 804; KB `docs/kb/tech/03-mobile.md` (Known limitations, „not investigated“).
Recommendation: Zuerst in Dev reproduzieren (eigenes Lebensmittel mit Foto favorisieren und loggen). Bei Bestätigung `isRemoteImageUri`-Guard an den genannten Stellen oder, mit PO-1, serverseitige Auflösung bzw. Schema-Anpassung in einem eigenen Plan. Nicht Teil von R2.

Finding key: R2Q-03
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2_Addendum_Favoriten-Marke.md` (Abschnitte 5 und 8)
Acceptance criterion: N/A (bekannte, bewusst nicht behobene Vorbelastung)
Description: `CosmosUserFoodRelationRepository.getByFoodRef` fängt jeden Lesefehler (auch transiente) und liefert `null`. `recordUsage` und `setFavorite` behandeln das als „keine Relation“ und schreiben ein neues Dokument per `upsert`, das einen bestehenden Favoriten (inkl. Marke, Nährwerte, `isFavorite`) überschreiben kann. Die neue Merge-Semantik greift in diesem Fall nicht.
Criticality: Non-blocking
Owner: Backend
Evidence: `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts` Z. 217-226 (`catch { return null; }`); Aufrufer `setFavorite` Z. 62 und `recordUsage` Z. 138 (Neuanlage-Zweige bei `null`).
Recommendation: Nur 404/`undefined` als „nicht vorhanden“ werten, andere Fehler weiterwerfen (`recordUsage` fängt sie ohnehin fire-and-forget; `setFavorite` meldet sie dem Client); Regressionstest mit gemocktem 5xx-Lesefehler.

Finding key: R2Q-04
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2_Addendum_Favoriten-Marke.md` (Abschnitt 8, „Stale Marke“)
Acceptance criterion: N/A
Description: Die denormalisierte `displayBrand` einer Relation wird bei einer späteren Markenänderung des Produkts (eigene Lebensmittel über `reusableItems`) nicht synchronisiert; es gibt keine Funktion analog `updateNutritionDenormalized`. Die Marke aktualisiert sich nur beim erneuten Favorisieren.
Criticality: Suggestion
Owner: Backend
Evidence: `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts` (`updateNutritionDenormalized` berührt nur `nutritionPer100g`/`portion`); `docs/kb/domain/03-food-catalog.md` Z. 125-136.
Recommendation: Bei Bedarf Backlog-Item für eine Brand-Synchronisation beim Update eines eigenen Lebensmittels.

Finding key: R2Q-05
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung_R2.md` (F-2.5, R2-AC-19: Konflikte KB ↔ Code benennen)
Acceptance criterion: R2-AC-19 (Randbereich; bereits bestehende Konflikte, nicht durch R2 verursacht)
Description: `docs/kb/product/04-food-entry-hub.md` beschreibt `hub/IdleState.tsx` (Zeilen 46, 85, 225) und `hub/AlleFavoritenModal.tsx` (Zeile 234) als Bestandteile des Hubs; beide Dateien existieren nicht im Repository (vorhanden: `hub/FoodList.tsx`, `RelationRow.tsx`). `docs/kb/domain/03-food-catalog.md` Z. 156 nennt „legacy IdleState“ für `GET /api/favorites/grouped`. Der Code ist Ground Truth.
Criticality: Suggestion
Owner: Documentation
Evidence: `file_search` nach `mobile/src/modules/nutrition/hub/{IdleState,AlleFavoritenModal}*` ohne Treffer; Grep in `docs/kb` (Zeilen oben).
Recommendation: `04-food-entry-hub.md` (Idle-Ansicht, Dateitabelle) und die Randnotiz in `03-food-catalog.md` an den tatsächlichen Hub-Aufbau angleichen oder die Abschnitte als historisch kennzeichnen.
