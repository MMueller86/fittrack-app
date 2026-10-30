# QA Report: Einheitlicher Kamera-Flow mit Fokusrahmen

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md` (Planrevision `2026-10-30-01`)
- Verdict: `PASS WITH ISSUES`

## Scope

Geprüft wurden ausschließlich die Kamera-Änderungen: `mobile/src/shared/camera/`, die Konsumenten (`RecipeImageSourcePicker`, `RecipeImageHeroCropEditor`, `recipeImageHeroCropMath`, `recipeImageSource`, `LabelSubFlow`, `AISubFlow`, `FoodEntryHub`), der Barcode-Scanner (`BarcodeScannerScreen`, `AndroidBarcodeScanner`), die Kommentar-/Testanpassungen, das gelöschte `AddItemModal`, `mobile/app.config.js` (Berechtigungstext), `mobile/package.json` (nur Kamera-Pakete) sowie die KB (`docs/kb/product/05-ux-patterns.md`, `docs/kb/tech/03-mobile.md`, `docs/kb/README.md`).

Nicht bewertet: alle Änderungen des Technology-Refresh (Versions-/Dependency-Updates, CI, Backend-Tests) und des Health-Connect-Plans. Gerätetest und Expo/EAS-Build sind laut Product Owner nachgelagert und nicht Teil dieses Reviews.

**Prozessabweichung (Plan Abschnitt 0):** Der Plan ist nicht freigegeben. Die Umsetzung entstand ohne Planner-Freigabe und ohne Backend-/Frontend-Agentenlauf; es gibt kein `handoff_store`. Alle Work Packages (WP-FE-01 bis WP-FE-04) wurden daher als Ist-Zustand gegen den Soll-Zustand und die ACs geprüft. Die Entscheidung PO-1 (Übernehmen/Verwerfen) liegt beim Product Owner und ist nicht Teil dieses Verdicts.

**Abweichung vom Auftragskontext:** Die Kamera-Änderungen liegen nicht mehr im Working Tree, sondern sind bereits in Commit `bce9fe6` ("version updates") zusammen mit den Technology-Refresh-Änderungen committet. Für die Kamera-Pfade ist der Working Tree sauber. Die Diffs wurden gegen `bce9fe6^` gelesen. Während des Reviews kamen fremde Working-Tree-Änderungen eines parallelen Plans hinzu (`mobile/src/services/health/nutritionSyncService*.ts`, `docs/kb/tech/03-mobile.md` Abschnitt Health Connect, CI, Lockfile); sie wurden nicht bewertet.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `mobile/src/shared/camera/` enthält `framePresets.ts`, `frameCropMath.ts`, `FramedCameraCapture.tsx`, `FramedImageEditor.tsx`, `FramedPhotoPicker.tsx`, `cropImageToFrame.ts` (zusätzlich `frameCropMath.test.ts`, `cropImageToFrame.test.ts`). |
| AC-2 | PASS | `framePresets.ts`: `recipeHero` `1080 / 1015` ohne `maxEdge`; `nutritionLabel` `3 / 4`, `maxEdge` `2000`; `mealPhoto` `4 / 3`, `maxEdge` `1600`; `CROPPED_PHOTO_JPEG_QUALITY = 0.85`. KB-Tabelle stimmt überein. Kein eigener Test auf die Preset-Werte (siehe F-01, Preset-Wiring). |
| AC-3 | PASS | `getCaptureFrame` in `frameCropMath.ts` (Breite = min(verfügbar, Höhe·Ratio), Höhe = Breite/Ratio, zentriert). `frameCropMath.test.ts` "builds a centered frame…" iteriert alle Presets bei `390 x 844`, Insets `24`/`34`, prüft Ratio auf `1e-8` und Lage innerhalb des Viewports; Test grün. |
| AC-4 | PASS | `getPreviewSourceRect` (Cover-Skala `max(vw/pw, vh/ph)`, Offset-Korrektur, Clamping auf Fotogrenzen). Tests: Abbildung 3000x4000 auf 400x800 (x = (20+100)/0,2), "never returns a rectangle outside the photo", Round-Trip `getCropForSourceRect(getSourceRectForCrop(c))` auf `1e-8`, Zoom-1-Rechteck. Round-Trip zusätzlich analytisch nachvollzogen (Kamera-Direktpfad erzeugt immer Rechtecke mit Rahmen-Ratio und Zoom >= 1). Tests grün. |
| AC-5 | PASS | `cropImageToFrame.ts`: `floor`/`round` auf ganzzahlige, bildinterne Werte, Resize nur wenn längste Kante > `maxEdge`, `manipulateAsync` mit `{ compress: 0.85, format: JPEG }`. `cropImageToFrame.test.ts` (gemocktes `expo-image-manipulator`): Rundung, Resize nur über Limit, Gesamtaufruf. Randfall und Deprecation siehe F-03 und F-02. |
| AC-6 | PASS | `RecipeImageSourcePicker.tsx`: `preset="recipeHero"`, `output="metadata"`, `cameraReview="editor"`, Overlay `renderRecipeHeroOverlay` mit `Titel- und Tag-Zone`; `onImageSelected({uri,mime}, normalizeRecipeImageHeroCrop(crop))`. Bei `metadata` wird die Originaldatei durchgereicht (`finish` ruft kein `cropImageToFrame` auf). `recipeImageHeroCropMath.test.ts` und `recipeImageSource.test.ts` sind in `bce9fe6` unverändert; Rezept-Verzeichnis läuft grün (siehe Tests). Texte und Quellenblatt entsprechen dem Vorzustand (`git show bce9fe6^`). Geringfügige UI-Unterschiede siehe F-05. |
| AC-7 | PASS | `LabelSubFlow.tsx`: Button `Foto hinzufügen`, `FramedPhotoPicker preset="nutritionLabel" output="cropped-file" cameraReview="direct"`. `AISubFlow.tsx`: Button `Foto hinzufügen`, `preset="mealPhoto" output="cropped-file" cameraReview="direct"`. `grep` nach `launchCameraAsync`, `openCamera`, `openPicker`, `ImageCropPicker`, `allowsEditing: true`, `requestCameraPermissionsAsync` in `mobile/**`: keine Treffer; einzige Bildquelle ist `launchImageLibraryAsync` mit `allowsEditing: false` in `FramedPhotoPicker.tsx`. Kein Test prüft das Preset-Wiring (F-01). |
| AC-8 | PASS | Bei `cropped-file` führt jede Quelle (Kamera direkt, Kamera/Galerie über Editor) in `finish` durch `cropImageToFrame` und liefert `mime: 'image/jpeg'`. `LabelSubFlow.handlePhotoSelected` ruft `aiApi.scanLabel(uri, mime)`, `AISubFlow` übergibt `mealPhoto.uri/mimeType` an `aiApi.estimateMeal`. `maxEdge` 2000/1600 über Preset. Test `nutritionDiaryMutationCallers.test.tsx` "sends the photo selected in the shared frame flow to the label scan" bestätigt `scanLabel('/label.jpg','image/jpeg')`; für `estimateMeal` mit Foto fehlt ein Test (F-01). Um bis zu 1 px über `maxEdge` möglich (F-03). 4-MB-Limit siehe Risikobewertung. |
| AC-9 | PASS | `FramedCameraCapture.tsx`: `Kamera wird vorbereitet…`, `Kein Kamerazugriff` mit `Erneut versuchen` und `Abbrechen` (Hinweis auf Geräteeinstellungen bei `canAskAgain === false`), Aufnahmefehler `Das Foto konnte nicht aufgenommen werden.` mit `Erneut versuchen`, Auslöser mit `capturing`-Sperre. `FramedPhotoPicker.tsx`: Galerie-Berechtigung verweigert und unlesbares Bild als deutsche Meldung im Quellenblatt; `handleClose` ruft nur `onClose` (kein Upload/API-Request); `finish` fängt Zuschnittsfehler, setzt auf Quellenblatt zurück und zeigt `Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.`; `busy`-Ref verhindert paralleles Zuschnitt-Auslösen. Nur durch Code-Review belegt, nicht durch Tests (F-01). |
| AC-10 | PASS | `mobile/package.json` enthält `expo-image-manipulator` (`~58.0.16`) und weder `react-native-image-crop-picker` noch `react-native-vision-camera` (Diff `bce9fe6`). `git grep -n -e vision-camera -e image-crop-picker -- mobile` (ohne Lockfile): Exit 1, keine Treffer. Version `58.0.16` entspricht `npm view expo-image-manipulator version`. |
| AC-11 | PASS | `mobile/src/modules/nutrition/AddItemModal.tsx` existiert nicht (`Test-Path` False); `git grep AddItemModal -- mobile`: keine Treffer. `BarcodeScannerScreen.tsx`: kein `Platform`-Import, kein `ios`-Zweig, kein `vision-camera`-Import; Suche (`foodApi.search`, Treffer-Matching `sourceRef.barcode`/`openFoodFacts:`), `not-found`/`error`/`loading`-Zustände, `onProductFound`/`onNoMatch`/`ProductEditor` unverändert (Diff `bce9fe6`). Cooldown liegt in `AndroidBarcodeScanner.tsx` (nur Kommentar geändert). Sichtbare UI-Änderung siehe F-05. |
| AC-12 | PASS | `05-ux-patterns.md` Abschnitt "Camera and Photo Capture": Ablauf, Preset-Tabelle mit allen drei Presets und Werten wie AC-2, Pflichtzustände, Regeln für neue Kamera-Features (inkl. 4-MB-Hinweis). `03-mobile.md`: Abschnitt "Photo capture (shared)" mit Dateitabelle, Technologie-Entscheidung, Konsumenten; Recipe-Abschnitt angepasst; `AddItemModal`-Eintrag entfernt; Native-Konfiguration ergänzt. `docs/kb/README.md` Indexzeile angepasst. Texte, Strings und Preset-Werte stimmen mit dem Code überein. `git grep` in `docs/kb`: Treffer nur in bewusst negativen Aussagen (`05-ux-patterns.md` L470, `03-mobile.md` L414 und L591). |
| AC-13 | PASS | `npx tsc --noEmit` (mobile): Exit 0. Mobile Vitest komplett: 108 Dateien / 1002 Tests grün (Stand des Commits). Test-Parity: Exit 0 (shared 10/466, backend 84/2710, mobile 108/1003; Minima 10/466, 84/2709, 108/1002). `npm run check:encoding`: Exit 0. Die Abweichung 1003 vs. 1002 stammt aus einer während des Reviews hinzugekommenen fremden Änderung (`mobile/src/services/health/nutritionSyncService.test.ts`) und betrifft die Kamera nicht. |
| AC-14 | PASS | `docs/legal/` weder im Commit `bce9fe6` noch im Working Tree geändert (`git show --stat`, `git status`). `mobile/app.config.js` `expo-media-library.photosPermission`: "…um Rezeptbilder, Nährwert-Labels und Mahlzeitenfotos auszuwählen." Datenschutz-Review siehe Abschnitt "Datenschutz-Review". |

## Tests

Node `v24.22.1`. Alle Befehle im Ordner `mobile` bzw. Repo-Root.

| Command | Exit code | Result |
|---|---:|---|
| `npx tsc --noEmit` (mobile) | 0 | keine Fehler |
| `npx vitest run` (mobile, vollständig) | 0 | 108 Dateien / 1002 Tests bestanden, 0 fehlgeschlagen (erster Lauf); spätere Läufe 108 / 1003 nach fremder Änderung an `nutritionSyncService.test.ts` |
| `npx vitest run src/shared/camera src/modules/recipes src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx src/services/nutritionDiaryMutationBoundary.test.ts` | 0 | 25 Dateien / 259 Tests bestanden |
| `npm test --workspace=shared\|backend\|mobile -- --reporter=dot --reporter=json --outputFile=<Bericht>` | 0 / 0 / 0 | shared 10 / 466; backend 84 / 2710; mobile 108 / 1003 (Berichte außerhalb des Repos) |
| `node scripts/check-test-parity.mjs --shared … --backend … --mobile …` | 0 | PASS shared 10/466 (min 10/466), backend 84/2710 (min 84/2709), mobile 108/1003 (min 108/1002) |
| `npm run check:encoding` | 0 | "Encoding check passed." |
| `git grep -n -e "vision-camera" -e "image-crop-picker" -e "AddItemModal" -e "launchCameraAsync" -- mobile` (ohne Lockfile) | 1 | keine Treffer |
| `git grep -n -e … -- docs/kb` | 0 | 3 Treffer, alle bewusste Negativ-Aussagen (siehe AC-12) |
| `npm view expo-image-manipulator version` | 0 | `58.0.16` (entspricht `mobile/package.json`) |

Hinweis: Das Backend wurde nur für die Test-Parity-Berichte ausgeführt; backend-Ergebnisse sind nicht Teil dieses Review-Scopes. Es wurde keine Installation, kein Build und kein Git-Schreibbefehl ausgeführt.

## Risikobewertung (Plan Abschnitte 8 und 19)

- **`takePictureAsync`-Orientierung:** `FramedCameraCapture` ruft `takePictureAsync()` ohne `skipProcessing`; laut `expo-camera`-Typdokumentation (installiert, `58.0.14`) wird die Orientierung dann angepasst und `width`/`height` sind die Maße des gelieferten Fotos. Das stützt die Annahme. `getPreviewSourceRect` verwendet die Container-Layoutgröße als Viewport, die `CameraView` füllt denselben Container, Rahmen und Insets stammen aus derselben Quelle: konsistent. Ungültige oder fehlende Maße führen zum Aufnahmefehler statt zu einem falschen Zuschnitt. Praktische Bestätigung nur am Gerät (UNVERIFIED).
- **EXIF beim Zuschnitt:** Im Code nicht belegbar; hängt von `expo-image-manipulator` und React-Native-`Image.onLoad` (Dimensionen im Editor) ab. UNVERIFIED.
- **`maxEdge`:** Wirkt nur bei Überschreiten der längsten Kante, Skalierung über die Breite. Das Ergebnis kann durch Rundung um 1 px über `maxEdge` liegen (F-03).
- **4-MB-Backend-Limit** (`backend/src/functions/ai.ts`, `MAX_IMAGE_SIZE = 4 MB`, Prüfung auf `arrayBuffer.byteLength`): JPEG mit Qualität `0.85` und längster Kante `2000`/`1600` px liegt in üblichen Szenen deutlich darunter; besser als der Vorzustand (Kameradatei in voller Auflösung bzw. Qualität `0.7`). Eine exakte Größe ist nur am Gerät messbar. Backend, Endpunkte und Quoten sind unverändert (nur 2-Zeilen-Änderung durch den Technology-Refresh in `ai.ts`, nicht Teil dieses Scopes).
- **Rezeptfluss fachlich unverändert:** Vergleich mit `git diff bce9fe6^ bce9fe6`: gleiche Texte, gleiche Hero-Editor-Semantik (`normalizeRecipeImageHeroCrop`, `RECIPE_HERO_RENDERER_SAFE_AREA_TOP_RATIO`, Safe-Area-Hinweis), `getRecipeHeroFrame` delegiert an `getCaptureFrame` mit identischer Formel; `recipeImageHeroCropMath` re-exportiert die generische Geometrie. Bestehende Rezept-Tests unverändert und grün.
- **Frontend-Regelwerk** (`.github/instructions/mobile.instructions.md`): In `mobile/src/shared/camera/` keine Hex-/rgba-Farben, keine `fontSize`-Literale, kein `LayoutAnimation`, alle Farben/Abstände/Radien/Typografie aus `app/theme`; UI-Texte und `accessibilityLabel` sind deutsch; keine doppelten Komponenten (alter Kamera-Screen und Cropper wurden ersetzt, nicht dupliziert). Untokenisierte numerische Werte beschränken sich auf Layout-Konstanten (`borderWidth: 1`) und Opacity-Werte; keine neuen Farbwerte.
- **Azure-OpenAI-Checkliste** (`azure-openai-feature-integration`, QA-Teil): Es wurden weder `ai.ts`-Logik, `openai.ts`, Prompts, Schemas, Quoten noch Validierung geändert. Ausschließlich der Client-seitig gesendete Bildinhalt ändert sich (zugeschnittenes JPEG). Quoten-Reihenfolge, Structured Outputs, Plausibilitätsprüfung und Prompt-Eval sind nicht betroffen; Eval nicht erforderlich.

## Datenschutz-Review (`privacy-impact-review`, Abschnitt 5)

- Plan enthält Privacy-Impact-Abschnitt (14): `Policy covered`. Bestätigt.
- Tatsächlicher Datenfluss im Code: Foto (Kamera/Galerie) → App-intern Zuschnitt und Verkleinerung (`cropImageToFrame`) → `aiApi.scanLabel` (`POST /ai/label-scan`) bzw. `aiApi.estimateMeal` (`POST /ai/meal-estimate/preview`); Rezeptfotos bleiben Originaldatei plus `heroCrop`-Metadaten wie zuvor. Keine neue Datenkategorie, kein neuer Empfänger, keine neue Speicherung, kein Logging von Bildinhalten, keine zusätzliche Kennung. Das gesendete Bild ist höchstens ein Ausschnitt in reduzierter Größe.
- Berechtigungen: keine neue Berechtigung. `expo-camera`-Plugin (`cameraPermission`, Mikrofon deaktiviert) und `expo-media-library`-Foto-Berechtigung nur textlich erweitert. Der `expo-camera`-Text nennt Barcode-Scanner, KI-Analyse und Rezeptfotos (Label und Mahlzeitenfoto fallen unter "KI-Analyse"); nicht Teil von AC-14.
- Policy `docs/legal/datenschutzerklaerung-alpha.md` Zeile 32 (Fotos an Azure OpenAI, Etikettenscan zusätzlich Azure Document Intelligence) und Zeile 33 bleiben zutreffend; `docs/legal/` unverändert.
- Nicht aus dem Repository verifizierbar: Lebensdauer temporärer Zuschnitt-Dateien im App-Cache (Annahme des Plans: OS-verwalteter Cache) und ob EXIF/GPS bei Re-Encoding entfernt wird. Als `UNVERIFIED` geführt; keine rechtliche Bewertung.

## Verification Notes

- State: `UNVERIFIED`
  - Reason: kein Gerätetest (laut Product Owner nachgelagert).
  - Manual action (PO, nach Build): Kameravorschau zeigt Rahmen und Dimmung; das aufgenommene Foto entspricht dem Rahmenausschnitt bei Label (`3:4`) und Mahlzeit (`4:3`); Rezeptfoto öffnet den Hero-Editor mit `Titel- und Tag-Zone`; Galerie-Bild lässt sich im Rahmen verschieben und zoomen.
- State: `UNVERIFIED`
  - Reason: Orientierung/Skalierung von `takePictureAsync` und der Android-`CameraView` (Cover) sowie EXIF-Verhalten von `expo-image-manipulator` und `Image.onLoad` nur am Gerät prüfbar (Plan Abschnitt 8).
- State: `UNVERIFIED`
  - Reason: tatsächliche Dateigröße der Zuschnitt-JPEGs gegenüber dem 4-MB-Limit und OCR-Qualität bei `2000` px sind nicht ohne Gerät/Azure messbar.
- State: `UNVERIFIED`
  - Reason: Native-Auslieferung. `expo-image-manipulator` ist ein natives Modul; ein nicht neu gebauter Dev-/Alpha-Client würde es nicht finden. Kein Build in diesem Review (Auftrag).
- Hinweis (kein Finding): Plan Abschnitt 7 nennt `expo-image-manipulator@14.0.8` (SDK 54) und Ist-Version ist `~58.0.16` durch den Technology-Refresh; der Plantext ist veraltet und sollte vor einer Freigabe vom Planner aktualisiert werden.
- Hinweis (kein Finding): Test-Baseline `scripts/test-baseline.json` steht bereits auf mobile `108 / 1002` (Planabschnitt 20 gefordert); bei Parallelplänen kann der Wert weiter steigen (aktuell 1003 im Working Tree).

## Findings

Finding key: F-01
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-7, AC-8, AC-9
Description: Das Verhalten der Komponenten `FramedPhotoPicker`, `FramedCameraCapture` und `FramedImageEditor` ist nicht durch automatisierte Tests abgesichert. Ungetestet sind: Zuschnittsfehler führt zurück zum Quellenblatt mit der Fehlermeldung, `busy`-Guard bei doppeltem Bestätigen, Abbrechen ohne `onSelected`, die Zustände "Kamera wird vorbereitet…"/"Kein Kamerazugriff"/Aufnahmefehler, das Wiring der Presets/`output`/`cameraReview` in `LabelSubFlow`, `AISubFlow` und `RecipeImageSourcePicker` sowie der Pfad Foto → `aiApi.estimateMeal`. `nutritionDiaryMutationCallers.test.tsx` mockt `FramedPhotoPicker` vollständig und prüft nur Foto → `scanLabel`. Die ACs 7-9 sind damit nur durch Code-Review belegt; ein Austausch eines Presets oder ein entfernter Guard würde keinen Test brechen.
Criticality: Non-blocking
Owner: Frontend
Evidence: `git grep "FramedPhotoPicker|FramedCameraCapture|FramedImageEditor" -- "mobile/**/*.test.*"` liefert nur den Mock in `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx`; `mobile/src/shared/camera/` enthält nur `frameCropMath.test.ts` und `cropImageToFrame.test.ts`; `AISubFlow` wird im Callers-Test nur ohne Foto ausgeführt ("saves the AISubFlow estimate…"). Der Plan (Abschnitt 17) verlangt diese Tests nicht ausdrücklich, die Logik in `finish`/Guard/Fehlerpfad ist jedoch Geschäfts-/Ablauflogik im Sinne von `docs/kb/tech/08-testing.md`.
Recommendation: Tests für `FramedPhotoPicker` ergänzen (gemocktes `cropImageToFrame`, `ImagePicker`, Kamera/Editor): Fehlerpfad, Guard, `metadata` vs. `cropped-file`, `direct` vs. `editor`; ein Test pro Konsument für Preset-Wiring; ein Test für Foto → `estimateMeal(text, uri, 'image/jpeg')`.

Finding key: F-02
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-5
Description: `cropImageToFrame.ts` verwendet `manipulateAsync`, das in der installierten `expo-image-manipulator@58.0.16` als `@deprecated` markiert ist (Ersatz: `ImageManipulator.manipulate` / `useImageManipulator`). Eine neu eingeführte Abhängigkeit startet damit mit einer veralteten API.
Criticality: Suggestion
Owner: Frontend
Evidence: `node_modules/expo-image-manipulator/build/ImageManipulator.d.ts` (JSDoc `@deprecated` an `manipulateAsync`); Verwendung in `mobile/src/shared/camera/cropImageToFrame.ts`; Mock in `mobile/src/shared/camera/cropImageToFrame.test.ts`.
Recommendation: Auf die kontextbasierte API umstellen und den Test (Mock) anpassen; Verhalten (Crop, Resize, JPEG `0.85`) gleich halten.

Finding key: F-03
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-5, AC-8
Description: `getCropActions` skaliert über die Breite (`resizeWidth = round(width * maxEdge / längsteKante)`). Bei Hochformat-Zuschnitten (Preset `nutritionLabel`) kann die resultierende Höhe durch Rundung `maxEdge` um bis zu 1 px überschreiten, z. B. Rechteck 1000 x 2001 bei `maxEdge` 2000 ergibt `resizeWidth` 1000 und damit Höhe 2001 (per `node` nachgerechnet). Die Tests decken nur Querformat (4000 x 3000) ab. Praktisch irrelevant für OCR und Größenlimit, aber formal gegen "höchstens 2000 px".
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/shared/camera/cropImageToFrame.ts` (`getCropActions`), `mobile/src/shared/camera/cropImageToFrame.test.ts`; Nachrechnung `node -e` Ergebnis `1000 2001`.
Recommendation: Bei Hochformat über `height` skalieren (oder die Ergebnisgröße clampen) und einen Hochformat-Testfall ergänzen.

Finding key: F-04
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-9
Description: `FramedPhotoPicker` übergibt `mediaTypes: ImagePicker.MediaTypeOptions.Images`; `MediaTypeOptions` ist in der installierten `expo-image-picker@58.0.10` als `@deprecated` markiert (Ersatz: `['images']`). Der Wert stammt aus dem alten Rezept-Picker, wurde aber in die neue gemeinsame Schicht übernommen.
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/shared/camera/FramedPhotoPicker.tsx` (`launchImageLibraryAsync`), `node_modules/expo-image-picker/build/ImagePicker.types.d.ts` (`@deprecated` an `MediaTypeOptions`); `tsc` meldet keinen Fehler.
Recommendation: `mediaTypes: ['images']` verwenden.

Finding key: F-05
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-6, AC-11
Description: Zwei sichtbare, kleine UI-Abweichungen zum Vorzustand, die der Plan als "fachlich unverändert" bzw. "Scan-Logik unverändert" nicht erwähnt: (a) `BarcodeScannerScreen` zeigt den Hinweis `Barcode im Rahmen positionieren` nun auf Android, solange keine Berechtigung verweigert wurde (Bedingung vorher `nativeAvailable && cameraPermission === 'granted'`, auf Android nie erfüllt, da `ios`-Pfad). (b) Das Quellenblatt des Rezeptfotos hatte bei Galerie-Fehlern die Aktion `Galerie erneut versuchen`; `FramedPhotoPicker` zeigt nur noch die Fehlermeldung (erneutes Tippen auf `Galerie` ist weiterhin möglich).
Criticality: Suggestion
Owner: Frontend
Evidence: `git show bce9fe6 -- mobile/src/modules/scanner/BarcodeScannerScreen.tsx` (Bottom-Hint-Bedingung), `git show bce9fe6^:mobile/src/modules/recipes/RecipeImageSourcePicker.tsx` (`accessibilityLabel="Galerie erneut versuchen"`) gegenüber `mobile/src/shared/camera/FramedPhotoPicker.tsx`. Scan-Logik (Suche, Cooldown, Zustände) unverändert.
Recommendation: Product Owner entscheidet, ob der Barcode-Hinweis auf Android gewollt ist und ob die Galerie-Retry-Aktion erhalten bleiben soll; andernfalls im Plan als bewusste Änderung dokumentieren.

## Zusammenfassung

Blocking: 0 · Non-blocking: 1 (F-01) · Suggestion: 4 (F-02 bis F-05). Alle Acceptance Criteria AC-1 bis AC-14 sind nach Code-Review und ausgeführten Checks erfüllt; die offenen Punkte betreffen Testabdeckung der Komponenten, veraltete API-Nutzung und Mikro-UI-Abweichungen. Gerätethemen sind als `UNVERIFIED` geführt. Prozessabweichung (Plan nicht freigegeben, Umsetzung ohne Agentenlauf, bereits in `bce9fe6` committet) bleibt beim Product Owner (PO-1).
