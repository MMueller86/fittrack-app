# QA Report: Einheitlicher Kamera-Flow mit Fokusrahmen

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md` (Planrevision `2026-11-02-02`, AC-1 bis AC-14)
- Revision: 5 (finale unabhängige Abschlussprüfung, 2026-11-02). Revision 4 ist unten als Historie erhalten; Revision 3, 2 und 1 bleiben unverändert (nur Kennungen markiert).
- Verdict: `PASS`

## Scope

Final independent closure review of Revision 4 findings F-11 and F-12. The reviewed delta is `mobile/src/shared/camera/FramedPhotoPicker.tsx` and `mobile/src/shared/camera/FramedPhotoPicker.test.tsx`: unmount invalidation and the stale-crop busy-guard regression. Both files were inspected directly and the focused picker suite, Mobile typecheck, full Mobile suite, and encoding gate were run in this pass.

Revision 4 evidence is reused only for acceptance criteria outside this delta. AC-9 and the Mobile portion of AC-13 were revalidated. The Revision 4 Shared/Backend parity evidence is reused; the parity script was not rerun in Revision 5. No application code was changed by QA.

F-05 remains the already documented Product Owner decision/suggestion. It is not reopened and is not a current actionable finding in this closure. Already-started `scanLabel`/`estimateMeal` request response handling is separate from F-11/F-12 and outside this focused closure.

**Process deviation (plan section 0):** The plan remains a draft awaiting approval. Earlier implementation proceeded without clear approval and without an agent handoff; PO-1 remains the Product Owner's decision. This report does not erase that note, approve the plan retroactively, or re-plan the work. The verdict assesses the current implementation against the plan's criteria only.

## Acceptance Criteria

Gesamtstatus aller 14 ACs nach Revision 4. Evidenz, die nicht neu erhoben wurde, gilt über unveränderte Dateien weiter (Details in der Historie).

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `mobile/src/shared/camera/` enthält `framePresets.ts`, `frameCropMath.ts`, `FramedCameraCapture.tsx`, `FramedImageEditor.tsx`, `FramedPhotoPicker.tsx`, `cropImageToFrame.ts` plus Tests; Plan Abschnitt 10 und KB-Tabelle nennen dieselben Dateien. |
| AC-2 | PASS | `framePresets.ts` unverändert; `FramedPhotoPicker.test.tsx` belegt `aspectRatio` `3 / 4` und `maxEdge` `2000` (`nutritionLabel`), `1600` (`mealPhoto`), kein `maxEdge` (`recipeHero`); neu zusätzlich `RecipeImageSourcePicker.test.tsx` (Preset `recipeHero`), `nutritionDiaryMutationCallers.test.tsx` für `LabelSubFlow`/`AISubFlow`. |
| AC-3 | PASS | `frameCropMath.ts` unverändert, `frameCropMath.test.ts` grün (Teil von `src/shared/camera`: 5 Dateien / 75 Tests). |
| AC-4 | PASS | `frameCropMath.ts` unverändert; Abbildung/Round-Trip durch `frameCropMath.test.ts`, Verdrahtung durch `FramedCameraCapture.test.tsx` belegt. |
| AC-5 | PASS | `cropImageToFrame.ts` und Test gegenüber Revision 3 nicht erneut geändert; `tsc` Exit 0; Tests grün. Plan (Abschnitte 10, AC-5, AC-8) und KB nennen jetzt "längste Kante höchstens `maxEdge`, nicht vergrößert", wie der Code. |
| AC-6 | PASS | Rezeptfluss unverändert (`git status` für `mobile/src/modules/recipes` nur die neue Testdatei). Neu belegt: `RecipeImageSourcePicker.test.tsx` prüft `recipeHero`/`metadata`/`editor`, kein `initialSource`, `editorOverlay`, `onClose`-Durchreichung und die Abbildung des Ergebnisses auf `onImageSelected(selection, normalizeRecipeImageHeroCrop(crop))`. `src/modules/recipes`: 22 Dateien / 245 Tests grün. F-05 bleibt gemäß FT-QA-2026-160 eine akzeptierte Product-Owner-Entscheidung; keine Korrektur ausstehend. |
| AC-7 | PASS | `LabelSubFlow`/`AISubFlow`: Aktionen `Kamera`/`Galerie`, `photoSource` → `initialSource`, Presets/Output/Review wie Plan; per `nutritionDiaryMutationCallers.test.tsx` (17 Tests) belegt. `git grep` `launchCameraAsync` in `mobile/`: 0 Treffer. |
| AC-8 | PASS | Jede Quelle liefert bei `cropped-file` ein JPEG über `cropImageToFrame(uri, rect, image, maxEdge)`; Foto → `scanLabel`/`estimateMeal` mit exakten Argumenten getestet. Aufrufe veralteter Zuschnitte (nach Abbruch) werden jetzt nicht mehr übergeben (F-09). |
| AC-9 | PASS | Frischer Lauf `FramedPhotoPicker.test.tsx`: 47/47 bestanden. `useEffect`-Cleanup erhöht `requestId`; `finish` prüft nach `await cropImageToFrame` und im Fehlerpfad die Request-ID. Der Deferred-Crop-Test unmountet den Picker vor dem Auflösen und erwartet weder `onSelected` noch `onClose`. Die Consumer erreichen `scanLabel` bzw. die spätere Mahlzeitenanalyse nur über die Auswahlübergabe; die stale Auswahl wird nicht übergeben. F-12-Test bestätigt zusätzlich, dass A's `finally` Bs Guard nicht freigibt. |
| AC-10 | PASS | `mobile/package.json` unverändert (`expo-camera ~58.0.14`, `expo-image-picker ~58.0.10`, `expo-image-manipulator ~58.0.16`; keine entfernten Pakete). `git grep` in `mobile/` plus `Select-String` über `mobile/src` (inkl. untrackter Tests): 0 Treffer. |
| AC-11 | PASS | `mobile/src/modules/scanner/` unverändert, `AddItemModal` nicht vorhanden, 0 Treffer in `mobile/`. F-05 bleibt gemäß FT-QA-2026-160 eine akzeptierte Product-Owner-Entscheidung; keine Korrektur ausstehend. |
| AC-12 | PASS | Plan, KB und Code stimmen überein (zwei Aktionen mit Icons `camera`/`image`, `initialSource`, Blatt nur bei Fehlern/Rezeptfluss, `cropImageToFrame` höchstens `maxEdge`, kein Hochskalieren, Kontext-API). `git grep` in `docs/kb`: 3 Treffer, alle bewusste Negativ-Aussagen (`05-ux-patterns.md` L477, `03-mobile.md` L414, L593). F-10 behoben. |
| AC-13 | PASS | Frisch: Mobile `npx.cmd tsc --noEmit` Exit 0, vollständiges Vitest 112 Dateien / 1093 Tests Exit 0, Encoding Exit 0. Test-Parity wurde in Revision 5 nicht erneut ausgeführt; die Revision-4-Ausgabe bleibt als unveränderte Evidenz für Shared 10/466 und Backend 84/2717 gültig. Der aktuelle Mobile-Lauf liegt mit 112/1093 über dem Baseline-Minimum 108/1002. |
| AC-14 | PASS | `git status` für `docs/legal/`, `mobile/app.config.js` und `mobile/package.json` ist leer. Der Datenfluss und die Empfänger bleiben unverändert; der Unmount-Cleanup verhindert nun die veraltete Auswahlübergabe. Datenschutz- und Azure-OpenAI-Prüfung siehe unten. |

## Tests

Node `v24.22.1`; die Befehle liefen im jeweiligen Package-Verzeichnis (Mobile) oder Repo-Root.

| Command | Exit code | Result |
|---|---:|---|
| `npx.cmd vitest run src/shared/camera/FramedPhotoPicker.test.tsx` (in `mobile`) | 0 | 1 Datei / 47 Tests bestanden; umfasst F-11 Deferred-Unmount und F-12 stale-finally Regressionen |
| `npx.cmd tsc --noEmit` (in `mobile`) | 0 | keine TypeScript-Fehler |
| `npx.cmd vitest run` (in `mobile`) | 0 | vollständige Suite: 112 Dateien / 1093 Tests bestanden |
| `npm.cmd run check:encoding` (Repo-Root) | 0 | Encoding check passed |

Test-Parity wurde in Revision 5 nicht erneut ausgeführt. Revision 4 dokumentiert den erfolgreichen Gate-Lauf (Shared 10/466, Backend 84/2717, Mobile 112/1087; Minima 10/466, 84/2709, 108/1002). In diesem Abschlusslauf wurden nur die Mobile-Parity-Zahlen aktualisiert; sie liegen weiterhin über dem Minimum. Es werden keine nicht ausgeführten Checks als frisch ausgeführt behauptet.

## Closure Review

- **F-11: verifiziert behoben.** Der Unmount-Cleanup invalidiert den laufenden Request. Der Regressionstest hält `cropImageToFrame` offen, unmountet den Renderer, löst den Crop danach auf und prüft, dass `onSelected` und `onClose` nicht aufgerufen werden. Der Auswahl-Callback ist die Übergabegrenze zu `scanLabel` bzw. zum Setzen des Mahlzeitenfotos; dadurch wird aus diesem stale Ergebnis kein Upload/API-Flow gestartet.
- **F-12: verifiziert behoben.** Der Test startet Crop A, bricht ab, startet Crop B, löst A auf und bestätigt B erneut, während B noch offen ist. Insgesamt bleiben es zwei `cropImageToFrame`-Aufrufe; B wird anschließend genau einmal ausgewählt. Würde A's `finally` den Guard bedingungslos leeren, startete die erneute Bestätigung einen dritten Crop und der Test schlüge fehl.
- **F-05:** bleibt die dokumentierte Product-Owner-Entscheidung aus Revision 4; nicht erneut bewertet oder als aktueller Finding geführt.

## Datenschutz- und Azure-OpenAI-Prüfung (Revision 5)

- `privacy-impact-review`, Abschnitt 5: kein neuer Datentyp, Empfänger, Zweck, Speicherort, Logging oder Berechtigungsumfang. Die bestehende Fotoübermittlung bleibt unverändert; der Cleanup verhindert die Übergabe eines nach Picker-Unmount fertiggestellten Crops. `docs/legal/` ist unverändert und die bestehende Policy-Bewertung `Covered` bleibt gültig. Cache-Aufbewahrung und EXIF/GPS-Verhalten beim Re-Encoding sind weiterhin nicht aus dem Repository verifizierbar.
- `azure-openai-feature-integration`, QA-Teil: keine Backend-, Prompt-, Schema-, Quoten- oder API-Änderung. `scanLabel` und `estimateMeal` bleiben unverändert; es wird kein Prompt-Eval beansprucht oder benötigt. Die neue Regression verhindert nur die veraltete Client-Auswahlübergabe nach Unmount.

## Verification Notes

- State: `UNVERIFIED`
  - Reason: kein Android-Gerätetest und kein Expo/EAS-Build; laut Plan nachgelagerte Product-Owner-Validierung. Keine Build- oder Gerätebehauptung aus diesem Bericht.
- State: `UNVERIFIED`
  - Reason: reale EXIF-/Orientierungssemantik, Bildgröße/OCR-Qualität, native Modul-Auslieferung und Systempicker-Verhalten bleiben geräte-/buildabhängig und wurden in dieser Abschlussprüfung nicht erneut geprüft.
- State: `MANUAL VALIDATION REQUIRED`
  - Prerequisites: Android-Build mit den nativen Modulen sowie ein Testprofil mit Kamera- und Fotoberechtigung (einmal erteilt, einmal verweigert).

| Schritt | Erwartetes Ergebnis | Ergebnis (PO) |
|---|---|---|
| Label-Scan und Mahlzeitenfoto: `Kamera` tippen | Kamera öffnet direkt; Aufnahme führt mit dem Rahmenausschnitt zur Analyse | |
| `Galerie` tippen, Bild wählen und bestätigen | Editor mit Rahmen; anschließend Analyse mit dem Ausschnitt | |
| Galerie öffnen und im Systempicker abbrechen / Zurück-Taste | Rückkehr zum Flow; erneutes Öffnen funktioniert | |
| Crop bestätigen und Flow während Verarbeitung schließen | Nach Unmount keine stale Fotoauswahl und kein daraus gestarteter Scan/keine Schätzung | |
| Fotozugriff dauerhaft verweigern | Quellenblatt mit Hinweis zu den Geräteeinstellungen | |
| Rezeptfoto | Quellenblatt `Foto hinzufügen` und Hero-Editor bleiben erhalten | |

## Findings

No actionable findings in this closure pass.

## Zusammenfassung

**PASS.** Alle 14 Acceptance Criteria bleiben erfüllt. F-11 und F-12 wurden unabhängig im Code und mit Regressionstests verifiziert. Der fokussierte Picker-Test (47), vollständige Mobile-Lauf (112 Dateien / 1093 Tests), Mobile-Typecheck und Encoding-Check sind grün. Shared/Backend-Parity wird transparent aus Revision 4 übernommen und nicht als in Revision 5 erneut ausgeführt dargestellt. F-05 bleibt eine dokumentierte Product-Owner-Entscheidung, nicht wiedereröffnet. Die Draft-/Freigabeabweichung bleibt ausdrücklich bestehen; Gerätetest und Build sind weiterhin `UNVERIFIED`/`MANUAL VALIDATION REQUIRED`.

---

## Historie: Revision 4

Der folgende Abschnitt ist die historische Revision-4-Prüfung (`PASS WITH ISSUES`), keine Verifikation der jetzt geschlossenen F-11/F-12-Fixes. Damals offene Findings: F-11 (Unmount ohne Request-Invalidierung), F-12 (fehlender Schutztest für den bedingten Busy-Reset) und F-05 (Product-Owner-Entscheidung). Die historische AC-Matrix, Testausgaben und Analyse bleiben zur Nachvollziehbarkeit erhalten; maßgeblich für den aktuellen Stand ist Revision 5 oben.

### Status der früheren Findings (Revision 4)

| Finding | Status | Begründung |
|---|---|---|
| F-01 (Komponententests fehlen) | behoben | Vier Komponententest-Dateien in `mobile/src/shared/camera/` plus Tests für `RecipeImageSourcePicker` und die Konsumenten. |
| F-02 (`manipulateAsync` deprecated) | behoben | Kontext-API, 0 `git grep`-Treffer, `tsc` Exit 0. |
| F-03 (`maxEdge` um 1 px überschreitbar) | behoben | unverändert seit Revision 2. |
| F-04 (`MediaTypeOptions` deprecated) | behoben | `mediaTypes: ['images']`, per Test der Optionen belegt. |
| F-05 (Barcode-Hinweis Android, Galerie-Retry) | bewusst zurückgestellt | Product-Owner-Entscheid; Suggestion, unverändert. |
| F-06 (Testlücken) | behoben | `RecipeImageSourcePicker.test.tsx` (Wiring), Re-Render ohne Re-Open, Reset-Tests, `busy`-Regression, Direkt-Kamera-Abbruch. Verbleibend bewusst ungetestet: `onLayout` der Kamera, Gesten/Reanimated; neue Lücken der F-09-Tests siehe F-12. |
| F-07 (Plan vs. KB/Code, AC-7) | behoben | seit Revision 3. |
| F-08 (Quellenwechsel, spätes Galerie-Ergebnis) | behoben | seit Revision 3 (`requestId`-Token, zusammengefasster Effekt). |
| F-09 (Ergebnis nach Abbruch während Zuschnitt) | behoben, Restfall als F-11 | `finish` verwirft veraltete Anfragen nach `await` und im `catch`; Details und Restfall (Unmount) unten. |
| F-10 (Plan/KB-Inkonsistenzen) | behoben | Plan Abschnitt 7 (installierte Versionen `58.x`, Baseline als Minima aus `scripts/test-baseline.json`), 8 (PO-1 offen), 10 (Fehlerverhalten präzisiert), 17, 20, AC-13 (keine feste Zahl) sowie `03-mobile.md` (höchstens `maxEdge`, nicht vergrößert) stimmen mit Code und Skript überein; alle Work Packages (WP-FE-01 bis WP-FE-04, WP-QA-01) enthalten Agent, Goal, Required Knowledge Base, Required Repository Context, Required Skills, Relevant Acceptance Criteria, Dependencies, Expected Handoff. |

## Prüfung der Änderungen seit Revision 3

**1. F-09: `finish` und Stale-Handling (kritische Analyse aller Pfade).** `finish` merkt `request = requestId.current` und prüft nach `await cropImageToFrame(...)` sowie im `catch` auf `request !== requestId.current`. Pfade, die `onSelected`/`onClose`/Fehlerzustand auslösen:
- Erfolg (`cropped-file`, nicht veraltet): `onSelected`, dann `handleClose` (`onClose` genau einmal). Korrekt.
- Veraltet (Erfolg): `return` ohne `onSelected`/`handleClose`/State; `finally` läuft. Korrekt.
- Fehler nicht veraltet: Editor zu, Blatt, Fehlermeldung; Wiederholung möglich. Fehler veraltet: kein State, kein `onClose`. Korrekt.
- `onSelected` wirft (nicht veraltet): landet im `catch`, Meldung "konnte nicht verarbeitet werden" (unverändert gegenüber Revision 3; `onSelected` der Konsumenten fangen intern).
- Invalidierung: `handleClose` (Kamera schließen, Blatt/Backdrop/`onRequestClose`), `handleEditorCancel` (jetzt mit eigener Erhöhung), Effekt bei `visible`-/`initialSource`-Wechsel und `handleOpenGallery` (`++`) erhöhen `requestId`. Damit sind alle Nutzer-Abbruchpfade abgedeckt. Beim `initialSource`-Editor-Abbruch wird zweimal erhöht (`handleEditorCancel` und `handleClose`), `onClose` genau einmal.
- Nicht abgedeckt: Unmount ohne vorheriges `handleClose` (Cleanup-Effekt fehlt) → F-11. Beide Konsumenten geben bei `!visible` `null` zurück (`LabelSubFlow.tsx` L119, `AISubFlow.tsx` L233), der Picker wird dann abgebaut, ohne dass ein Effekt läuft. Ein zu diesem Zeitpunkt laufender Zuschnitt endet mit `onSelected` → `scanLabel`/`estimateMeal` trotz geschlossenem Flow (`handlePhotoSelected` aus dem Render-Closure). Auslöser wäre ein programmatisches Schließen des Flows, während der Picker-Modal darüber liegt; Android-Zurück läuft über `onRequestClose` → `handleClose` und ist abgedeckt. State-Updates nach Unmount sind in React 19 ohne Warnung und ohne Leak.
- Metadata-Pfad (Rezept): unverändert; keine `await`, daher keine Race; `onSelected` und `handleClose` laufen synchron. Doppelaufruf von `onConfirm` im selben Tick (nach vollständigem ersten Lauf) wäre theoretisch ein zweites `onSelected` (der `editorSource`-Closure ist dann noch gesetzt); das war vor der Änderung identisch (kein Regress), über getrennte Touch-Events nicht erreichbar, daher kein Finding.

**2. `busyRequest`-Guard.** Guard `busyRequest.current === requestId.current` (zu Beginn von `finish` als `request` gemerkt), Rücksetzen im `finally` nur wenn `busyRequest.current === request`.
- Doppelbestätigung in derselben Anfrage: zweiter Aufruf trifft `busyRequest === request` und kehrt zurück: genau ein Zuschnitt (Test "crops only once").
- Neue Anfrage nach Abbruch: `requestId` wurde erhöht, `busyRequest` hält noch die alte ID, Guard greift nicht, neuer Zuschnitt startet sofort (Test "lets a new confirmation start…").
- Zwei neue Anfragen nacheinander (A läuft, Abbruch, B läuft, Abbruch, C): `requestId` ist monoton und wird nie wiederverwendet; ein veraltetes `busyRequest` kann nie wieder gleich dem aktuellen `requestId` werden. `busyRequest` hält nur die jüngste laufende ID; das `finally` einer veralteten Anfrage setzt nichts zurück (`!== request`), das der jüngsten setzt `null`. Eine veraltete Anfrage, die nach der jüngsten endet, ändert nichts. Kein hängender Zustand: jeder Pfad (Erfolg, Fehler, veraltet) durchläuft `finally`; bleibt `busyRequest` auf einer veralteten ID stehen, blockiert das nichts. Offen bleibt nur der Fall eines nie endenden `cropImageToFrame`-Promises (wie zuvor).
- Quellenwechsel/Wiedereintritt: `handleOpenGallery` erhöht per `++requestId` und invalidiert damit einen laufenden Zuschnitt (gewollt: Quellenwechsel verwirft das alte Ergebnis).
- Sonderfall: `requestId` und `busyRequest` sind Refs; im React-Dev-Doppel-Mount würde der Effekt zusätzlich erhöhen, was nur verwirft, nicht blockiert.

**3. Aussagekraft der Tests (analytisch; nichts ausgeführt gegen den Vorzustand).**

| Test (`FramedPhotoPicker.test.tsx` sofern nicht anders genannt) | Ohne den jeweiligen Fix | Einordnung |
|---|---|---|
| F-09: "discards the result when the sheet is closed during the crop" | rot: ohne Stale-Prüfung nach `await` ruft `finish` `onSelected` und ein zweites `onClose` auf | Regressionstest |
| F-09: "…editor is cancelled during the crop" | rot ohne Stale-Prüfung und auch mit Prüfung, aber ohne `requestId`-Erhöhung in `handleEditorCancel` (Editor-Abbruch im Blatt-Modus ruft `handleClose` nicht auf) | Regressionstest (deckt beide Teile) |
| F-09: "…picker is hidden during the crop" und "…initialSource switches during the crop" | rot ohne Stale-Prüfung nach `await` (die Erhöhung kommt aus dem F-08-Effekt) | Regressionstest |
| F-09: "sets no error state when the crop fails after the request was cancelled" | rot ohne Stale-Prüfung im `catch` (Fehlermeldung erschiene im wiedergeöffneten Blatt) | Regressionstest |
| F-09: "lets a new confirmation start while a discarded crop is still pending" | rot bei Boolean-`busy` (zweite Bestätigung wird blockiert, `cropImageToFrame` bliebe bei 1) | Regressionstest `busy` |
| Direkt-Kamera: "discards the result when the camera is closed during the crop" / "sets no error state when the crop fails after the camera was closed" | rot ohne Stale-Prüfung (`onSelected` bzw. Fehlerzustand) | Regressionstest |
| "crops only once when the confirmation fires twice while busy" | rot ohne Guard (zweiter Zuschnitt) | Regressionstest, aussagekräftig |
| F-09: "still calls onSelected and onClose exactly once on the normal path" | auch ohne Fix grün | reine Absicherung |
| F-08-Tests (Quellenwechsel, spätes Ergebnis) | rot ohne F-08-Fix (Revision 3) | Regressionstests |
| "resets error and editor state…" und "resets an open editor…" | auch im Vorzustand grün (Reset bei `!visible` existierte) | reine Absicherung |
| "does not restart the gallery when re-rendered… new callback identities" | grün im Vorzustand (Callbacks sind keine Effekt-Abhängigkeit) | reine Absicherung (Schutz vor künftigem Retrigger) |
| "opens the system library for exactly one image…" (Optionen) | rot nur bei Optionsänderung | Absicherung der Konstanten |
| `RecipeImageSourcePicker.test.tsx` (2 Tests) | rot bei vertauschtem Preset/Output/Review, `initialSource` oder Ergebnis-Mapping | Verdrahtungstests mit gemocktem Picker; der Mapping-Test nutzt `normalizeRecipeImageHeroCrop` zur Erwartung, prüft aber zusätzlich konkrete Werte (`0.3`/`0.6`/`1.8`); Texte (`sourceTitle`, `cameraPurpose`, `editorTitle`) sind nicht geprüft |

Die Tests prüfen Verhalten (Sichtbarkeit der Modals/Stubs, Aufrufzahlen, Argumente, Texte), nicht nur Mock-Rückgaben; Kinder des Pickers sind durch Stubs ersetzt und separat getestet. Nicht durch Tests gefangen (Mutationen, die grün blieben): ein unbedingtes Zurücksetzen von `busyRequest` im `finally` (siehe F-12) sowie der Unmount-Fall (F-11). Gesten/Reanimated und `onLayout` bleiben bewusst ungetestet.

**4. F-10: Konsistenz Plan ↔ KB ↔ Code.** `cropImageToFrame.ts` begrenzt die längste Kante auf höchstens `maxEdge`, vergrößert nicht und rundet die kürzere Kante; Plan Abschnitt 10, AC-5, AC-8, Test-Strategie und `03-mobile.md` formulieren das so. Plan Abschnitt 7 nennt die installierten Versionen (`~58.0.14`/`~58.0.10`/`~58.0.16`, `mobile/package.json` bestätigt) und nennt die Kompatibilität als nicht verifiziert (nicht durch mich geprüft: `npx expo install --check`). Plan Abschnitt 8 nennt PO-1 offen; Abschnitte 17, 20 und AC-13 binden nicht mehr an feste Zahlen, sondern an die Minima in `scripts/test-baseline.json` (`108 / 1002`, stimmt mit der Parity-Ausgabe überein). Hinweis: Plan Abschnitt 19 beschreibt nur das späte Galerie-Ergebnis als Soll-Verhalten, nicht das Verwerfen eines späten Zuschnitts (kein Fund, Doku-Lücke gering).

## Datenschutz- und Azure-OpenAI-Prüfung (Revision 4)

- `privacy-impact-review`, Abschnitt 5: Datenfluss unverändert (Foto → lokaler Zuschnitt → `scanLabel`/`estimateMeal` bzw. Rezeptfoto mit `heroCrop`). Seit Revision 3 geändert wurden nur Picker-Logik (Verwerfen veralteter Zuschnitte), Tests, KB- und Plantext; keine neue Datenkategorie, kein neuer Empfänger, keine Speicherung, kein Logging, keine neue Berechtigung. `docs/legal/` unverändert (`git status` leer); `docs/legal/datenschutzerklaerung-alpha.md` bleibt zutreffend (`Covered`). Das Verwerfen veralteter Zuschnitte stellt den Plan-Satz "Abbrechen löst keinen Upload/API-Request aus" für alle Nutzer-Abbruchpfade her; der Unmount-Restfall (F-11) ändert weder Empfänger noch Datenkategorie, kann aber eine Übermittlung nach dem Verlassen des Flows auslösen. Nicht aus dem Repository verifizierbar (UNVERIFIED): Lebensdauer temporärer Zuschnitt-Dateien im App-Cache, EXIF/GPS beim Re-Encoding.
- `azure-openai-feature-integration`, QA-Teil: Keine Datei unter `backend/src/lib/prompts/**`, `openai.ts`, `ai.ts` oder ein Schema ist Teil dieses Scopes; Quoten, Structured Outputs, Plausibilität und Prompt-Eval nicht betroffen, Eval nicht erforderlich. Clientseitig unverändert: JPEG `0.85`, längste Kante höchstens `2000`/`1600` px; F-11 betrifft potenziell eine unnötig verbrauchte Quote (ein `scanLabel`/`estimateMeal`-Aufruf) nach Verlassen des Flows.

## Verification Notes

- State: `UNVERIFIED`
  - Reason: kein Gerätetest und kein Expo/EAS-Build (laut Product Owner nachgelagert).
- State: `UNVERIFIED`
  - Reason: reale Rendering-Semantik von `expo-image-manipulator` (EXIF, Zielmaße, Dateigröße gegenüber 4-MB-Limit, OCR-Qualität), Orientierung von `takePictureAsync`/`CameraView`, Verhalten der Systemgalerie bei parallelem `launchImageLibraryAsync`, Zurück-Taste im Systempicker und `Modal`-`onRequestClose`, ob der Flow-Modal unter dem Picker-Modal auf dem Gerät programmatisch schließbar ist (F-11).
- State: `UNVERIFIED`
  - Reason: Native-Auslieferung; ein nicht neu gebauter Dev-/Alpha-Client würde `expo-image-manipulator`/`expo-image-picker` ggf. nicht finden. `npx expo install --check` und `npm ls` (Plan Abschnitt 7) wurden nicht ausgeführt.
- State: `MANUAL VALIDATION REQUIRED`
  - Prerequisites: neuer Android-Build mit den Modulen, Testprofil mit Kamera- und Fotoberechtigung (einmal erteilt, einmal verweigert).

| Schritt | Erwartetes Ergebnis | Ergebnis (PO) |
|---|---|---|
| Label-Scan und Mahlzeitenfoto: `Kamera` tippen | Kamera öffnet direkt ohne Quellenblatt; Aufnahme führt zur Analyse mit dem Rahmenausschnitt | |
| `Galerie` tippen, Bild wählen, bestätigen | Editor mit Rahmen; danach Analyse mit dem Ausschnitt | |
| Galerie öffnen und im Systempicker abbrechen / Zurück-Taste | Rückkehr zum Flow, erneutes Tippen funktioniert | |
| Kamera aufnehmen und sofort Zurück/Schließen (Zuschnitt läuft) | Rückkehr zum Flow, kein Scan/keine Schätzung nach dem Abbruch | |
| Im Editor bestätigen und sofort Abbrechen/Zurück | kein Scan/keine Schätzung nach dem Abbruch | |
| Nach Abbruch sofort neues Foto aufnehmen/bestätigen | neuer Zuschnitt startet ohne Verzögerung, genau ein Scan | |
| Fotozugriff dauerhaft verweigert, `Galerie` tippen | Quellenblatt mit Meldung zu den Geräteeinstellungen | |
| `Kamera` und `Galerie` in schneller Folge tippen | genau eine Quelle ist aktiv | |
| Rezeptfoto | weiterhin Quellenblatt `Foto hinzufügen` mit Hero-Editor | |

- Hinweis (kein Fund): `scripts/test-baseline.json` steht auf mobile `108 / 1002` (Ist `112 / 1087`); die Parity prüft Minima, eine Anhebung gehört zum Technology-Refresh.

## Findings

Finding key: F-11
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-9, AC-14
Description: `FramedPhotoPicker` hat keinen Unmount-Cleanup für `requestId`. Gibt der Eltern-Flow den Picker ab (`LabelSubFlow`/`AISubFlow` liefern bei `!visible` `null`), während ein Zuschnitt läuft, wird das Ergebnis nicht verworfen: `finish` ruft `onSelected` auf, und `handlePhotoSelected` sendet das Foto an `scanLabel`/`estimateMeal` (Quota, Datenübermittlung), obwohl der Flow geschlossen ist. Auslöser wäre ein programmatisches Schließen des Flows, während der Picker-Modal darüber liegt; Nutzer-Abbruchpfade (Schließen, Zurück, Editor-Abbrechen) sind abgedeckt. Zeitfenster: Dauer eines Zuschnitts; Erreichbarkeit auf dem Gerät nicht verifiziert.
Criticality: Non-blocking
Owner: Frontend
Evidence: `mobile/src/shared/camera/FramedPhotoPicker.tsx` (Effekt auf `[visible, initialSource, handleOpenGallery]` ohne Cleanup; `finish` prüft nur `requestId`); `mobile/src/modules/nutrition/hub/LabelSubFlow.tsx` L119 und `AISubFlow.tsx` L233 (`if (!visible) return null`); `FramedPhotoPicker.test.tsx` enthält keinen Unmount-Test.
Recommendation: Cleanup `useEffect(() => () => { requestId.current += 1; }, [])` ergänzen und einen Test (Zuschnitt per Deferred offen halten, `renderer.unmount()`, Deferred auflösen, `onSelected` nicht aufgerufen) hinzufügen.

Finding key: F-12
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-9
Description: Der bedingte Reset im `finally` (`if (busyRequest.current === request)`) ist durch keinen Test geschützt. Ein unbedingtes `busyRequest.current = null` ließe alle bestehenden Tests grün; dann könnte eine veraltete Anfrage, die nach dem Start einer neuen endet, deren Guard aufheben und eine Doppelbestätigung der neuen Anfrage zulassen.
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/shared/camera/FramedPhotoPicker.tsx` (`finally`); `FramedPhotoPicker.test.tsx` "lets a new confirmation start while a discarded crop is still pending" löst die zweite Anfrage vor der ersten auf und bestätigt danach nicht doppelt.
Recommendation: Test ergänzen: Anfrage A offen, abbrechen, Anfrage B starten (offen), A auflösen, B zweimal bestätigen, `cropImageToFrame` bleibt bei zwei Aufrufen.

Finding key: F-05
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-6, AC-11
Description: Unverändert. (a) `BarcodeScannerScreen` zeigt `Barcode im Rahmen positionieren` auch auf Android; (b) beim Galerie-Fehler fehlt die frühere Aktion `Galerie erneut versuchen` (erneutes Tippen auf `Galerie` im Blatt möglich). Product-Owner-Entscheidung: bleibt bewusst bestehen.
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/modules/scanner/BarcodeScannerScreen.tsx`, `mobile/src/shared/camera/FramedPhotoPicker.tsx` (Fehlerbox ohne Retry-Aktion).
Recommendation: Als bewusste Änderung im Plan dokumentieren; kein Handlungsbedarf, solange die PO-Entscheidung gilt.

## Zusammenfassung

Blocking: 0 · Non-blocking: 1 (F-11) · Suggestion: 2 (F-05, F-12). F-01 bis F-04, F-06 bis F-10 sind behoben (F-09 mit Restfall F-11), F-05 bleibt PO-Entscheid. Alle 14 ACs sind erfüllt. `tsc` Exit 0, mobile Vitest zweimal 112 / 1087 grün, gezielte Läufe grün (75 / 245 / 17 / 1 Tests), Encoding und Parity Exit 0. Datenfluss, Berechtigungen und `docs/legal/` unverändert, kein KI-/Quota-Code im Scope geändert. Gerätethemen sind `UNVERIFIED`/`MANUAL VALIDATION REQUIRED`; Prozessabweichung und PO-1 bleiben beim Product Owner.

---

## Historie: Revision 3

Nachfolgend der Bericht der Vorrevision (Revision 3, Verdict damals `PASS WITH ISSUES`) im ursprünglichen Wortlaut; nur Überschriften, AC-IDs (`R3-AC-n`) und Finding-Kennungen sind markiert, damit dieser Bericht genau ein Verdict, eine AC-Matrix und eine aktuelle Findings-Liste hat. Maßgeblich ist der Stand oben (Revision 4). Planrevision damals `2026-11-02-01`.

### Revision 3 – Scope

Re-Review der Änderungen seit Revision 2 (Working Tree auf `HEAD` `f171b9e`, nicht committet; Stand `git status` für die Pfade unten):
- F-08: `mobile/src/shared/camera/FramedPhotoPicker.tsx` (`requestId`-Token, zusammengefasster Effekt).
- F-06: `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx`, `mobile/src/shared/camera/FramedPhotoPicker.test.tsx`, `mobile/src/shared/camera/FramedCameraCapture.test.tsx` (neu bzw. erweitert).
- F-07: Plan `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md` (Revision `2026-11-02-01`), KB `docs/kb/product/05-ux-patterns.md` ("Camera and Photo Capture") und `docs/kb/tech/03-mobile.md` ("Photo capture (shared)"), Konsumenten `LabelSubFlow.tsx`, `AISubFlow.tsx`.

Unverändert gegenüber `HEAD`: Rezeptfluss (`mobile/src/modules/recipes/`), Scanner, `mobile/app.config.js`, `mobile/package.json`, `docs/legal/`.

Nicht bewertet (fremde Änderungen des Parallelplans `PLAN_FitTrack-Technology-Refresh.md` und anderer Pläne im selben Working Tree): Dependencies, CI, Backend (`backend/src/functions/diary.ts`, `backend/src/lib/repositories/*DayMeta*` u. a.), Health Connect, `DiaryScreen.tsx`, `DayStoryCard.tsx` und Tests, weitere KB-Dokumente (`docs/kb/domain/*`, `docs/kb/tech/04-shared-library.md`, `09-api-reference.md`), der Diary-Absatz in `03-mobile.md`, der Bericht `docs/qa/reports/PLAN_Diary-Historische-Tagesziele.md`. Gerätetest und Expo/EAS-Build sind laut Product Owner nachgelagert und nicht Teil dieses Reviews.

**Prozessabweichung (Plan Abschnitt 0):** Der Plan ist nicht freigegeben; die Umsetzung entstand ohne Agentenlauf und ohne `handoff_store`. PO-1 liegt beim Product Owner und ist nicht Teil dieses Verdicts. Die ACs wurden als Ist-Zustand gegen den Plantext geprüft.

### Revision 3 – Acceptance Criteria

Gesamtstatus aller 14 ACs nach Revision 3. Evidenz, die nicht neu erhoben wurde, gilt über unveränderte Dateien weiter (Details in der Historie).

| ID | Result | Evidence |
|---|---|---|
| R3-AC-1 | PASS | `mobile/src/shared/camera/` enthält `framePresets.ts`, `frameCropMath.ts`, `FramedCameraCapture.tsx`, `FramedImageEditor.tsx`, `FramedPhotoPicker.tsx`, `cropImageToFrame.ts` (unverändert) plus Tests; Plan Abschnitt 10 und KB-Tabelle nennen dieselben Dateien. |
| R3-AC-2 | PASS | `framePresets.ts` unverändert; `FramedPhotoPicker.test.tsx` belegt `aspectRatio` `3 / 4` und `maxEdge` `2000` (`nutritionLabel`), `1600` (`mealPhoto`) und "kein `maxEdge`" (`recipeHero`). Neu: `nutritionDiaryMutationCallers.test.tsx` belegt das Preset-Wiring von `LabelSubFlow` (`nutritionLabel`) und `AISubFlow` (`mealPhoto`). |
| R3-AC-3 | PASS | `frameCropMath.ts` unverändert, `frameCropMath.test.ts` grün (Teil der 64 Kamera-Tests). |
| R3-AC-4 | PASS | `frameCropMath.ts` unverändert; Abbildung und Round-Trip durch `frameCropMath.test.ts`, Verdrahtung durch `FramedCameraCapture.test.tsx` belegt. |
| R3-AC-5 | PASS | `cropImageToFrame.ts` und Test unverändert gegenüber Revision 2 (Kontext-API, JPEG `0.85`, längste Kante exakt `maxEdge` nur bei Überschreitung); `tsc` Exit 0; `cropImageToFrame.test.ts` grün. |
| R3-AC-6 | PASS | `git status` für `mobile/src/modules/recipes` leer; `RecipeImageSourcePicker.tsx` übergibt kein `initialSource`. Ohne `initialSource` verhält sich der Picker wie zuvor (Sheet sichtbar, Galerie-Abbruch lässt es offen, Editor-Abbruch führt zurück; je getestet). `src/modules/recipes`: 21 Dateien / 243 Tests grün. Das Wiring von `RecipeImageSourcePicker` (`recipeHero`/`metadata`/`editor`) ist weiterhin nicht per Test belegt (F-06). |
| R3-AC-7 | PASS | `LabelSubFlow`/`AISubFlow` zeigen `Kamera`/`Galerie` mit Feather-Icons `camera`/`image` und mounten `FramedPhotoPicker` mit `initialSource` (`photoSource`-State) und `nutritionLabel`/`cropped-file`/`direct` bzw. `mealPhoto`/`cropped-file`/`direct`. Jetzt per Test belegt (`nutritionDiaryMutationCallers.test.tsx`: Quelle `camera`/`gallery` je Flow, Preset/Output/Review, Reset über `onClose` und Wiederöffnen). Plantext (Abschnitte 3, 4, 10, WP-FE-02, AC-7) entspricht dem Code (F-07 behoben). `git grep` `launchCameraAsync` in `mobile/`: 0 Treffer. |
| R3-AC-8 | PASS | `FramedPhotoPicker.test.tsx` belegt `cropImageToFrame(uri, getSourceRectForCrop(...), image, maxEdge)` und `mime: 'image/jpeg'` für Galerie/Editor und Kamera `direct`; `nutritionDiaryMutationCallers.test.tsx` belegt Foto → `scanLabel('/label.jpg','image/jpeg')` und neu Foto → `estimateMeal('Porridge','/meal-cropped.jpg','image/jpeg')` samt Entfernen und Reset bei Wiederöffnen (`estimateMeal(…, undefined, undefined)`). |
| R3-AC-9 | PASS | Alle Zustände durch Komponententests belegt (Kamera: Vorbereiten, Verweigerung, Einstellungen-Hinweis, Retry, Aufnahmefehler, Callback-Fehler, Auslösersperre inkl. zweitem Tipp bei `capturing`; Picker: Galerie verweigert/Exception/Asset ohne URI, Zuschnittsfehler in Galerie- und neu auch Kamera-Direktpfad mit Blatt und Meldung, Retry, Doppelbestätigung nur ein Zuschnitt, Abbrechen ohne `onSelected`). Einschränkung: Wird Abbrechen/Schließen während eines laufenden Zuschnitts gedrückt, wird danach trotzdem `onSelected` aufgerufen (F-09, Race). |
| R3-AC-10 | PASS | `mobile/package.json` unverändert (`expo-image-manipulator ~58.0.16`, keine entfernten Pakete). `git grep` in `mobile/` (inkl. untrackter Testdateien per `Select-String`): 0 Treffer für `vision-camera`, `image-crop-picker`, `AddItemModal`, `launchCameraAsync`, `MediaTypeOptions`, `manipulateAsync`. |
| R3-AC-11 | PASS | `BarcodeScannerScreen.tsx`/`AndroidBarcodeScanner.tsx` unverändert, `AddItemModal.tsx` nicht vorhanden, 0 Treffer in `mobile/`. Restpunkt F-05 (PO-Entscheid). |
| R3-AC-12 | PASS | Plan, KB und Code stimmen überein: zwei direkte Aktionen mit Icons `camera`/`image`, `initialSource` überspringt das Blatt, Abbruch von Kamera/Galerie/Editor schließt den Picker, Fehler zeigen das Blatt, Rezeptfluss behält das Blatt (`05-ux-patterns.md` Flow Schritt 1 und "Required states"; `03-mobile.md` `FramedPhotoPicker`-Zeile und Konsumentenabsatz). `git grep` in `docs/kb`: 3 Treffer, alle bewusste Negativ-Aussagen (`05-ux-patterns.md` L477, `03-mobile.md` L414, L593). Ungenauigkeit in `03-mobile.md` ("longest edge is scaled to exactly `maxEdge`" gilt nur bei Überschreitung) siehe F-10. |
| R3-AC-13 | PASS | `npx tsc --noEmit` Exit 0; mobile Vitest vollständig zweimal grün (111 Dateien / 1074 Tests, Exit 0 beide Läufe, kein Flackern von `authRedirect.test.ts`); gezielte Läufe grün (siehe Tests); `npm run check:encoding` Exit 0; Test-Parity Exit 0 (shared 10/466, backend 84/2717, mobile 111/1074; Minima 10/466, 84/2709, 108/1002). |
| R3-AC-14 | PASS | `docs/legal/`, `mobile/app.config.js`, `mobile/package.json` ohne Änderung (`git status` leer). Datenfluss unverändert (siehe Datenschutz- und Azure-OpenAI-Prüfung); Hinweis zu F-09 (Race kann nach Abbruch ein Foto senden). |

### Revision 3 – Tests

Node `v24.22.1` (`$env:PATH = "$env:USERPROFILE\tools\node-v24.22.1-win-x64;" + $env:PATH`, `npm.cmd`/`npx.cmd`). Exit-Codes sind `$LASTEXITCODE` des eigentlichen Befehls (nicht hinter `Select-String`); Zahlen stammen aus der Vitest-Ausgabe.

| Command | Exit code | Result |
|---|---:|---|
| `npx tsc --noEmit` (in `mobile`) | 0 | keine Fehler |
| `npx vitest run` (in `mobile`, vollständig, Lauf 1) | 0 | 111 Dateien / 1074 Tests bestanden |
| `npx vitest run` (in `mobile`, vollständig, Lauf 2) | 0 | 111 Dateien / 1074 Tests bestanden; `authRedirect.test.ts` in beiden Läufen grün (kein Flackern) |
| `npx vitest run src/shared/camera` | 0 | 5 Dateien / 64 Tests (Revision 2: 55) |
| `npx vitest run src/modules/recipes` | 0 | 21 Dateien / 243 Tests |
| `npx vitest run src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx` | 0 | 1 Datei / 17 Tests (Revision 2: 11) |
| `npx vitest run src/services/nutritionDiaryMutationBoundary.test.ts` | 0 | 1 Datei / 1 Test |
| `npx vitest run src/shared/camera src/modules/recipes src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx src/services/nutritionDiaryMutationBoundary.test.ts` | 0 | 28 Dateien / 325 Tests (64 + 243 + 17 + 1) |
| `npm.cmd run check:encoding` (Repo-Root) | 0 | "Encoding check passed." |
| `npx vitest run --reporter=json --outputFile=<Temp>\<paket>.json` in `shared`, `backend`, `mobile` | 0 / 0 / 0 | JSON-Berichte im Temp-Ordner erzeugt, danach gelöscht (Löschung geprüft) |
| `node scripts/check-test-parity.mjs --shared … --backend … --mobile …` | 0 | PASS shared 10 / 466 (Minimum 10/466), backend 84 / 2717 (Minimum 84/2709), mobile 111 / 1074 (Minimum 108/1002) |
| `git grep -n -e "vision-camera" -e "image-crop-picker" -e "AddItemModal" -e "launchCameraAsync" -e "MediaTypeOptions" -e "manipulateAsync" -- mobile docs/kb` (Lockfiles ausgenommen) | 0 | 3 Treffer, alle in `docs/kb` als Negativ-Aussagen; 0 Treffer in `mobile/` |
| `Select-String` derselben Muster in den untrackten Dateien `mobile/src/shared/camera/*.test.tsx` | – | 0 Treffer |
| `git diff --check -- mobile/src/shared/camera mobile/src/modules/nutrition/hub docs/kb/product/05-ux-patterns.md docs/kb/tech/03-mobile.md "docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md"` | 0 | keine Whitespace-Fehler |
| `git status --short -- docs/legal mobile/package.json mobile/app.config.js` | 0 | leer (keine Änderung) |

Hinweise: Das Backend wurde nur für die Parity-Berichte ausgeführt (nicht Teil des Scopes). Es wurde nichts installiert, gebaut oder per Git verändert; im Repo wurde ausschließlich dieser Bericht geändert. Die Tests wurden nicht gegen den Stand vor dem F-08-Fix ausgeführt (nicht erlaubt); die Rot-Aussagen unten sind analytisch.

### Revision 3 – Status der früheren Findings

| Finding | Status | Begründung |
|---|---|---|
| F-01 (Komponententests fehlen) | behoben | Drei Komponententest-Dateien, in Revision 3 erweitert (64 Kamera-Tests); Restlücken als F-06 (Suggestion). |
| F-02 (`manipulateAsync` deprecated) | behoben | Kontext-API (`ImageManipulator.manipulate`), `grep`: 0 Treffer, `tsc` Exit 0. |
| F-03 (`maxEdge` um 1 px überschreitbar) | behoben | unverändert seit Revision 2; Rechenprüfung 48 048 Kombinationen und Tests. |
| F-04 (`MediaTypeOptions` deprecated) | behoben | `mediaTypes: ['images']`; jetzt zusätzlich durch Test der Optionen belegt. |
| F-05 (Barcode-Hinweis Android, Galerie-Retry) | bewusst zurückgestellt | Product-Owner-Entscheid; weiterhin Suggestion. |
| F-06 (Testlücken) | teilweise behoben, Rest Suggestion | Belegt sind jetzt: Preset/Output/Review-Wiring beider Flows, Foto → `estimateMeal`, `onClose`-Reset und Wiederöffnen, Reset bei `visible` false → true, Direkt-Kamera-Zuschnittsfehler, Auslösersperre, `launchImageLibraryAsync`-Optionen. Offen: Wiring von `RecipeImageSourcePicker`, `onLayout` der Kamera, Re-Render-Test gegen Effekt-Retrigger (Rest unter F-06, auf Suggestion herabgestuft). |
| F-07 (Plan vs. KB/Code, AC-7) | behoben | Plan Abschnitte 3, 4, 10, 17, 19, WP-FE-02, AC-5, AC-7, AC-8 entsprechen KB und Code. Restpunkte des Plans (Abschnitte 7 und 8, AC-13-Zahlen) als F-10. |
| F-08 (Quellenwechsel, spätes Galerie-Ergebnis) | behoben | `requestId`-Token und zusammengefasster Effekt; Analyse und Regressionstests unten. Verwandter neuer Befund F-09 (`finish`-Ergebnis nach Abbruch). |

### Revision 3 – Prüfung der Änderungen seit Revision 2

**1. F-08: `FramedPhotoPicker.tsx` (kritische Analyse).**
- Token: `requestId` (`useRef`) wird in `handleClose`, im Reset-/Start-Effekt und in `handleOpenGallery` erhöht. `handleOpenGallery` speichert `request = ++requestId.current` und prüft nach jedem `await` (Berechtigung, `launchImageLibraryAsync`) und im `catch` auf `request !== requestId.current`; veraltete Ergebnisse (Erfolg, "abgebrochen", Berechtigung verweigert, Fehler) setzen weder State noch rufen sie `onClose`. Korrekt.
- Effekt-Retrigger/Endlosschleife: Abhängigkeiten `[visible, initialSource, handleOpenGallery]`. `handleOpenGallery` hängt nur an `initialSource` (`setState`, Refs stabil; `onClose` über `onCloseRef`), ändert sich also nur gleichzeitig mit `initialSource`. Die Konsumenten reichen pro Render neue Lambdas für `onClose`/`onSelected` durch; diese sind keine Effekt-Abhängigkeit (`handleClose`/`finish` werden nicht im Effekt verwendet). Keine Schleife, kein Re-Start bei Eltern-Re-Render. Kein Test rendert den Picker mit neuen Callback-Identitäten neu (Suggestion in F-06).
- Doppelöffnung: Mit `initialSource` startet der Effekt die Quelle genau einmal pro Wechsel. Im Quellenblatt: ein zweiter Tipp, solange die erste Anfrage noch auf die Berechtigung wartet, verwirft die erste vor `launchImageLibraryAsync`; nur die zweite startet. Nur wenn die erste bereits die Systemgalerie geöffnet hat, könnte eine zweite `launchImageLibraryAsync` parallel laufen (Verhalten der Systemgalerie nicht aus dem Repo prüfbar, UNVERIFIED; praktisch verdeckt die Systemgalerie die Tasten).
- Wechsel `camera` <-> `gallery` bei sichtbarem Picker: Der Effekt setzt zuerst `pickerView` auf `'sources'`, löscht Fehler und Editor und startet dann Kamera (`pickerView = 'camera'`) oder Galerie. Der Fehler aus Revision 2 (Kamera-Modal und Galerie gleichzeitig) ist behoben; ein spätes Galerie-Ergebnis nach dem Wechsel wird verworfen (Token).
- Ohne `initialSource` (Rezeptfluss): Der Effekt setzt nur zurück (bei `visible`-Wechsel) und startet nichts; Quellenblatt, Galerie-Abbruch (Blatt bleibt offen) und Editor-Abbruch (zurück zum Blatt) unverändert und getestet; `RecipeImageSourcePicker` und `src/modules/recipes` unverändert (243 Tests grün). Auch im Rezeptfluss wird ein spätes Galerie-Ergebnis nach Schließen jetzt verworfen (`handleClose` erhöht das Token).
- Reset mit `initialSource`: Beim Schließen setzen die Konsumenten `photoSource = null` (`onClose`), `initialSource` wird `undefined` und `visible` `false`; der Effekt läuft einmal und setzt zurück. Wiederöffnen startet sauber.
- Unmount: Es gibt keinen Cleanup; nach dem Unmount gesetzter State erzeugt in React 18+ keine Warnung und hält keine Ressourcen (kein Memory-Leak). Ein spätes Galerie-Ergebnis nach Unmount ruft höchstens `onCloseRef.current()` (Setter im Eltern-Flow). Unkritisch.
- `busy`-Guard in `finish`: unverändert wirksam gegen Doppelbestätigung (Test), aber `finish` kennt das Token nicht (F-09).

**2. F-06: Aussagekraft der Tests.** Die Tests prüfen Verhalten über Eigenschaften der Stubs (`visible`, `imageUri`, `permissionPurpose`, `disabled`), Aufrufargumente und sichtbare Texte, nicht bloß Rückgaben von Mocks; Kinder des Pickers sind durch Stubs ersetzt (eigene Tests vorhanden), `Modal` wird als Host-Element mit `visible`-Prop gerendert. Beispiele: Doppelbestätigung (ein Zuschnitt trotz zweier Bestätigungen), Zuschnittsfehler im Kamera-Direktpfad (Blatt sichtbar, Meldung, weder `onSelected` noch `onClose`), Auslösersperre (zweiter Tipp startet keine zweite Aufnahme; der Test ruft `onPress` direkt auf, prüft also den Guard im Handler, nicht nur `disabled`), Optionen von `launchImageLibraryAsync` exakt (`mediaTypes: ['images']`, `allowsEditing: false`, `selectionLimit: 1`, `quality: 0.85`), Preset/Output/Review beider Flows über die echten Konsumenten, Foto → `estimateMeal` mit exakten Argumenten.
- Schwächen: erwartete Rahmenwerte werden teils mit denselben Mathe-Funktionen berechnet (Verdrahtungstest); `onLayout` wird nicht ausgelöst; Gesten/Reanimated bleiben bewusst ungetestet; der Callers-Test mockt den Picker (daher kein Test der Interaktion Flow ↔ echter Picker und kein Test von `RecipeImageSourcePicker`, dort nur `'RecipeImageSourcePicker'`-Stub in `RecipeWizardScreen.test.tsx`).
- F-08-Regressionstests, analytisch gegen den Stand von Revision 2 (getrennte Effekte, kein Token, `pickerView` nur bei `camera` gesetzt, Reset nur bei `!visible`): (a) "camera → gallery bei sichtbarem Picker" wäre rot (`cameraVisible` bliebe `true`); (b) "gallery → camera, spätes Ergebnis" rot (spätes Ergebnis setzt `editorSource`, `editorVisible` `true`); (c) "spätes `canceled`" rot (`onCloseRef.current()` würde aufgerufen); (d) "nach Verbergen/Wiederöffnen" rot (spätes Ergebnis setzt `editorSource` nach dem Reset, beim Wiederöffnen sichtbar); (e) "nach Schließen des Blatts" rot (`handleClose` verwirft nichts, `editorVisible` `true`). Der Test "resets error and editor state when hidden and shown again" wäre auch ohne den Fix grün (Reset bei `!visible` existierte bereits) und ist ein Verhaltenstest, kein F-08-Regressionstest. Der Rot-Nachweis ist analytisch, nicht per Lauf.

**3. F-07: Plan, KB und Code.** Konsistent: `initialSource?: 'camera' | 'gallery'`, zwei Aktionen mit Feather-Icons, Abbruch ruft `onClose`, Blatt nur bei Fehlern, Rezeptfluss mit Blatt `Foto hinzufügen`, späte Galerie-Ergebnisse werden verworfen (Plan Abschnitt 19; KB nennt das nicht, nicht erforderlich). Pflichtfelder jedes Work Packages (Agent, Goal, Required Knowledge Base, Required Repository Context, Required Skills, Relevant Acceptance Criteria, Dependencies, Expected Handoff) sind in WP-FE-01 bis WP-FE-04 und WP-QA-01 vollständig vorhanden; die Skills `azure-openai-feature-integration` und `privacy-impact-review` stehen in WP-FE-02 und WP-QA-01. Restpunkte siehe F-10.

### Revision 3 – Datenschutz- und Azure-OpenAI-Prüfung

- `privacy-impact-review`, Abschnitt 5: Datenfluss unverändert (Foto → lokaler Zuschnitt → `scanLabel`/`estimateMeal` bzw. Rezeptfoto mit `heroCrop`). Seit Revision 2 geändert wurden nur Picker-Logik (Token) und Tests, die Konsumenten-UI und der Plan; keine neue Datenkategorie, kein neuer Empfänger, keine Speicherung, kein Logging, keine neue Berechtigung (`app.config.js`, `package.json` unverändert). `docs/legal/` unverändert; `docs/legal/datenschutzerklaerung-alpha.md` bleibt zutreffend (`Covered`). Einschränkung: F-09 beschreibt einen Race, in dem nach "Abbrechen" ein bereits laufender Zuschnitt noch zur Übergabe an `scanLabel`/`estimateMeal` führt; das widerspricht dem Plan-Satz "Abbrechen löst keinen Upload/API-Request aus" in einem engen Zeitfenster, ändert aber weder Empfänger noch Datenkategorie. Nicht aus dem Repository verifizierbar (UNVERIFIED): Lebensdauer temporärer Zuschnitt-Dateien im App-Cache, EXIF/GPS beim Re-Encoding.
- `azure-openai-feature-integration`, QA-Teil: Keine Datei unter `backend/src/lib/prompts/**`, `openai.ts`, `ai.ts` oder ein Schema im Working Tree geändert (die Backend-Änderungen betreffen Diary/DayMeta und sind fremd); Quoten, Structured Outputs, Plausibilität und Prompt-Eval nicht betroffen, Eval nicht erforderlich. Clientseitig unverändert: JPEG `0.85`, längste Kante höchstens `2000`/`1600` px, Endpunkte und Typen unverändert.

### Revision 3 – Verification Notes

- State: `UNVERIFIED`
  - Reason: kein Gerätetest und kein Expo/EAS-Build (laut Product Owner nachgelagert).
  - Manual action (PO, nach Build): siehe Checkliste unten.
- State: `UNVERIFIED`
  - Reason: reale Rendering-Semantik von `expo-image-manipulator` (EXIF, Zielmaße, Dateigröße gegenüber 4-MB-Limit, OCR-Qualität bei 2000 px), Orientierung/Skalierung von `takePictureAsync` und `CameraView`, Verhalten der Systemgalerie bei einem zweiten `launchImageLibraryAsync` während eines laufenden, Zurück-Taste im Systempicker und `Modal`-`onRequestClose` nur am Gerät prüfbar.
- State: `UNVERIFIED`
  - Reason: Native-Auslieferung; ein nicht neu gebauter Dev-/Alpha-Client würde `expo-image-manipulator`/`expo-image-picker` ggf. nicht finden.
- State: `MANUAL VALIDATION REQUIRED`
  - Prerequisites: neuer Android-Build mit den Modulen, Testprofil mit Kamera- und Fotoberechtigung (einmal erteilt, einmal verweigert).

| Schritt | Erwartetes Ergebnis | Ergebnis (PO) |
|---|---|---|
| Label-Scan und Mahlzeitenfoto: `Kamera` tippen | Kamera öffnet direkt ohne Quellenblatt; Aufnahme führt zur Analyse mit dem Rahmenausschnitt | |
| `Galerie` tippen, Bild wählen, bestätigen | Editor mit Rahmen; danach Analyse mit dem Ausschnitt | |
| Galerie öffnen und im Systempicker abbrechen / Zurück-Taste | Rückkehr zum Flow, erneutes Tippen funktioniert | |
| Kamera schließen, Editor abbrechen | Rückkehr zum Flow, kein API-Request | |
| Fotozugriff dauerhaft verweigert, `Galerie` tippen | Quellenblatt mit Meldung zu den Geräteeinstellungen | |
| Direkt nach dem Bestätigen im Editor sofort abbrechen/zurück (F-09) | kein Scan/Schätzung nach dem Abbruch | |
| `Kamera` und `Galerie` in schneller Folge tippen | genau eine Quelle ist aktiv | |
| Rezeptfoto | weiterhin Quellenblatt `Foto hinzufügen` mit Hero-Editor | |

- Hinweis (kein Fund): `scripts/test-baseline.json` steht auf mobile `108 / 1002` (Ist `111 / 1074`); die Parity prüft Minima, eine Anhebung gehört zum Technology-Refresh.

### Revision 3 – Findings (Wortlaut der Vorrevision; aktueller Status siehe oben)

Finding (Rev. 3): F-09
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-9, AC-14
Description: Abbrechen während eines laufenden Zuschnitts verhindert die Übergabe nicht. `finish` setzt `busy`, wartet auf `cropImageToFrame` und ruft danach `onSelected` und `handleClose` auf, ohne zu prüfen, ob der Nutzer inzwischen geschlossen hat. Während des Zuschnitts bleiben Kamera-Schließen (`onClose` → `handleClose`) und Editor-Abbrechen (`handleEditorCancel` → `handleClose`) bedienbar; `handleClose` erhöht nur das Token der Galerieanfragen, nicht den `finish`-Lauf. Folge: Der Eltern-Flow bekommt nach Abbruch noch `onSelected` und sendet das Foto an `scanLabel`/`estimateMeal` (Quota und Datenübermittlung trotz Abbruch), und `onClose` wird zweimal aufgerufen. Gleiches gilt nach Unmount des Flows. Zeitfenster: Dauer eines Zuschnitts. Seit Revision 1 vorhanden, durch das neue Token jetzt leicht behebbar.
Criticality: Non-blocking
Owner: Frontend
Evidence: `mobile/src/shared/camera/FramedPhotoPicker.tsx` (`finish`: `await cropImageToFrame(...)` gefolgt von `onSelected(...)` und `handleClose()`; `handleClose` erhöht `requestId`, `finish` liest es nicht); `FramedPhotoPicker.test.tsx` enthält keinen Test für Abbruch während des Zuschnitts. Plan AC-9 "Abbrechen löst weder einen Upload noch einen API-Request aus".
Recommendation: In `finish` zu Beginn `const request = requestId.current` merken und nach dem `await` bei `request !== requestId.current` ohne `onSelected`/`handleClose` zurückkehren (auch im `catch` keinen State setzen); Test: Zuschnitt per Deferred offen halten, `onClose`/Editor-Abbrechen auslösen, Deferred auflösen, `onSelected` nicht aufgerufen und `onClose` genau einmal.

Finding (Rev. 3): F-06
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-6, AC-9
Description: Rest der Testlücken nach den neuen Tests (auf Suggestion herabgestuft, weil AC-7 bis AC-9 jetzt per Verhalten belegt sind): (a) das Wiring von `RecipeImageSourcePicker` (`recipeHero`, `metadata`, `editor`, Overlay) ist nicht getestet (nur ein Stub in `RecipeWizardScreen.test.tsx`); ein vertauschtes Preset im Rezeptfluss bliebe unentdeckt; (b) kein Test rendert `FramedPhotoPicker` mit unveränderter `initialSource`, aber neuen `onClose`/`onSelected`-Identitäten neu (Schutz gegen Effekt-Retrigger/Doppelstart); (c) `onLayout` der Kamera und Gesten/Reanimated bleiben ungetestet (bewusst).
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/modules/recipes/RecipeImageSourcePicker.tsx` ohne eigenen Test; `mobile/src/shared/camera/FramedPhotoPicker.test.tsx` (`update` nur mit geänderten `initialSource`/`visible`).
Recommendation: Kleinen Test für `RecipeImageSourcePicker` mit gemocktem `FramedPhotoPicker` (Props prüfen) und einen Re-Render-Test mit neuen Callbacks und `launchImageLibraryAsync` genau einmal ergänzen.

Finding (Rev. 3): F-10
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-12, AC-13
Description: Rest-Inkonsistenzen in Plan und KB: (a) Plan Abschnitt 7 nennt `expo-camera@17.0.10`, `expo-image-picker@17.0.11` und `expo-image-manipulator@14.0.8` (SDK 54, "SDK-54-Linie bleibt"), installiert sind `~58.0.14`, `~58.0.10`, `~58.0.16` (SDK 58); (b) Plan Abschnitt 8 behauptet "Keine offenen Product-Owner-Entscheidungen", obwohl Abschnitt 0 PO-1 und Abschnitt 1 unbestätigte Annahmen nennen; (c) AC-13 und Abschnitt 7/17 nennen Baseline-/Working-Tree-Zahlen `108 / 1002` bzw. `106 / 993`, Ist `111 / 1074`; (d) `03-mobile.md` (`cropImageToFrame.ts`-Zeile) sagt, die längste Kante werde "auf exakt `maxEdge`" skaliert, tatsächlich nur bei Überschreitung (kein Hochskalieren); (e) Plan Abschnitt 10 "Fehler bei direktem Einstieg führen zum Quellenblatt" ist für Kamera-Berechtigungs- und Aufnahmefehler ungenau (diese bleiben im Kamera-Screen, so auch das KB).
Criticality: Suggestion
Owner: Planner
Evidence: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md` Abschnitte 7, 8, 10, 17, AC-13; `mobile/package.json`; `docs/kb/tech/03-mobile.md` Z. 410; `mobile/src/shared/camera/FramedCameraCapture.tsx` (Fehler im Kamera-Screen).
Recommendation: Planner aktualisiert die genannten Stellen vor einer Freigabe; Documentation ergänzt in `03-mobile.md` "wenn größer als `maxEdge`".

Finding (Rev. 3): F-05
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-6, AC-11
Description: Unverändert. (a) `BarcodeScannerScreen` zeigt `Barcode im Rahmen positionieren` auch auf Android; (b) beim Galerie-Fehler fehlt die frühere Aktion `Galerie erneut versuchen` (erneutes Tippen auf `Galerie` im Blatt möglich). Product-Owner-Entscheidung: bleibt bewusst bestehen.
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/modules/scanner/BarcodeScannerScreen.tsx`, `mobile/src/shared/camera/FramedPhotoPicker.tsx` (Fehlerbox ohne Retry-Aktion).
Recommendation: Als bewusste Änderung im Plan dokumentieren; kein Handlungsbedarf, solange die PO-Entscheidung gilt.

### Revision 3 – Zusammenfassung (Verdict Rev. 3: PASS WITH ISSUES)

Blocking: 0 · Non-blocking: 1 (F-09) · Suggestion: 3 (F-05, F-06, F-10). F-01 bis F-04, F-07 und F-08 sind behoben, F-06 ist auf einen Rest-Suggestion reduziert, F-05 bleibt PO-Entscheid. Alle 14 ACs sind erfüllt. `tsc` Exit 0, mobile Vitest zweimal 111 / 1074 grün, gezielte Läufe 28 / 325 grün, Encoding und Parity Exit 0. Datenfluss, Berechtigungen und `docs/legal/` unverändert, kein KI-/Quota-Bezug im Code. Gerätethemen sind `UNVERIFIED`/`MANUAL VALIDATION REQUIRED`; Prozessabweichung und PO-1 bleiben beim Product Owner.

---

## Historie: Revision 2

Nachfolgend der Bericht der Vorrevision (Revision 2, Verdict damals `PASS WITH ISSUES`) im ursprünglichen Wortlaut; nur Überschriften, AC-IDs (`R2-AC-n`) und Finding-Kennungen sind markiert, damit dieser Bericht genau ein Verdict, eine AC-Matrix und eine aktuelle Findings-Liste hat. Maßgeblich ist der Stand oben (Revision 3). Planrevision damals `2026-10-30-01`.

### Revision 2 – Scope

Re-Review der Änderungen seit Revision 1 (Working Tree auf `HEAD` `f171b9e`, noch nicht committet): `mobile/src/shared/camera/` (`cropImageToFrame.ts` und Test, `FramedPhotoPicker.tsx`, neue Tests `FramedPhotoPicker.test.tsx`, `FramedCameraCapture.test.tsx`, `FramedImageEditor.test.tsx`), `mobile/src/modules/nutrition/hub/LabelSubFlow.tsx`, `mobile/src/modules/nutrition/hub/AISubFlow.tsx`, `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx`, `docs/kb/product/05-ux-patterns.md` (Abschnitt "Camera and Photo Capture") und `docs/kb/tech/03-mobile.md` (Abschnitt "Photo capture (shared)"). Alle übrigen Kamera-Pfade (Rezeptfluss, Scanner, `app.config.js`, `package.json`) sind gegenüber `HEAD` unverändert (`git status` leer) und behalten ihren Befund aus Revision 1.

Nicht bewertet (fremde Änderungen des Parallelplans `PLAN_FitTrack-Technology-Refresh.md` bzw. Diary-/Health-Connect-Arbeiten im selben Working Tree): `mobile/src/modules/nutrition/DiaryScreen.tsx`, `DiaryScreen.f2.test.tsx`, der Diary-Absatz in `docs/kb/tech/03-mobile.md` (Historische Tagesziele), Backend-Dateien (`backend/src/functions/diary.ts` u. a.), Dependency-/CI-Änderungen und der Bericht `docs/qa/reports/PLAN_Diary-Historische-Tagesziele.md`. Gerätetest und Expo/EAS-Build sind laut Product Owner nachgelagert und nicht Teil dieses Reviews.

**Prozessabweichung (Plan Abschnitt 0):** Der Plan ist nicht freigegeben; die Umsetzung (inklusive der Änderungen seit Revision 1) entstand ohne Agentenlauf und ohne `handoff_store`. Die Entscheidung PO-1 liegt beim Product Owner und ist nicht Teil dieses Verdicts. Die ACs wurden als Ist-Zustand gegen den Plantext geprüft; Abweichungen zwischen Plantext und bewusster UI-Änderung sind als F-07 geführt.

### Revision 2 – Acceptance Criteria

Gesamtstatus aller ACs nach Revision 2. "geändert" bedeutet: Bewertung oder Evidenz seit Revision 1 neu begründet; "unverändert" verweist auf die Evidenz von Revision 1 (Historie), die durch unveränderte Dateien weiter gilt.

| ID (Rev. 2) | Result (Rev. 2) | Evidence (Rev. 2) |
|---|---|---|
| R2-AC-1 | PASS | unverändert. `mobile/src/shared/camera/` enthält alle geforderten Dateien; neu zusätzlich `FramedPhotoPicker.test.tsx`, `FramedCameraCapture.test.tsx`, `FramedImageEditor.test.tsx`. |
| R2-AC-2 | PASS | unverändert (`framePresets.ts` nicht geändert). Neu zusätzlich durch Test belegt: `FramedPhotoPicker.test.tsx` prüft den Editor mit `aspectRatio` `3 / 4` (nutritionLabel), `maxEdge` `2000` (nutritionLabel), `1600` (mealPhoto) und "kein `maxEdge`" bei `recipeHero`. |
| R2-AC-3 | PASS | unverändert (`frameCropMath.ts` nicht geändert). `frameCropMath.test.ts` grün; `FramedCameraCapture.test.tsx` prüft zusätzlich die Verdrahtung (`getCaptureFrame` mit Fenster `400 x 800`, Insets `20`/`10`). |
| R2-AC-4 | PASS | unverändert. `FramedCameraCapture.test.tsx` "reports the photo with its size and the frame rectangle" belegt, dass die Komponente `getPreviewSourceRect(photo, layout, frame)` mit den echten Aufnahmemaßen verwendet und ein Rechteck mit Rahmen-Ratio (`4/3`, `1e-5`) liefert. Der erwartete Wert wird mit denselben Mathe-Funktionen berechnet (Verdrahtungstest, die Geometrie selbst belegt `frameCropMath.test.ts`). |
| R2-AC-5 | PASS | geändert. `cropImageToFrame.ts` nutzt `ImageManipulator.manipulate(uri).crop().resize()`, `renderAsync()`, `saveAsync({ compress: 0.85, format: SaveFormat.JPEG })`; Signaturen gegen `node_modules/expo-image-manipulator/build/` (`58.0.16`) verifiziert, `tsc` Exit 0. Verhalten gegenüber `manipulateAsync` gleich (Crop vor Resize, gleiche Rundung, JPEG `0.85`, Resize nur über `maxEdge`); längste Kante jetzt exakt `maxEdge` (F-03 behoben). Rechnerisch geprüft: 48 048 Kombinationen (u. a. `1 x 5000`, `5000 x 1`, `2001 x 2001`, `1000 x 2001`, `maxEdge` 1600/2000), 0 Überschreitungen, keine Kante `< 1`. `cropImageToFrame.test.ts` 6 Tests grün (Hochformat, Rundungs-Schleife, Aufrufreihenfolge-unabhängige Argumentprüfung). |
| R2-AC-6 | PASS | geändert (neu geprüft). Rezeptfluss unverändert: `git status` für `mobile/src/modules/recipes` leer; `RecipeImageSourcePicker.tsx` übergibt weiterhin kein `initialSource`; `FramedPhotoPicker` ohne `initialSource` zeigt Quellenblatt wie zuvor (Bedingung `!initialSource \|\| error != null` ergibt `true`), Galerie-Abbruch lässt das Blatt offen, Editor-Abbruch führt zum Blatt zurück (je durch `FramedPhotoPicker.test.tsx` belegt). `src/modules/recipes`: 21 Dateien / 243 Tests grün. Restpunkt F-05 (PO-Entscheid). |
| R2-AC-7 | PASS | geändert. Funktional erfüllt: `LabelSubFlow` mountet `FramedPhotoPicker` mit `nutritionLabel`/`cropped-file`/`direct`, `AISubFlow` mit `mealPhoto`/`cropped-file`/`direct`; `git grep` auf `launchCameraAsync` in `mobile/`: keine Treffer. Wortlaut weicht ab: statt eines Buttons `Foto hinzufügen` zeigen beide Flows zwei Aktionen `Kamera`/`Galerie` mit Feather-Icons, das Quellenblatt erscheint nur noch bei Fehlern (bewusste UI-Änderung, KB nachgezogen; Plantext nicht, siehe F-07). Das Preset-Wiring der Konsumenten ist nur per Code-Review belegt (F-06). |
| R2-AC-8 | PASS | geändert. Jede Quelle liefert bei `cropped-file` ein JPEG: `FramedPhotoPicker.test.tsx` belegt `cropImageToFrame(uri, getSourceRectForCrop(...), image, maxEdge)` für Galerie/Editor und für Kamera `direct` (Rechteck gleich Rahmenrechteck, `maxEdge` 1600) und das Ergebnis `mime: 'image/jpeg'`. `nutritionDiaryMutationCallers.test.tsx` belegt weiterhin Foto → `scanLabel('/label.jpg','image/jpeg')`. Foto → `estimateMeal` ist weiterhin ohne Test (F-06). Überschreitung von `maxEdge` ausgeschlossen (F-03 behoben). |
| R2-AC-9 | PASS | geändert. Jetzt durch Komponententests belegt: `Kamera wird vorbereitet…`, einmalige Berechtigungsanfrage, `Kein Kamerazugriff` mit Zweck-Text, Geräteeinstellungs-Hinweis bei `canAskAgain: false`, `Erneut versuchen` (erneute Anfrage), `Abbrechen`, Aufnahmefehler (fehlende URI/Maße, Exception, Callback-Fehler) mit `Erneut versuchen` (`FramedCameraCapture.test.tsx`); Galerie verweigert (beide Meldungen), Asset ohne URI, Galerie-Exception, Zuschnittsfehler → Quellenblatt mit `Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.` ohne `onSelected`/`onClose`, Retry danach, Doppelbestätigung ruft `cropImageToFrame` nur einmal, Abbrechen ohne `onSelected` (`FramedPhotoPicker.test.tsx`). Offen: Gesten, `capturing`-Sperre des Auslösers, Fehler beim Kamera-Direktzuschnitt auf Pickerebene (F-06). |
| R2-AC-10 | PASS | unverändert; `mobile/package.json` nicht geändert. `git grep` nach `vision-camera`, `image-crop-picker`, `AddItemModal`, `launchCameraAsync`, `MediaTypeOptions`, `manipulateAsync` in `mobile/`: 0 Treffer (Code, Tests, Config). Neu: `MediaTypeOptions` und `manipulateAsync` nicht mehr im Code (F-02, F-04 behoben). |
| R2-AC-11 | PASS | unverändert (`BarcodeScannerScreen.tsx` und `AndroidBarcodeScanner.tsx` gegenüber `HEAD` unverändert, `AddItemModal.tsx` nicht vorhanden). Restpunkt F-05 (PO-Entscheid). |
| R2-AC-12 | PASS | geändert. `05-ux-patterns.md` ("Camera and Photo Capture", Flow Schritt 1 und "Required states") und `03-mobile.md` ("Photo capture (shared)": `FramedPhotoPicker`/`cropImageToFrame`-Zeilen, Konsumentenabsatz) stimmen mit dem Code überein: zwei direkte Aktionen mit Feather-Icons `camera`/`image`, `initialSource` überspringt das Blatt, Abbruch von Kamera/Galerie/Editor schließt den Picker, Fehler zeigen das Blatt, `photoSource`-State, Context-API von `expo-image-manipulator`, längste Kante exakt `maxEdge`, Rezeptfluss behält das Blatt, "No emojis as icons in photo actions". `git grep` in `docs/kb`: 3 Treffer, alle bewusste Negativ-Aussagen. Nicht bewertet: der fremde Diary-Absatz in `03-mobile.md`. |
| R2-AC-13 | PASS | geändert. `npx tsc --noEmit` Exit 0; mobile Vitest vollständig im zweiten Lauf 111 Dateien / 1059 Tests grün (erster Lauf: 1 kameraunabhängiger Fehler in `authRedirect.test.ts`, siehe Tests); gezielte Läufe 28 Dateien / 310 Tests grün; Encoding Exit 0; Test-Parity Exit 0 (shared 10/466, backend 84/2717, mobile 111/1059; Minima 10/466, 84/2709, 108/1002). |
| R2-AC-14 | PASS | geändert (neu geprüft). `docs/legal/` unverändert (`git status` und `git diff HEAD --stat -- docs/legal` leer). Die Änderungen seit Revision 1 betreffen nur den UI-Einstieg und Zuschnittsparameter; kein neuer Datenfluss (siehe Datenschutz- und Azure-OpenAI-Prüfung). `mobile/app.config.js` und `mobile/package.json` unverändert. |

### Revision 2 – Tests

Node `v24.22.1` (`$env:PATH = "$env:USERPROFILE\tools\node-v24.22.1-win-x64;" + $env:PATH`, `npm.cmd`/`npx.cmd`). Exit-Codes sind die von `$LASTEXITCODE` des eigentlichen Befehls.

| Command | Exit code | Result |
|---|---:|---|
| `npx tsc --noEmit` (in `mobile`) | 0 | keine Fehler |
| `npx vitest run` (in `mobile`, vollständig, erster Lauf) | 1 | 110 von 111 Dateien, 1058 von 1059 Tests bestanden; 1 Fehler in `src/services/authRedirect.test.ts` ("app.config.js consistency", Test dauerte 5124 ms, Fehlertext nicht ausgewertet; Ursache vermutlich Timeout beim Laden von `app.config.js` unter Last, siehe Verification Notes). Datei betrifft die Kamera nicht. |
| `npx vitest run src/services/authRedirect.test.ts` (in `mobile`) | 0 | 1 Datei / 7 Tests bestanden |
| `npx vitest run` (in `mobile`, vollständig, zweiter Lauf) | 0 | 111 Dateien / 1059 Tests bestanden, 0 fehlgeschlagen |
| `npx vitest run src/shared/camera` | 0 | 5 Dateien / 55 Tests bestanden |
| `npx vitest run src/modules/recipes` | 0 | 21 Dateien / 243 Tests bestanden |
| `npx vitest run src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx` | 0 | 1 Datei / 11 Tests bestanden |
| `npx vitest run src/services/nutritionDiaryMutationBoundary.test.ts` | 0 | 1 Datei / 1 Test bestanden |
| `npx vitest run src/shared/camera src/modules/recipes src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx src/services/nutritionDiaryMutationBoundary.test.ts` | 0 | 28 Dateien / 310 Tests bestanden |
| `npm.cmd run check:encoding` (Repo-Root) | 0 | "Encoding check passed." |
| `npx vitest run --reporter=json --outputFile=<Bericht>` in `shared`, `backend`, `mobile` | 0 / 0 / 0 | JSON-Berichte außerhalb des Repos erzeugt und nach dem Lauf gelöscht (Löschung geprüft) |
| `node scripts/check-test-parity.mjs --shared … --backend … --mobile …` | 0 | PASS shared 10 Dateien / 466 Tests (Minimum 10/466), backend 84 / 2717 (Minimum 84/2709), mobile 111 / 1059 (Minimum 108/1002) |
| `git grep -n -e "vision-camera" -e "image-crop-picker" -e "AddItemModal" -e "launchCameraAsync" -e "MediaTypeOptions" -e "manipulateAsync" -- mobile docs/kb` (Lockfiles ausgenommen) | 0 | 3 Treffer, alle in `docs/kb` als bewusste Negativ-Aussagen (`05-ux-patterns.md` L477, `03-mobile.md` L414 und L593); 0 Treffer in `mobile/` |
| `node -e` Rechenprüfung der `getCropActions`-Resize-Logik (Kopie der Formel, keine Datei angelegt) | 0 | 48 048 Kombinationen (Breite 1-6000 × 14 Gegenkanten × beide Orientierungen × `maxEdge` 1600/2000): 0 Verstöße (längste Kante exakt `maxEdge`, keine Kante `< 1`) |
| `git diff HEAD --check -- mobile/src/shared/camera mobile/src/modules/nutrition/hub docs/kb/product/05-ux-patterns.md` | 0 | keine Whitespace-Fehler |
| `git grep` Emoji-Zeichen / Hex- und `rgba`-Farben in `LabelSubFlow.tsx`, `AISubFlow.tsx`, `mobile/src/shared/camera` | 0 | Treffer nur in unveränderten Zeilen (Überschriften `📷`/`✨`, Schließen `✕`, Warnung `⚠`, `#C8A032`, zwei `rgba`-Werte in `AISubFlow.tsx`); im Diff und in `mobile/src/shared/camera` keine Emojis und keine Hardcode-Farben |

Hinweis: Das Backend wurde nur für die Parity-Berichte ausgeführt und ist nicht Teil dieses Review-Scopes. Es wurde nichts installiert, nichts gebaut, kein Git-Schreibbefehl ausgeführt und keine Datei im Repo außer diesem Bericht geändert.

### Revision 2 – Status der früheren Findings

| Finding | Status | Begründung |
|---|---|---|
| F-01 (Komponententests fehlen) | teilweise behoben | Drei neue Komponententest-Dateien belegen Verhalten (siehe Bewertung unten); Restlücken sind als F-06 neu geführt. |
| F-02 (`manipulateAsync` deprecated) | behoben | Kontext-API, Signaturen gegen `58.0.16` verifiziert, Test angepasst, `tsc` Exit 0. |
| F-03 (`maxEdge` um 1 px überschreitbar) | behoben | Längste Kante exakt `maxEdge`; 48 048 Kombinationen und 5 Testfälle ohne Überschreitung. |
| F-04 (`MediaTypeOptions` deprecated) | behoben | `mediaTypes: ['images']`; gültig laut `expo-image-picker@58.0.10` (`MediaType = 'images' \| 'videos' \| 'livePhotos'`, `mediaTypes?: MediaType \| MediaType[] \| MediaTypeOptions`). |
| F-05 (Barcode-Hinweis Android, Galerie-Retry) | bewusst zurückgestellt | Product-Owner-Entscheidung; weiterhin als Suggestion geführt. |

### Revision 2 – Prüfung der Änderungen seit Revision 1

**1. `cropImageToFrame.ts` (F-02).** `ImageManipulator.manipulate(source: string | SharedRef<'image'>, options?)` liefert einen `ImageManipulatorContext` mit `crop(rect: { originX, originY, width, height })`, `resize({ width?, height? })` (beide `number | null`), `renderAsync(): Promise<ImageRef>`; `ImageRef.saveAsync(options?: SaveOptions): Promise<ImageResult>` mit `compress`/`format`. Alle Aufrufe sind typkonform. Reihenfolge Crop vor Resize entspricht der früheren Aktionsliste. Der Test mockt den Kontext zustandsfrei (`crop`/`resize` liefern denselben Kontext) und prüft Argumente und Ergebnis (`{ uri, mime: 'image/jpeg' }`), nicht die Aufrufreihenfolge; reale Rendering-Semantik (EXIF, tatsächliche Zielmaße) ist nur am Gerät prüfbar (UNVERIFIED).

**2. Resize-Logik (F-03).** Bei `width >= height` wird `{ width: maxEdge, height: max(1, round(height · maxEdge / längste)) }`, sonst `{ width: max(1, round(width · …)), height: maxEdge }` gesetzt. Die kürzere Kante ist nach Rundung `<= maxEdge` (Rundung einer Zahl `<= maxEdge`), nie `< 1` (Klammerung auf 1, z. B. `1 x 5000` → `1 x 2000`). Kein Hochskalieren, da Resize nur bei `längste > maxEdge`. Quadratisch (`2001 x 2001` → `2000 x 2000`) korrekt. Die Tests decken Querformat, Hochformat und fünf Rundungskombinationen ab, nicht die Klammerung auf 1 (kein Fund; per Rechenprüfung bestätigt). Ein `maxEdge` von `0`/`undefined` überspringt das Resize (so beabsichtigt, `recipeHero` hat keines).

**3. `mediaTypes` (F-04).** Typkonform; keine Deprecation mehr. Kein Test prüft die an `launchImageLibraryAsync` übergebenen Optionen (`mediaTypes`, `allowsEditing: false`, `selectionLimit: 1`); Teil von F-06.

**4. Komponententests (F-01).** Beurteilung: Die Asserts prüfen Verhalten, nicht Mock-Rückgaben. Beispiele: Doppelbestätigung (zwei synchrone `onConfirm`-Aufrufe → `cropImageToFrame` einmal; würde ohne `busy`-Ref scheitern), Zuschnittsfehler (Quellenblatt sichtbar, Editor unsichtbar, `onSelected`/`onClose` nicht aufgerufen, exakter Fehlertext), Retry nach Fehler, `output: 'metadata'` ohne Zuschnitt, Kamera-`direct` mit Rechteck-Gleichheit und `maxEdge` 1600, Berechtigung "nur einmal anfragen", Aufnahme ohne URI/Maße. Mocks sind plausibel gebaut: Kinder des Pickers werden durch Stubs ersetzt (`CameraCaptureStub`, `ImageEditorStub`) und über deren Props gesteuert; `react-native`-`Modal` wird als Host-Komponente gerendert, daher wird Sichtbarkeit über die `visible`-Prop geprüft (nicht über Vorhandensein von Text) und Meldungstexte zusätzlich mit Sichtbarkeit der Ansicht kombiniert. Schwächen: (a) erwartete Rahmen-/Rechteckwerte werden teils mit denselben Mathe-Funktionen berechnet (reine Verdrahtungstests); (b) `onLayout` der Kamera wird nie ausgelöst, es gilt nur der Fensterwert; (c) der Editor-Test mockt Reanimated/Gesture-Handler so, dass nur die Konfigurationsaufrufe laufen; belegt sind damit Ladezustand, Fehlerzustand, Bestätigung mit Anfangs-Crop und Standard-Crop, Abbrechen, Overlay, nicht aber Pan/Pinch (bewusst, siehe Lücken). Belegte Aussagen: AC-2 (Preset-Parameter im Picker), AC-8 (Quelle → JPEG über `cropImageToFrame`), AC-9 (siehe Tabelle). Verbleibende Lücken: Gesten und Reanimated; `capturing`-Sperre des Auslösers; Picker-Reset bei `visible: false → true` (Wiederöffnen); Zuschnittsfehler beim Kamera-Direktpfad auf Pickerebene (nur der Galeriepfad ist getestet); `launchImageLibraryAsync`-Optionen; Wiring `preset`/`output`/`cameraReview` in `LabelSubFlow`, `AISubFlow`, `RecipeImageSourcePicker` (der Callers-Test mockt den Picker und prüft nur `visible`/`initialSource`/`onSelected`); Foto → `estimateMeal`. Gebündelt als F-06.

**5. UI-Änderung und `initialSource`.**
- Fehlerfälle bleiben sichtbar: Das Blatt ist sichtbar bei `!initialSource || error != null` (`FramedPhotoPicker.tsx` L177). Galerie verweigert/Exception/Asset ohne URI und Zuschnittsfehler setzen `error` und zeigen das Blatt; Kamera-Berechtigungs- und Aufnahmefehler bleiben im Kamera-Screen (wie im KB-Abschnitt "Required states"). Durch Test belegt (`initialSource="gallery"` verweigert → Blatt mit Meldung, `onClose` nicht aufgerufen).
- Abbruch ruft `onClose`: Galerie-Abbruch (`onCloseRef.current()` bei `initialSource`), Editor-Abbruch (`handleEditorCancel`), Kamera schließen und Blatt-Abbrechen (`handleClose`) – alle durch Test belegt; ohne `initialSource` bleibt das Verhalten (Blatt bleibt offen bzw. Rückkehr zum Blatt) und ist ebenfalls getestet.
- Zustand nach Abbruch/Erfolg: Jeder Pfad ruft `onClose` → `photoSource` wird in beiden Flows auf `null` gesetzt (`onClose={() => setPhotoSource(null)}`); erneutes Tippen setzt wieder `'camera'`/`'gallery'` und öffnet erneut (Picker-Reset über `visible`-Effekt L70). Das Hub-Schließen setzt `photoSource` im `!visible`-Effekt zurück; beide Flows liefern bei `!visible` `null`, der Picker wird dabei mit seinem Modal abgebaut. Reiner Code-Nachweis; ein Test für Wiederöffnen fehlt (F-06).
- Doppeltippen: zweimal dieselbe Aktion setzt denselben State (kein zweiter Start). Wechsel `camera → gallery` bei bereits sichtbarem Picker (zwei Aktionen im selben Frame) startet den Galerie-Effekt, `pickerView` bleibt aber `'camera'` (Kamera-Modal und Galerie gleichzeitig); ein spätes Galerie-Ergebnis nach Rücksetzen (`visible: false`) setzt `editorSource` ohne erneutes Zurücksetzen (F-08, praktisch kaum erreichbar). Der Auslöser sperrt per `capturing` Doppelaufnahmen; der Zuschnitt ist per `busy`-Ref gegen Doppelbestätigung gesichert.
- Rezeptfluss: `RecipeImageSourcePicker.tsx` und `src/modules/recipes` unverändert, 243 Tests grün.
- Emojis/Texte/Theme: In den Foto-Aktionen beider Flows keine Emojis mehr (`✕` und `📷` im Indikator durch Feather-Icons `check-circle`/`x`/`camera`/`image` ersetzt; Icon-Namen und -Größen `md`/`lg` typgeprüft). Nur Theme-Tokens (`colors`, `spacing`, `radius`, `typography`), keine neuen Hardcode-Werte im Diff; alle Texte Deutsch. Unverändert bestehende Emojis/Hardcodes außerhalb der Foto-Aktionen (Überschriften `📷 Nährwert-Label scannen`, `✨ …`, `✕` Schließen, `⚠`, `#C8A032`, zwei `rgba`) sind nicht Teil dieser Änderung und nicht von der KB-Regel "No emojis as icons in photo actions" erfasst; kein Fund.
- Zugänglichkeit: Alle neuen Aktionen haben `accessibilityRole="button"` und deutsche `accessibilityLabel` (`Foto mit der Kamera aufnehmen`, `Foto aus der Galerie auswählen`, `Label mit der Kamera fotografieren`, `Label-Foto aus der Galerie auswählen`, `Foto entfernen`); sichtbarer Text (`Kamera`/`Galerie`) ist im Label enthalten. Die Tests suchen die Buttons per sichtbarem Text, die Labels selbst sind nicht getestet (Hinweis, kein Fund).
- KB-Übereinstimmung: siehe AC-12; Abweichung zwischen KB (neues Verhalten) und Plantext (`Foto hinzufügen`-Button) ist F-07.

**6. F-05.** Unverändert offen, vom Product Owner bewusst nicht behoben (Barcode-Hinweis `Barcode im Rahmen positionieren` auf Android und fehlende Aktion `Galerie erneut versuchen` beim Galerie-Fehler). Beide Punkte gelten durch die neuen Direkteinstiege unverändert; das Tippen auf `Galerie` im Blatt ist weiterhin möglich.

### Revision 2 – Datenschutz- und Azure-OpenAI-Prüfung

- `privacy-impact-review`, Abschnitt 5: Datenfluss unverändert (Foto → lokaler Zuschnitt → `scanLabel`/`estimateMeal` bzw. Rezeptfoto + `heroCrop`). Neu sind nur der Einstieg (zwei Aktionen statt Button + Blatt) und die API des Zuschnitts; keine neue Datenkategorie, kein neuer Empfänger, keine neue Speicherung, kein Logging, keine neue Berechtigung (`mobile/app.config.js` und `mobile/package.json` unverändert). Die Zuschnittsgröße ist weiterhin höchstens `maxEdge` (jetzt exakt). `docs/legal/` unverändert; `docs/legal/datenschutzerklaerung-alpha.md` bleibt zutreffend (`Covered`). Nicht aus dem Repository verifizierbar bleiben (wie Revision 1): Cache-Lebensdauer temporärer Zuschnitt-Dateien und EXIF/GPS-Verhalten beim Re-Encoding (UNVERIFIED).
- `azure-openai-feature-integration`, QA-Teil: Weder `ai.ts`, `openai.ts`, Prompts, Schemas noch Quoten sind im Working Tree geändert (`git status` zeigt keine entsprechenden Dateien); Quoten-Reihenfolge, Structured Outputs, Plausibilitätsprüfung und Prompt-Eval sind nicht betroffen, Eval nicht erforderlich. Clientseitig ändert sich nur der Bildzuschnitt (längste Kante exakt `maxEdge`) und der Einstieg.

### Revision 2 – Verification Notes

- State: `UNVERIFIED`
  - Reason: kein Gerätetest (laut Product Owner nachgelagert).
  - Manual action (PO, nach Build): `Kamera` und `Galerie` in `LabelSubFlow` und `AISubFlow` öffnen jeweils direkt Kamera bzw. Systemgalerie ohne Quellenblatt; Abbruch (Galerie, Kamera-Schließen, Zurück-Taste, Editor-Abbrechen) kehrt zum Flow zurück, erneutes Tippen funktioniert; Berechtigung verweigert zeigt Meldung (Kamera im Kamera-Screen, Galerie im Quellenblatt); Rezeptfoto zeigt weiterhin das Quellenblatt `Foto hinzufügen`; schnelles Doppeltippen öffnet nur eine Quelle.
- State: `UNVERIFIED`
  - Reason: reale Rendering-Semantik der Kontext-API von `expo-image-manipulator` (Orientierung/EXIF, tatsächliche Zielmaße des Resize, Dateigröße gegenüber dem 4-MB-Limit, OCR-Qualität bei 2000 px) nur am Gerät messbar; Orientierung/Skalierung von `takePictureAsync` und `CameraView` wie in Revision 1.
- State: `UNVERIFIED`
  - Reason: Native-Auslieferung. `expo-image-manipulator` und `expo-image-picker` sind native Module; ein nicht neu gebauter Dev-/Alpha-Client würde sie ggf. nicht finden (kein Build in diesem Review).
- State: `UNVERIFIED`
  - Reason: Ursache des einmaligen Fehlers in `src/services/authRedirect.test.ts` im ersten vollständigen Lauf (Testdauer 5124 ms; Fehlertext nicht ausgewertet, Wiederholung grün). Datei liegt außerhalb des Kamera-Scopes (lädt `mobile/app.config.js`); Flakiness im CI nicht bewertet.
- Hinweis (kein Fund): `scripts/test-baseline.json` steht weiter auf mobile `108 / 1002` (Parity prüft Minima; Ist 111 / 1059); eine Anhebung ist eine bewusste Entscheidung des Technology-Refresh und nicht Teil dieses Scopes.
- Hinweis (kein Fund): Plan Abschnitt 7 nennt noch `expo-image-manipulator@14.0.8`; Ist `~58.0.16` (wie Revision 1).

### Revision 2 – Findings (Wortlaut der Vorrevision; aktueller Status siehe oben)

Finding (Rev. 2): F-05
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-6, AC-11
Description: Unverändert aus Revision 1. (a) `BarcodeScannerScreen` zeigt den Hinweis `Barcode im Rahmen positionieren` nun auch auf Android, solange keine Berechtigung verweigert wurde. (b) Beim Galerie-Fehler fehlt die frühere Aktion `Galerie erneut versuchen`; das Quellenblatt zeigt nur die Meldung (erneutes Tippen auf `Galerie` bleibt möglich). Product-Owner-Entscheidung: beide Punkte bleiben bewusst bestehen (nicht behoben).
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/modules/scanner/BarcodeScannerScreen.tsx` (Bottom-Hint-Bedingung), `mobile/src/shared/camera/FramedPhotoPicker.tsx` (Fehlerbox ohne Retry-Aktion); beide Dateien gegenüber Revision 1 unverändert in Verhalten.
Recommendation: Als bewusste Änderung im Plan dokumentieren (Planner); kein Handlungsbedarf, solange die PO-Entscheidung gilt.

Finding (Rev. 2): F-06
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-7, AC-8, AC-9
Description: Verbleibende Testlücken nach den neuen Komponententests. Nicht belegt sind (a) das Wiring `preset`/`output`/`cameraReview` in `LabelSubFlow`, `AISubFlow` und `RecipeImageSourcePicker` (der Callers-Test mockt `FramedPhotoPicker` und prüft nur `visible` und `initialSource`; ein vertauschtes Preset bliebe unentdeckt), (b) Foto → `aiApi.estimateMeal(text, uri, mime)` in `AISubFlow` (AC-8; nur der Label-Pfad `scanLabel` ist getestet), (c) das Zurücksetzen von `photoSource` über `onClose` und das Wiederöffnen (Flow-Ebene) sowie der Reset des Pickers bei `visible: false → true`, (d) Zuschnittsfehler im Kamera-Direktpfad auf Pickerebene (getestet ist nur der Galeriepfad), (e) die `capturing`-Sperre des Auslösers und `onLayout`, (f) die an `launchImageLibraryAsync` übergebenen Optionen (`mediaTypes: ['images']`, `allowsEditing: false`). Gesten/Reanimated bleiben bewusst ungetestet und sind hier nicht aufgeführt.
Criticality: Non-blocking
Owner: Frontend
Evidence: `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx` (Mock `FramedPhotoPicker`, nur `visible`/`initialSource`/`onSelected` aus den Props gelesen; `estimateMeal` nur in Mock-Setup und Test ohne Foto); `mobile/src/shared/camera/FramedPhotoPicker.test.tsx` (kein Test mit `visible`-Wechsel, Direkt-Kamera-Fehlerfall, Optionsprüfung); `mobile/src/shared/camera/FramedCameraCapture.test.tsx` (kein Test für `capturing`/`disabled`).
Recommendation: Im Callers-Test `preset`/`output`/`cameraReview` der gemockten Picker-Props für beide Flows und `RecipeImageSourcePicker` prüfen, `onClose` aufrufen und erneutes Öffnen testen, Foto → `estimateMeal` ergänzen; im Picker-Test Direkt-Kamera-Zuschnittsfehler, `visible`-Wechsel und `launchImageLibraryAsync`-Optionen sowie in `FramedCameraCapture` die Auslösersperre ergänzen.

Finding (Rev. 2): F-07
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-7
Description: Der Plantext fordert in Abschnitt 3 (Zeile 68), in WP-FE-03 (Zeile 191) und in AC-7 (Zeile 370) einen einzelnen Button `Foto hinzufügen`, der das Quellenblatt öffnet. Umgesetzt und im KB beschrieben sind zwei direkte Aktionen `Kamera`/`Galerie` (Feather-Icons) ohne Quellenblatt (Blatt nur bei Fehlern und im Rezeptfluss). Der Plan wurde nicht nachgezogen; KB und Plan widersprechen sich, und AC-7 ist wörtlich nicht erfüllt, funktional (gemeinsamer Picker mit den geforderten Presets) schon. Die Änderung ist eine bewusste, vom Auftrag benannte UI-Entscheidung; die Bewertung als PASS stützt sich darauf und auf die noch ausstehende Freigabe/PO-1.
Criticality: Non-blocking
Owner: Planner
Evidence: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md` Z. 68, 191, 370 gegenüber `mobile/src/modules/nutrition/hub/LabelSubFlow.tsx` und `mobile/src/modules/nutrition/hub/AISubFlow.tsx` (`accessibilityLabel` `Foto mit der Kamera aufnehmen` u. a.) und `docs/kb/product/05-ux-patterns.md` ("Camera and Photo Capture", Flow Schritt 1).
Recommendation: Planner passt AC-7 und die betroffenen Abschnitte an (zwei direkte Aktionen, `initialSource`, Blatt nur bei Fehlern/Rezeptfluss) oder der Product Owner bestätigt die Abweichung im Rahmen von PO-1.

Finding (Rev. 2): F-08
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-9
Description: `FramedPhotoPicker` startet die Quelle nur im Effekt auf `[visible, initialSource, handleOpenGallery]`. Wechselt `initialSource` von `camera` auf `gallery`, solange der Picker sichtbar ist (zwei Aktionen im selben Frame getippt), startet der Galerie-Effekt, `pickerView` bleibt aber `'camera'`, sodass Kamera-Modal und Systemgalerie gleichzeitig aktiv sind. Außerdem setzt ein spätes Galerie-Ergebnis nach dem Zurücksetzen (`visible: false`) `editorSource` erneut, der nur beim Wechsel von `visible` geleert wird; beim nächsten Öffnen könnte der Editor mit dem alten Bild erscheinen. Beide Fälle sind praktisch kaum erreichbar, weil das Modal die Aktionen nach dem ersten Tippen verdeckt.
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/shared/camera/FramedPhotoPicker.tsx` L70-L76 (Reset nur bei `!visible`), L138 (`setEditorSource` nach `await`), L144-L148 (Effekt setzt `pickerView` nur für `camera`).
Recommendation: Im Effekt `pickerView` für beide Quellen explizit setzen (`'sources'` für die Galerie) und das Ergebnis von `launchImageLibraryAsync` verwerfen, wenn `visible` inzwischen `false` ist; Test dazu ergänzen.

### Revision 2 – Zusammenfassung (Verdict Rev. 2: PASS WITH ISSUES)

Blocking: 0 · Non-blocking: 2 (F-06, F-07) · Suggestion: 2 (F-05, F-08). F-02, F-03 und F-04 sind behoben, F-01 ist teilweise behoben (Rest als F-06), F-05 ist vom Product Owner bewusst zurückgestellt. Alle Acceptance Criteria AC-1 bis AC-14 sind erfüllt (AC-7 funktional; Plantext weicht bewusst ab, F-07). Datenfluss, Berechtigungen und `docs/legal/` unverändert, kein KI-/Quota-Bezug. Gerätethemen sind als `UNVERIFIED` geführt; die Prozessabweichung (Plan nicht freigegeben, Umsetzung ohne Agentenlauf) bleibt beim Product Owner (PO-1).

---

## Historie: Revision 1

Nachfolgend der Bericht der Vorrevision (Erstreview, Verdict damals `PASS WITH ISSUES`) in seinem ursprünglichen Wortlaut. Überschriften, AC-IDs (`R1-AC-n`) und Finding-Kennungen sind nur markiert, damit dieser Bericht genau ein Verdict, eine AC-Matrix und eine aktuelle Findings-Liste hat. Maßgeblich ist der Stand oben (Revision 2).


### Revision 1 – Scope

Geprüft wurden ausschließlich die Kamera-Änderungen: `mobile/src/shared/camera/`, die Konsumenten (`RecipeImageSourcePicker`, `RecipeImageHeroCropEditor`, `recipeImageHeroCropMath`, `recipeImageSource`, `LabelSubFlow`, `AISubFlow`, `FoodEntryHub`), der Barcode-Scanner (`BarcodeScannerScreen`, `AndroidBarcodeScanner`), die Kommentar-/Testanpassungen, das gelöschte `AddItemModal`, `mobile/app.config.js` (Berechtigungstext), `mobile/package.json` (nur Kamera-Pakete) sowie die KB (`docs/kb/product/05-ux-patterns.md`, `docs/kb/tech/03-mobile.md`, `docs/kb/README.md`).

Nicht bewertet: alle Änderungen des Technology-Refresh (Versions-/Dependency-Updates, CI, Backend-Tests) und des Health-Connect-Plans. Gerätetest und Expo/EAS-Build sind laut Product Owner nachgelagert und nicht Teil dieses Reviews.

**Prozessabweichung (Plan Abschnitt 0):** Der Plan ist nicht freigegeben. Die Umsetzung entstand ohne Planner-Freigabe und ohne Backend-/Frontend-Agentenlauf; es gibt kein `handoff_store`. Alle Work Packages (WP-FE-01 bis WP-FE-04) wurden daher als Ist-Zustand gegen den Soll-Zustand und die ACs geprüft. Die Entscheidung PO-1 (Übernehmen/Verwerfen) liegt beim Product Owner und ist nicht Teil dieses Verdicts.

**Abweichung vom Auftragskontext:** Die Kamera-Änderungen liegen nicht mehr im Working Tree, sondern sind bereits in Commit `bce9fe6` ("version updates") zusammen mit den Technology-Refresh-Änderungen committet. Für die Kamera-Pfade ist der Working Tree sauber. Die Diffs wurden gegen `bce9fe6^` gelesen. Während des Reviews kamen fremde Working-Tree-Änderungen eines parallelen Plans hinzu (`mobile/src/services/health/nutritionSyncService*.ts`, `docs/kb/tech/03-mobile.md` Abschnitt Health Connect, CI, Lockfile); sie wurden nicht bewertet.

### Revision 1 – Acceptance Criteria

| ID (Rev. 1) | Result (Rev. 1) | Evidence (Rev. 1) |
|---|---|---|
| R1-AC-1 | PASS | `mobile/src/shared/camera/` enthält `framePresets.ts`, `frameCropMath.ts`, `FramedCameraCapture.tsx`, `FramedImageEditor.tsx`, `FramedPhotoPicker.tsx`, `cropImageToFrame.ts` (zusätzlich `frameCropMath.test.ts`, `cropImageToFrame.test.ts`). |
| R1-AC-2 | PASS | `framePresets.ts`: `recipeHero` `1080 / 1015` ohne `maxEdge`; `nutritionLabel` `3 / 4`, `maxEdge` `2000`; `mealPhoto` `4 / 3`, `maxEdge` `1600`; `CROPPED_PHOTO_JPEG_QUALITY = 0.85`. KB-Tabelle stimmt überein. Kein eigener Test auf die Preset-Werte (siehe F-01, Preset-Wiring). |
| R1-AC-3 | PASS | `getCaptureFrame` in `frameCropMath.ts` (Breite = min(verfügbar, Höhe·Ratio), Höhe = Breite/Ratio, zentriert). `frameCropMath.test.ts` "builds a centered frame…" iteriert alle Presets bei `390 x 844`, Insets `24`/`34`, prüft Ratio auf `1e-8` und Lage innerhalb des Viewports; Test grün. |
| R1-AC-4 | PASS | `getPreviewSourceRect` (Cover-Skala `max(vw/pw, vh/ph)`, Offset-Korrektur, Clamping auf Fotogrenzen). Tests: Abbildung 3000x4000 auf 400x800 (x = (20+100)/0,2), "never returns a rectangle outside the photo", Round-Trip `getCropForSourceRect(getSourceRectForCrop(c))` auf `1e-8`, Zoom-1-Rechteck. Round-Trip zusätzlich analytisch nachvollzogen (Kamera-Direktpfad erzeugt immer Rechtecke mit Rahmen-Ratio und Zoom >= 1). Tests grün. |
| R1-AC-5 | PASS | `cropImageToFrame.ts`: `floor`/`round` auf ganzzahlige, bildinterne Werte, Resize nur wenn längste Kante > `maxEdge`, `manipulateAsync` mit `{ compress: 0.85, format: JPEG }`. `cropImageToFrame.test.ts` (gemocktes `expo-image-manipulator`): Rundung, Resize nur über Limit, Gesamtaufruf. Randfall und Deprecation siehe F-03 und F-02. |
| R1-AC-6 | PASS | `RecipeImageSourcePicker.tsx`: `preset="recipeHero"`, `output="metadata"`, `cameraReview="editor"`, Overlay `renderRecipeHeroOverlay` mit `Titel- und Tag-Zone`; `onImageSelected({uri,mime}, normalizeRecipeImageHeroCrop(crop))`. Bei `metadata` wird die Originaldatei durchgereicht (`finish` ruft kein `cropImageToFrame` auf). `recipeImageHeroCropMath.test.ts` und `recipeImageSource.test.ts` sind in `bce9fe6` unverändert; Rezept-Verzeichnis läuft grün (siehe Tests). Texte und Quellenblatt entsprechen dem Vorzustand (`git show bce9fe6^`). Geringfügige UI-Unterschiede siehe F-05. |
| R1-AC-7 | PASS | `LabelSubFlow.tsx`: Button `Foto hinzufügen`, `FramedPhotoPicker preset="nutritionLabel" output="cropped-file" cameraReview="direct"`. `AISubFlow.tsx`: Button `Foto hinzufügen`, `preset="mealPhoto" output="cropped-file" cameraReview="direct"`. `grep` nach `launchCameraAsync`, `openCamera`, `openPicker`, `ImageCropPicker`, `allowsEditing: true`, `requestCameraPermissionsAsync` in `mobile/**`: keine Treffer; einzige Bildquelle ist `launchImageLibraryAsync` mit `allowsEditing: false` in `FramedPhotoPicker.tsx`. Kein Test prüft das Preset-Wiring (F-01). |
| R1-AC-8 | PASS | Bei `cropped-file` führt jede Quelle (Kamera direkt, Kamera/Galerie über Editor) in `finish` durch `cropImageToFrame` und liefert `mime: 'image/jpeg'`. `LabelSubFlow.handlePhotoSelected` ruft `aiApi.scanLabel(uri, mime)`, `AISubFlow` übergibt `mealPhoto.uri/mimeType` an `aiApi.estimateMeal`. `maxEdge` 2000/1600 über Preset. Test `nutritionDiaryMutationCallers.test.tsx` "sends the photo selected in the shared frame flow to the label scan" bestätigt `scanLabel('/label.jpg','image/jpeg')`; für `estimateMeal` mit Foto fehlt ein Test (F-01). Um bis zu 1 px über `maxEdge` möglich (F-03). 4-MB-Limit siehe Risikobewertung. |
| R1-AC-9 | PASS | `FramedCameraCapture.tsx`: `Kamera wird vorbereitet…`, `Kein Kamerazugriff` mit `Erneut versuchen` und `Abbrechen` (Hinweis auf Geräteeinstellungen bei `canAskAgain === false`), Aufnahmefehler `Das Foto konnte nicht aufgenommen werden.` mit `Erneut versuchen`, Auslöser mit `capturing`-Sperre. `FramedPhotoPicker.tsx`: Galerie-Berechtigung verweigert und unlesbares Bild als deutsche Meldung im Quellenblatt; `handleClose` ruft nur `onClose` (kein Upload/API-Request); `finish` fängt Zuschnittsfehler, setzt auf Quellenblatt zurück und zeigt `Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.`; `busy`-Ref verhindert paralleles Zuschnitt-Auslösen. Nur durch Code-Review belegt, nicht durch Tests (F-01). |
| R1-AC-10 | PASS | `mobile/package.json` enthält `expo-image-manipulator` (`~58.0.16`) und weder `react-native-image-crop-picker` noch `react-native-vision-camera` (Diff `bce9fe6`). `git grep -n -e vision-camera -e image-crop-picker -- mobile` (ohne Lockfile): Exit 1, keine Treffer. Version `58.0.16` entspricht `npm view expo-image-manipulator version`. |
| R1-AC-11 | PASS | `mobile/src/modules/nutrition/AddItemModal.tsx` existiert nicht (`Test-Path` False); `git grep AddItemModal -- mobile`: keine Treffer. `BarcodeScannerScreen.tsx`: kein `Platform`-Import, kein `ios`-Zweig, kein `vision-camera`-Import; Suche (`foodApi.search`, Treffer-Matching `sourceRef.barcode`/`openFoodFacts:`), `not-found`/`error`/`loading`-Zustände, `onProductFound`/`onNoMatch`/`ProductEditor` unverändert (Diff `bce9fe6`). Cooldown liegt in `AndroidBarcodeScanner.tsx` (nur Kommentar geändert). Sichtbare UI-Änderung siehe F-05. |
| R1-AC-12 | PASS | `05-ux-patterns.md` Abschnitt "Camera and Photo Capture": Ablauf, Preset-Tabelle mit allen drei Presets und Werten wie AC-2, Pflichtzustände, Regeln für neue Kamera-Features (inkl. 4-MB-Hinweis). `03-mobile.md`: Abschnitt "Photo capture (shared)" mit Dateitabelle, Technologie-Entscheidung, Konsumenten; Recipe-Abschnitt angepasst; `AddItemModal`-Eintrag entfernt; Native-Konfiguration ergänzt. `docs/kb/README.md` Indexzeile angepasst. Texte, Strings und Preset-Werte stimmen mit dem Code überein. `git grep` in `docs/kb`: Treffer nur in bewusst negativen Aussagen (`05-ux-patterns.md` L470, `03-mobile.md` L414 und L591). |
| R1-AC-13 | PASS | `npx tsc --noEmit` (mobile): Exit 0. Mobile Vitest komplett: 108 Dateien / 1002 Tests grün (Stand des Commits). Test-Parity: Exit 0 (shared 10/466, backend 84/2710, mobile 108/1003; Minima 10/466, 84/2709, 108/1002). `npm run check:encoding`: Exit 0. Die Abweichung 1003 vs. 1002 stammt aus einer während des Reviews hinzugekommenen fremden Änderung (`mobile/src/services/health/nutritionSyncService.test.ts`) und betrifft die Kamera nicht. |
| R1-AC-14 | PASS | `docs/legal/` weder im Commit `bce9fe6` noch im Working Tree geändert (`git show --stat`, `git status`). `mobile/app.config.js` `expo-media-library.photosPermission`: "…um Rezeptbilder, Nährwert-Labels und Mahlzeitenfotos auszuwählen." Datenschutz-Review siehe Abschnitt "Datenschutz-Review". |

### Revision 1 – Tests

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

### Revision 1 – Risikobewertung (Plan Abschnitte 8 und 19)

- **`takePictureAsync`-Orientierung:** `FramedCameraCapture` ruft `takePictureAsync()` ohne `skipProcessing`; laut `expo-camera`-Typdokumentation (installiert, `58.0.14`) wird die Orientierung dann angepasst und `width`/`height` sind die Maße des gelieferten Fotos. Das stützt die Annahme. `getPreviewSourceRect` verwendet die Container-Layoutgröße als Viewport, die `CameraView` füllt denselben Container, Rahmen und Insets stammen aus derselben Quelle: konsistent. Ungültige oder fehlende Maße führen zum Aufnahmefehler statt zu einem falschen Zuschnitt. Praktische Bestätigung nur am Gerät (UNVERIFIED).
- **EXIF beim Zuschnitt:** Im Code nicht belegbar; hängt von `expo-image-manipulator` und React-Native-`Image.onLoad` (Dimensionen im Editor) ab. UNVERIFIED.
- **`maxEdge`:** Wirkt nur bei Überschreiten der längsten Kante, Skalierung über die Breite. Das Ergebnis kann durch Rundung um 1 px über `maxEdge` liegen (F-03).
- **4-MB-Backend-Limit** (`backend/src/functions/ai.ts`, `MAX_IMAGE_SIZE = 4 MB`, Prüfung auf `arrayBuffer.byteLength`): JPEG mit Qualität `0.85` und längster Kante `2000`/`1600` px liegt in üblichen Szenen deutlich darunter; besser als der Vorzustand (Kameradatei in voller Auflösung bzw. Qualität `0.7`). Eine exakte Größe ist nur am Gerät messbar. Backend, Endpunkte und Quoten sind unverändert (nur 2-Zeilen-Änderung durch den Technology-Refresh in `ai.ts`, nicht Teil dieses Scopes).
- **Rezeptfluss fachlich unverändert:** Vergleich mit `git diff bce9fe6^ bce9fe6`: gleiche Texte, gleiche Hero-Editor-Semantik (`normalizeRecipeImageHeroCrop`, `RECIPE_HERO_RENDERER_SAFE_AREA_TOP_RATIO`, Safe-Area-Hinweis), `getRecipeHeroFrame` delegiert an `getCaptureFrame` mit identischer Formel; `recipeImageHeroCropMath` re-exportiert die generische Geometrie. Bestehende Rezept-Tests unverändert und grün.
- **Frontend-Regelwerk** (`.github/instructions/mobile.instructions.md`): In `mobile/src/shared/camera/` keine Hex-/rgba-Farben, keine `fontSize`-Literale, kein `LayoutAnimation`, alle Farben/Abstände/Radien/Typografie aus `app/theme`; UI-Texte und `accessibilityLabel` sind deutsch; keine doppelten Komponenten (alter Kamera-Screen und Cropper wurden ersetzt, nicht dupliziert). Untokenisierte numerische Werte beschränken sich auf Layout-Konstanten (`borderWidth: 1`) und Opacity-Werte; keine neuen Farbwerte.
- **Azure-OpenAI-Checkliste** (`azure-openai-feature-integration`, QA-Teil): Es wurden weder `ai.ts`-Logik, `openai.ts`, Prompts, Schemas, Quoten noch Validierung geändert. Ausschließlich der Client-seitig gesendete Bildinhalt ändert sich (zugeschnittenes JPEG). Quoten-Reihenfolge, Structured Outputs, Plausibilitätsprüfung und Prompt-Eval sind nicht betroffen; Eval nicht erforderlich.

### Revision 1 – Datenschutz-Review (`privacy-impact-review`, Abschnitt 5)

- Plan enthält Privacy-Impact-Abschnitt (14): `Policy covered`. Bestätigt.
- Tatsächlicher Datenfluss im Code: Foto (Kamera/Galerie) → App-intern Zuschnitt und Verkleinerung (`cropImageToFrame`) → `aiApi.scanLabel` (`POST /ai/label-scan`) bzw. `aiApi.estimateMeal` (`POST /ai/meal-estimate/preview`); Rezeptfotos bleiben Originaldatei plus `heroCrop`-Metadaten wie zuvor. Keine neue Datenkategorie, kein neuer Empfänger, keine neue Speicherung, kein Logging von Bildinhalten, keine zusätzliche Kennung. Das gesendete Bild ist höchstens ein Ausschnitt in reduzierter Größe.
- Berechtigungen: keine neue Berechtigung. `expo-camera`-Plugin (`cameraPermission`, Mikrofon deaktiviert) und `expo-media-library`-Foto-Berechtigung nur textlich erweitert. Der `expo-camera`-Text nennt Barcode-Scanner, KI-Analyse und Rezeptfotos (Label und Mahlzeitenfoto fallen unter "KI-Analyse"); nicht Teil von AC-14.
- Policy `docs/legal/datenschutzerklaerung-alpha.md` Zeile 32 (Fotos an Azure OpenAI, Etikettenscan zusätzlich Azure Document Intelligence) und Zeile 33 bleiben zutreffend; `docs/legal/` unverändert.
- Nicht aus dem Repository verifizierbar: Lebensdauer temporärer Zuschnitt-Dateien im App-Cache (Annahme des Plans: OS-verwalteter Cache) und ob EXIF/GPS bei Re-Encoding entfernt wird. Als `UNVERIFIED` geführt; keine rechtliche Bewertung.

### Revision 1 – Verification Notes

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

### Revision 1 – Findings (Wortlaut der Vorrevision; aktueller Status siehe oben)

Finding (Rev. 1): F-01
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-7, AC-8, AC-9
Description: Das Verhalten der Komponenten `FramedPhotoPicker`, `FramedCameraCapture` und `FramedImageEditor` ist nicht durch automatisierte Tests abgesichert. Ungetestet sind: Zuschnittsfehler führt zurück zum Quellenblatt mit der Fehlermeldung, `busy`-Guard bei doppeltem Bestätigen, Abbrechen ohne `onSelected`, die Zustände "Kamera wird vorbereitet…"/"Kein Kamerazugriff"/Aufnahmefehler, das Wiring der Presets/`output`/`cameraReview` in `LabelSubFlow`, `AISubFlow` und `RecipeImageSourcePicker` sowie der Pfad Foto → `aiApi.estimateMeal`. `nutritionDiaryMutationCallers.test.tsx` mockt `FramedPhotoPicker` vollständig und prüft nur Foto → `scanLabel`. Die ACs 7-9 sind damit nur durch Code-Review belegt; ein Austausch eines Presets oder ein entfernter Guard würde keinen Test brechen.
Criticality: Non-blocking
Owner: Frontend
Evidence: `git grep "FramedPhotoPicker|FramedCameraCapture|FramedImageEditor" -- "mobile/**/*.test.*"` liefert nur den Mock in `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx`; `mobile/src/shared/camera/` enthält nur `frameCropMath.test.ts` und `cropImageToFrame.test.ts`; `AISubFlow` wird im Callers-Test nur ohne Foto ausgeführt ("saves the AISubFlow estimate…"). Der Plan (Abschnitt 17) verlangt diese Tests nicht ausdrücklich, die Logik in `finish`/Guard/Fehlerpfad ist jedoch Geschäfts-/Ablauflogik im Sinne von `docs/kb/tech/08-testing.md`.
Recommendation: Tests für `FramedPhotoPicker` ergänzen (gemocktes `cropImageToFrame`, `ImagePicker`, Kamera/Editor): Fehlerpfad, Guard, `metadata` vs. `cropped-file`, `direct` vs. `editor`; ein Test pro Konsument für Preset-Wiring; ein Test für Foto → `estimateMeal(text, uri, 'image/jpeg')`.

Finding (Rev. 1): F-02
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-5
Description: `cropImageToFrame.ts` verwendet `manipulateAsync`, das in der installierten `expo-image-manipulator@58.0.16` als `@deprecated` markiert ist (Ersatz: `ImageManipulator.manipulate` / `useImageManipulator`). Eine neu eingeführte Abhängigkeit startet damit mit einer veralteten API.
Criticality: Suggestion
Owner: Frontend
Evidence: `node_modules/expo-image-manipulator/build/ImageManipulator.d.ts` (JSDoc `@deprecated` an `manipulateAsync`); Verwendung in `mobile/src/shared/camera/cropImageToFrame.ts`; Mock in `mobile/src/shared/camera/cropImageToFrame.test.ts`.
Recommendation: Auf die kontextbasierte API umstellen und den Test (Mock) anpassen; Verhalten (Crop, Resize, JPEG `0.85`) gleich halten.

Finding (Rev. 1): F-03
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-5, AC-8
Description: `getCropActions` skaliert über die Breite (`resizeWidth = round(width * maxEdge / längsteKante)`). Bei Hochformat-Zuschnitten (Preset `nutritionLabel`) kann die resultierende Höhe durch Rundung `maxEdge` um bis zu 1 px überschreiten, z. B. Rechteck 1000 x 2001 bei `maxEdge` 2000 ergibt `resizeWidth` 1000 und damit Höhe 2001 (per `node` nachgerechnet). Die Tests decken nur Querformat (4000 x 3000) ab. Praktisch irrelevant für OCR und Größenlimit, aber formal gegen "höchstens 2000 px".
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/shared/camera/cropImageToFrame.ts` (`getCropActions`), `mobile/src/shared/camera/cropImageToFrame.test.ts`; Nachrechnung `node -e` Ergebnis `1000 2001`.
Recommendation: Bei Hochformat über `height` skalieren (oder die Ergebnisgröße clampen) und einen Hochformat-Testfall ergänzen.

Finding (Rev. 1): F-04
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-9
Description: `FramedPhotoPicker` übergibt `mediaTypes: ImagePicker.MediaTypeOptions.Images`; `MediaTypeOptions` ist in der installierten `expo-image-picker@58.0.10` als `@deprecated` markiert (Ersatz: `['images']`). Der Wert stammt aus dem alten Rezept-Picker, wurde aber in die neue gemeinsame Schicht übernommen.
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/shared/camera/FramedPhotoPicker.tsx` (`launchImageLibraryAsync`), `node_modules/expo-image-picker/build/ImagePicker.types.d.ts` (`@deprecated` an `MediaTypeOptions`); `tsc` meldet keinen Fehler.
Recommendation: `mediaTypes: ['images']` verwenden.

Finding (Rev. 1): F-05
Plan reference: `docs/User Stories/plans/PLAN_Einheitlicher-Kamera-Flow.md`
Acceptance criterion: AC-6, AC-11
Description: Zwei sichtbare, kleine UI-Abweichungen zum Vorzustand, die der Plan als "fachlich unverändert" bzw. "Scan-Logik unverändert" nicht erwähnt: (a) `BarcodeScannerScreen` zeigt den Hinweis `Barcode im Rahmen positionieren` nun auf Android, solange keine Berechtigung verweigert wurde (Bedingung vorher `nativeAvailable && cameraPermission === 'granted'`, auf Android nie erfüllt, da `ios`-Pfad). (b) Das Quellenblatt des Rezeptfotos hatte bei Galerie-Fehlern die Aktion `Galerie erneut versuchen`; `FramedPhotoPicker` zeigt nur noch die Fehlermeldung (erneutes Tippen auf `Galerie` ist weiterhin möglich).
Criticality: Suggestion
Owner: Frontend
Evidence: `git show bce9fe6 -- mobile/src/modules/scanner/BarcodeScannerScreen.tsx` (Bottom-Hint-Bedingung), `git show bce9fe6^:mobile/src/modules/recipes/RecipeImageSourcePicker.tsx` (`accessibilityLabel="Galerie erneut versuchen"`) gegenüber `mobile/src/shared/camera/FramedPhotoPicker.tsx`. Scan-Logik (Suche, Cooldown, Zustände) unverändert.
Recommendation: Product Owner entscheidet, ob der Barcode-Hinweis auf Android gewollt ist und ob die Galerie-Retry-Aktion erhalten bleiben soll; andernfalls im Plan als bewusste Änderung dokumentieren.

### Revision 1 – Zusammenfassung (Verdict Rev. 1: PASS WITH ISSUES)

Blocking: 0 · Non-blocking: 1 (F-01) · Suggestion: 4 (F-02 bis F-05). Alle Acceptance Criteria AC-1 bis AC-14 sind nach Code-Review und ausgeführten Checks erfüllt; die offenen Punkte betreffen Testabdeckung der Komponenten, veraltete API-Nutzung und Mikro-UI-Abweichungen. Gerätethemen sind als `UNVERIFIED` geführt. Prozessabweichung (Plan nicht freigegeben, Umsetzung ohne Agentenlauf, bereits in `bce9fe6` committet) bleibt beim Product Owner (PO-1).
