# QA Report: Profilbereich redesignen und neu strukturieren (Work Package Q-1)

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung.md`
- Verdict: `PASS WITH ISSUES`

## Scope

Reviewed: Subtasks F-1.1 (Profil-Hub, ProfileEdit, Health-Connect-Oberfläche), F-1.2 (Bibliothek, `FoodProductSummary`, `SearchState.ResultRow`), F-1.3 (In-App-Legal, Login-/Wizard-Einstieg) und F-1.4 (KB-Abgleich) gegen AC-1 bis AC-16. Es existiert keine User Story (siehe Plan-Header).

Geprüft per Code-/Diff-Review gegen `HEAD`, Vitest, Typecheck, Encoding-Check und Git-Status. Backend-Code wurde nur lesend herangezogen, um Aussagen des Datenschutztexts zu verifizieren (Insight-Ablauf, keine Nutzer-ID an Azure OpenAI).

Nicht Teil des Reviews: Geräte-/Emulator-/Screenreader-Prüfungen (siehe Verification Notes), juristische Bewertung der Rechtstexte, `ProfileWizardScreen` jenseits der Datenschutz-Einstiege (laut Plan Out of Scope), künftige Features (`Gemeinsam`, Altersvalidierung, vollständige Kontolöschung).

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `mobile/src/app/navigation/RootNavigator.tsx`: `tabBarLabel: 'Profil'`, Route-ID `Profile` unverändert. `ProfileScreen.tsx` zeigt Titel `Profil`, Profil-/Zielübersicht oben, Navigationsgruppen darunter. `ProfileScreen.test.tsx` ("shows the Profil hub with summary on top and groups in fixed order"). Kein automatisierter Test für `tabBarLabel` (siehe F-5). Hinweis: Titel `Profil` erscheint nur im geladenen Zustand (Lade-/Fehler-/Leerzustand ohne Titel, siehe F-3). |
| AC-2 | PASS | Diff `ProfileEditScreen.tsx`: `handleSave`, `isValid`, Payload und `profileApi.createProfile/updateProfile` unverändert; nur `Alert` → `InfoOverlay`/`Snackbar`, Accessibility und Tokens geändert. Anzeige in `ProfileScreen.tsx` (Basisdaten, Alltag & Training, Ziel, Tagesziele Ruhe-/Trainingstag) inhaltlich unverändert. `ProfileScreen.test.tsx`, `ProfileEditScreen.test.tsx`. Keine Änderungen an `shared/`, `backend/`. |
| AC-3 | PASS | Einziger Einstieg: Hub-Eintrag `Favoriten & Eigene Lebensmittel` → Route `Library` (`profileHubGroups.ts`). `LibraryScreen.tsx` mit Tabs `Favoriten`/`Eigene Lebensmittel`. `ownFoodItems.ts` schließt `sourceType: 'openFoodFacts'` aus (gleiche Filter-/Sortierlogik wie das gelöschte `MyProductsScreen`, per `git show HEAD:` verglichen). Suche (Name/Marke), Bearbeiten (`LabelScanReviewScreen` mode `edit`), Löschen (`ConfirmSheet`), Pull-to-Refresh und verzögerter Reload nach Enrichment (4 s) erhalten (`OwnFoodsView.tsx`). `MyProductsScreen.tsx` gelöscht, `MyProducts` weder in `RootNavigator.tsx` noch `ProfileStackParamList`; Grep in `mobile/src` ohne Treffer; kein `linking`/`prefixes` am `NavigationContainer`, Schema `fittrack` nur für Auth-Redirect. `LibraryScreen.test.tsx`, `ownFoodItems.test.ts`. Zweiter Profil-Tab `Meine Lebensmittel` und Header-Aktion `Bibliothek` entfernt (`ProfileScreen.test.tsx`). |
| AC-4 | PASS (mit Non-blocking-Findings) | Betroffene Dateien nutzen `colors/typography/spacing/radius`; Hex-Farben in `HealthConnectScreen.tsx` durch Tokens ersetzt (Diff), Emoji/Unicode-Icons (`‹`, `▲/▼`) durch `Icon` ersetzt. Karten über `profileCardStyle` (Card DNA, deckungsgleich mit `docs/kb/product/03-design-system.md`), Suchfeld in `OwnFoodsView.tsx` als Pill (`radius.full`, 52 pt, `surfaceMuted`, ohne Rahmen). `FoodProductSummary.tsx` ist rein präsentativ, `FOOD_THUMBNAIL_SIZE = 52`, Buchstaben-Avatar-Fallback, Name, Marke, Badges, Nährwertzeile; genutzt von `SearchState.ResultRow` und `OwnFoodsView`. Aktionen getrennt: Hub: Favoriten-Herz (`trailing`), Quick-Accept (`footer`), Auswahl; Bibliothek: Tap = Bearbeiten, separater Löschen-Button. `FoodProductSummary.test.tsx`, `foodProductSummaryUtils.test.ts`. Restpunkte: F-1 (Edit-Dialog mit Emoji), F-2 (verbliebene direkte Werte). |
| AC-5 | PASS (mit Non-blocking-Finding) | Kein `Alert.alert` mehr in `ProfileScreen.tsx`, `ProfileEditScreen.tsx`, `LibraryScreen.tsx`, `OwnFoodsView.tsx`, `FavoritesView.tsx`, `HealthConnectScreen.tsx` (Grep). Ersatz durch `ConfirmSheet`, `InfoOverlay`, `Snackbar`. `LibraryScreen.test.tsx` mockt `Alert` so, dass jede Nutzung fehlschlägt; `ProfileEditScreen.test.tsx` ("shows an InfoOverlay instead of a system alert"). Offen: `LabelScanReviewScreen.tsx` (Zeile 172) nutzt weiterhin `Alert.alert` im Edit-Flow eigener Lebensmittel (Datei nicht im Plan-Scope, vom Implementierer offengelegt, siehe F-1). |
| AC-6 | PASS | `ProfileScreen.tsx`: Status `loading`/`ready`/`error`; `Noch kein Profil` nur bei erfolgreichem Request ohne Profil, Fehler → `Profil konnte nicht geladen werden` + `Erneut versuchen`, Refresh-Fehler bei vorhandenen Daten → Snackbar. `useLibraryList.ts` für Favoriten und Eigene Lebensmittel mit gleichem Muster. Tests: `ProfileScreen.test.tsx` (Fehlerzustand vs. Leerzustand), `LibraryScreen.test.tsx` (Fehler ≠ leer, Retry, Refresh-Fehler behält Daten). |
| AC-7 | PASS | Native Ansichten `LegalDocumentView.tsx`/`LegalScreens.tsx`; kein `Linking`/`WebBrowser`/`openURL` in `modules/legal` und `modules/profile` (Grep). Einstiege: `Profil > Rechtliches` (Routen `Imprint`, `PrivacyPolicy`), `LoginScreen.tsx` (lokaler State, ohne Auth), `ProfileWizardScreen.tsx` (Willkommensschritt und Vorschau direkt vor `handleSave`; Eingaben bleiben im State). Tests: `LoginScreen.test.tsx`, `ProfileWizardScreen.test.tsx` (Schritt 0), `LegalDocumentView.test.tsx`. Der Link in der Wizard-Vorschau ist nur per Code-Review verifiziert (siehe F-5). |
| AC-8 | PASS | `profileHubGroups.ts`: feste Reihenfolge Bibliothek → Integrationen → Gemeinsam → Rechtliches, leere Gruppen gefiltert (`shared: []` wird nicht gerendert), Einfügeposition dokumentiert. `ProfileGroup`/`ProfileRow` wiederverwendbar; `profileHubGroups.test.ts` prüft Reihenfolge und simulierte Erweiterung von `Gemeinsam`. Keine Platzhalter-Route registriert. Einzige Ausnahme `Konto löschen` (AC-15). KB: `docs/kb/product/02-navigation.md` (Tabelle, `[Planned]` für `Gemeinsam`), `docs/kb/product/05-ux-patterns.md`, `docs/kb/tech/03-mobile.md`; keine Aussagen zu Haushaltsrechten. |
| AC-9 | PASS (Code-Ebene); Android-Verhalten MANUAL VALIDATION REQUIRED | `services/health/*` unverändert (nicht in `git status`). Defaults `enabled: false` in `healthSyncService.ts`/`nutritionSyncService.ts`; getrennte Aktivierung je Kategorie. `healthConnectCopy.ts`: Datenkategorie + `Ziel: Health Connect auf deinem Gerät`, vor Aktivierung als `SyncNotice` gerendert; `healthConnectCopy.test.ts` prüft kein `google|cloud|konto`. `disableSync()` löscht weder Health-Connect-Daten noch Warteschlange. Der Umbau löst keine Synchronisation aus (Handler unverändert, nur Aktivierungs-Buttons). Deaktivieren-`ConfirmSheet`: "Deine bisherigen Daten bleiben in Health Connect erhalten." |
| AC-10 | MANUAL VALIDATION REQUIRED (Code-Indikatoren positiv) | Code: Touch-Ziele über `minHeight: spacing.xxl` (48) bei Hub-Zeilen, Tabs, Buttons, Login-/Wizard-Datenschutzlink; `flexWrap`/`flexShrink` und `ScrollView` für Lade-/Fehler-/Leerzustände und Rechtsseiten; `accessibilityRole/Label/State` an Zurück-Buttons, Tabs (`tablist`/`tab`), Hub-Zeilen, deaktiviertem Platzhalter; Nährwertzeile ohne `numberOfLines` (bricht um). Keine Geräte-/Viewport-/Screenreader-Prüfung möglich, siehe Verification Notes. |
| AC-11 | PASS | `git status --short`/`git diff --stat HEAD`: geändert nur `mobile/src/**`, `docs/kb/**`, Plan-Datei; neu `docs/legal/` und neue Mobile-Dateien. Keine Änderungen in `backend/`, `shared/`, `infra/`, `mobile/app.config.js`, `app.json`, `eas.json`, `android/`, keiner `package.json`/Lockfile. Keine neue Dependency; `mobile/src/shared/api/profileApi.ts` unverändert. Mobile Build Impact: None. |
| AC-12 | PASS | `legalTexts.test.ts` vergleicht eingebetteten Text byte-genau (CRLF-normalisiert) mit `docs/legal/datenschutzerklaerung-alpha.md` und `impressum-alpha.md`; Test auf eckige Klammern ohne Treffer. Text liegt einmalig in `mobile/src/modules/legal/legalTexts.ts`. Inhaltliche Gegenprüfung gegen Code: SecureStore für Tokens (`services/authService.ts`), Gewicht/Ernährung getrennt und standardmäßig aus, Diagnoseprotokoll max. 150 (`syncLogger.ts`) und löschbar (`syncLogger.clear`, `HealthConnectScreen.tsx`), Daily-/Weekly-Insights mit `ttl`/`expiresAt` (`backend/src/lib/weeklyInsight.ts`, `insightRepository.ts`), keine Nutzer-ID/E-Mail in `backend/src/lib/openai.ts`. Einschränkung zum Diagnoseprotokoll: F-4. |
| AC-13 | PASS | `ProfileEditScreen.tsx`: nur deaktivierter `Konto löschen`-Platzhalter; `profileApi.deleteProfile` hat keinen Aufrufer in der UI (Grep: nur Definition in `profileApi.ts` und Mock im Test). Datenschutztext enthält kein `DELETE /api/profile` (Test in `legalTexts.test.ts`) und behauptet keinen Löschweg. |
| AC-14 | PASS | Datenschutztext, Abschnitt `## Hinweis`: "Das ist eine Alpha-Version. Dieser Text kann sich ändern." (Test in `legalTexts.test.ts`); Plan-Header und Kommentar in `legalTexts.ts` kennzeichnen den Text als Alpha-Text ohne juristische Prüfung. |
| AC-15 | PASS | `ProfileEditScreen.tsx`: `ProfileRow label="Konto löschen" detail="Wird später verfügbar" disabled` nur bei `!isNew`; `ProfileRow` rendert deaktiviert als `View` ohne `onPress`, ohne Chevron, `accessibilityState={{ disabled: true }}`, Label `Konto löschen, Wird später verfügbar`. Alter `Profil löschen`-Button und `handleDelete` entfernt. `ProfileEditScreen.test.tsx` prüft Nicht-Interaktivität und `deleteProfile` nicht aufgerufen, kein Platzhalter bei Neuanlage. |
| AC-16 | PASS | Datenschutztext, Abschnitt `## Speicherdauer und Löschen`: "Deine Daten bleiben gespeichert, bis dein Konto gelöscht wird.", "**Konto löschen ist in der Alpha noch nicht verfügbar.** Aktuell gibt es keinen anderen Weg, Daten zu löschen."; Abschnitt `## Fragen?` bietet keine Löschung per E-Mail an ("Die Adresse dient nur für Fragen."). Test in `legalTexts.test.ts`. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm run typecheck --workspace=@fittrack/mobile` | 0 | `tsc --noEmit` ohne Fehler |
| `npm test --workspace=@fittrack/mobile` | 0 | 71 Testdateien, 698 Tests bestanden, 0 fehlgeschlagen (React-Test-Renderer-Deprecation-Warnungen auf stderr, nicht relevant) |
| `npm run check:encoding` | 0 | "Encoding check passed." |
| `git status --short` und `git diff --stat HEAD` | 0 | Nur `mobile/src/**`, `docs/kb/**`, Plan-Datei geändert; `docs/legal/` und neue Mobile-Dateien untracked; keine Backend-/Shared-/Infra-/Config-/package.json-Änderung (AC-11) |
| Grep `MyProducts`, `deleteProfile`, `Linking`/`WebBrowser`/`openURL`, `Alert.alert`, `Google` in `mobile/src` | 0 | Keine Restreferenzen auf `MyProducts`; keine externen Legal-Links; `Alert.alert` nur noch in `LabelScanReviewScreen.tsx` und `ProfileWizardScreen.tsx` (Wizard laut Plan out of scope); kein Google-Bezug in Health-Connect-Texten |

Backend- und Shared-Tests wurden nicht ausgeführt (keine Änderungen in diesen Paketen).

## Verification Notes

- State: `MANUAL VALIDATION REQUIRED`
- Reason: Kein Gerät/Emulator, keine Viewport-/Schriftgrößen-/Screenreader-Tooling in dieser Umgebung (AC-10, AC-9, AC-4).
- Manual action (Prerequisite: Android-Gerät mit Preview/Dev-Build, iOS-Gerät/Simulator; TalkBack/VoiceOver). Ergebnisfeld jeweils vom Nutzer auszufüllen:

| # | Prüfung | Schritte | Erwartung | Ergebnis |
|---|---|---|---|---|
| M-1 | Profil-Hub schmal/groß | Schmales Gerät oder Android-Schriftgröße "Größte" und iOS Dynamic Type; Tab `Profil` öffnen, alle Gruppen scrollen | Tab-Label `Profil`; Hub-Namen (inkl. `Favoriten & Eigene Lebensmittel`) umbrechen statt abzuschneiden; kein horizontales Scrollen; `Bearbeiten` erreichbar | ☐ |
| M-2 | Profil-Zustände | Flugmodus an, Tab öffnen; danach Netz an, `Erneut versuchen` | Fehlerzustand, nicht `Noch kein Profil`; Retry lädt Profil | ☐ |
| M-3 | Bibliothek | `Profil > Favoriten & Eigene Lebensmittel`; beide Tabs; Suche, Bearbeiten, Löschen, Pull-to-Refresh bei großer Schrift | Tabs nicht abgeschnitten; Zeilen mit 52-pt-Thumbnail/Buchstaben-Avatar; Löschen mit `ConfirmSheet`, Snackbar mit Hinweis auf behaltene Tagebuch-Einträge; keine OpenFoodFacts-Items | ☐ |
| M-4 | Search Hub 52 pt | Mahlzeit hinzufügen → Suche; scrollen im Bottom Sheet, Herz tippen, im Rezeptmodus Quick-Accept | Zeilen und Scrollen nicht überlagert; Herz/Quick-Accept lösen nicht die Zeilenauswahl aus; Trefferdichte akzeptabel | ☐ |
| M-5 | Konto-Löschen-Platzhalter | `Profil > Bearbeiten` (bestehendes Profil) mit TalkBack/VoiceOver; Zeile antippen | Ansage "Konto löschen, Wird später verfügbar, deaktiviert"; Tippen ohne Reaktion/Dialog/Request | ☐ |
| M-6 | Legal-Einstiege | Ausgeloggt: `LoginScreen` → `Datenschutzerklärung`; Neuinstallation: Wizard Schritt 0 und Vorschau → `Datenschutzerklärung`; `Profil > Rechtliches` → beide Seiten; jeweils Zurück-Button und Android-Zurückgeste | Kein Browser; Text vollständig scrollbar; Zurück führt zum Ausgangsscreen, Wizard-Eingaben bleiben erhalten | ☐ |
| M-7 | Health Connect Android | `Profil > Health Connect` (Android, Preview-Build) | Vor Aktivierung je Karte `Datenkategorie` + `Ziel: Health Connect auf deinem Gerät`; Opt-ins getrennt, standardmäßig aus; Berechtigungsdialog nur nach Tippen auf Aktivieren; Deaktivieren behält geschriebene Einträge; Status/Re-Export unverändert | ☐ |
| M-8 | Health Connect iOS | `Profil > Health Connect` auf iOS | Weiterhin `Nur unter Android verfügbar` | ☐ |
| M-9 | Screenreader Hub/Dialoge | TalkBack/VoiceOver durch Hub, Library-Tabs, `ConfirmSheet`, `InfoOverlay` | Sinnvolle Reihenfolge/Beschriftung; Tabs als ausgewählt/nicht ausgewählt angesagt | ☐ |

- State: `UNVERIFIED`
- Reason: Aussagen des Datenschutztexts zu Azure-Region/Dienstkonfiguration (`North Europe`, `Germany West Central`, Retention 30 Tage) sind aus dem Plan (Azure-Abfrage 2026-10-07) übernommen und wurden in dieser Umgebung nicht gegen Azure geprüft; der Text selbst nennt nur "Azure-Dienste in Europa" und "30 Tage".
- Manual action: Bei Bedarf vor dem Release gegen die tatsächliche Azure-Konfiguration abgleichen (kein Gate laut Plan).

- Hinweise (keine Findings):
  - Neue Dateien unter `docs/legal/` sind untracked und müssen mit dem Änderungssatz committet werden; `legalTexts.test.ts` liest sie per `node:fs` und schlägt ohne sie fehl.
  - Offene künftige Punkte, ausdrücklich nicht als implementiert bewertet: `Gemeinsam` (Freunde/Haushalt, `[Planned]`), Altersvalidierung, vollständige Kontolöschung (`DELETE /api/profile` löscht nur das Profil-Dokument), juristische Prüfung der Rechtstexte vor öffentlichem Release.
  - Eigene Lebensmittel mit Blob-Pfad statt URL in `imageUrl` zeigen den Buchstaben-Avatar; das frühere `MyProductsScreen` zeigte keine Bilder (kein Regress).
  - `ProfileWizardScreen` enthält weiterhin `Alert.alert`, Emoji und direkte Werte; laut Plan out of scope (kein allgemeines Wizard-Redesign).

## Findings

Finding key: F-1
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung.md`
Acceptance criterion: AC-4, AC-5
Description: Der Bearbeiten-Flow `Eigene Lebensmittel` öffnet `LabelScanReviewScreen` (mode `edit`). Dieser verwendet weiterhin `Alert.alert` ("Historische Einträge aktualisieren?" mit drei Optionen) sowie Emoji-Zeichen als UI-Icons/Beschriftungen. Damit gilt für den vollständigen Weg Profil → Bibliothek → Bearbeiten weder "keine `Alert.alert`" noch "keine Emoji-/Unicode-Icons". Die Datei liegt außerhalb der im Plan genannten Scope-Dateien; der Implementierer hat die Lücke offengelegt und in `docs/kb/tech/03-mobile.md` als Known limitation dokumentiert.
Criticality: Non-blocking
Owner: Frontend
Evidence: `mobile/src/modules/nutrition/LabelScanReviewScreen.tsx` Zeile 172 (`Alert.alert`), Zeilen 282, 312, 418, 431, 446, 564, 597 (Emoji/`✕`); Aufruf in `mobile/src/modules/profile/OwnFoodsView.tsx` (`<LabelScanReviewScreen ... mode="edit" ...>`); Grep `Alert\.alert` in `mobile/src`.
Recommendation: Folgeaufgabe: `handleEditSave` auf `ConfirmSheet` (drei Aktionen) und Emoji auf `Icon` umstellen; Scope-Entscheidung beim Planner/PO, da der Screen auch im Erfassungsflow genutzt wird.

Finding key: F-2
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung.md`
Acceptance criterion: AC-4
Description: In den neu geschriebenen bzw. angepassten Komponenten verbleiben direkte Werte statt Tokens: `FoodProductSummary.tsx` (`paddingVertical: 2` in beiden Badge-Styles, `spacing.xs + 1`), `SearchState.tsx` (`paddingVertical: 12` in `row` und `fallbackAction`, `fontSize: 10` in `fallbackActionLabel`, `gap: 2`/`paddingVertical: 4` in `quickAcceptPill`). Die zum `HealthConnectScreen` gehörende `SyncStatusSheet.tsx` enthält ebenfalls direkte Werte (`rgba(0,0,0,0.55)`, `fontSize: 11`, `✕` als Schließen-Symbol, feste `hitSlop`).
Criticality: Non-blocking
Owner: Frontend
Evidence: `mobile/src/shared/components/FoodProductSummary.tsx` Zeilen 163-181; `mobile/src/modules/nutrition/hub/SearchState.tsx` Zeilen 357, 407, 419, 440-444; `mobile/src/modules/healthConnect/SyncStatusSheet.tsx` Zeilen 79-82, 163, 233; Grep nach `fontSize:|padding*:\s*\d|rgba`.
Recommendation: Direkte Werte auf `spacing.*`/`typography.*`/Overlay-Token abbilden; `SyncStatusSheet` ggf. in die nächste Health-Connect-Berührung aufnehmen. Ob `SyncStatusSheet` in AC-4 fällt, ist im Plan nicht eindeutig (Scope nennt nur `HealthConnectScreen`).

Finding key: F-3
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung.md`
Acceptance criterion: AC-1, AC-7
Description: Hub-Gruppen (Bibliothek, Integrationen, Rechtliches) und der Titel `Profil` werden nur im Zustand `ready` mit vorhandenem Profil gerendert. Bei Profil-Ladefehler oder fehlendem Profil sind Impressum und Datenschutz über `Profil > Rechtliches` nicht erreichbar (Datenschutz bleibt über Wizard/Login erreichbar). Das entspricht dem Vorverhalten für Bibliothek/Health Connect und verletzt den Wortlaut der ACs nicht, ist aber für das neue Ziel "Rechtliches fest am Hub-Ende" eine Einschränkung.
Criticality: Suggestion
Owner: Planner
Evidence: `mobile/src/modules/profile/ProfileScreen.tsx` `renderBody()` (Rückgaben für `loading`, `error`, `!profile` ohne `getProfileHubGroups()`); Vorversion `git show HEAD:mobile/src/modules/profile/ProfileScreen.tsx`.
Recommendation: Produktentscheidung, ob `Rechtliches` (und ggf. `Integrationen`) auch in Fehler-/Leerzustand angezeigt werden soll.

Finding key: F-4
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung.md`
Acceptance criterion: AC-12
Description: Der Datenschutztext sagt, das Diagnoseprotokoll könne "in der Health-Connect-Ansicht manuell" gelöscht werden. Die Schaltfläche `Log leeren` wird nur gerendert, wenn `EXPO_PUBLIC_APP_VARIANT` `development` oder `preview` ist (`IS_DEBUG_BUILD`). Für die aktuelle Alpha-Verteilung (EAS-Profil `preview`) stimmt die Aussage; für eine künftige `production`-Variante wäre sie falsch, während `syncLogger` weiterhin schreibt.
Criticality: Suggestion
Owner: Documentation
Evidence: `mobile/src/modules/healthConnect/HealthConnectScreen.tsx` Zeilen 39-42, 586-608; `mobile/eas.json` (`preview` setzt `EXPO_PUBLIC_APP_VARIANT`, `production` leer); `docs/legal/datenschutzerklaerung-alpha.md` Abschnitt `Speicherdauer und Löschen`.
Recommendation: Vor einem Build ohne `development`/`preview`-Variante entweder die Log-Ansicht freigeben oder den Textabschnitt (MD-Datei und `legalTexts.ts` gemeinsam) anpassen.

Finding key: F-5
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung.md`
Acceptance criterion: AC-1, AC-4, AC-7
Description: Testlücken bei Teilaspekten, die nur per Code-Review verifiziert wurden: (a) `tabBarLabel: 'Profil'` in `RootNavigator.tsx` ist nicht automatisiert abgesichert; (b) `SearchState.ResultRow` (52-pt-Thumbnail über `FoodProductSummary`, getrennte Favoriten-/Quick-Accept-Aktionen) hat keinen eigenen Test; (c) der Datenschutzlink in der Wizard-Vorschau (vor dem Speichern) ist nicht getestet (nur Schritt 0).
Criticality: Suggestion
Owner: Frontend
Evidence: Testliste: `mobile/src/modules/profile/ProfileWizardScreen.test.tsx` (nur "opens the Datenschutz text from the welcome step"); kein Test für `RootNavigator` oder `ResultRow` in `mobile/src`.
Recommendation: Gezielte Tests für Wizard-Vorschau-Link und `ResultRow`-Aktionstrennung ergänzen; Tab-Label ggf. über Konstante testbar machen.

Finding key: F-6
Plan reference: `docs/User Stories/plans/PLAN_Profilebereich_Redesign_und_Strukturierung.md`
Acceptance criterion: AC-4
Description: Thumbnail-Größen im Search Hub sind nicht einheitlich: `RelationRow` (zuletzt verwendet, ohne Suchbegriff) nutzt 50 pt, das unreferenzierte `RecentItem` 44 pt, `ResultRow` jetzt 52 pt. Die zwei Komponenten sind nicht Teil der AC-4-Formulierung (nur Suchergebnisse und Eigene Lebensmittel), die Abweichung ist teilweise als Known limitation dokumentiert (`RecentItem`).
Criticality: Suggestion
Owner: Frontend
Evidence: `mobile/src/modules/nutrition/hub/RelationRow.tsx` Zeile 26 (`THUMBNAIL_SIZE = 50`); `mobile/src/modules/nutrition/hub/RecentItem.tsx` Zeile 12 (`44`); `mobile/src/shared/components/foodProductSummaryUtils.ts` (`FOOD_THUMBNAIL_SIZE = 52`); `docs/kb/tech/03-mobile.md` "Known limitations".
Recommendation: Bei nächster Überarbeitung des Hubs `RelationRow` auf `FOOD_THUMBNAIL_SIZE` angleichen; `RecentItem`/`FoodSearchResultList` entfernen oder weiterverwenden.
