# QA Report: US-09 Rezept teilen, Vorschau und Instagram-Bild speichern

- Format: `fittrack-qa-v1`
- Plan reference: [`docs/User Stories/Reciepe/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md`](../../User%20Stories/Reciepe/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md)
- Verdict: `PASS`

## Scope

Diese Final Correction Review verwendet ausschließlich den genehmigten
Plantext vor `## Legacy draft (HISTORICAL ONLY; NOT EXECUTABLE)`. Geprüft
wurden Backend-Rendervertrag und Adapter, Mobile-API, Share-Draft,
Options-Sheet, Preview-/Crop-Integration, lokale Medienablage,
Expo-Native-Konfiguration, Knowledge-Base-Dokumentation und der Dev-
Release-Gate. Die vorherigen Findings `FT-QA-2026-035` / `US09-F-002` und
`FT-QA-2026-036` / `US09-F-003` sind durch die exakte deutsche Copy, die
aktualisierten fokussierten Assertions und die ergänzte UX-KB-Dokumentation
behoben. Die Korrektur zum Lock des finalen Renderzustands bleibt
verifiziert. Kein Deploy, Alpha-Release oder Dev Build wurde ausgeführt; die
Prüfung hat `docs/qa/findings.md` nicht geschrieben.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | [`mobile/src/modules/recipes/RecipeDetailScreen.tsx`](../../../mobile/src/modules/recipes/RecipeDetailScreen.tsx) zeigt im Sticky Footer genau `Bearbeiten`, `Teilen` und `Löschen`; `Teilen` verwendet das bestehende Icon-System und ein deutsches Accessibility-Label. |
| AC-2 | PASS | Der Share-Handler öffnet zuerst den lokalen Draft und sperrt Doppeltaps; Foto- und Share-Aufrufe liegen erst hinter `Speichern & teilen`. Nachweis in [`RecipeDetailScreen.tsx`](../../../mobile/src/modules/recipes/RecipeDetailScreen.tsx) und [`recipeShareDraftState.test.ts`](../../../mobile/src/modules/recipes/recipeShareDraftState.test.ts). |
| AC-3 | PASS | Backend und Draft wählen das Primärbild nach niedrigstem endlichem `order` und kleinster Bild-ID bei Gleichstand; beide Requests lassen `imageId` weg. Nachweis in [`instagramRecipe.ts`](../../../backend/src/functions/instagramRecipe.ts) und [`recipeShareDraftState.ts`](../../../mobile/src/modules/recipes/recipeShareDraftState.ts). |
| AC-4 | PASS | Initialer Request enthält `selectedTags`, explizites Highlight und vollständige temporäre Meta ohne `presentation`; der abschließende Request ergänzt die vollständige normalisierte Presentation. Server-owned Rezeptdaten bleiben maßgeblich. Nachweis in [`instagramRecipe.ts`](../../../backend/src/functions/instagramRecipe.ts), [`recipeAdapter.ts`](../../../backend/src/lib/instagramRenderer/recipeAdapter.ts) und [`recipeApi.ts`](../../../mobile/src/shared/api/recipeApi.ts). |
| AC-5 | PASS | Leere Auswahl, Teilmenge, Vierergrenze, Vorauswahl der ersten vier Tags und sichtbare deaktivierte weitere Tags sind implementiert und getestet. Der Handler weist unbekannte, doppelte, freie und überzählige Werte kontrolliert ab und behält Serverreihenfolge und Labels. Nachweis in [`instagramRecipe.test.ts`](../../../backend/src/functions/instagramRecipe.test.ts), [`recipeAdapter.test.ts`](../../../backend/src/lib/instagramRenderer/recipeAdapter.test.ts) und [`RecipeInstagramOptionsSheet.test.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramOptionsSheet.test.tsx). |
| AC-6 | PASS | Renderer-Tests bestätigen die PNG-Abmessungen `1080 x 1350`; die Preview nutzt ein stabiles Verhältnis und der Media-Service hält die Antwort in einer eindeutigen temporären Datei. Nachweis in [`highlight.test.ts`](../../../backend/src/lib/instagramRenderer/__tests__/highlight.test.ts), [`RecipeInstagramPreview.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramPreview.tsx) und [`recipeShareMediaService.ts`](../../../mobile/src/services/recipeShareMediaService.ts). |
| AC-7 | PASS | Die Preview zeigt vor dem Speichern die tatsächlich gerenderte PNG. Renderer-, Meta-, Options- und Preview-Tests decken Titel, gewählte Tags, Nutrition, Meta sowie `Kein Highlight` und `high-protein` ab. Nachweis in [`highlight.test.ts`](../../../backend/src/lib/instagramRenderer/__tests__/highlight.test.ts), [`recipe-meta.test.ts`](../../../backend/src/lib/instagramRenderer/__tests__/recipe-meta.test.ts), [`RecipeInstagramOptionsSheet.test.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramOptionsSheet.test.tsx) und [`RecipeInstagramPreview.test.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramPreview.test.tsx). |
| AC-8 | PASS | Der bestehende Editor und die Crop-Mathematik verwenden den `1080 x 1015`-Hero-Vertrag, den effektiven gespeicherten Crop sowie die Pan-/Pinch-Grenzen; der Share-Override wird nicht persistiert. Nachweis in [`RecipeImageHeroCropEditor.tsx`](../../../mobile/src/modules/recipes/RecipeImageHeroCropEditor.tsx), [`recipeImageHeroCropMath.ts`](../../../mobile/src/modules/recipes/recipeImageHeroCropMath.ts) und [`recipeShareDraftState.ts`](../../../mobile/src/modules/recipes/recipeShareDraftState.ts). |
| AC-9 | PASS | [`RecipeInstagramPreview.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramPreview.tsx) sperrt `Ausschnitt anpassen` und `Optionen ändern` bei `renderStatus === 'loading'`, auch bei bereits vorhandener Preview-URI. Die Regression ist in [`RecipeInstagramPreview.test.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramPreview.test.tsx) abgedeckt; Draft-Tests bestätigen keine Live-Requests während Pan/Pinch und genau einen finalen Render nach `Übernehmen`. |
| AC-10 | PASS | Asset-Erstellung erfolgt erst in `save()`; der Media-Service sucht das exakte Album `FitTrack`, legt es bei einem fehlenden Treffer an und verwendet es später wieder. Nachweis in [`recipeShareMediaService.ts`](../../../mobile/src/services/recipeShareMediaService.ts) und [`recipeShareMediaService.test.ts`](../../../mobile/src/services/recipeShareMediaService.test.ts). |
| AC-11 | PASS | Der Media-Service verwendet ausschließlich `FitTrack`, legt keine Ersatznamen an und verändert keine vorhandenen Albuminhalte. Die Album-/Asset-Tests prüfen die Zuordnung und den Rollback. Nachweis in [`recipeShareMediaService.test.ts`](../../../mobile/src/services/recipeShareMediaService.test.ts). |
| AC-12 | PASS | `canAskAgain` wird in retrybare und settings-only Permission-Fehler getrennt; Draft, Auswahl und Preview bleiben beim Abbruch erhalten. Nachweis in [`recipeShareMediaService.ts`](../../../mobile/src/services/recipeShareMediaService.ts), [`recipeShareMediaService.test.ts`](../../../mobile/src/services/recipeShareMediaService.test.ts) und [`RecipeDetailScreen.tsx`](../../../mobile/src/modules/recipes/RecipeDetailScreen.tsx). |
| AC-13 | PASS | Permission-, Album- und Asset-Fehler öffnen kein Share-Sheet und melden keinen vollständigen Erfolg. Neu angelegte Assets und ein neu angelegtes leeres Album werden best effort zurückgerollt; die Preview bleibt retrybar. Nachweis in [`recipeShareMediaService.test.ts`](../../../mobile/src/services/recipeShareMediaService.test.ts). |
| AC-14 | PASS | Nach bestätigtem Albumzugriff übergibt der Service exakt dieselbe temporäre PNG-URI an `shareAsync`, die für das Asset verwendet wurde. Nachweis in [`recipeShareMediaService.test.ts`](../../../mobile/src/services/recipeShareMediaService.test.ts). |
| AC-15 | PASS | Die URI bleibt bis zur Auflösung des Share-Promises erhalten, wird danach idempotent bereinigt und bei einem Share-Retry mit dem bereits gespeicherten Asset wiederverwendet. Nachweis in [`recipeShareMediaService.ts`](../../../mobile/src/services/recipeShareMediaService.ts) und [`recipeShareMediaService.test.ts`](../../../mobile/src/services/recipeShareMediaService.test.ts). |
| AC-16 | PASS | Nicht verfügbares Sharing, Abbruch und externe Share-Fehler lassen das Foto im Album und behaupten keine Instagram-Zustellung; der Retry legt kein zweites Asset an. Nachweis in [`recipeShareMediaService.test.ts`](../../../mobile/src/services/recipeShareMediaService.test.ts) und den deutschen Notices in [`RecipeDetailScreen.tsx`](../../../mobile/src/modules/recipes/RecipeDetailScreen.tsx). |
| AC-17 | PASS | Partielle Crop-Overrides werden feldweise gemerged; der bestätigte Override gehört nur zum Draft und führt über den finalen Render zur vollständigen `1080 x 1350`-Ausgabe. Nachweis in [`recipeAdapter.ts`](../../../backend/src/lib/instagramRenderer/recipeAdapter.ts), [`instagramRecipe.test.ts`](../../../backend/src/functions/instagramRecipe.test.ts) und [`recipeShareDraftState.test.ts`](../../../mobile/src/modules/recipes/recipeShareDraftState.test.ts). |
| AC-18 | PASS | Der Toggle startet mit `Kein Highlight`, sendet aus `null` und an ausdrücklich `'high-protein'`. Der Handler weist `low-fat`, `automatic`, unbekannte Strings und falsche Typen ab; es gibt keine automatische Klassifikation, Schwelle oder neues Rezeptfeld. Nachweis in [`RecipeInstagramOptionsSheet.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramOptionsSheet.tsx), [`RecipeInstagramOptionsSheet.test.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramOptionsSheet.test.tsx) und [`instagramRecipe.test.ts`](../../../backend/src/functions/instagramRecipe.test.ts). |
| AC-19 | PASS | `TEMPORARY_RECIPE_RENDER_META` definiert `30` Minuten und `Einfach` zentral und temporär; der Wert gelangt nicht in Recipe, Shared-Typen, Cosmos, Nutrition-Berechnung oder AI-Prompts. Nachweis in [`recipeInstagramRenderContract.ts`](../../../mobile/src/shared/api/recipeInstagramRenderContract.ts), [`recipeAdapter.ts`](../../../backend/src/lib/instagramRenderer/recipeAdapter.ts) und [`docs/kb/tech/03-mobile.md`](../../../docs/kb/tech/03-mobile.md). |
| AC-20 | PASS | Der Renderpfad liest user-scoped Rezept-/Bilddaten und schreibt weder Rezept, Crop-Metadaten, Cosmos-Dokument noch PNG-Persistenz. Der API-Vertrag dokumentiert den transienten Render. Nachweis in [`instagramRecipe.ts`](../../../backend/src/functions/instagramRecipe.ts) und [`docs/kb/tech/09-api-reference.md`](../../../docs/kb/tech/09-api-reference.md). |
| AC-21 | PASS | Die exakten freigegebenen Strings `Welche Tags sollen auf dem Bild erscheinen?` und `Für dieses Rezept sind keine Tags hinterlegt.` stehen in [`RecipeInstagramOptionsSheet.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramOptionsSheet.tsx) und sind in [`RecipeInstagramOptionsSheet.test.tsx`](../../../mobile/src/modules/recipes/RecipeInstagramOptionsSheet.test.tsx) fokussiert abgedeckt. Dark-only Theme-Tokens, bestehende Overlay-/Sheet-Muster, Animationen, Accessibility und keine Standard-Alerts bleiben eingehalten. |
| AC-22 | PASS | Volltests, fokussierte US-09-Tests, Typechecks, Build-Verify, Encoding-/Diff-Checks und Expo-Introspection sind ausgeführt und dokumentiert. Der Dev-Gate weist `Dev Build Required: YES` sowie die offenen nativen/Linux-Gates aus; die SDK-54-kompatiblen Pakete und der Patchstand bleiben dokumentiert. Nachweis in [`PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern_Dev-Gate.md`](../../../infra/release-records/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern_Dev-Gate.md). |
| AC-23 | PASS | API-, Mobile- und UX-Dokumentation beschreiben jetzt den realen Vertrag einschließlich `selectedTags`, `nutritionHighlight`, `presentation`, `FitTrack`, Hero-/Gesamtbild, Nutzerwahl des sichtbaren High-Protein-Symbols sowie fehlender automatischer Klassifikation. [`docs/kb/product/05-ux-patterns.md`](../../../docs/kb/product/05-ux-patterns.md) enthält zusätzlich Options-Sheet, Tag-Cap/Empty-State, Toggle, Preview, Crop, Back/Cancel, InfoOverlay-Fehler, Permission-/Media-Rollback, Album, Share-Abbruch und Retry. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run` | 0 | 58 Testdateien, 1060 Tests bestanden. |
| `cd mobile && npx vitest run` | 0 | 45 Testdateien, 443 Tests bestanden. |
| `cd shared && npx vitest run` | 0 | 9 Testdateien, 444 Tests bestanden. |
| `cd mobile && npx vitest run src/shared/api/recipeApi.test.ts src/modules/recipes/recipeShareDraftState.test.ts src/modules/recipes/RecipeInstagramOptionsSheet.test.tsx src/services/recipeShareMediaService.test.ts src/modules/recipes/RecipeInstagramPreview.test.tsx` | 0 | 5 Dateien, 32 fokussierte US-09-Tests bestanden, einschließlich exakter Options-Sheet-Copy und finalem Render-UI-Lock. |
| `cd backend && npx tsc --noEmit` | 0 | Backend-Typecheck bestanden. |
| `cd mobile && npx tsc --noEmit` | 0 | Mobile-Typecheck bestanden. |
| `cd shared && npx tsc --noEmit` | 0 | Shared-Typecheck bestanden. |
| `cd backend && npm run build:verify` | 0 | Build- und Modulauflösungsprüfung bestanden. |
| `node scripts/check-encoding.mjs` | 0 | Encoding-Prüfung bestanden. |
| `git diff --check` | 0 | Keine Whitespace-Fehler. |
| `cd mobile && npx expo config --type introspect --json` | 0 | Expo-Config-Introspection und Native-Media-Plugin-Auflösung bestanden. |
| `cd mobile && npx expo install --check` | 1 | Erwartete dokumentierte Abweichung: `expo@54.0.36` gegenüber `~54.0.37`; automatische Korrektur wurde abgelehnt und es wurden keine Paketänderungen vorgenommen. |
| `POST http://127.0.0.1:7071/api/recipes/00000000-0000-0000-0000-000000000000/instagram-render` ohne Bearer | 0 | HTTP 401; lokale Route und Auth-Middleware erreichbar, wie im Dev-Gate dokumentiert. |

## UNVERIFIED

- Ein authentifizierter Dev-End-to-End-Render mit echtem user-scoped Rezept,
	Blob und Testtoken wurde nicht ausgeführt; es gab kein sicheres Fixture.
- Linux-Node-20-x64-Native-Smoke und Veröffentlichung konnten auf dem
	Windows-Host ohne Linux Node 20 x64, WSL oder Docker nicht ausgeführt werden.
- `expo@54.0.36` bleibt gegenüber `~54.0.37` ein offenes dokumentiertes
	Kompatibilitätsgate. Die automatische Änderung wurde nicht ausgeführt.
- Externe/deployte Azure-Application-Settings wurden nicht abgefragt.
- Cosmos-Emulator- beziehungsweise authentifizierte Persistenzprüfungen
	wurden nicht ausgeführt; der genehmigte Plan sieht wegen der fehlenden
	Persistenzänderung keinen Cosmos-Contract-Test vor.

## MANUAL VALIDATION REQUIRED

- Voraussetzungen: neuer Expo-54-Dev-Build mit den installierten Native-
	Paketen, physisches Android- und iOS-Gerät oder gleichwertige native
	Testumgebung sowie Testrezepte mit keinem/einem/mehreren Bildern und
	0/1-3/4/>4 Tags.
- Android/iOS prüfen: native Foto-Berechtigungen, retrybare und dauerhafte
	Ablehnung, erstes Anlegen und spätere Wiederverwendung des exakten Albums
	`FitTrack`, Erhalt anderer Alben/Inhalte, Asset-/Album-Rollback ohne
	Share-Sheet, `1080 x 1350`, Hero-Crop/Pan/Pinch, Back/System-Back und
	Screenreader-Labels.
- Share-Sheet prüfen: identische URI zwischen Asset und nativer Freigabe,
	URI-Lebensdauer bis Promise-Auflösung, Share-Abbruch/Fehler ohne Instagram-
	Erfolgsbehauptung, Retry ohne zweites Asset und Cleanup nach Abschluss.
- Erwartetes Ergebnis: alle nativen Permission-, Album-, Asset-, Crop-,
	Back-, Accessibility- und Share-Semantiken entsprechen dem genehmigten
	Plan; diese Geräteprüfung bleibt bis zur Ausführung offen.

## Findings

No actionable findings. Die beiden vorherigen nicht-blockierenden Findings
sind mit der exakten Options-Sheet-Copy und der vollständigen UX-KB-Ergänzung
behoben; alle überprüften Kriterien erfüllen den genehmigten Plan.