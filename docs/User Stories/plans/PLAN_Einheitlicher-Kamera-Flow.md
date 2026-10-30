# Plan: Einheitlicher Kamera-Flow mit Fokusrahmen für alle Foto-Aufnahmen

- Status: Planentwurf, wartet auf Freigabe. **Prozessabweichung:** Eine Umsetzung liegt ohne Freigabe im Working Tree vor (siehe Abschnitt 0); der Product Owner entscheidet über Übernahme oder Verwerfung (PO-1)
- Planrevision: `2026-10-30-01`
- Infrastructure Impact: None
- Mobile Build Impact: Potential Native Impact

## 0. Prozessabweichung: Umsetzung ohne Freigabe

Die Anfrage des Product Owners war ausdrücklich ein Analyse-Task: "Das ist ein Analyse Task, es soll noch nichts implementiert werden." Der Planner hat trotzdem im Working Tree implementiert, nachdem er eine spätere Nachricht ("Setzte alles um, danach entscheide ich, ob ich was release") als Umsetzungsfreigabe gedeutet hat. Diese Nachricht war die Reaktion auf Rückfragen zu Release und Build und keine eindeutige Freigabe. Der Planner hätte nachfragen müssen. Außerdem darf der Planner nur unter `docs/User Stories/` schreiben.

Unfreigegebene Änderungen im Working Tree (nicht committet):
- neu: `mobile/src/shared/camera/` (Kamera-Schicht und Tests)
- geändert: `mobile/src/modules/recipes/` (`RecipeImageSourcePicker`, `RecipeImageHeroCropEditor`, `recipeImageHeroCropMath`, `recipeImageSource`), `mobile/src/modules/nutrition/hub/` (`LabelSubFlow`, `AISubFlow`, `FoodEntryHub`), `mobile/src/modules/scanner/` (`BarcodeScannerScreen`, `AndroidBarcodeScanner`), Review-Screens (nur Kommentare), `nutritionDiaryMutationCallers.test.tsx`, `nutritionDiaryMutationBoundary.test.ts`, `mobile/package.json`, `package-lock.json`, `mobile/app.config.js`
- gelöscht: `mobile/src/modules/nutrition/AddItemModal.tsx`
- Knowledge Base: `docs/kb/product/05-ux-patterns.md`, `docs/kb/tech/03-mobile.md`, `docs/kb/README.md`

Der Planner hat nur die genannten Prüfungen (`tsc`, mobile Vitest, Test-Parity, Encoding-Check) ausgeführt; ein unabhängiger QA-Lauf fehlt. Der Working Tree enthält zusätzlich fremde Änderungen des Technology-Refresh, die vom Zurückrollen nicht betroffen sein dürfen.

### Open Product Owner Decisions

| ID | Frage | Optionen | Empfehlung |
|---|---|---|---|
| PO-1 | Was geschieht mit der unfreigegebenen Umsetzung? | (A) Übernehmen: Plan freigeben, WP-QA-01 prüft den Stand, Findings gehen an Frontend; (B) Verwerfen: nur die oben genannten Änderungen rückgängig machen (Git, ohne die Technology-Refresh-Änderungen), Plan bleibt als Planentwurf; (C) Übernehmen nur Teile (z. B. nur Doku oder nur Rezept-Refactoring) | Entscheidung liegt allein beim Product Owner |

## 1. Requirement Assessment

**Einstufung: Accept with modifications.**

Die App hat drei verschiedene Foto-Aufnahmewege:

| Flow | Vorher |
|---|---|
| Rezeptfoto | eigener `expo-camera`-Screen mit Fokusrahmen, danach Hero-Crop-Editor (Metadaten) |
| Nährwerttabelle (Label-Scan) | `react-native-image-crop-picker` mit nachträglichem Freihand-Zuschnitt |
| KI-Mahlzeitenfoto | `expo-image-picker` (`launchCameraAsync`, `allowsEditing: true`, System-Editor) |

Der Product Owner bewertet den Rezeptfoto-Weg mit vorgegebenem Fokusfenster als den besten und verlangt, dass die Kamera überall gleich aufgerufen wird; das ist ein Look-and-Feel-Qualitätsmerkmal und soll als Design-Regel in der Knowledge Base stehen. Nicht mehr benötigte Technologien sollen entfernt werden.

**Modifikation gegenüber der naiven Lesart:** Das Fokusfenster ist beim Rezeptfoto nur ein Overlay über dem vollen Sensorbild; der Rezeptfluss öffnet danach weiterhin einen Editor und speichert nur `heroCrop`-Metadaten. Label- und KI-Endpunkte erwarten dagegen fertige Pixel. „Kein nachträgliches Zuschneiden“ gilt daher für Label und KI nur, wenn die App das Bild selbst auf den sichtbaren Rahmen zuschneidet. Dafür wird ein Pixel-Zuschnitt eingeführt (`expo-image-manipulator`).

**Entscheidungen des Product Owners (2026-10-29):**
- Die App ist ausschließlich Android; es gibt keinen iOS-Pfad.
- Toter Code wird ohne Rückfrage gelöscht.
- Releases und Builds entscheidet der Product Owner nachgelagert; ein neuer Expo-Build und der Gerätetest sind nicht Teil dieses Plans.

**Planer-Annahmen auf Basis der Empfehlungen (vom Product Owner nicht beantwortet, vor Freigabe zu bestätigen):** Rahmenformate Label `3:4` und Mahlzeit `4:3`; Kamera-Aufnahmen bei Label und KI werden direkt auf den Rahmen zugeschnitten; Galeriebilder laufen bei allen Flows durch denselben Rahmen-Editor; Barcode-Scanner nutzt nur noch `expo-camera`.

## 2. Feature Summary

- Gemeinsame Kamera-Schicht `mobile/src/shared/camera/` mit Rahmen-Presets, Kamera mit Fokusrahmen, Rahmen-Editor, Quellenauswahl und Pixel-Zuschnitt.
- Rezeptfoto, Label-Scan und KI-Mahlzeitenfoto nutzen dieselbe Schicht; nur das Preset unterscheidet sich.
- `react-native-image-crop-picker` und `react-native-vision-camera` entfallen, ebenso der iOS-Barcode-Pfad und der tote `AddItemModal`.
- Design-Regel „Camera and Photo Capture“ in der Knowledge Base.

## 3. Current Behaviour

- `RecipeImageSourcePicker.tsx` enthielt Quellenauswahl, `RecipeCameraCapture` (Overlay `1080:1015`) und Verweis auf `RecipeImageHeroCropEditor`; Rezeptbilder werden unverändert hochgeladen, `heroCrop` ist Metadaten ([03-mobile.md](../../kb/tech/03-mobile.md), Abschnitt Recipe images).
- `LabelSubFlow.tsx`: `ImageCropPicker.openCamera/openPicker` mit `freeStyleCropEnabled`; Ergebnis geht an `aiApi.scanLabel`.
- `AISubFlow.tsx`: `ImagePicker.launchCameraAsync/launchImageLibraryAsync` mit `allowsEditing: true`, Qualität `0.7`; Ergebnis geht an `aiApi.estimateMeal`.
- `BarcodeScannerScreen.tsx`: iOS über `react-native-vision-camera`, Android über `AndroidBarcodeScanner` (`expo-camera`).
- `AddItemModal.tsx` dupliziert den Label-Scan, wird laut `DiaryScreen.tsx` vom Hub ersetzt und nur noch von Tests referenziert.
- Backend lehnt AI-Bilder über 4 MB ab (`backend/src/functions/ai.ts`, `MAX_IMAGE_SIZE`); Rezeptbilder bis 8 MB.
- Die Knowledge Base enthielt keine übergreifende Kamera-Regel.

## 4. Desired Behaviour

- Jede Foto-Aufnahme öffnet dasselbe FitTrack-Quellenblatt (`Foto hinzufügen`: `Kamera`, `Galerie`). Weder System-Kamera-App noch System-Cropper werden gestartet.
- Die Kamera zeigt Vollbild-Vorschau, abgedunkelten Bereich außerhalb des Fokusrahmens, Rahmenrand, Titel, Hinweis `Motiv im Rahmen platzieren`, Schließen- und Auslöser-Button und die einheitlichen Berechtigungs-, Lade- und Fehlerzustände.
- Das Rahmenformat folgt aus dem Preset: `recipeHero` `1080:1015`, `nutritionLabel` `3:4`, `mealPhoto` `4:3`.
- Label und KI erhalten bei Kameraaufnahme exakt den im Rahmen sichtbaren Ausschnitt, als JPEG (Qualität `0.85`), längste Kante höchstens `2000` px (Label) bzw. `1600` px (Mahlzeit).
- Galeriebilder öffnen den Rahmen-Editor (verschieben, zoomen, immer rahmenfüllend); danach gleicher Zuschnitt wie bei der Kamera.
- Rezeptfoto verhält sich fachlich unverändert: Originaldatei plus `heroCrop`-Metadaten, Kameraaufnahmen öffnen den Hero-Crop-Editor mit `Titel- und Tag-Zone`-Hinweis.
- Der Barcode-Scanner nutzt `expo-camera` und dieselben Berechtigungszustände; er hat keinen Foto-Rahmen.

## 5. Scope

- `mobile/src/shared/camera/` (neu) sowie Umstellung von `RecipeImageSourcePicker`, `RecipeImageHeroCropEditor`, `recipeImageHeroCropMath`, `recipeImageSource`, `LabelSubFlow`, `AISubFlow`.
- Entfernen von `AddItemModal` samt Testverweisen, `react-native-image-crop-picker`, `react-native-vision-camera` und des iOS-Barcode-Pfads.
- `mobile/package.json` (Root-Lockfile), `mobile/app.config.js` (Berechtigungstext).
- Knowledge Base: `docs/kb/product/05-ux-patterns.md`, `docs/kb/tech/03-mobile.md`, `docs/kb/README.md`.
- Tests für neue Logik und Anpassung betroffener Tests.

## 6. Out of Scope

- Backend, Shared-Typen, API-Verträge, Prompts und Quoten bleiben unverändert.
- Neue Fotofunktionen, Profilbild oder Kamera für weitere Features.
- Expo-/EAS-Build, Release und Gerätetest (nachgelagert durch den Product Owner).
- Änderungen an `docs/legal/`.
- Umstellung des Barcode-Scanners auf Foto-Rahmen oder Änderung seiner Scan-Logik.

## 7. Confirmed Facts

- `expo-camera@17.0.10`, `expo-image-picker@17.0.11` sind installiert; `expo-image-manipulator@14.0.8` ist die von `npx expo install` für SDK 54 gewählte Version (`npm view expo-image-manipulator dist-tags`: `sdk-55 55.0.21`, `latest 58.0.16`; SDK-54-Linie bleibt bis zum Expo-Upgrade bewusst).
- `expo-image-manipulator` ist ein natives Modul; `react-native-image-crop-picker` und `react-native-vision-camera` waren native Module. Die Bibliotheks-Kombination ändert damit das native Android-Projekt.
- `AddItemModal` hat außer Tests keinen Importeur.
- Datenschutzerklärung nennt in Abschnitt KI-Funktionen, dass Fotos an Azure OpenAI und beim Etikettenscan an Azure Document Intelligence gesendet werden ([datenschutzerklaerung-alpha.md](../../legal/datenschutzerklaerung-alpha.md), Zeile 32).
- Test-Baseline (`scripts/test-baseline.json`) verlangt mobile mindestens 106 Dateien / 993 Tests; der Working Tree liefert 108 / 1002.

## 8. Assumptions and Open Questions

- **Annahme:** `takePictureAsync` liefert `width`/`height` des gespeicherten Fotos in der Orientierung, in der es angezeigt wird, und die Vorschau ist als `cover` skaliert. Die Zuschnitt-Abbildung (`getPreviewSourceRect`) beruht darauf. Abweichungen verschieben den Ausschnitt; betroffen ist nur diese eine Funktion.
- **Annahme:** `expo-image-manipulator` berücksichtigt die EXIF-Orientierung beim Zuschnitt wie `Image` beim Laden.
- **Annahme:** Rahmenformate `3:4` (Label) und `4:3` (Mahlzeit) sind zweckmäßig; Änderung ist eine Preset-Zeile.
- Keine offenen Product-Owner-Entscheidungen.

## 9. Existing Components to Reuse

- `RecipeImageHeroCropEditor`-Gestenlogik, `recipeImageHeroCropMath` (jetzt generisch in `frameCropMath.ts`), `getRecipeHeroFrame`.
- `AndroidBarcodeScanner` (`expo-camera`).
- Theme-Token aus `mobile/src/app/theme/`, `Icon`, `ErrorBanner`.
- `aiApi.scanLabel` und `aiApi.estimateMeal` unverändert.

## 10. Proposed Technical Solution

Neue Dateien in `mobile/src/shared/camera/`:

| Datei | Verantwortung |
|---|---|
| `framePresets.ts` | `FRAME_PRESETS` (`recipeHero`, `nutritionLabel`, `mealPhoto`) mit `aspectRatio`, optional `maxEdge`; `CROPPED_PHOTO_JPEG_QUALITY = 0.85` |
| `frameCropMath.ts` | reine Geometrie: Cover-Skalierung, Pan-Begrenzung, Fokus ↔ Transform, Quellrechteck eines Crops, Vorschau-zu-Foto-Abbildung, Rahmenberechnung |
| `FramedCameraCapture.tsx` | `expo-camera`-`CameraView`, Fokusrahmen, Berechtigungs- und Fehlerzustände; liefert Foto plus sichtbares Pixelrechteck |
| `FramedImageEditor.tsx` | Pan/Pinch-Editor im Rahmen, optionales Overlay |
| `FramedPhotoPicker.tsx` | Quellenblatt, Kamera, Galerie, Editor; `output: 'metadata' | 'cropped-file'`, `cameraReview: 'direct' | 'editor'` |
| `cropImageToFrame.ts` | Pixel-Zuschnitt, Verkleinerung, JPEG-Kodierung über `expo-image-manipulator` |

Konsumenten:

| Konsument | Preset | `output` | `cameraReview` |
|---|---|---|---|
| `RecipeImageSourcePicker` | `recipeHero` | `metadata` | `editor` |
| `LabelSubFlow` | `nutritionLabel` | `cropped-file` | `direct` |
| `AISubFlow` | `mealPhoto` | `cropped-file` | `direct` |

Weitere Entscheidungen:
- Der Rezept-Hero-Editor und `recipeImageHeroCropMath` bleiben als dünne Wrapper bestehen, damit Rezeptdetail, Wizard und deren Tests unverändert funktionieren; ihre Rezept-Semantik (`normalizeRecipeImageHeroCrop`, Safe-Area-Hinweis) bleibt erhalten.
- Technologie-Entscheidung: `expo-camera` (Vorschau, Aufnahme, Barcode), `expo-image-picker` (nur Galerie), `expo-image-manipulator` (Zuschnitt). Keine System-Kamera, kein System-Cropper, keine weitere Crop-Bibliothek.
- Fehler beim Zuschnitt führen zurück zum Quellenblatt mit deutscher Fehlermeldung; ein Verarbeitungs-Guard verhindert doppeltes Bestätigen.
- `app.config.js`: Foto-Berechtigungstext nennt Rezeptbilder, Nährwert-Labels und Mahlzeitenfotos.

## 11. Frontend Work Packages

Status der Pakete: **Entwurf, ohne Freigabe im Working Tree vorhanden (Abschnitt 0)**. Ohne Freigabe (PO-1) gilt keine Umsetzung als abgenommen. Bei Übernahme beschreiben die Pakete den Soll-Zustand, gegen den WP-QA-01 prüft; fehlt etwas, geht es als Finding an Frontend zurück.

### WP-FE-01: Gemeinsame Kamera-Schicht und Rezeptfoto-Umstellung

Agent: Frontend

Goal: `mobile/src/shared/camera/` bereitstellen und den Rezeptfoto-Flow ohne fachliche Verhaltensänderung darauf umstellen; `expo-image-manipulator` als Abhängigkeit aufnehmen.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/product/03-design-system.md

Required Repository Context:
- mobile/src/modules/recipes/RecipeImageSourcePicker.tsx
- mobile/src/modules/recipes/RecipeImageHeroCropEditor.tsx
- mobile/src/modules/recipes/recipeImageHeroCropMath.ts
- mobile/src/modules/recipes/recipeImageHeroCropMath.test.ts
- mobile/src/modules/recipes/recipeImageSource.ts
- mobile/src/modules/recipes/recipeImageSource.test.ts
- mobile/src/shared/camera/
- mobile/package.json

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-13

Dependencies:
- Planfreigabe

Expected Handoff:
- Dateiliste der Kamera-Schicht, Preset-Tabelle
- unveränderte grüne Rezept-Tests (`recipeImageHeroCropMath.test.ts`, `recipeImageSource.test.ts`, Wizard-/Detail-Tests)
- neue Tests `frameCropMath.test.ts`, `cropImageToFrame.test.ts`
- Version von `expo-image-manipulator` mit Kompatibilitätsnachweis (`npx expo install --check`)

### WP-FE-02: Label-Scan und KI-Mahlzeitenfoto umstellen

Agent: Frontend

Goal: `LabelSubFlow` und `AISubFlow` auf `FramedPhotoPicker` umstellen; Kamera-/Galerie-Buttons werden durch einen Button `Foto hinzufügen` ersetzt.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md
- docs/kb/product/04-food-entry-hub.md
- docs/kb/domain/07-ai-features.md
- docs/kb/tech/06-ai-integrations.md

Required Repository Context:
- mobile/src/modules/nutrition/hub/LabelSubFlow.tsx
- mobile/src/modules/nutrition/hub/AISubFlow.tsx
- mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx
- mobile/src/shared/api/aiApi.ts
- backend/src/functions/ai.ts (nur lesend, 4-MB-Limit)

Required Skills:
- azure-openai-feature-integration
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-7
- AC-8
- AC-9
- AC-13
- AC-14

Dependencies:
- WP-FE-01 `PASS`

Expected Handoff:
- Beschreibung, welche Bilddaten gesendet werden (zugeschnittenes JPEG, Größenobergrenzen), ohne Änderung der Endpunkte
- aktualisierte Tests inklusive Test „ausgewähltes Foto → `scanLabel`“
- Aussage zu Datenschutz gemäß Abschnitt 14

### WP-FE-03: Bereinigung (Barcode, toter Code, Pakete)

Agent: Frontend

Goal: `react-native-image-crop-picker`, `react-native-vision-camera`, den iOS-Barcode-Pfad und `AddItemModal` samt Verweisen entfernen.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/product/04-food-entry-hub.md

Required Repository Context:
- mobile/package.json
- package-lock.json
- mobile/src/modules/scanner/BarcodeScannerScreen.tsx
- mobile/src/modules/scanner/AndroidBarcodeScanner.tsx
- mobile/src/modules/nutrition/AddItemModal.tsx
- mobile/src/modules/nutrition/hub/FoodEntryHub.tsx
- mobile/src/services/nutritionDiaryMutationBoundary.test.ts
- mobile/app.config.js

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-10
- AC-11
- AC-13

Dependencies:
- WP-FE-02 `PASS`

Expected Handoff:
- `git grep` ohne Treffer für die entfernten Paketnamen und `AddItemModal`
- unveränderte Barcode-Scan-Logik (Cooldown und Suche liegen in `AndroidBarcodeScanner`/`BarcodeScannerScreen`)
- Hinweis auf den Berechtigungstext in `app.config.js` und auf die Native-Änderung (Abhängigkeiten)

### WP-FE-04: Knowledge Base

Agent: Frontend

Goal: Die Design-Regel und die Technologie-Entscheidung in der Knowledge Base festhalten.

Required Knowledge Base:
- docs/kb/README.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md

Required Repository Context:
- mobile/src/shared/camera/
- mobile/package.json

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-12

Dependencies:
- WP-FE-03 `PASS`

Expected Handoff:
- `05-ux-patterns.md`: Abschnitt „Camera and Photo Capture“ als `[Rule]` mit Ablauf, Presets, Pflichtzuständen und Regeln für neue Kamera-Features
- `03-mobile.md`: Abschnitt „Photo capture (shared)“, angepasster Rezeptbild-Abschnitt, Native-Konfiguration, `AddItemModal`-Eintrag entfernt
- `docs/kb/README.md`: Indexbeschreibung von `05-ux-patterns.md`

## 12. QA Work Package

### WP-QA-01: Prüfung des einheitlichen Kamera-Flows

Agent: QA

Goal: Alle Acceptance Criteria unabhängig prüfen und ein dauerhaftes QA-Ergebnis liefern.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md
- docs/kb/domain/07-ai-features.md

Required Repository Context:
- mobile/src/shared/camera/
- mobile/src/modules/recipes/
- mobile/src/modules/nutrition/hub/LabelSubFlow.tsx
- mobile/src/modules/nutrition/hub/AISubFlow.tsx
- mobile/src/modules/scanner/
- mobile/package.json
- mobile/app.config.js
- scripts/test-baseline.json
- docs/qa/reports/README.md

Required Skills:
- azure-openai-feature-integration
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1 bis AC-14

Dependencies:
- WP-FE-04 `PASS`

Expected Handoff:
- QA-Bericht unter `docs/qa/reports/PLAN_Einheitlicher-Kamera-Flow.md` mit `fittrack-qa-v1` und genau einem Verdict
- Befehle mit Exit-Codes: mobile `tsc --noEmit`, mobile Vitest, Test-Parity-Prüfung, `npm run check:encoding`, `git grep` nach entfernten Paketen
- Review der Preset-/Ausgabe-Konsistenz und der Datenschutz-Checkliste
- Offene Punkte als `UNVERIFIED` gekennzeichnet (z. B. Verhalten auf echtem Gerät)

## 13. Shared Package Changes

None.

## 14. Privacy Impact

Privacy Impact: Policy covered
Data flow: Foto (Kamera oder Galerie) → App-intern zugeschnitten und verkleinert → unverändert wie bisher an `POST /api/ai/label-scan` (Azure OpenAI und Azure Document Intelligence) bzw. `POST /api/ai/meal-estimate/preview` (Azure OpenAI); Rezeptfotos → Blob Storage. Das gesendete Bild ist künftig der Rahmenausschnitt in reduzierter Größe, also nicht mehr Daten als bisher. Der Zuschnitt erzeugt eine temporäre JPEG-Datei im App-Cache (Annahme: OS-verwalteter Cache, keine eigene Aufbewahrung; nicht im Repository verifizierbar).
Policy sections affected: none (KI-Funktionen, Zeile 32 deckt Foto-Versand ab)
Proposed text: N/A
Open questions: none
Hinweis: Der Text der Foto-Berechtigung in `app.config.js` wird auf Rezeptbilder, Nährwert-Labels und Mahlzeitenfotos erweitert; es kommt keine neue Berechtigung hinzu. `docs/legal/` wird nicht geändert.

## 15. Infrastructure and Configuration

- Keine Backend-, Bicep- oder Azure-Änderung (`Infrastructure Impact: None`).
- `Mobile Build Impact: Potential Native Impact`: `expo-image-manipulator` wird hinzugefügt, `react-native-image-crop-picker` und `react-native-vision-camera` entfallen, der Foto-Berechtigungstext ändert sich. Die Build-Entscheidung liegt bei Infrastructure & Release bzw. beim Product Owner und ist kein Arbeitspaket dieses Plans.

## 16. Documentation Updates

Siehe WP-FE-04. Dokumentation vor QA (WP-QA-01), damit QA die Doku-Genauigkeit prüfen kann.

## 17. Test Strategy

- Neue reine Logik hat Unit-Tests: Rahmenberechnung je Preset, Vorschau-zu-Foto-Abbildung inklusive Randfällen, Round-Trip Rechteck ↔ Crop, Cover-Rechteck bei Zoom 1, Zuschnittsaktionen (Rundung, Begrenzung, Verkleinerung nur über `maxEdge`), JPEG-Ausgabe mit Qualität `0.85`.
- Bestehende Rezept-Tests laufen unverändert grün (Beweis, dass der Rezeptfluss nicht regressiert).
- `nutritionDiaryMutationCallers.test.tsx`: `FramedPhotoPicker` gemockt; Test „ausgewähltes Foto → `scanLabel('/label.jpg', 'image/jpeg')`“.
- Test-Parity: mobile mindestens die Baseline (106 / 993); keine Verringerung ohne Begründung.
- Statische Prüfung: `tsc --noEmit`, `git grep` auf entfernte Paketnamen und `AddItemModal`, `npm run check:encoding`.
- Nicht automatisierbar im Plan: Verhalten der Kamera-Vorschau auf einem echten Gerät; das ist ein bewusst nachgelagerter Schritt des Product Owners.

## 18. Acceptance Criteria

1. **AC-1:** `mobile/src/shared/camera/` enthält `framePresets.ts`, `frameCropMath.ts`, `FramedCameraCapture.tsx`, `FramedImageEditor.tsx`, `FramedPhotoPicker.tsx` und `cropImageToFrame.ts`.
2. **AC-2:** `FRAME_PRESETS` definiert `recipeHero` mit `aspectRatio` `1080/1015` (ohne `maxEdge`), `nutritionLabel` mit `3/4` und `maxEdge` `2000`, `mealPhoto` mit `4/3` und `maxEdge` `1600`; die JPEG-Qualität ist `0.85`.
3. **AC-3:** `getCaptureFrame` liefert für jedes Preset bei einem Viewport von `390 x 844` (Insets `24`/`34`) einen Rahmen mit dem Preset-Seitenverhältnis (Toleranz `1e-8`), vollständig innerhalb des Viewports; abgedeckt durch Unit-Test.
4. **AC-4:** `getPreviewSourceRect` bildet einen Rahmen auf eine cover-skalierte Vorschau korrekt auf Foto-Pixel ab und liefert nie ein Rechteck außerhalb des Fotos; `getCropForSourceRect(getSourceRectForCrop(c))` ergibt `c` (Toleranz `1e-8`); abgedeckt durch Unit-Tests.
5. **AC-5:** `cropImageToFrame` schneidet auf ganzzahlige, bildinterne Pixel zu, verkleinert nur bei Überschreiten von `maxEdge` proportional und kodiert JPEG mit Qualität `0.85`; abgedeckt durch Unit-Test mit gemocktem `expo-image-manipulator`.
6. **AC-6:** Der Rezeptfluss liefert weiterhin Originaldatei plus normalisiertes `heroCrop` (`output: 'metadata'`); Kameraaufnahmen öffnen den Hero-Crop-Editor mit dem Hinweis `Titel- und Tag-Zone`; alle bestehenden Rezept-Tests (inklusive `recipeImageHeroCropMath.test.ts` und `recipeImageSource.test.ts`) sind unverändert grün.
7. **AC-7:** `LabelSubFlow` und `AISubFlow` zeigen jeweils einen Button `Foto hinzufügen`, der `FramedPhotoPicker` mit `nutritionLabel`/`cropped-file`/`direct` bzw. `mealPhoto`/`cropped-file`/`direct` öffnet; weder `launchCameraAsync` noch ein System-Cropper wird irgendwo im Mobile-Code aufgerufen.
8. **AC-8:** An `aiApi.scanLabel` und `aiApi.estimateMeal` wird bei Kamera und Galerie ausschließlich die zugeschnittene JPEG-Datei übergeben (`mime: 'image/jpeg'`); ihre längste Kante ist höchstens `2000` px bzw. `1600` px.
9. **AC-9:** Alle Fehler- und Berechtigungszustände entsprechen dem KB-Abschnitt: `Kamera wird vorbereitet…`, `Kein Kamerazugriff` mit `Erneut versuchen` und `Abbrechen`, Aufnahmefehler mit `Erneut versuchen`, Galerie-Berechtigung verweigert und unlesbares Bild als deutsche Meldung im Quellenblatt; Abbrechen löst weder einen Upload noch einen API-Request aus; ein Zuschnittsfehler führt zum Quellenblatt zurück mit `Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.`; doppeltes Bestätigen löst den Zuschnitt nur einmal aus.
10. **AC-10:** `mobile/package.json` enthält weder `react-native-image-crop-picker` noch `react-native-vision-camera`, aber `expo-image-manipulator`; `git grep -n "vision-camera\|image-crop-picker"` (ohne Lockfile und `docs/User Stories`) liefert keine Treffer.
11. **AC-11:** `AddItemModal.tsx` existiert nicht mehr; kein Quell- oder Testfile referenziert `AddItemModal`; `BarcodeScannerScreen.tsx` enthält keinen `Platform.OS === 'ios'`-Zweig und keinen `vision-camera`-Import; die Scan-Logik (Produktsuche, Treffer-/Kein-Treffer-Zustände) ist unverändert.
12. **AC-12:** `05-ux-patterns.md` enthält den Abschnitt „Camera and Photo Capture“ mit Ablauf, Preset-Tabelle (alle drei Presets), Pflichtzuständen und den Regeln für neue Kamera-Features; `03-mobile.md` beschreibt die Kamera-Schicht und die Technologie-Entscheidung und listet `AddItemModal` nicht mehr; die Doku stimmt mit den Werten in AC-2 überein.
13. **AC-13:** `npx tsc --noEmit` im Mobile-Workspace endet mit Exit 0; mobile Vitest ist vollständig grün (Working-Tree-Stand: 108 Dateien / 1002 Tests); `node scripts/check-test-parity.mjs` ist grün; `npm run check:encoding` ist grün.
14. **AC-14:** `docs/legal/` ist unverändert; der Berechtigungstext der Foto-Berechtigung in `mobile/app.config.js` nennt Rezeptbilder, Nährwert-Labels und Mahlzeitenfotos; das Datenschutz-Review (Abschnitt 14) ist im QA-Bericht bestätigt.

## 19. Risks and Edge Cases

- **Zuschnitt-Abbildung:** Weichen Foto-Orientierung oder Vorschau-Skalierung von den Annahmen ab (Abschnitt 8), sitzt der Ausschnitt verschoben; Wirkung begrenzt auf `getPreviewSourceRect`/`cropImageToFrame`, Korrektur ohne API-Änderung möglich.
- **OCR-Qualität:** Eine Verkleinerung auf `2000` px kann sehr kleine Schrift verschlechtern; `maxEdge` ist eine Preset-Zeile.
- **Seitenverhältnis Label:** Sehr breite oder hohe Tabellen passen eventuell nicht ins `3:4`-Format; Nutzer können Abstand halten oder aus der Galerie im Editor zoomen; Änderung am Preset ist möglich.
- **Doppelter Foto-Zugriff:** Kamera nutzt `expo-camera`-Berechtigung, Galerie `expo-image-picker`; beide Texte sind in `app.config.js` bzw. im Plugin gepflegt.
- **Native Änderung:** Hinzufügen/Entfernen nativer Module ändert das Android-Projekt; ein nicht neu gebauter Dev-/Alpha-Client würde `expo-image-manipulator` nicht finden. Das betrifft nur die Auslieferung, nicht den Code.
- **Konflikt mit anderen Plänen:** siehe Abschnitt 20.
- **Hub-Mounting:** `FoodEntryHub` mountet Subflows bedingt; die Rückmeldung zum nativen Initialisieren beim App-Start bezog sich auf die entfernten Module und ist mit ihnen entfallen.

## 20. Auswirkungen auf andere Pläne

`PLAN_FitTrack-Technology-Refresh.md` nennt `react-native-vision-camera`, `react-native-image-crop-picker`, `AddItemModal` und `LabelSubFlow` in WP-T0-06, WP-FE-01 (Handoff „Camera/Crop Picker“), AC-6 und AC-17 sowie die Mobile-Baseline `106 / 993`. Dieser Plan wird **vor** dem Technology-Refresh ausgeführt; der Technology-Refresh muss anschließend revidiert werden:
- Verweise auf Vision Camera, Crop Picker und `AddItemModal` entfernen und `expo-image-manipulator` in die SDK-Migrationsmatrix aufnehmen.
- Mobile-Baseline auf den Stand nach QA anheben (Working Tree: `108 / 1002`).

## 21. Recommended Execution Order

1. Planfreigabe und Entscheidung PO-1 durch den Product Owner. Bei Option B (Verwerfen) wird die unfreigegebene Umsetzung zuerst zurückgenommen und die Pakete laufen danach regulär durch Frontend.
2. WP-FE-01 Kamera-Schicht und Rezeptfoto-Umstellung.
3. WP-FE-02 Label-Scan und KI-Mahlzeitenfoto.
4. WP-FE-03 Bereinigung.
5. WP-FE-04 Knowledge Base.
6. WP-QA-01 unabhängige Prüfung.
7. Revision von `PLAN_FitTrack-Technology-Refresh.md` gemäß Abschnitt 20.
8. Build, Release und Gerätetest ausschließlich nach separatem Auftrag des Product Owners.
