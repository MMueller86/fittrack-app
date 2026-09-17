# Technischer Plan: FitTrack Instagram Recipe Renderer — PoC

**Status:** Revidiert und gesperrt — B-1.1 teilweise ausgeführt, aber wegen des blockierten Registry-Smoke-Tests nicht abgeschlossen; erneute explizite `APPROVE`-Freigabe vor Fortsetzung erforderlich
**User Story:** None — der PoC-Auftrag liegt ausschließlich als externe Spezifikation "FitTrack – Instagram Recipe Renderer PoC — Technische Spezifikation V1 / Golden-Master-Gate" vor.
**Infrastructure Impact:** None
**Mobile Build Impact:** None

**Execution Gate:** Die vorherige Ausführungsfreigabe ist durch diese Planrevision ungültig. Der Plan gilt bis zu einer erneuten expliziten Nutzerfreigabe mit `APPROVE` nicht als frei ausführbar; der Orchestrator darf bis dahin keinen weiteren Subtask dispatchen. **PO-1** ist in dieser Fassung aufgelöst: `Pasta` verwendet bei `@tabler/icons@3.46.0` den package-relativen Resolve-/Importpfad `@tabler/icons/outline/bowl.svg` (physischer Paketpfad: `icons/outline/bowl.svg`). Für jede verwendete Tabler-Zuordnung gilt dieselbe Regel: `@tabler/icons/outline/<name>.svg` ist der Exportspecifier, `icons/outline/<name>.svg` der physische Paketpfad; der physische `icons/`-Teil darf nicht doppelt im Specifier erscheinen. Eine weitere PO-Rückfrage zur Icon-Auswahl ist nicht erforderlich.

Mangels User-Story wird der Plan nach dem dokumentierten Fallback unter `docs/User Stories/plans/` abgelegt. Diese Planungsrunde ändert keinen Produktionscode, keine Tests und keine Knowledge-Base-Datei. Sie liefert den technischen Plan für die anschließende Implementierung des Renderers als **importierbare Backend-Library** unter `backend/src/lib/instagramRenderer/`.

Nach erneuter Nutzerfreigabe wird der Renderer nicht als isoliertes `tools/`-Projekt aufgebaut, sondern direkt am produktiven Zielort im Backend. Das vermeidet Doppelaufwände und lässt den Zufriedenheitscheck des Nutzers **vor** allen weiteren Investitionen (Function-Endpoint, Auth, Storage-Integration) stattfinden.

### Revisionsstatus

- B-1.1 wurde teilweise ausgeführt und ist wegen des blockierten Registry-Smoke-Tests nicht abgeschlossen.
- Der angehaltene B-1.1-Lauf hat bereits `backend/package.json`, `backend/.gitignore`, `backend/src/lib/instagramRenderer/types.ts`, `backend/src/lib/instagramRenderer/layout.ts`, `backend/src/lib/instagramRenderer/tagIcons.ts` und `backend/src/lib/instagramRenderer/index.ts` angelegt oder angepasst. Die fünf Dependency-Versionen und das Script `render:instagram-reference` sind verifiziert; Typecheck und Backend-Build waren erfolgreich.
- Der Registry-Smoke-Test ist wegen eines im bisherigen Task Package unvollständig korrigierten Tabler-Specifiers blockiert: `Pasta -> bowl` wurde berücksichtigt, die bereits bestehende `Sauerteig -> bread`-Zuordnung verwendet aber weiterhin fälschlich `@tabler/icons/icons/outline/bread.svg`. B-1.1 wird nach der Korrektur aller verwendeten Tabler-Exportspecifier fortgesetzt: korrekte Dependencies und Dateien werden nicht unnötig erneut geändert; lokale Resolve-Prüfung für jedes Tabler-Asset, Registry-Smoke-Test und Mapping-Konsistenz sind noch erfolgreich abzuschließen.
- `handoff_store` enthält keinen vollständig abgeschlossenen B-1.1-Handoff; kein Subtask gilt als abgeschlossen.
- Die frühere Nutzerfreigabe gilt für diese revidierte Fassung nicht weiter. Der Orchestrator muss vor der Fortsetzung erneut explizit `APPROVE` für diese Fassung einholen.

Bereits vor diesem Plan durchgeführte Vorbereitungen (Referenzen im weiteren Text):

- Ordner-Struktur, Asset-Migration und Fonts unter [`backend/src/lib/instagramRenderer/`](../../../backend/src/lib/instagramRenderer/)
- Golden Master (V1.7, 1080×1350 px, 24-Bit RGB) unter [`backend/src/lib/instagramRenderer/test-fixtures/golden/`](../../../backend/src/lib/instagramRenderer/test-fixtures/golden/)
- Golden Sampling und Spec-vs-Golden-Deltas unter [`backend/src/lib/instagramRenderer/docs/golden-metrics.md`](../../../backend/src/lib/instagramRenderer/docs/golden-metrics.md)
- Tag-Icon-Mapping unter [`backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`](../../../backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md)

## 1. Requirement Assessment

**Klassifikation:** Accept with modifications — die Renderer-Library-first-Architektur und der visuelle Abnahme-Gate bleiben unverändert; die fehlende exakte Pasta-/Nudel-Datei wird mit dem semantisch nächstliegenden vorhandenen Food-Icon `bowl.svg` abgebildet.

### Nutzerproblem und Lösungsfit

Für die spätere App-Integration eines Rezept-Share-Features nach Instagram muss deterministisch nachgewiesen werden, dass FitTrack aus strukturierten Rezeptdaten, einem Rezeptfoto und festen Design-Assets ein visuell konsistentes 1080 × 1350 px PNG erzeugen kann. Vor jeder App-, Kamera-, Share-, Function- oder UI-Arbeit wird der Renderer als reine Bibliothek gebaut und gegen einen Golden Master abgesichert. Diese Trennung "Renderer-Library zuerst, Function und App-Integration danach" ist explizit vom PO bestätigt: sie reduziert Kopplungsrisiko, macht deterministische Golden-Tests direkt vor Ort möglich und lässt die Zufriedenheitsbeurteilung des Nutzers stattfinden, bevor Auth/Storage/HTTP-Investitionen anfallen.

### Domain- und Produktausrichtung

- Der PoC berührt keine FitTrack-Domain-Regeln (Nutrition, Weight, Goals, AI). Er verwendet Nährwert-Zahlen und Tags rein visuell, ohne fachliche Ableitung.
- Der PoC berührt keine dokumentierten AI-Features. Es wird ausdrücklich **keine** generative KI im Renderpfad verwendet.
- Der PoC berührt keine Cosmos-Persistenz. Es werden keine Container, Schemas oder Felder verändert.
- Der PoC berührt keine Azure-Function-Endpoints, keine Auth, keine Health-Connect- oder Storage-Pfade. Er ist reine Library.
- Nährwert-Badges (`HIGH PROTEIN`, `LOW FAT`) werden **nicht** aus fachlichen Schwellwerten abgeleitet, sondern vom Aufrufer als expliziter Input-Wert (`nutritionHighlight`) übergeben. Die Schwellwert-Logik ist explizit Post-PoC-Arbeit.

### Resolved Product Owner Decisions

**[Resolved] PO-1 — Pasta-Tag-Icon:** Der Nutzer hat die Auswahl ausdrücklich delegiert. `Pasta` verwendet als semantisch nächstliegende vorhandene Food-Darstellung das Tabler-Outline-Icon `bowl.svg` aus `@tabler/icons@3.46.0`. Der exakte package-relative Resolve-/Importpfad lautet `@tabler/icons/outline/bowl.svg`; die physische Datei im Paket liegt unter `icons/outline/bowl.svg`. Das Paket-Exportmapping leitet den package-relativen Unterpfad über `./*` auf `./icons/*` weiter. Physischer Paketpfad und package-exportierter Resolve-/Importpfad können deshalb verschieden aussehen; Backend muss den Exportspecifier verwenden und darf den physischen `icons/`-Teil nicht ein zweites Mal in den Specifier aufnehmen.

Diese Produktentscheidung begrenzt die technische Pfadkorrektur nicht auf `Pasta`: Alle im Mapping verwendeten Tabler-Ausnahmen müssen nach demselben Muster aufgelöst werden. Die geprüfte Liste ist `Sauerteig -> bread`: `@tabler/icons/outline/bread.svg` → physisch `icons/outline/bread.svg`, sowie `Pasta -> bowl`: `@tabler/icons/outline/bowl.svg` → physisch `icons/outline/bowl.svg`. Kein verwendeter Tabler-Exportspecifier darf `@tabler/icons/icons/outline/...` enthalten.

Die Abwägung ist bewusst knapp und sichtbar: Ein exaktes Pasta-/Nudel-Icon ist in den geprüften Ständen nicht vorhanden. `soup.svg` ist wegen der Dampf-/Suppendarstellung fachlich enger und dadurch irreführender; `cooking-pot.svg` ist in Tabler nicht vorhanden und Lucides Variante beschreibt eher den Kochvorgang. `bowl.svg` ist eine neutrale, unmittelbar erkennbare Food-/Servierdarstellung und bleibt näher an Pasta als ein generisches Werkzeug- oder Textsymbol.

Die read-only Verifikation vom 2026-09-15 bestätigt bei `@tabler/icons@3.46.0` das Exportmapping `./* -> ./icons/*`, die physischen Dateien `icons/outline/bread.svg` und `icons/outline/bowl.svg` sowie gültige SVG-Assets. Im aktuellen Workspace lösen `require.resolve('@tabler/icons/outline/bread.svg')` und `require.resolve('@tabler/icons/outline/bowl.svg')` erfolgreich auf diese physischen Dateien auf; die Varianten `@tabler/icons/icons/outline/bread.svg` und `@tabler/icons/icons/outline/bowl.svg` schlagen jeweils mit `MODULE_NOT_FOUND` fehl. Die Pfade für `noodles` und `pasta` waren in den geprüften Bibliotheken nicht vorhanden. Diese lokale Prüfung bestätigt die notwendige Korrektur, ersetzt aber nicht den noch offenen B-1.1-Registry-Smoke-Test nach der Planrevision.

Eine zusätzliche Icon-Bibliothek, ein handgezeichnetes Ersatz-SVG oder eine andere Dependency-Version ist nicht Bestandteil dieses Plans. B-1.1 synchronisiert die bestehende Mapping-Referenz, Registry, Compose-Schicht und QA-Abdeckung auf genau diese Entscheidung. Die übrigen bereits bekannten offenen Punkte (Badge-Schwellwerte, weitere Badge-Kategorien, Kamera-Führung, Share-UI, PNG-Export in der App, Function-Endpoint) bleiben bewusst Out-of-Scope dieses Plans und werden erst nach erfolgreichem PoC in separaten Planungsrunden entschieden.

## 2. Feature Summary

Renderer als importierbare Node-TypeScript-Library unter `backend/src/lib/instagramRenderer/`, die aus einem typisierten Render-Input deterministisch ein 1080 × 1350 px PNG erzeugt. Der Renderer verwendet ausschließlich lokale, deterministische Ressourcen: die bereits migrierten Design-Assets, Inter/Inter-Display-Fontdateien, Tag-Icon-Bibliotheken (Lucide + Tabler) in gepinnter Version, das Referenzfoto und den Golden Master.

Ein Vitest-Golden-Image-Test vergleicht das Rendering pixelweise gegen den Golden Master und schreibt bei Abweichungen ein Diff-Bild. Zusätzlich ermöglicht ein kleines Node-Skript `backend/scripts/render-golden.mjs` das lokale Erzeugen eines `output/quarkbroetchen.png` für die visuelle Freigabe durch den Nutzer. Die Tabler-Icon-Darstellungen verwenden die geprüften package-relativen Exportspecifier `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg`; ein nicht vorhandenes `noodles`- oder `pasta`-Asset darf nicht importiert oder still ersetzt werden.

**Nicht Bestandteil dieses Plans:** Azure-Function-Endpoint, Auth, Quota, Storage-Foto-Ladung, Recipe-ID-basierter Aufruf, Mobile-Integration. Diese Arbeit folgt separat nach visueller Abnahme des PoC-Ergebnisses durch den Nutzer.

## 3. Current Behaviour

### Bereits im Workspace vorhanden

- [`backend/src/lib/instagramRenderer/assets/`](../../../backend/src/lib/instagramRenderer/assets/): alle Design-Assets in finaler Struktur (`branding/`, `nutrition/`, `nutrition-highlights/`, `fonts/`). Fonts sind Inter 4.0 aus rsms/inter (OFL, siehe `LICENSE.txt`).
- [`backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png`](../../../backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png): Referenzfoto (aus JPG konvertiert).
- [`backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`](../../../backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png): Golden Master V1.7, 1080 × 1350 px, 24-Bit RGB.
- [`backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`](../../../backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md): aktuelle Tag → Icon-Referenz mit den Tabler-Ausnahmen `Sauerteig -> bread` und `Pasta -> bowl`; der im angehaltenen B-1.1-Lauf bereits auf `bowl` synchronisierte `Pasta`-Eintrag muss zusammen mit `Sauerteig -> bread` im Backend-Handoff mit den package-relativen Pfaden `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg` konsistent gehalten und verifiziert werden.
- [`backend/src/lib/instagramRenderer/docs/golden-metrics.md`](../../../backend/src/lib/instagramRenderer/docs/golden-metrics.md): extrahierte Referenzmetriken aus dem Golden Master und dokumentierte Deltas zur Spec.
- Backend-Package hat bereits `vitest ^2.1.9`, `typescript ^5.8.0` und `sharp ^0.34.5` als Dependencies — diese werden vom Renderer bzw. den Tests wiederverwendet.

### Noch nicht im Workspace vorhanden

- Kein vollständiger Renderer-Code (`src/render.ts`, `src/compose.ts`, `src/photo.ts`, `src/ambient.ts`, `src/transition.ts`). `types.ts`, `layout.ts`, `tagIcons.ts` und `index.ts` wurden im teilweise ausgeführten B-1.1-Lauf bereits angelegt oder angepasst.
- Keine Fixture-Definitionen als TypeScript-Modul.
- Kein `render-golden.mjs`-Skript unter `backend/scripts/`.
- Keine Golden-Image- oder Fehler-Path-Tests.
- `backend/package.json` enthält durch den teilweise ausgeführten B-1.1-Lauf bereits die neuen Runtime-Dependencies `satori`, `@resvg/resvg-js`, `lucide-static`, `@tabler/icons`, die Test-Dev-Dependency `pixelmatch` sowie das Script `render:instagram-reference`; diese korrekten Einträge werden nicht unnötig neu erstellt.
- `backend/.gitignore` ist durch den teilweise ausgeführten B-1.1-Lauf bereits vorhanden. Der Root-`.gitignore` ignoriert die beiden Renderer-Ausgabepfade nicht spezifisch; B-1.1 verifiziert deshalb die scoped Ignore-Datei und ändert den Root-Ignore nicht.
- Die Mapping-Referenz ist durch den angehaltenen B-1.1-Lauf bereits auf `Pasta -> bowl` (Tabler) synchronisiert. Der Plan legt zusätzlich die Korrektur für `Sauerteig -> bread` fest: package-relativ `@tabler/icons/outline/bread.svg`, physisch `icons/outline/bread.svg`; für `Pasta` gilt entsprechend package-relativ `@tabler/icons/outline/bowl.svg`, physisch `icons/outline/bowl.svg`.

### Bereits korrekte oder absichtlich unveränderte Pfade

- `mobile/assets/brand/fittrack_wordmark_v1.png` bleibt Single Source of Truth für die Brand-Wortmarke. Die im Renderer-Modul liegende Kopie ist eine bewusste Ausnahme für den PoC-Determinismus.
- Der PoC führt keine Änderungen an `mobile/`, `shared/` oder `infra/` durch.
- Bestehende Backend-Module (Handler, Repositories, Lib) bleiben unangetastet.

## 4. Desired Behaviour

- Eine importierbare Node-Library `renderInstagramRecipe(input): Promise<RenderResult>` in `backend/src/lib/instagramRenderer/`, aufrufbar aus jedem Backend-Modul und aus Tests, ohne HTTP-Layer oder Auth.
- Determinismus: identischer Input führt bit-genau zum selben Ergebnis auf derselben Maschine, robust gegen leichte Anti-Aliasing-Schwankungen im Test-Vergleich.
- Ausgabe strikt 1080 × 1350 px (4:5), PNG, sRGB.
- Der Renderer nutzt **Satori** zur JSX-zu-SVG-Umwandlung und **@resvg/resvg-js** zur SVG-zu-PNG-Rasterisierung — beide explizit vom PO freigegeben. Kein Screenshot einer UI-Ebene.
- Ausschließlich lokale Fonts und lokale Icon-SVG-Quellen zur Renderzeit. Keine Netzwerk-Abhängigkeit.
- `backend/scripts/render-golden.mjs` erzeugt reproduzierbar `backend/output/quarkbroetchen.png` für die visuelle Freigabe durch den Nutzer.
- Ein automatisierter Golden-Image-Test in Vitest dekodiert das gerenderte PNG, vergleicht Pixel gegen den Golden Master mit einer definierten und begründeten Toleranz und schreibt bei Abweichung ein Diff-Bild.
- Ein zweites, minimales Smoke-Fixture (kein Golden-Test) beweist, dass der Renderer nicht auf Quarkbrötchen hart codiert ist.
- Die Tabler-Zuordnungen entsprechen exakt der geprüften Registry: `Sauerteig -> bread.svg` über `@tabler/icons/outline/bread.svg` und `Pasta -> bowl.svg` über `@tabler/icons/outline/bowl.svg`, jeweils physisch unter `icons/outline/<name>.svg`. `bowl.svg` bleibt die semantisch nächstliegende vorhandene Food-Darstellung für Pasta; keine weitere implizite Ersatzzuordnung.
- **Der Nutzer erhält am Ende des PoC ein PNG, das er visuell abnehmen oder ablehnen kann.** Dies ist eine explizite Bedingung für den PoC-Abschluss und wird durch das `render-golden.mjs`-Skript und ggf. das Diff-Bild bereitgestellt.

## 5. Scope

- Ergänzung von `backend/package.json` um Runtime-Dependencies `satori`, `@resvg/resvg-js`, `lucide-static`, `@tabler/icons` und Dev-Dependency `pixelmatch`. Versionspinning mit `~`-Präfix.
- Aufbau des Renderer-Moduls unter `backend/src/lib/instagramRenderer/`:
  - Typ-Definitionen (`RenderInput`, `RenderResult`, `RenderError`) inkl. Validierung.
  - Zentrale Layout-Konstanten aus Spec + `golden-metrics.md`.
  - Tag-Icon-Registry auf Basis von `tag-icon-mapping.md`, mit statisch importierten SVG-Strings aus `lucide-static` und `@tabler/icons`.
  - Foto-Compositor (Crop, Zoom, Focus-Point, Cover-Verhalten).
  - Foto-→-Dark-Transition mit smootherstep-Alpha-Verlauf.
  - Green-Ambient-Field als reproduzierbare Radial-Gradient-Funktion, inklusive Sonderzone für den Wortmarken-Hintergrund.
  - Nutrition Highlight Badge (Position, Größe) mit Support für `"high-protein"`, `"low-fat"`, `null`.
  - Rezepttitel als einzeiliger Text mit Overflow-Validierung.
  - Tag-Zeile mit maximal 4 Chips, horizontaler Overflow-Validierung, Icon-Auflösung und Fallback (Text-only).
  - Nutrition Card mit Hantel-Divider, `PRO PORTION`-Label und vier gerundeten Nährwert-Spalten inkl. Dividern.
  - FitTrack-Wortmarke im Footer inkl. lokalem BG-Match.
- Renderer-Fehlerbehandlung mit `Result<T, RenderError>` für erwartbare Fehler; unerwartete technische Fehler werden am Renderer-Rand in `RenderError` übersetzt.
- `backend/scripts/render-golden.mjs` als Node-Skript für lokale Renderer-Aufrufe und Ausgabe nach `backend/output/`.
- npm-Skript `render:instagram-reference` in `backend/package.json`, das das Node-Skript startet.
- Golden-Image-Test als Vitest-Test unter `backend/src/lib/instagramRenderer/__tests__/golden.test.ts` mit Pixel-Vergleich, Toleranz-Konstanten und Diff-Bild-Output.
- Fehler-Path-, Tag-Zeile- und Highlight-Tests als weitere Vitest-Tests unter demselben Ordner.
- Smoke-Fixture ohne Golden-Test.
- Anlage von `backend/.gitignore` als neue Datei, falls sie weiterhin nicht existiert, mit `output/` und `src/lib/instagramRenderer/__tests__/output/`. Der Root-`.gitignore` wird dafür nicht als Ersatz geändert.
- Fortsetzung von B-1.1 mit Prüfung und Korrektur aller verwendeten Tabler-Exportspecifier: `@tabler/icons/outline/bread.svg` für `Sauerteig` und `@tabler/icons/outline/bowl.svg` für `Pasta`; physisch bleiben dies `icons/outline/bread.svg` bzw. `icons/outline/bowl.svg`. Bis zum erfolgreichen lokalen Resolve jedes Tabler-Assets und Registry-Smoke-Test keine abweichende Datei, Bibliothek oder handgezeichnete Ersatzgrafik verwenden. Bereits korrekte Dependencies und Dateien werden dabei nicht unnötig erneut geändert.

## 6. Out of Scope

- **Kein Azure-Function-Endpoint** in diesem PoC. Weder `render...`-Handler noch Registrierung in `backend/src/index.ts` oder `backend/host.json`. Dieser Schritt folgt separat nach visueller Abnahme.
- **Kein Auth-, Quota- oder Rate-Limiting-Setup.**
- **Kein Rezeptfoto-Load aus Cosmos oder Storage.** Der Renderer erhält Fotos als Dateipfad oder Buffer, nicht per Recipe-ID.
- **Kein Deployment.** Der PoC wird weder ins Dev- noch ins Alpha-Environment deployt.
- Keine Mobile-Änderungen: keine React-Native-Screens, Navigation, Services, Stores, Native-Share-Integration.
- Kein Kamera-Dialog, kein Crop-Editor, kein Bilder-Picker, keine Tag-Auswahl-UI, kein Nährwert-Editor.
- Keine Nährwert-Schwellwert-Logik (`HIGH PROTEIN` / `LOW FAT` Auslöser-Berechnung). `nutritionHighlight` ist Input, keine Ableitung.
- Keine Internationalisierung. `PRO PORTION`, `Kalorien`, `Protein`, `Kohlenhydrate`, `Fett` sind fest deutsch.
- Keine transparente Wortmarken-Version. Der PoC verwendet die vorhandene Raster-Wortmarke mit lokalem BG-Match.
- Keine Cosmos-Änderungen, keine Bicep-Änderungen, keine Function-App-Konfiguration.
- Keine Änderung an bestehenden Backend-Handlern oder Backend-Test-Infrastruktur außerhalb von `backend/src/lib/instagramRenderer/`, `backend/scripts/render-golden.mjs` und dem Hinzufügen von Deps in `backend/package.json`.
- Keine Änderung an bestehender Knowledge-Base-Dokumentation.
- Keine Anpassung des `mobile/assets/brand/`-Ordners.

## 7. Confirmed Facts

- Repository ist ein TypeScript-Monorepo mit Packages `backend`, `mobile`, `shared`.
- `backend/package.json` deklariert bereits `vitest ^2.1.9`, `typescript ^5.8.0` und `sharp ^0.34.5`. Diese decken das Test-Framework, den TypeScript-Compiler und PNG-Dekodierung im Test ab. Keine Ergänzung nötig.
- Der Root-`.gitignore` existiert, aber `backend/.gitignore` nicht. Die beiden Renderer-Ausgabepfade sind im Root-`.gitignore` nicht spezifisch ausgeschlossen; die planmäßige Lösung ist die Neuanlage von `backend/.gitignore` durch Backend.
- Backend-Tests laufen mit `npm test` (`vitest run`) im Backend-Ordner. Dieselbe Kommandokette wird für die neuen Tests verwendet.
- Es existieren keine Inter- oder Inter-Display-Fontdateien außerhalb des Renderer-Modulordners. Die drei benötigten `.ttf` sind unter `backend/src/lib/instagramRenderer/assets/fonts/` bereits vorhanden, jeweils ~400 KB, inkl. OFL `LICENSE.txt`.
- Golden Master und Fixture-Foto liegen in finaler Form und Namenskonvention vor.
- Der Golden Master weicht in nachweisbarer Form von einigen Spec-Referenzwerten ab (Badge-Größe, Transition-Zone, Wortmarken-Größe). Diese Deltas sind in `docs/golden-metrics.md` Sektion 11 dokumentiert. PO-Entscheidung: V1.7 bleibt Referenz, isolierte Feinjustierungen sind erlaubt, wenn die Gesamtwirkung besser bleibt.
- Der PO hat `nutritionHighlight`-Werte als Input, nicht als Ableitung, festgelegt.
- Der PO hat `Snacks` (Plural) als Fixture-Wert bestätigt, weil der Golden Master genau diesen Text zeigt.
- Der PO hat `250 kcal / 14 g / 31 g / 8 g` als Demo-Werte bestätigt — nicht als echte Werte des Alpha-Rezepts "Kernige Quarkbrötchen".
- Der PO hat `Result<T, RenderError>` als bevorzugtes Fehlerformat für erwartbare Fehler bestätigt; interne Exceptions dürfen am Renderer-Rand in `RenderError` übersetzt werden.
- Der PO hat ein zweites minimales Smoke-Fixture (2 Tags + `nutritionHighlight: null`) als sinnvoll bestätigt.
- Der PO hat 0 Tags als erlaubt bestätigt: keine Fehlerbehandlung, Tag-Zeile wird nicht gerendert, restliches Layout bleibt in seinen festen Positionen.
- Der PO hat als Ziel-Architektur nach PoC-Abnahme eine Azure Function im Backend bestätigt. Der Renderer wird deshalb direkt am Zielort als importierbare Library aufgebaut, um Doppelaufwand bei einer späteren Migration zu vermeiden.
- Der PO verlangt ausdrücklich, dass am Ende des PoC ein visuell abnehmbares PNG-Ergebnis vorliegt.
- `npm view` hat am 2026-09-15 folgende aktuelle Stable-Versionen bestätigt: `satori@0.33.4`, `@resvg/resvg-js@2.6.2`, `lucide-static@1.46.0`, `@tabler/icons@3.46.0` und `pixelmatch@7.2.0`.
- In `@tabler/icons@3.46.0` existieren die physischen Dateien `icons/outline/bread.svg` und `icons/outline/bowl.svg` neben `salad.svg` und `soup.svg`; `icons/outline/noodles.svg` und `icons/outline/pasta.svg` existieren nicht. Das Paket exportiert über `./* -> ./icons/*`; deshalb lösen `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg` auf die physischen Dateien auf, während ein doppeltes `@tabler/icons/icons/outline/...` ungültig ist. In `lucide-static@1.46.0` existieren ebenfalls keine `noodles`- oder `pasta`-Dateien. `bowl.svg` ist deshalb die festgelegte semantische Annäherung.
- Der aktuelle Registry-Code verwendet für `Sauerteig -> bread` und `Pasta -> bowl` noch die ungültigen Doppel-`icons`-Specifier. Der Registry-Smoke-Test scheitert deshalb bereits beim Laden der bestehenden Sauerteig-Zuordnung, bevor die Bowl-Zuordnung geprüft wird; B-1.1 muss beide Einträge auf die package-relativen Exportspecifier korrigieren.

## 8. Assumptions and Open Questions

- **Node-Version:** Der Renderer erwartet Node 20 LTS. Das ist die im Root-`package.json` deklarierte Mindestversion (`>=20.0.0`) und entspricht der Backend-Dokumentation.
- **`resvg-js` Determinismus:** `@resvg/resvg-js` verwendet native Bindings, die je Plattform leicht unterschiedliches Anti-Aliasing produzieren können. Der PoC wird auf der Entwickler-Maschine (Windows) verifiziert. CI-Läufe sind kein Bestandteil des PoC.
- **Font-Fallback:** Satori benötigt für jede verwendete Font-Familie eine explizit geladene Fontdatei. Wir gehen davon aus, dass `Inter-Medium.ttf`, `Inter-SemiBold.ttf` und `InterDisplay-Bold.ttf` genügen und keine Emoji-, CJK- oder Symbol-Zeichen im Fixture auftreten.
- **Icon-Pinning:** `lucide-static@1.46.0` und `@tabler/icons@3.46.0` liefern SVG-Strings, die sich zwischen Minor-Versionen ändern können. Der Renderer verwendet `~`-Pinning auf diese verifizierten Stable-Versionen. Für jede Tabler-Zuordnung sind ausschließlich die package-relativen Exportspecifier `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg` zulässig; die physischen Pfade `icons/outline/bread.svg` und `icons/outline/bowl.svg` dürfen nicht als zusätzlicher `icons/`-Unterpfad in den Specifier eingesetzt werden. `noodles` und `pasta` dürfen nicht als Assets importiert werden.
- **Tabler-Mapping:** `resolveTagIcon("sauerteig")` und `resolveTagIcon("pasta")` verwenden nach erfolgreichem Dependency-Resolve die normalisierten SVG-Strings aus `@tabler/icons/outline/bread.svg` bzw. `@tabler/icons/outline/bowl.svg`. Bei einem fehlenden oder nicht auflösbaren Asset gilt `MISSING_ASSET`; es gibt keinen stillen Text- oder Bibliothekswechsel für diese bekannten Tabler-Einträge.
- **Green-Ambient-Funktion:** Die aus dem Golden abgeleitete Radial-Gradient-Definition (siehe `docs/golden-metrics.md` 11.7) ist eine Näherung. Der Renderer kann geringfügig davon abweichen, solange die Gesamtwirkung dem Golden entspricht.
- **Foto-Kompression:** Das Fixture-Foto ist ein aus JPG konvertiertes PNG mit ca. 20 MB. Für den PoC wird keine Vorab-Optimierung gemacht. Falls das Rendering zu langsam wird, kann das Fixture in einem Follow-up reduziert werden.
- **Legacy-Tag-Normalisierung:** Für den Golden-Test bleibt `Snacks` bestehen. Eine spätere fachliche `Snacks → Snack`-Normalisierung ist unabhängig vom Renderer.

## 9. Existing Components to Reuse

- `backend/package.json` — hostet bereits `vitest`, `typescript`, `sharp` und wird um vier Runtime-Deps und eine Dev-Dep ergänzt.
- Root-`.gitignore` — bestätigt, dass die Renderer-Ausgabepfade nicht spezifisch abgedeckt sind; `backend/.gitignore` wurde im angehaltenen B-1.1-Lauf bereits ergänzt.
- `backend/tsconfig.json` — deckt den Renderer-Ordner automatisch mit ab. Kein separater TSConfig nötig.
- `backend/scripts/`-Konvention — bestehende Skripte wie `dev.mjs`, `storage.mjs`, `wait-for-azurite.mjs` folgen dem Node-`.mjs`-Muster. `render-golden.mjs` folgt derselben Konvention.
- Vitest-Setup — der Renderer kann seine Tests unter `backend/src/lib/instagramRenderer/__tests__/` ablegen und läuft automatisch mit `npm test`.
- `sharp` — steht bereits zur Verfügung und wird für PNG-Dekodierung im Golden-Test verwendet, statt eine separate `pngjs`-Dep zu ziehen.
- Alle bereits migrierten Assets, Fonts, Fixture-Foto, Golden Master und Docs unter `backend/src/lib/instagramRenderer/`.

## 10. Proposed Technical Solution

### 10.1 Setup

Renderer als Ordner-Modul unter `backend/src/lib/instagramRenderer/` — kein eigenes npm-Projekt, kein separates `tsconfig.json`.

Ergänzungen an `backend/package.json`:

```jsonc
{
  "dependencies": {
    "satori": "~0.33.4",
    "@resvg/resvg-js": "~2.6.2",
    "lucide-static": "~1.46.0",
    "@tabler/icons": "~3.46.0"
    // bestehende Einträge unverändert
  },
  "devDependencies": {
    "pixelmatch": "~7.2.0"
    // bestehende Einträge unverändert
  },
  "scripts": {
    "render:instagram-reference": "node scripts/render-golden.mjs"
    // bestehende Einträge unverändert
  }
}
```

Die Versionen wurden am 2026-09-15 mit `npm view <package> dist-tags.latest` als aktuelle Stable-Versionen verifiziert. Der Backend-Agent verwendet genau diese `~`-gepinnten Werte; eine andere Version oder zusätzliche Icon-Bibliothek ist nicht Teil dieses Plans. Für die verwendeten Tabler-Assets verwendet er ausschließlich die verifizierten package-relativen Exportspecifier `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg` und prüft jeden davon nach der Dependency-Installation mit `require.resolve` oder einem gleichwertigen lokalen Resolve.

`backend/.gitignore` ist im angehaltenen B-1.1-Lauf bereits vorhanden. B-1.1 prüft nur, dass sie `output/` und `src/lib/instagramRenderer/__tests__/output/` ausschließt; der Root-`.gitignore` wird dafür nicht geändert.

Modul-Struktur:

```
backend/src/lib/instagramRenderer/
├── index.ts                     (öffentlicher Export: renderInstagramRecipe)
├── render.ts                    (pure Renderer-Entry mit Validierung)
├── compose.ts                   (Satori-JSX-Struktur, Z-Order)
├── photo.ts                     (Focus/Zoom/Cover)
├── ambient.ts                   (Green Ambient Field, Wortmarken-Sonderzone)
├── transition.ts                (Foto → Dark smootherstep)
├── layout.ts                    (Positions-, Size-, Farb-Konstanten)
├── tagIcons.ts                  (Icon-Registry, statische SVG-Strings)
├── types.ts                     (RenderInput, RenderResult, RenderError)
├── fixtures/
│   ├── quarkbroetchen.ts        (Golden-Fixture-Definition)
│   └── smoke.ts                 (Smoke-Fixture-Definition)
├── __tests__/
│   ├── golden.test.ts
│   ├── errors.test.ts
│   ├── tags.test.ts
│   ├── highlight.test.ts
│   └── smoke.test.ts
├── assets/                      (bereits vorhanden)
├── test-fixtures/               (bereits vorhanden: Foto + Golden Master)
└── docs/                        (bereits vorhanden)
```

### 10.2 Renderer-Kontrakt

Die vom Spec beschriebenen Typen werden konkretisiert:

```ts
type RenderInput = {
  image: { path: string } | { buffer: Buffer };
  presentation: { focusX: number; focusY: number; zoom: number };
  title: string;
  tags: Array<{ id: string; label: string }>;
  nutritionHighlight: "high-protein" | "low-fat" | null;
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
};

type RenderOk = { ok: true; width: 1080; height: 1350; format: "png"; buffer: Buffer };
type RenderError =
  | { code: "TITLE_OVERFLOW"; message: string; measured: { width: number; max: number } }
  | { code: "TOO_MANY_TAGS"; message: string; count: number; max: 4 }
  | { code: "TAG_ROW_OVERFLOW"; message: string; measured: { width: number; max: number } }
  | { code: "INVALID_ZOOM"; message: string; value: number }
  | { code: "INVALID_FOCUS"; message: string; field: "focusX" | "focusY"; value: number }
  | { code: "IMAGE_UNREADABLE"; message: string; cause?: string }
  | { code: "MISSING_ASSET"; message: string; asset: string }
  | { code: "INTERNAL"; message: string; cause?: string };

type RenderFail = { ok: false; error: RenderError };
type RenderResult = RenderOk | RenderFail;
```

Öffentliche Renderer-Signatur (Export aus `index.ts`): `async function renderInstagramRecipe(input: RenderInput): Promise<RenderResult>`. Diese exakten Feldnamen sind Vertragsgegenstand.

### 10.3 Layout-Konstanten

`src/layout.ts` exportiert benannte Konstanten für alle Positionen, Größen und Farben. Grundlage:

- Farb-Tokens laut Spec: `#B9EF12`, `#080D0B`, `#0D1511`, `#37463D`, `#F8F9F8`, `#B9BFBB`.
- Zusätzlich der gemessene Wortmarken-BG `#030604` als Sonderfarbe für die Green-Ambient-Sonderzone.
- Positions- und Sizewerte aus Spec Sektionen 4–16.
- Wo Golden und Spec konfligieren (Highlight-Badge-Größe, Transition-Zone, Wortmarken-Größe): Backend startet mit den Spec-Werten, dokumentiert die Abweichung zum Golden in einem Kurzkommentar an der Konstante und lässt QA das Ergebnis im Golden-Test bewerten. QA ändert keine Produktionskonstanten; eine Abweichung außerhalb der Toleranz wird als Finding an Backend zurückgegeben und in einer gezielten Backend-Iteration entschieden.

### 10.4 Green Ambient Field

Reproduzierbare Radial-Gradient-Funktion mit Zentrum `(540, 1250)`, Radius ~720 px. Stops aus `docs/golden-metrics.md` Sektion 11.7:

- 0 % `#030604`
- 15 % `#060C08`
- 40 % `#080F0B`
- 100 % `#0D190E`

Zusätzlich ein zweiter, sehr enger Radial-Gradient um `(540, 1253)`, Radius ~60 px, von `#030604` weich in den umgebenden Ambient-Ton. Dieser Sonderzonen-Gradient wird über den Basis-Ambient-Gradient gemalt und verschluckt damit den nahezu-schwarzen Wortmarken-Rasterhintergrund.

Es gibt **eine einzige gemeinsame Ambient-Funktion** über den gesamten unteren Bereich. Keine drei unterschiedlichen Grüntöne oder lokalen Glows.

### 10.5 Foto → Dark Transition

Smootherstep-Alpha-Overlay auf einer dunklen Fläche (`#080D0B`).

- Spec-Werte: `startY = 655`, `endY = 1115`.
- Golden-Werte: `startY ≈ 574`, `endY ≈ 953`.

Backend implementiert die Spec-Werte als Default und exportiert die Konstanten für eine gezielte Backend-Iteration. Falls das Rendering mit Spec-Werten den Golden-Test außerhalb der Toleranz reißt, dokumentiert QA das als Finding; Backend entscheidet und implementiert danach die begründete Feinjustierung innerhalb des Renderer-Moduls, gegebenenfalls auf die gemessenen Golden-Werte.

### 10.6 Tag-Icon-Auflösung

Auflösung gemäß `docs/tag-icon-mapping.md` und der aufgelösten Pasta-Entscheidung. Der Renderer:

- Löst Tag-Label über `resolveTagIcon(tagId)` in `src/tagIcons.ts` auf.
- Lädt Lucide-SVGs statisch aus `lucide-static/icons/*.svg`.
- Lädt Tabler-SVGs statisch über package-relative Exportspecifier der Form `@tabler/icons/outline/<name>.svg`. Bei den verwendeten Assets sind dies `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg`; physisch liegen sie unter `icons/outline/bread.svg` bzw. `icons/outline/bowl.svg`. Der physische `icons/`-Teil darf nicht doppelt im Exportspecifier erscheinen.
- Normalisiert Stroke `currentColor` (wird auf `#B9EF12` gesetzt), `stroke-width: 2`, `stroke-linecap: round`, `stroke-linejoin: round`. Tabler wird bei Bedarf auf `stroke-width: 2.1` angehoben.
- Fallback für unbekannten Tag: Text-Pill ohne Icon.
- `Curry` ist im Mapping explizit ohne Icon → Text-Pill.
- `Snacks` und `Snack` werden identisch behandelt (Lookup fällt auf `snack`).
- `Sauerteig` und `Pasta` werden über `resolveTagIcon("sauerteig")` bzw. `resolveTagIcon("pasta")` ausschließlich auf die normalisierten SVG-Strings aus `@tabler/icons/outline/bread.svg` bzw. `@tabler/icons/outline/bowl.svg` aufgelöst. Die Compose-Schicht rendert diese Icons mit dem übrigen Tag-Chip-Stil.
- Ein Import oder Registry-Eintrag für `noodles` oder `pasta` ist ausdrücklich unzulässig. Eine neue Icon-Bibliothek, ein handgezeichnetes Ersatz-SVG oder ein anderer stiller Ersatz ist ebenfalls ausgeschlossen.

### 10.7 Fixtures

**Golden Fixture** (`fixtures/quarkbroetchen.ts`):

- Foto: `../test-fixtures/quarkbroetchen-source.png` (relativ zum Modul)
- `focusX: 0.5`, `focusY: 0.46`, `zoom: 1.0`
- Titel: `Quarkbrötchen`
- Tags: `Backen`, `Vegetarisch`, `Snacks`, `Frühstück`
- `nutritionHighlight: "high-protein"`
- Nährwerte: `250 / 14 / 31 / 8`

**Smoke Fixture** (`fixtures/smoke.ts`):

- Foto: dasselbe Referenzfoto
- `focusX: 0.5`, `focusY: 0.5`, `zoom: 1.0`
- Titel: `Sauerteig Nussbrot`
- Tags: `Backen`, `Vollkorn`
- `nutritionHighlight: null`
- Nährwerte: `210 / 8 / 32 / 4` (Demo)

### 10.8 Render-Skript für lokale Nutzung und visuelle Abnahme

`backend/scripts/render-golden.mjs` ist ein kleines Node-Skript (ca. 20–30 Zeilen), das:

1. Den kompilierten Renderer aus `dist/backend/src/lib/instagramRenderer/index.js` importiert. Der Aufruf setzt `npm run build` im Backend-Ordner voraus; `tsx` oder eine zusätzliche Dev-Dependency ist in diesem Plan nicht vorgesehen.
2. Das Golden-Fixture aus `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` (bzw. dem kompilierten Pendant) lädt.
3. `renderInstagramRecipe(fixture)` aufruft.
4. Bei `ok: true` `output/quarkbroetchen.png` schreibt.
5. Bei `ok: false` `error` als JSON auf STDERR ausgibt, Exit-Code `1`.

Aufruf über npm: `npm run render:instagram-reference`. Ausgabe unter `backend/output/quarkbroetchen.png` — genau das PNG, das der Nutzer zur visuellen Freigabe erhält.

Kein CLI-Framework, keine Argument-Parsing, keine Sub-Kommandos. Das Skript ist bewusst minimal.

### 10.9 Golden-Image-Test

- Test-Framework: **Vitest** (aus `backend/package.json` wiederverwendet).
- Testdatei: `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`.
- Ablauf: Renderer mit Golden-Fixture aufrufen, Ergebnis in Memory-Buffer halten, mit `sharp` (bereits im Backend) in RGB-Rohdaten dekodieren, gegen `test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png` vergleichen.
- Pixel-Vergleich mit `pixelmatch`, Threshold begründet: Startwert **0.10** (10 % Farb-Delta pro Pixel). Erlaubte Anzahl abweichender Pixel: **max. 3 %** der Gesamtpixel (43 740 von 1 458 000). Beide Werte stehen als benannte Konstanten am Anfang der Testdatei.
- Bei Fehlschlag schreibt der Test `__tests__/output/actual.png`, `__tests__/output/expected.png` und `__tests__/output/diff.png`. Der Ordner ist in `backend/.gitignore` ausgeschlossen.
- Der Test verifiziert zusätzlich exakt `width === 1080 && height === 1350`.
- Kein Netzwerkzugriff, keine Zeit- oder Datumsabhängigkeit.

### 10.10 Fehlerbehandlung und Validierung

Vor jedem Layout-Schritt validiert der Renderer:

- Titel-Overflow → misst gerenderte Textbreite via Satori-Layout, `> 904` px → `TITLE_OVERFLOW`.
- `tags.length > 4` → `TOO_MANY_TAGS`.
- Tag-Zeilen-Overflow → misst gerenderte Chip-Row-Breite; `> 904` px → `TAG_ROW_OVERFLOW`.
- `zoom < 1` → `INVALID_ZOOM`. Zoom wird nicht geclamped.
- `focusX` oder `focusY` außerhalb `[0, 1]` → `INVALID_FOCUS`.
- Foto nicht ladbar → `IMAGE_UNREADABLE`.
- Font- oder Icon-Asset nicht auflösbar → `MISSING_ASSET`.
- Unerwartete technische Fehler werden am Renderer-Rand in `INTERNAL` übersetzt.

## 11. Backend Work Package B-1

### Subtask B-1.1 — Dependencies, Typen, Layout-Konstanten, Tag-Icon-Registry

**Agent:** Backend

**Status:** Partially executed — blocked by the registry smoke test; continuation and completion require renewed explicit `APPROVE` for this plan revision.

**Goal:** Den teilweise ausgeführten Setup-Subtask fortsetzen und abschließen: vorhandene korrekte Dependencies, `.gitignore`, Typen, Layout-Konstanten und Barrel-Datei unverändert übernehmen; alle verwendeten Tabler-Exportspecifier im Registry-Mapping (`Sauerteig -> bread`, `Pasta -> bowl`), die lokale Resolve-Prüfung jedes Tabler-Assets, die Registry-Smoke-Prüfung und die Mapping-Konsistenz vollständig korrigieren bzw. abschließen.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`

**Required Repository Context:**

- `backend/package.json`
- `backend/tsconfig.json`
- Root-`.gitignore`
- `backend/.gitignore` — im angehaltenen B-1.1-Lauf bereits angelegt; nur Inhalt und Zielpfade verifizieren
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/src/lib/instagramRenderer/assets/`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-11
- AC-17

**Dependencies:** None for the already-started subtask. The renewed `APPROVE` gate for this plan revision must be satisfied before continuation; no subsequent subtask may start before B-1.1 is completed.

**Expected Handoff:**

- Die bereits vorhandenen Einträge in `backend/package.json` bleiben exakt bei `satori~0.33.4`, `@resvg/resvg-js~2.6.2`, `lucide-static~1.46.0`, `@tabler/icons~3.46.0` sowie `pixelmatch~7.2.0` als Dev-Dep. Diese Versionen sind am 2026-09-15 als aktuelle Stable-Versionen verifiziert; keine andere Backend-Dependency wird verändert.
- Das bereits vorhandene npm-Skript `render:instagram-reference` bleibt unverändert bestehen.
- Die bereits vorhandene `backend/.gitignore` schließt `output/` sowie `src/lib/instagramRenderer/__tests__/output/` aus. Der Root-`.gitignore` wird nicht als Ersatz geändert.
- Die bereits vorhandenen Dateien `backend/src/lib/instagramRenderer/types.ts`, `layout.ts` und `index.ts` werden übernommen und nur bei einem konkreten B-1.1-Befund angepasst.
- `backend/src/lib/instagramRenderer/tagIcons.ts` exportiert `resolveTagIcon(tagId: string): { svg: string; source: "lucide" | "tabler" } | null`, deckt alle Einträge aus `docs/tag-icon-mapping.md` ab, behandelt `Snacks` und `Snack` gleich, gibt für `Curry` und unbekannte Tags `null` zurück und normalisiert die SVG-Strings (Stroke, Linecap, Linejoin, Farb-Attribute). Die notwendige Korrektur umfasst alle verwendeten Tabler-Exportspecifier: `@tabler/icons/outline/bread.svg` für `Sauerteig` und `@tabler/icons/outline/bowl.svg` für `Pasta`.
- Die `Sauerteig`- und `Pasta`-Zuordnungen verwenden ausschließlich die normalisierten SVG-Strings aus `@tabler/icons@3.46.0` über die package-relativen Resolve-/Importpfade `@tabler/icons/outline/bread.svg` bzw. `@tabler/icons/outline/bowl.svg`; die physischen Paketpfade `icons/outline/bread.svg` und `icons/outline/bowl.svg` werden nicht als doppelte Specifier verwendet. Es gibt keinen `noodles`- oder `pasta`-Import und keine stille Ersatzzuordnung.
- B-1.1 führt nach der Dependency-Installation für jeden verwendeten Tabler-Assetpfad eine lokale Prüfung mit `require.resolve` oder gleichwertigem Resolve aus und führt den Registry-Smoke-Test erfolgreich aus. Die Mapping-Dokumentation, Registry und der spätere Handoff müssen package-relative Specifier und physische Paketpfade eindeutig unterscheiden und konsistent auf `bread.svg` bzw. `bowl.svg` verweisen.
- Der Handoff wird erst nach diesen Prüfungen als abgeschlossen an B-1.2 übergeben; bis dahin bleibt `handoff_store` ohne vollständigen B-1.1-Handoff.

### Subtask B-1.2 — Layout-Komposition (Foto, Ambient, Content-Ebenen)

**Agent:** Backend

**Status:** Blocked until completed B-1.1 Handoff and renewed explicit `APPROVE` for this plan revision.

**Goal:** Die vollständige visuelle Komposition — Foto mit Focus/Zoom, Foto-→-Dark-Transition, Green Ambient Field mit Wortmarken-Sonderzone, Nutrition Highlight Badge, Rezepttitel, Tag-Zeile, Nutrition Card mit Hantel-Divider und Nährwerten, FitTrack-Wortmarke — als reine Satori-JSX-Struktur implementieren.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`

**Required Repository Context:**

- Subtask B-1.1 Handoff
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`
- `backend/src/lib/instagramRenderer/assets/`
- B-1.1-Handoff mit den aufgelösten Tabler-Zuordnungen `Sauerteig -> bread` und `Pasta -> bowl`, den verifizierten package-relativen Pfaden `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg` sowie dem erfolgreichen lokalen Resolve jedes Tabler-Assets und Registry-Smoke-Test

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-17

**Dependencies:**

- B-1.1 Dependencies, Typen, Layout-Konstanten, Tag-Icon-Registry

**Expected Handoff:**

- `backend/src/lib/instagramRenderer/compose.ts` gibt eine reine JSX-Struktur zurück, die alle sichtbaren Layout-Elemente in korrekter Z-Order enthält.
- `backend/src/lib/instagramRenderer/ambient.ts` implementiert die Green-Ambient-Radial-Gradient-Funktion inkl. Wortmarken-Sonderzone.
- `backend/src/lib/instagramRenderer/photo.ts` implementiert Focus/Zoom/Cover für das Rezeptfoto, mit Panning-Clamp so, dass niemals leerer Raum sichtbar wird.
- `backend/src/lib/instagramRenderer/transition.ts` implementiert die Foto-→-Dark-Transition.
- Genau ein Nutrition Highlight Badge wird gerendert, wenn `nutritionHighlight !== null`. Bei `null` bleibt der Bereich leer; alle übrigen Positionen bleiben fest.
- Genau eine FitTrack-Wortmarke wird gerendert. Kein Logo auf Logo.
- Der Renderer verwendet nur Fonts aus `assets/fonts/` und Icons aus den lokal gebündelten Bibliotheken.
- Die Tag-Zeile verwendet die in B-1.1 festgehaltenen Tabler-Auflösungen `Sauerteig -> bread` und `Pasta -> bowl`; die Compose-Schicht erzeugt die bestätigten lokalen Tabler-Icons über die package-relativen Exportspecifier `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg`.
- Bei 0 Tags wird die Tag-Zeile nicht gerendert; keine Container-Boxen erzeugen leeren Platz.

### Subtask B-1.3 — Renderer-Entry, Validierung, Fixtures, Render-Skript

**Agent:** Backend

**Status:** Blocked until completed B-1.2 and renewed explicit `APPROVE` for this plan revision.

**Goal:** Die öffentliche Renderer-API `renderInstagramRecipe(input)` fertigstellen — mit vollständiger Validierung, Fehler-Übersetzung, den beiden Fixture-Modulen und dem `render-golden.mjs`-Skript, das ein visuell abnehmbares PNG erzeugt.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`

**Required Repository Context:**

- Subtask B-1.1 Handoff
- Subtask B-1.2 Handoff
- `backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png`
- `backend/scripts/dev.mjs` (als `.mjs`-Skript-Referenzmuster)
- B-1.1-Handoff mit der geprüften vollständigen Tabler-Registry (`Sauerteig -> bread`, `Pasta -> bowl`) und erfolgreich aufgelösten package-relativen Exportspecifiern

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-2
- AC-9
- AC-10
- AC-12
- AC-13
- AC-16

**Dependencies:**

- B-1.2 Layout-Komposition

**Expected Handoff:**

- `backend/src/lib/instagramRenderer/render.ts` exportiert `renderInstagramRecipe(input: RenderInput): Promise<RenderResult>`. Führt Validierung vor dem Rendering aus. Übersetzt alle unerwarteten Exceptions in `RenderError` mit Code `INTERNAL` und Ursache. Keine Side-Effects beim Import: Font- und Asset-Ladung erfolgt lazy beim ersten Aufruf.
- `backend/src/lib/instagramRenderer/index.ts` re-exportiert `renderInstagramRecipe` sowie die Typen.
- `backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts` enthält das Golden-Fixture wörtlich laut Abschnitt 10.7.
- `backend/src/lib/instagramRenderer/fixtures/smoke.ts` enthält das Smoke-Fixture wörtlich laut Abschnitt 10.7.
- `backend/scripts/render-golden.mjs` ruft den Renderer mit dem Golden-Fixture auf und schreibt `backend/output/quarkbroetchen.png`. Bei Fehler wird `RenderError` als JSON auf STDERR ausgegeben, Exit-Code `1`.
- `npm run render:instagram-reference` funktioniert im Backend-Ordner und erzeugt reproduzierbar dasselbe PNG.
- Das gerenderte `output/quarkbroetchen.png` ist exakt 1080 × 1350 px PNG. Backend übergibt dieses PNG explizit an den Nutzer zur visuellen Freigabe (siehe AC-16 und Sektion 20 Schritt 6).

## 12. QA Work Package Q-1

### Subtask Q-1.1 — Golden-Image-Test und Diff-Output

**Agent:** QA

**Status:** Blocked until completed B-1.3 and renewed explicit `APPROVE` for this plan revision.

**Goal:** Einen automatisierten, deterministischen Pixel-Vergleich zwischen dem gerenderten Golden-Fixture und dem Golden Master implementieren, inklusive Diff-Bild-Ausgabe bei Abweichungen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- Subtask B-1.3 Handoff
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`
- B-1.1-Handoff mit erfolgreichem Resolve für `@tabler/icons/outline/bread.svg` und `@tabler/icons/outline/bowl.svg`
- `backend/.gitignore` — im teilweise ausgeführten B-1.1-Lauf bereits vorhanden; Zielpfade und Ausschlüsse sind zu verifizieren
- `backend/vitest.config.mts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-11
- AC-12
- AC-14

**Dependencies:**

- B-1.3 Renderer-Entry, Validierung, Fixtures, Render-Skript

**Expected Handoff:**

- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts` verwendet Vitest, ruft `renderInstagramRecipe` mit dem Golden-Fixture auf, dekodiert das Ergebnis mit `sharp` und vergleicht Pixel gegen den Golden Master.
- Toleranz ist begründet dokumentiert: `pixelmatch`-Threshold `0.10`, maximal `3 %` abweichende Pixel. Beide Werte stehen als benannte Konstanten am Anfang der Testdatei.
- Der Test prüft zusätzlich `width === 1080 && height === 1350`.
- Bei Abweichung schreibt der Test `__tests__/output/actual.png`, `__tests__/output/expected.png` und `__tests__/output/diff.png`. Diese Dateien sind in `backend/.gitignore` ausgeschlossen.
- Der Test bestätigt, dass der Ausgabeordner durch die in B-1.1 verifizierte `backend/.gitignore` abgedeckt ist.
- Der Test läuft ohne Netzwerkzugriff und ohne Zeit-/Datumsabhängigkeit.
- Der Test läuft als Teil von `npm test` im Backend-Ordner mit.

### Subtask Q-1.2 — Fehler-Path-, Tag-, Highlight- und Smoke-Tests, QA-Report

**Agent:** QA

**Status:** Blocked until completed Q-1.1 and renewed explicit `APPROVE` for this plan revision.

**Goal:** Belegen, dass der Renderer die vollständige Definition-of-Done erfüllt: negative Pfade sind ohne stille Fallbacks abgesichert, das Smoke-Fixture rendert ohne Golden-Test durch, kein hart codiertes Fixture-Verhalten liegt vor.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- Subtask B-1.3 Handoff
- Subtask Q-1.1 Handoff
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`
- B-1.1-Handoff mit den explizit aufgelösten Tabler-Entscheidungen `Sauerteig -> bread` und `Pasta -> bowl`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- AC-1
- AC-9
- AC-10
- AC-13
- AC-15
- AC-17

**Dependencies:**

- Q-1.1 Golden-Image-Test

**Expected Handoff:**

- `backend/src/lib/instagramRenderer/__tests__/errors.test.ts` deckt jeden `RenderError`-Code über konstruierte Inputs ab: `TITLE_OVERFLOW`, `TOO_MANY_TAGS`, `TAG_ROW_OVERFLOW`, `INVALID_ZOOM`, `INVALID_FOCUS`, `IMAGE_UNREADABLE`, `MISSING_ASSET`. Jede Assertion prüft `ok: false` und den erwarteten `error.code`.
- `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts` prüft, dass `nutritionHighlight: null` das Layout der übrigen Elemente nicht verschiebt und keine Badge-Pixel im Top-Right-Quadranten erscheinen.
- `backend/src/lib/instagramRenderer/__tests__/tags.test.ts` prüft, dass 0 Tags, 1 Tag, 4 Tags, unbekannter Tag (Text-Pill-Fallback) und `Curry` (Text-Pill-Fallback) korrekt gerendert werden. Für `Sauerteig` und `Pasta` prüft der Test exakt die normalisierten Icon-Strings aus `@tabler/icons/outline/bread.svg` bzw. `@tabler/icons/outline/bowl.svg` und die Konsistenz mit den package-relativen Resolves. Ein nicht vorhandenes `noodles`- oder `pasta`-Asset darf nicht als impliziter Ersatz erscheinen.
- `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts` ruft `renderInstagramRecipe` mit dem Smoke-Fixture auf und prüft nur `ok: true`, `width === 1080`, `height === 1350`. Kein Golden-Vergleich.
- QA-Report unter `docs/qa/reports/` mit Verdict, Kriterien-Matrix (alle AC-N), Ergebnisse pro Test-Kommando und dokumentierten Findings, inklusive der Side-by-Side-Beobachtung Renderer-Output vs V1.7 Golden Master (mit Verweis auf `__tests__/output/diff.png` falls erzeugt).

## 13. Shared Package Changes

Keine.

## 14. Persistence Impact

**Migration class:** Class 0 — keine Persistenzänderung. Der PoC liest keine Cosmos-Daten, schreibt keine Cosmos-Daten und ändert kein Datenmodell.

## 15. Infrastructure and Configuration

- **Bicep:** keine Änderung.
- **Cosmos:** keine Änderung.
- **Function App:** keine Änderung. Es wird **kein** Function-Endpoint hinzugefügt.
- **Mobile Native Layer:** keine Änderung.
- **Development:** Der Renderer läuft nach `npm install && npm run build && npm run render:instagram-reference` im Backend-Ordner. Backend-Tests inkl. Golden-Test laufen mit `npm test`.
- **Alpha:** keine Alpha-Aktion. Der PoC wird nicht deployt.
- Es gibt kein eigenes Infrastructure-&-Release-Work-Package, weil keine Infrastruktur-Entscheidung, keine IaC-Datei und kein Deployment betroffen sind.

## 16. Documentation Updates

- Backend darf `backend/src/lib/instagramRenderer/docs/golden-metrics.md` und `docs/tag-icon-mapping.md` mit expliziten Kommentaren erweitern, wenn Werte im Implementierungsverlauf präzisiert werden. Bestehende Zahlen dürfen nicht überschrieben werden, ohne den Widerspruch zu markieren.
- Die Mapping-Dokumentation ist im angehaltenen B-1.1-Lauf bereits auf `Pasta -> bowl` synchronisiert. B-1.1 verifiziert und korrigiert vor dem Handoff alle verwendeten Tabler-Einträge: `@tabler/icons/outline/bread.svg` → `icons/outline/bread.svg` für `Sauerteig` sowie `@tabler/icons/outline/bowl.svg` → `icons/outline/bowl.svg` für `Pasta`. Registry, Compose-Schicht und QA-Tests müssen exakt dieselben package-relativen Specifier und physischen Paketpfade unterscheiden und verwenden.
- `backend/.gitignore` ist bereits angelegt; B-1.1 verifiziert die vorgesehenen Ausschlüsse. Der Root-`.gitignore` wird nicht als Ersatz angepasst.
- Keine Änderung an `docs/kb/`, `.github/`, `docs/User Stories/` außer diesem Plan-Dokument.
- Keine Änderung an `mobile/`- oder allgemeiner Backend-Dokumentation.

## 17. Test Strategy

**Automatisierte Tests** (durch QA, in Vitest):

- Golden-Image-Test: dekodierter Pixelvergleich gegen V1.7 mit begründeter Toleranz.
- Fehler-Pfade: jeder `RenderError`-Code über konstruierte Inputs.
- Smoke-Fixture: zweites Rezept ohne Golden-Test rendert durch.
- Tag-Zeile: 0, 1, 4 Tags, unbekannter Tag, `Curry` sowie die exakt festgelegten Tabler-Varianten `Sauerteig -> bread` und `Pasta -> bowl`.
- Highlight-Layout: `null`-Verhalten ändert Layout nicht.

**Manuelle Prüfung** (durch Nutzer, Ergebnis der PoC-Abnahme):

- Visuelle Sichtprüfung von `backend/output/quarkbroetchen.png`.
- Bei Golden-Test-Fehlschlag: Vergleich `__tests__/output/actual.png` vs `__tests__/output/expected.png` mit `diff.png`.

**Nicht Bestandteil dieses PoC:**

- CI-Ausführung des Golden-Tests.
- Docker-basierter deterministischer Test-Runner.
- Contract- oder E2E-Tests.
- Mobile-Tests, Health-Connect-Tests, AI-Evaluation.
- HTTP-Endpoint-Tests via curl/Postman.

## 18. Acceptance Criteria

- **AC-1:** Der Renderer existiert als importierbare Node-TypeScript-Library unter `backend/src/lib/instagramRenderer/` mit öffentlicher Signatur `renderInstagramRecipe(input: RenderInput): Promise<RenderResult>`. Kein HTTP-Endpoint, keine Auth-Logik, keine Cosmos-Zugriffe, keine Storage-Zugriffe.
- **AC-2:** Der Renderer akzeptiert einen typisierten `RenderInput` mit den Feldern `image`, `presentation`, `title`, `tags`, `nutritionHighlight`, `nutrition` in der in Abschnitt 10.2 beschriebenen Form.
- **AC-3:** Für das Golden-Fixture liefert der Renderer ein Ergebnis mit `ok: true`, `width === 1080`, `height === 1350` und einem PNG-Buffer als Ausgabe.
- **AC-4:** Genau ein Nutrition Highlight Badge wird gerendert, wenn `nutritionHighlight === "high-protein"` oder `nutritionHighlight === "low-fat"`. Bei `null` erscheint kein Badge, und die Positionen von Titel, Tags, Nutrition Card, Hantel, Nährwerten und Wortmarke sind identisch zum Highlight-Fall.
- **AC-5:** Genau eine FitTrack-Wortmarke wird im Footer horizontal zentriert gerendert. Kein sichtbarer Wortmarken-Rasterhintergrund als Rechteck. Keine harte Kante zwischen Wortmarke und Green Ambient Field.
- **AC-6:** Der untere Bereich ab der Foto-Unterkante verwendet eine einzige, gemeinsame Green-Ambient-Field-Funktion. Keine unterschiedlichen Grüntöne oder lokalen Glows nebeneinander sichtbar.
- **AC-7:** Die vier Nährwert-Spalten `Kalorien`, `Protein`, `Kohlenhydrate`, `Fett` werden in dieser Reihenfolge gerendert. Werte sind gerundet (Kalorien auf 10 kcal, Makros auf ganze Gramm) und im Golden-Fixture exakt `250 kcal / 14 g / 31 g / 8 g`.
- **AC-8:** `PRO PORTION` wird als Lime-Text im Center-Gap der Hantel gerendert. Es gibt genau eine sichtbare Hantel-Grafik. Keine doppelten Divider.
- **AC-9:** Bei ungültigem Input liefert der Renderer `ok: false` mit dem erwarteten `RenderError.code`: `TITLE_OVERFLOW`, `TOO_MANY_TAGS`, `TAG_ROW_OVERFLOW`, `INVALID_ZOOM`, `INVALID_FOCUS`, `IMAGE_UNREADABLE`, `MISSING_ASSET` oder `INTERNAL`. Kein stiller Fallback, kein Silent-Shrink, kein Wrap.
- **AC-10:** Bei 0 Tags liefert der Renderer `ok: true` ohne gerenderte Tag-Zeile. Die Positionen aller übrigen Elemente sind identisch zum Fall mit Tags.
- **AC-11:** Die neuen Runtime-Dependencies sind in `backend/package.json` exakt mit `satori~0.33.4`, `@resvg/resvg-js~2.6.2`, `lucide-static~1.46.0`, `@tabler/icons~3.46.0` und die Dev-Dependency mit `pixelmatch~7.2.0` eingetragen. Keine anderen Backend-Dependencies werden verändert. `backend/.gitignore` existiert nach B-1.1 und schließt `output/` sowie `src/lib/instagramRenderer/__tests__/output/` aus; falls sie vor B-1.1 nicht existierte, ist ihre Neuanlage zulässig und erwartet.
- **AC-12:** Ein automatisierter Golden-Image-Test in Vitest vergleicht das gerenderte Golden-Fixture dekodiert Pixel-für-Pixel gegen den Golden Master. Toleranz `pixelmatch`-Threshold `0.10` und maximal `3 %` abweichende Pixel. Bei Abweichung werden `__tests__/output/actual.png`, `__tests__/output/expected.png` und `__tests__/output/diff.png` geschrieben. Der Test läuft mit `npm test` im Backend-Ordner und die Dateien liegen unter der neuen bzw. vorhandenen `backend/.gitignore`.
- **AC-13:** Das Smoke-Fixture (`Sauerteig Nussbrot`, 2 Tags, `nutritionHighlight: null`, andere Nährwerte) rendert mit `ok: true` und liefert 1080 × 1350 PNG. Es findet **kein** Golden-Vergleich für das Smoke-Fixture statt.
- **AC-14:** Der QA-Report unter `docs/qa/reports/` enthält Verdict, Kriterien-Matrix und dokumentierte Findings inkl. Side-by-Side-Beobachtung Renderer vs V1.7.
- **AC-15:** Weder der Renderer noch die Tests verwenden generative KI, dynamische Datums-/Zeitwerte, zufällige Werte oder Netzwerkanfragen zur Laufzeit.
- **AC-16:** `npm run render:instagram-reference` erzeugt reproduzierbar `backend/output/quarkbroetchen.png` als 1080 × 1350 px PNG. Dieses PNG dient als Grundlage der visuellen Freigabe durch den Nutzer und ist der Kern-Deliverable des PoC.
- **AC-17:** Alle verwendeten Tabler-Icon-Zuordnungen sind vor Ausführungsbeginn auf die package-relativen Exportspecifier `@tabler/icons/outline/bread.svg` für `Sauerteig` und `@tabler/icons/outline/bowl.svg` für `Pasta` bei `@tabler/icons@3.46.0` festgelegt und in Mapping-Dokumentation, Registry, Compose-Schicht und QA-Tests konsistent umgesetzt. `resolveTagIcon("sauerteig")` bzw. `resolveTagIcon("pasta")` liefern die normalisierten SVG-Strings aus diesen Exportspecifiern; die physischen Paketpfade `icons/outline/bread.svg` und `icons/outline/bowl.svg` dürfen nicht als doppelte Unterpfade verwendet werden. B-1.1 weist die Auflösung jedes verwendeten Tabler-Assets mit `require.resolve` oder gleichwertigem lokalem Resolve sowie im Registry-Smoke-Test nach. `noodles` und ein nicht vorhandenes `pasta`-Asset dürfen nicht importiert werden; eine neue Bibliothek, ein handgezeichnetes Ersatz-SVG oder ein stiller Text-Fallback für die bekannten Tabler-Einträge ist ausgeschlossen.

## 19. Risks and Edge Cases

- **Determinismus über Plattformen:** `@resvg/resvg-js` nutzt native Bindings, deren Output zwischen macOS, Linux und Windows leicht divergieren kann. Der PoC verifiziert auf der Entwickler-Maschine (Windows). Ein plattformübergreifender CI-Lauf ist nicht Bestandteil.
- **V1.7 ist nicht pixelperfekt:** Bekannte Abweichungen sind in `docs/golden-metrics.md` Sektion 11 dokumentiert. Backend folgt der Spec und lässt QA im Golden-Test entscheiden. Bei Golden-Test-Fehlschlag außerhalb der Toleranz iteriert Backend, gestützt auf QA-Findings.
- **Font-Rendering von Umlauten:** `Quarkbrötchen` enthält `ö`. Der Renderer muss die Umlaute aus den Inter-Fonts korrekt zeichnen. Beim ersten Golden-Fehlschlag prüft QA gezielt Umlaut-Rendering.
- **Tag-Chip-Padding und Border-Intensität:** Nicht im Golden Master exakt messbar. Backend übernimmt Spec-Werte und lässt QA entscheiden.
- **Foto-Aspect-Ratio:** Das Referenzfoto ist Hochformat. Bei `zoom: 1.0` muss der Renderer die kleinste zulässige Skalierung verwenden, die die 1080 × 1015 Hero-Fläche vollständig füllt. Panning muss geclamped werden.
- **PNG-Größe:** `quarkbroetchen-source.png` ist ~20 MB. Sollte das Rendering dadurch signifikant verlangsamt werden, kann das Fixture in einer separaten Follow-up-Änderung verkleinert werden.
- **Icon-Bibliothek-Divergenz:** Lucide- und Tabler-Icons haben leicht unterschiedliche Optik. Ohne Stroke-Normalisierung wirken die Tabler-Icons dünner. Der Renderer wendet die in Abschnitt 10.6 genannten Normalisierungen an.
- **Tabler-Exportspecifier:** Die aktuelle Registry enthält für `bread` und `bowl` fälschlich `@tabler/icons/icons/outline/...`; dadurch scheitert das Registry-Laden bereits an `Sauerteig -> bread`. B-1.1 muss jeden verwendeten Tabler-Exportspecifier gegen den package-relativen Resolve prüfen und auf `@tabler/icons/outline/<name>.svg` korrigieren. Die physischen Paketpfade bleiben `icons/outline/<name>.svg`.
- **Pasta-Icon-Annäherung:** Ein exaktes Pasta-/Nudel-Icon fehlt in beiden aktuell zugelassenen Bibliotheksständen. `bowl.svg` aus `@tabler/icons@3.46.0` ist als neutrale Food-/Servierdarstellung gewählt; QA prüft die Lesbarkeit und die konsistente Darstellung im Tag-Chip. Eine technische Abweichung von diesem Pfad ist nicht vorgesehen.
- **Backend-`package.json`-Berührung:** Dieser PoC verändert Backend-Deps. Falls die neuen Runtime-Deps mit bestehenden Backend-Modulen zu Konflikten führen (`peer-dep`-Warnungen, TypeScript-Type-Kollisionen), meldet Backend das als Blocker.
- **Ignore-Datei:** `backend/.gitignore` ist im teilweise ausgeführten B-1.1-Lauf bereits angelegt. B-1.1 verifiziert, dass Renderer- und Diff-Ausgaben nicht versioniert werden; ein zusätzlicher Root-Ignore-Refactor ist nicht erforderlich.
- **`sharp` als Test-Dekoder:** Backend hat `sharp` bereits, wir nutzen es statt `pngjs`. Falls `sharp`-API-Unterschiede zwischen Versionen den Test brechen, muss ggf. auf `pngjs` als Test-Dev-Dep ausgewichen werden.
- **`.mjs`-Skript vs. TypeScript-Source:** Das Render-Skript importiert ausschließlich den kompilierten JS-Output. Bei laufender Entwicklung muss `npm run build` vor `npm run render:instagram-reference` erfolgen. Ein `tsx`-Ausweichpfad und eine zusätzliche Dev-Dependency sind nicht Teil dieses Plans.

## 20. Recommended Execution Order

Die Orchestrierung erfolgt strikt sequenziell. Der Plan ist bis zur erneuten expliziten `APPROVE`-Freigabe nicht frei ausführbar; die frühere Ausführungsfreigabe ist ungültig. Nach der Freigabe muss der angehaltene B-1.1-Subtask zuerst abgeschlossen werden:

0. **Erneute Ausführungsfreigabe:** Der Orchestrator holt für diese revidierte Planfassung erneut ein explizites `APPROVE` ein. Die Pasta-Icon-Auswahl ist bereits auf den package-relativen Exportspecifier `@tabler/icons/outline/bowl.svg` bei `@tabler/icons@3.46.0` festgelegt; die technische Korrektur umfasst zusätzlich den bestehenden `Sauerteig -> bread`-Eintrag. Eine weitere PO-Rückfrage ist nicht erforderlich.
1. **Backend B-1.1 fortsetzen und abschließen:** Nach der erneuten Freigabe korrekte vorhandene Dependencies und Dateien nicht erneut ändern. Alle verwendeten Tabler-Exportspecifier in der Registry prüfen und auf `@tabler/icons/outline/bread.svg` bzw. `@tabler/icons/outline/bowl.svg` korrigieren, für beide Assets die lokale `require.resolve`- oder gleichwertige Resolve-Prüfung nach Dependency-Installation erfolgreich ausführen, den Registry-Smoke-Test ausführen und die Mapping-Konsistenz zwischen package-relativen Pfaden und physischen Pfaden `icons/outline/bread.svg` bzw. `icons/outline/bowl.svg` prüfen. Erst danach den vollständigen Handoff übergeben.
2. **Backend B-1.2:** Layout-Komposition mit Foto, Ambient, Content-Ebenen implementieren.
3. **Backend B-1.3:** Renderer-Entry, Validierung, Fixtures und `render-golden.mjs`-Skript fertigstellen. Backend erzeugt am Ende dieses Schritts erstmals `backend/output/quarkbroetchen.png` und übergibt es dem Nutzer.
4. **QA Q-1.1:** Golden-Image-Test aufsetzen und ausführen; Findings bei Abweichung außerhalb Toleranz an Backend zurückspielen.
5. **QA Q-1.2:** Fehlerpfade, Smoke-Fixture, Tag-Zeile-Varianten und Highlight-Verhalten prüfen; QA-Report erzeugen.
6. **Backend Iteration:** Bei QA-Findings gezielte Feinjustierung ausschließlich innerhalb des Renderer-Moduls; Golden-Test erneut laufen lassen; aktualisiertes PNG erneut dem Nutzer übergeben.
7. **Nutzer-Freigabe (visuell):** Der Nutzer prüft `backend/output/quarkbroetchen.png` und ggf. das QA-Diff-Bild. **Ohne diese ausdrückliche visuelle Freigabe ist der PoC nicht abgeschlossen**, unabhängig davon, ob der automatisierte Golden-Test grün ist. Diese Freigabe ist der Gate-Punkt für die anschließende Function-Integration.
8. **PoC-Abnahme und Handoff:** Nach visueller Freigabe wird die Function-Integration in einer separaten Planungsrunde adressiert (siehe Sektion 21).

## 21. Post-PoC Target Architecture

**Bestätigte Ziel-Architektur:** Der finale Rezept-Share-Flow rendert **server-seitig in einer Azure Function** im Backend. Client-seitiges Rendering in der Mobile-App ist ausdrücklich ausgeschlossen.

Weil der Renderer bereits im Backend-Modul liegt, ist die Migration nach PoC-Abnahme **keine Migration mehr, sondern nur noch das Hinzufügen eines Function-Endpoints**, der die Library aufruft.

### 21.1 Design-Guardrails im PoC, die die Function-Integration absichern

- **Node-nativ:** Satori und `@resvg/resvg-js` laufen unverändert in der Azure-Functions-Node-Runtime.
- **Pure Async Function als öffentliche API:** `renderInstagramRecipe(input): Promise<RenderResult>` liest keinen globalen Zustand und schreibt keinen. Das PNG wird als Buffer zurückgegeben, nicht auf Disk geschrieben.
- **Keine Side-Effects beim Import:** Das Laden von `src/render.ts` oder `src/compose.ts` triggert kein I/O, keinen Font-Load, kein Netzwerk. Font- und Asset-Ladung findet ausschließlich beim ersten Renderer-Aufruf statt und ist lazy-cached für Folgeaufrufe innerhalb derselben Function-Instance.
- **Asset-Pfade konfigurierbar:** Die Konstante `ASSETS_ROOT` (bzw. gleichwertig) ist an einer einzigen Stelle definiert und kann im Function-Kontext auf den finalen Deploy-Pfad umgesetzt werden.
- **Render-Skript strikt außerhalb der Renderer-Logik:** `backend/scripts/render-golden.mjs` ist ein reines Wrapper-Skript. Die Function importiert später ausschließlich `src/lib/instagramRenderer/index.ts`, niemals `scripts/render-golden.mjs`.
- **Runtime-Dependencies minimal:** `pixelmatch` verbleibt strikt in `devDependencies`. Nur `satori`, `@resvg/resvg-js`, `lucide-static`, `@tabler/icons` gehen in `dependencies` und damit ins Function-Deploy-Bundle.
- **Keine globalen Caches mit unbegrenztem Wachstum.**
- **Kein Zufall, keine Zeit-, Datums- oder Sprach-Abhängigkeit** (bereits durch AC-15 abgesichert).

### 21.2 Erwartete Follow-up-Arbeit (nicht Teil dieses Plans)

1. Neue Azure Function `renderRecipeShareImage` in `backend/src/functions/` — importiert `renderInstagramRecipe` aus `backend/src/lib/instagramRenderer/index.ts`.
2. Input-Contract der Function: `RenderInput` angereichert um Auth-Token und Rezept-ID.
3. Backend lädt Rezeptfoto aus vorhandenem Storage (bestehende Muster) und übergibt es als Buffer an den Renderer.
4. Response-Design (PNG-Buffer, SAS-URL oder gemischt) — Entscheidung der Folge-Planungsrunde.
5. Quota, Rate-Limiting, Auth folgen bestehenden Backend-Patterns.
6. Deployment über bestehende Function-App-Pipelines.

### 21.3 PoC-Artefakte, die bei Function-Integration ersetzt oder ergänzt werden

- `backend/scripts/render-golden.mjs` bleibt als lokales Entwickler-Werkzeug erhalten, wird aber nicht Teil des Function-Deploys.
- Golden-Image-Test wird ergänzt um einen HTTP-Contract-Test der Function, sobald diese existiert. Der bestehende Library-Level-Golden-Test bleibt bestehen.
- Das Smoke-Fixture bleibt als Library-Test bestehen und wird nicht Teil produktiver Function-Tests.

**Zusammenfassung:** Der gesamte Renderer-Kern-Code (Renderer-Entry, Kompositions-Ebenen, Layout-Konstanten, Tag-Icon-Registry, Typen, Fixtures, Golden-Test, Assets, Docs) überlebt die Function-Integration ohne Umzugsarbeit. Die Folge-Planungsrunde adressiert ausschließlich Auth, Storage-Foto-Ladung, Response-Format, Quota und Deployment.
