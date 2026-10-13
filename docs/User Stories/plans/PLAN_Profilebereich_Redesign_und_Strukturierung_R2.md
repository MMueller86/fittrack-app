# Technischer Plan (Revision R2): Profil-Hub verschlanken, Favoriten angleichen, QA-Findings beheben

**Status:** Ready for implementation. Eine nicht blockierende offene Produktfrage (PO-1, Fotos eigener Lebensmittel), alle Work Packages sind ausführbar.
**Basis:** Revision von [`PLAN_Profilebereich_Redesign_und_Strukturierung.md`](PLAN_Profilebereich_Redesign_und_Strukturierung.md) (R1, umgesetzt als F-1.1 bis F-1.4, QA `PASS WITH ISSUES`: [`docs/qa/reports/PLAN_Profilebereich_Redesign_und_Strukturierung.md`](../../qa/reports/PLAN_Profilebereich_Redesign_und_Strukturierung.md)). R1 bleibt unverändert als Historie; wo R2 und R1 abweichen, gilt R2 (siehe „Verhältnis zu R1“).
**User Story:** None — eigenständiger Redesign-Auftrag des Users vom 2026-10-12.
**Infrastructure Impact:** None
**Mobile Build Impact:** None

## Open Product Owner Decisions

- **PO-1 (nicht blockierend): Fotos eigener Lebensmittel.** Für eigene Lebensmittel mit Foto liefert die API in `imageUrl` nur einen Blob-Pfad (`<userId>/<itemId>.jpg`), keine ladbare URL. Such-Hub, `Eigene Lebensmittel` und künftig `Favoriten` zeigen dafür den Buchstaben-Avatar (Ist-Stand, kein Regress). Sollen diese Fotos angezeigt werden?
  - **Option A (empfohlen, falls gewünscht):** Backend löst Blob-Pfad in `food-search`, `reusable-items` (Liste) und `favorites` zu einer kurzlebigen SAS-URL auf (eigener Backend-Plan, kein neues Feld, nur Wertänderung von `imageUrl`).
  - **Option B:** Mobile ruft pro Zeile `GET /api/reusable-items/:id/image` auf (N+1-Requests, SAS-Cache nötig). Nicht empfohlen.
  - **Option C (in R2 umgesetzt):** Parität mit dem Such-Hub, Avatar-Fallback bleibt. Keine API-Änderung.
  - Alle R2-Work-Packages sind unabhängig von dieser Entscheidung.

## Vom User delegierte Entscheidung (vom Planner getroffen)

**Tab-Label bleibt `Profil`; Route-ID `Profile` bleibt unverändert.** Begründung:

1. Die erste Karte im Hub ist die persönliche Karte `Basisdaten`; der Hub bleibt damit ein Ort mit Nutzeridentität. Ein generisches `Mehr` würde diese Karte und `Favoriten & Eigene Lebensmittel` hinter einem Sammelbegriff verstecken und die Auffindbarkeit senken.
2. `Profil` ist bereits bestätigt (R1 „Confirmed Product Decisions“) und im Code, KB und Tests verankert; ein Wechsel wäre eine reine Umbenennung ohne Nutzen für das vom User beschriebene Problem (Einstellungen erst nach Scrollen sichtbar). Dieses Problem löst die neue Hub-Struktur, nicht das Label.
3. `Mehr` bräuchte ein neues Tab-Icon (`ProfileIcon` ist ein Personen-Symbol) und würde die künftige Gruppe `Gemeinsam` (Freunde/Haushalt) semantisch schlechter einordnen.
4. Neubewertung, falls der Hub später mehrere nicht profilbezogene Bereiche aufnimmt, sodass die persönliche Karte nicht mehr der Kern ist.

## 1. Requirement Assessment

**Classification:** Accept with modifications.

| Anforderung des Users | Bewertung |
|---|---|
| Findings 107, 108, 109, 111, 112 beheben, 110 unberührt lassen | Accept. 109 wird durch die neue Hub-Struktur gelöst (R2-AC-5). Scope-Entscheidung 107 siehe F-2.4. |
| Hub: nur erste Karte oben, danach Links; Profil bearbeiten/Details hinter Link | Accept. „Erste Karte“ = `Basisdaten` (siehe Ist-Stand). Details/Tagesziele wandern in einen neuen read-only Screen `ProfileDetails`; `ProfileEdit` bleibt reines Formular. |
| Favoriten wie Search-Hub-Ergebnisse (inkl. Bild) | Accept mit Modifikation: gleiche Produktdarstellung über `FoodProductSummary`; Container bleibt die Library-Karte; Bildparität ohne Backend-Änderung, Blob-Pfad-Fotos siehe PO-1. Die R1-Aussage „Favoriten bleibt eine Relation-Liste“ wird für die Darstellung ersetzt (Datenquelle bleibt `UserFoodRelation`). |
| Redesign-Auftrag mit Umsetzung | Plan ist implementierungsreif; Ausführung durch Frontend und QA über den Orchestrator. |

Keine Cosmos-, Azure-OpenAI-, Backend-, Shared- oder Infrastrukturänderung. Es sind keine Skills erforderlich.

## 2. Verhältnis zu R1 (unverändert referenziert, nicht erneut geplant)

Als Ist-Stand übernommen und **nicht** Teil von R2 (Regressionsschutz über bestehende Tests, siehe R2-AC-20):

- Rechtstexte, In-App-Seiten `Imprint`/`PrivacyPolicy`, Einstiege in `LoginScreen`/`ProfileWizardScreen`, `legalTexts.ts` samt `legalTexts.test.ts` (R1 F-1.3, AC-7, AC-12, AC-14, AC-16).
- Deaktivierter Platzhalter `Konto löschen` in `ProfileEditScreen` (R1 AC-13, AC-15).
- `Eigene Lebensmittel`: Filter `ownFoodItems.ts`, Suche, Bearbeiten, Löschen, Refresh, Enrichment-Reload (R1 F-1.2, AC-3).
- Health-Connect-Copy und getrennte Opt-ins (R1 AC-9).
- **FT-QA-2026-110** (Log-Löschung nur in `development`/`preview`): vom User akzeptiert, nicht anfassen. Neubewertung erst bei einer `production`-Variante.

| R1-AC | Status unter R2 |
|---|---|
| AC-1 | Ersetzt durch R2-AC-1 bis R2-AC-3. |
| AC-2 | Anzeige wandert nach `ProfileDetails`: R2-AC-4, R2-AC-6. Berechnungen/API unverändert. |
| AC-3 | Gilt weiter; Darstellung `Favoriten` ergänzt durch R2-AC-7 bis R2-AC-11. |
| AC-4 | Erweitert durch R2-AC-12, R2-AC-13. |
| AC-5 | Erweitert durch R2-AC-15, R2-AC-16 (`LabelScanReviewScreen`). |
| AC-6 | Gilt weiter; Hub-Zustände erweitert durch R2-AC-5. |
| AC-7 | Gilt weiter; `Rechtliches` zusätzlich in jedem Hub-Zustand (R2-AC-5). |
| AC-8 | Ersetzt durch R2-AC-3 (neue Gruppenreihenfolge). |
| AC-9, AC-10, AC-12 bis AC-16 | Unverändert. AC-10 wird für neue/geänderte Screens manuell erneut geprüft (R2-AC-18). |
| AC-11 | Fortgeführt als R2-AC-17. |

## 3. Current Behaviour (geprüft im Repository)

- `ProfileScreen.tsx` (Hub) rendert nur im Zustand `ready` mit Profil: Header (`Profil` + Pille `Bearbeiten`), danach die Karten `Basisdaten`, `Alltag & Training`, `Ziel`, die Überschrift `Tagesziele` mit zwei `MacroGrid`-Karten und **erst danach** die Gruppen aus `profileHubGroups.ts` (`Bibliothek`, `Integrationen`, `Rechtliches`). Die Navigationslinks liegen dadurch weit unterhalb des ersten Bildschirms.
- Im Lade-/Fehler-/Leerzustand rendert der Hub weder Titel noch Gruppen; `Impressum`/`Datenschutzerklärung` sind dann nur über Login/Wizard erreichbar (FT-QA-2026-109).
- Vor dem R1-Redesign war die erste Karte ebenfalls `Basisdaten` (`git show HEAD:…/ProfileScreen.tsx`); der User meint diese Karte.
- `ProfileEditScreen` erwartet den Parameter `{ profile: UserProfile | null }` und ruft nach Speichern `navigation.goBack()`. Einziger Aufrufer von `ProfileEdit` ist der Hub. Es gibt keine Deep-Links (`NavigationContainer` ohne `linking`).
- `FavoritesView.tsx` rendert `UserFoodRelation` als eigene Karte (`FavoriteRow`): Name, Marke, Textzeile `Katalog · Eigenes Lebensmittel · Rezept · n× verwendet`, rechts Herz-Button, **ohne** Bild und ohne Nährwerte. Entfernen mit `ConfirmSheet`. `isUnavailableRecipeRelation` wird dort nicht berücksichtigt.
- `OwnFoodsView.tsx` nutzt `FoodProductSummary` in einer Karte (`profileCardStyle`) mit Tap = Bearbeiten und separatem Löschen-Button. `SearchState.ResultRow` nutzt `FoodProductSummary` als flache Trennlinien-Zeile mit Herz (`trailing`) und Quick-Accept (`footer`).
- `UserFoodRelation` (shared) enthält bereits alles Nötige denormalisiert: `displayName`, `displayBrand`, `imageUrl`, `nutritionPer100g`, `portion`, `isComplete`, `foodRefType`, `recipeAccess`. Ein Feld `nutritionBasis` fehlt. Für Rezept-Relationen entfernt das Backend `displayBrand`, `imageUrl`, `nutritionPer100g`, `portion`, `isComplete`, `recipeAccess` im Cache (`stripRecipeRelationCache`) und projiziert den Zugriff beim Lesen (`projectRecipeReferenceAccess`).
- Bild-Ist-Stand: `food-search` und `reusable-items` liefern für eigene Produkte den Blob-Pfad in `imageUrl`; `isRemoteImageUri` in `foodProductSummaryUtils.ts` zeigt dafür den Buchstaben-Avatar. `POST /api/favorites` validiert `imageUrl` als `z.string().url()`; `SearchState.ResultRow.handleFavoriteToggle` sendet `item.imageUrl ?? null` ungefiltert. Ein Blob-Pfad würde dort als ungültige URL abgelehnt (400) und der Herz-Toggle stillschweigend zurückgesetzt. **Das ist aus dem Code abgeleitet und im Frontend-Schritt F-2.2 zuerst per Test zu bestätigen.**
- Direkte Werte (FT-QA-2026-108): `FoodProductSummary.tsx` (`paddingVertical: 2`, `spacing.xs + 1`), `SearchState.tsx` (`paddingVertical: 12` in `row` und `fallbackAction`, `fontSize: 10`, `gap: 2`, `paddingVertical: 4`, `Icon size={12}`, `hitSlop`-Literale), `SyncStatusSheet.tsx` (`rgba(0,0,0,0.55)`, `fontSize: 11`, `✕`, `hitSlop`-Literale). Im Theme existiert kein Overlay-Token; `ConfirmSheet` verwendet `rgba(0,0,0,0.6)`.
- Thumbnails: `FOOD_THUMBNAIL_SIZE = 52`; `RelationRow` 50 pt; `RecentItem.tsx` (44 pt) und `shared/components/FoodSearchResultList.tsx` sind im Mobile-Code unreferenziert.
- `LabelScanReviewScreen.tsx`: `Alert.alert` nur in `handleEditSave` (Zeile 172, ausschließlich Edit-Modus); Emoji/Unicode-Zeichen an mehreren Stellen (`✏️`, `📷`, `⚠️`, `🔧`, `✨`, `⏳`, `✕`, `💾`, `🔄`, `‹`) in Edit- und Erfassungsmodus. Der Screen wird von `AddItemModal` (zwei Stellen), `hub/LabelSubFlow`, `hub/ManuellerSubFlow` und `OwnFoodsView` verwendet.
- Tests: `tabBarLabel: 'Profil'` ist ungetestet; für `ResultRow` existiert kein Test; `ProfileWizardScreen.test.tsx` deckt den Datenschutz-Link nur in Schritt 0 ab.

## 4. Desired Behaviour

### 4.1 Profil-Hub

Der Tab `Profil` zeigt von oben nach unten: Titel `Profil`, **genau eine Karte** (`Basisdaten`, Inhalt unverändert), dann die Linkgruppen. Alles andere (Alltag & Training, Ziel, Tagesziele, Bearbeiten) liegt hinter dem Link `Profil & Tagesziele`.

```
Profil
┌ Basisdaten ───────────────┐
│ Geschlecht / Alter /      │
│ Größe / Gewicht /         │
│ Zielgewicht               │
└───────────────────────────┘
PERSÖNLICHE DATEN
 › Profil & Tagesziele        (Details ansehen und bearbeiten)
BIBLIOTHEK
 › Favoriten & Eigene Lebensmittel
INTEGRATIONEN
 › Health Connect
[GEMEINSAM — [Planned], wird nicht gerendert]
RECHTLICHES
 › Impressum
 › Datenschutzerklärung
```

Entscheidungen und Begründung:

- **Erste Karte = `Basisdaten`.** Das ist die erste Karte im Ist-Stand und vor dem R1-Redesign. Eine neue Kompakt-Zusammenfassung würde neue Inhalte erfinden und ist nicht gewünscht.
- **Genau ein Link zu Profil/Details/Bearbeiten (`Profil & Tagesziele`)**, kein zweiter Bearbeiten-Eintrag im Hub: hält die Linkliste kurz, damit `Bibliothek` und `Integrationen` ohne Scrollen sichtbar bleiben. Die Pille `Bearbeiten` im Hub-Header entfällt; `Bearbeiten` liegt im Header von `ProfileDetails`. **Konsequenz (bewusst):** Profil bearbeiten braucht zwei Taps statt einem. Bearbeiten ist laut Domain selten (Gewichtsverlauf läuft über Progress).
- **Details-Ziel = neuer Screen `ProfileDetails` im Profile-Stack**, nicht `ProfileEdit`. `ProfileEdit` ist ein Formular und kann weder `Tagesziele` noch die read-only Karten darstellen; die Tagesziele (`targets`) kommen aus `GET /api/profile` und werden nicht im Formular berechnet.
- **Hub in jedem Zustand erreichbar (FT-QA-2026-109):** Titel und die Gruppen `Bibliothek`, `Integrationen`, `Rechtliches` werden **immer** gerendert. Der Platz der ersten Karte zeigt je nach Zustand: Laden (`ActivityIndicator`), Fehler (`Profil konnte nicht geladen werden` + `Erneut versuchen`) oder kein Profil (`Noch kein Profil` + `Profil einrichten`). Die Gruppe `Persönliche Daten` erscheint nur, wenn ein Profil geladen ist (keine toten Links). Bibliothek und Integrationen sind unabhängig vom Profilzustand nutzbar (eigene Endpunkte).

### 4.2 Favoriten

`FavoritesView` rendert jede Zeile mit demselben `FoodProductSummary` wie der Such-Hub: 52-pt-Thumbnail (Bild oder Buchstaben-Avatar), Name, Marke, Herkunfts-Badge, Nährwertzeile. Der Container ist dieselbe Library-Karte wie bei `Eigene Lebensmittel` (Card DNA des Profilbereichs); nur die Produktdarstellung ist mit dem Hub identisch, nicht der flache Trennlinien-Container des Bottom Sheets.

Mapping `UserFoodRelation` → `FoodProductSummary` (ohne Backend-/Shared-Änderung, ohne zusätzlichen Request):

| Summary-Prop | Quelle |
|---|---|
| `name` | `displayName`; bei nicht verfügbarem Rezept (`isUnavailableRecipeRelation`) `Rezept nicht verfügbar` |
| `brand` | `displayBrand`; Fallback Rezept: `Community-Rezept` / `Eigenes Rezept` (wie `RelationRow`) |
| `imageUri` | `imageUrl` (Remote-URL → Bild; sonst/`null`/Blob-Pfad → Buchstaben-Avatar, identisch zum Such-Hub) |
| `badges` | `catalog` → `OFF` (accent), `personal` → `Eigen` (neutral), `recipe` → `Rezept` (neutral); gleiche Vokabeln wie `resultBadges` im Hub |
| `incomplete` | `isComplete === false` |
| `nutrition` | `nutritionPer100g` |
| `nutritionBasis` | fest `'per100g'` (Relation hat kein Basisfeld; ohne `nutritionPer100g` entfällt die Nährwertzeile) |
| `portion` | `portion` |

Aktionen in der Favoritenansicht: **nur Favorit entfernen** (Herz-Button am Karten-Rand, 48 pt, mit bestehendem `ConfirmSheet` und Snackbar bei Fehler). Kein Tap auf die Zeile (es gibt kein Ziel). Die frühere Textzeile `n× verwendet` entfällt bewusst, damit die Zeile dem Hub entspricht; die Herkunft steht im Badge. Sortierung bleibt die API-Sortierung (Name, `de`).

**Backend-/API-Bedarf: keiner** (siehe PO-1 für Blob-Pfad-Fotos).

## 5. Scope

- Hub-Umbau, neuer Screen `ProfileDetails`, Zustände des Hubs, `profileHubGroups.ts`, Tab-Label-Konstante, Stack-Registrierung.
- `FavoritesView` auf `FoodProductSummary`; gemeinsamer Karten-Container für `Favoriten` und `Eigene Lebensmittel`; `ResultRow`-Favoriten-Guard gegen Blob-Pfad-`imageUrl`.
- Token-Bereinigung in `FoodProductSummary.tsx`, `SearchState.tsx`, `SyncStatusSheet.tsx` (inkl. ggf. neuem Theme-Token `colors.overlay`).
- Thumbnail-Vereinheitlichung (`RelationRow`), Entfernung unreferenzierter `RecentItem.tsx` und `FoodSearchResultList.tsx`.
- `LabelScanReviewScreen`: `Alert.alert` im Edit-Flow und Emoji/Unicode-Icons.
- Tests für Tab-Label, `ResultRow`, Wizard-Vorschau-Datenschutzlink sowie die neuen Hub-/Details-/Favoriten-Zustände.
- KB-Aktualisierung.

## 6. Out of Scope

- Backend, Shared, API-Verträge, Cosmos, Infrastruktur, native Konfiguration, neue Dependencies.
- Auflösung von Blob-Pfad-Fotos (PO-1) und jede Änderung an `imageUrl`-Semantik.
- Migration von `RelationRow`/Recents im Hub auf `FoodProductSummary` (andere Aktionen: `Wie immer?`, Rezept-Icon, Nutzungsring); nur die Thumbnail-Größe wird angeglichen.
- Allgemeines Redesign von `ProfileWizardScreen` (`Alert.alert`, Emoji, direkte Werte dort bleiben wie in R1 out of scope; nur der Datenschutz-Link-Test in der Vorschau wird ergänzt).
- `Gemeinsam` (Freunde/Haushalt), Altersvalidierung, vollständige Kontolöschung, FT-QA-2026-110.
- Änderungen an Profilberechnung, Zielwerten oder `profileApi`.

## 7. Confirmed Facts

- Route-ID `Profile`, `tabBarLabel: 'Profil'` in `RootNavigator.tsx`; `ProfileStackParamList` enthält `ProfileMain`, `ProfileEdit`, `Library`, `HealthConnect`, `Imprint`, `PrivacyPolicy`. Es gibt keinen `linking`-Konfigurationspunkt für Profile-Routen.
- `ProfileEdit` wird nur aus `ProfileScreen` navigiert; `ProfileEditScreen` navigiert nach Speichern per `goBack()`.
- `ProfileGroup`/`ProfileRow` unterstützen `detail`, `iconName`, `disabled` und tragen Touch-Ziele mit `minHeight: spacing.xxl`.
- `ConfirmSheet` ist ein RN-`Modal` mit beliebig vielen `actions` plus eingebautem `Abbrechen`.
- `FoodProductSummary` ist rein präsentativ und bietet die Slots `trailing` und `footer`; Buchstaben-Avatar-Fallback und `FOOD_THUMBNAIL_SIZE = 52` sind vorhanden.
- Theme-Tokens: `spacing` xs 4, sm 8, md 16, lg 24, xl 32, xxl 48; `typography` mit `caption` 12 und `overline` 11; kein Overlay-Token.
- Knowledge Base sagt in `05-ux-patterns.md` („Favorite Heart Toggle“) noch „favorite management UI is a separate future story“; das ist durch `FavoritesView` überholt (Korrektur im KB-Paket).
- Der Tab ist in `docs/kb/product/02-navigation.md` bereits als `Profil` (Route-ID `Profile`) dokumentiert.

## 8. Assumptions

- Das Tab-Label `Profil` ist durch die oben begründete Entscheidung festgelegt (keine Annahme mehr).
- Ältere Favoriten ohne gespeicherte `nutritionPer100g` zeigen keine Nährwertzeile. Das ist akzeptiert, weil kein zusätzlicher Lookup und keine Backend-Änderung gewünscht sind.
- Die Bewertung „Blob-Pfad wird von `POST /api/favorites` abgelehnt“ ist aus Schema und Code abgeleitet; F-2.2 bestätigt sie per Test, bevor der Guard gesetzt wird.
- Ein neuer, rein additiver Theme-Token `colors.overlay` (Wert wie `ConfirmSheet`, `rgba(0,0,0,0.6)`) ist im Rahmen von FT-QA-2026-108 zulässig und kein API-/Native-Impact.

## 9. Existing Components to Reuse

`ProfileGroup`/`ProfileRow`/`profileCardStyle`, `profileHubGroups.ts`, `LibraryStateView`, `useLibraryList`, `FoodProductSummary` samt `foodProductSummaryUtils.ts`, `ownFoodBadges`/`ownFoodItems.ts`, `ConfirmSheet`, `InfoOverlay`, `Snackbar`, `Icon`, `isUnavailableRecipeRelation` (`nutrition/hub/RelationRow.utils.ts`), `profileApi`, `favoritesApi`.

## 10. Proposed Technical Solution

**Hub und Details (alles profil-lokal, keine globale Abstraktion):**

- Neues profil-lokales Modul `ProfileSummaryCards.tsx`: verschobene Bausteine `InfoRow`, `MacroGrid`, Label-Maps (`GENDER_LABELS`, `ACTIVITY_LABELS`, `GOAL_LABELS`) und die Kartenkomponenten `BasicDataCard`, `LifestyleCard`, `GoalCard`, `TargetsSection` mit unverändertem Inhalt/Format.
- Neuer Hook `useProfileData.ts`: kapselt `profileApi.getMe()` mit Status `loading | ready | error`, `profile`, `targets`, `retry`, `refresh`, Snackbar bei Refresh-Fehler nach erfolgreichem Erstladen (Logik 1:1 aus dem heutigen `ProfileScreen`, inkl. `hasLoadedRef`-Verhalten), und Laden bei Fokus.
- `ProfileScreen` (Hub): nutzt den Hook; rendert Titel, Kartenplatz (`BasicDataCard` bzw. Zustandskarte) und `getProfileHubGroups({ hasProfile })`. Wizard-Zweig (`showWizard`) unverändert. `ScrollView` mit `RefreshControl` bleibt in jedem Zustand erhalten.
- Neuer `ProfileDetailsScreen.tsx` (Route `ProfileDetails`, Param `undefined`): Header im Muster von `LibraryScreen` (Zurück, zentrierter Titel `Profil & Tagesziele`, rechts `Bearbeiten`), Inhalt `LifestyleCard`, `GoalCard`, `TargetsSection`; Laden/Fehler/Retry/Refresh über denselben Hook; Laden bei Fokus, damit nach `ProfileEdit` → Speichern → `goBack()` aktuelle Werte erscheinen. `Bearbeiten` navigiert zu `ProfileEdit` mit dem geladenen `profile`. Ohne Profil (z. B. nach Fehler) ist `Bearbeiten` nicht sichtbar.
- `profileHubGroups.ts`: neue erste Gruppe `profile` (Titel `Persönliche Daten`, Eintrag `Profil & Tagesziele`, `detail: Details ansehen und bearbeiten`, Icon `user`, Route `ProfileDetails`); `ProfileHubRoute` um `ProfileDetails` erweitert; Reihenfolge `profile` → `library` → `integrations` → `shared` → `legal`; Option, die Gruppe `profile` ohne Profil auszublenden. Weiterhin: leere Gruppen nicht rendern.
- `RootNavigator.tsx`: `ProfileDetails` im `ProfileStackParamList` und `ProfileStack` registrieren. Tab-Label und Route-ID aus neuem Modul `mobile/src/app/navigation/profileTab.ts` (`PROFILE_TAB_ROUTE = 'Profile'`, `PROFILE_TAB_LABEL = 'Profil'`) beziehen, damit der Wert testbar ist (FT-QA-2026-111a).

**Favoriten und Library-Container:**

- Pure Funktion `favoriteSummaryProps(relation)` (profil-lokal, z. B. `favoriteFoodSummary.ts`) bildet das Mapping aus Abschnitt 4.2 ab und ist einzeln getestet.
- Profil-lokale Komponente `LibraryFoodCard` (Karte mit `profileCardStyle`, Hauptbereich, optional tippbar, rechter 48-pt-Aktionsbutton). `FavoritesView` und `OwnFoodsView` nutzen sie; keine doppelten Kartenstile mehr. `OwnFoodsView`-Verhalten (Tap = Bearbeiten, Löschen) bleibt identisch.
- `SearchState.ResultRow.handleFavoriteToggle`: `imageUrl` nur senden, wenn `isRemoteImageUri(item.imageUrl)`, sonst `null`.

**Aufräumen:**

- Tokens in `FoodProductSummary.tsx`, `SearchState.tsx`, `SyncStatusSheet.tsx`; `✕` in `SyncStatusSheet` durch `Icon` (`x`); `colors.overlay` in `SyncStatusSheet` und `ConfirmSheet`.
- `RelationRow`: `THUMBNAIL_SIZE` aus `FOOD_THUMBNAIL_SIZE`. `RecentItem.tsx` und `FoodSearchResultList.tsx` (samt etwaiger Tests) löschen, nachdem erneut belegt ist, dass nichts darauf verweist.

**`LabelScanReviewScreen` (Scope-Beurteilung für FT-QA-2026-107):**

- `Alert.alert` kommt ausschließlich im Edit-Modus (`handleEditSave`) vor; der Erfassungsflow ist davon nicht berührt. Ersatz: `ConfirmSheet` mit den Aktionen `Nur Produkt` und `Produkt + Tagebuch-Einträge` (Wortlaut „Diary“ wird durch „Tagebuch“ ersetzt, deutsche UI-Vorgabe), `Abbrechen` ist eingebaut. Der Aufruf von `handleUpdateProduct(false|true)` bleibt unverändert. Das `ConfirmSheet` wird innerhalb des Modal-Inhalts des Screens gerendert (verschachteltes Modal; Verhalten auf iOS und Android manuell prüfen).
- Emoji/Unicode-Icons werden im **gesamten Screen** durch `Icon` bzw. reinen Text ersetzt (Edit- und Erfassungsmodus). Begründung: Emoji liegen im selben JSX für beide Modi; ein halber Ersatz hinterließe einen Screen mit zwei Icon-Systemen, und die Design-System-Regel gilt pro Screen. Es ändert sich ausschließlich die Darstellung; State, Props, API-Aufrufe und Speicherlogik der Erfassungsflows bleiben unverändert. QA prüft deshalb zusätzlich Regression der Erfassungsflows (Label-Scan, manuelle Eingabe).

## 11. Frontend Work Package F-2

Alle Subtasks laufen streng nacheinander.

### F-2.1 Profil-Hub verschlanken, `ProfileDetails`, Tab-Label-Konstante

**Agent:** Frontend  
**Goal:** Hub auf Titel + Karte `Basisdaten` + Linkgruppen umbauen (4.1), `ProfileDetails` mit den verschobenen Karten und `Bearbeiten` anlegen, Hub-Zustände ohne Verlust von `Rechtliches`/`Bibliothek`/`Integrationen` umsetzen (FT-QA-2026-109), Tab-Label/Route als testbare Konstanten führen und testen (FT-QA-2026-111a). Inhalte, Formatierung und Berechnung der verschobenen Karten bleiben unverändert.

**Required Knowledge Base:**

- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/domain/04-profile-goals.md`

**Required Repository Context:**

- `mobile/src/modules/profile/ProfileScreen.tsx`
- `mobile/src/modules/profile/ProfileScreen.test.tsx`
- `mobile/src/modules/profile/ProfileGroup.tsx`
- `mobile/src/modules/profile/profileHubGroups.ts`
- `mobile/src/modules/profile/profileHubGroups.test.ts`
- `mobile/src/modules/profile/ProfileEditScreen.tsx`
- `mobile/src/modules/profile/LibraryScreen.tsx` (Header-Muster)
- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- R2-AC-1
- R2-AC-2
- R2-AC-3
- R2-AC-4
- R2-AC-5
- R2-AC-6
- R2-AC-14 (nur Tab-Label)
- R2-AC-17
- R2-AC-20

**Dependencies:** None.

**Expected Handoff:**

- `ProfileScreen` (Hub), `ProfileDetailsScreen`, `ProfileSummaryCards.tsx`, `useProfileData.ts`, angepasste `profileHubGroups.ts`, `profileTab.ts`, Route `ProfileDetails`
- aktualisierte/neue Tests: Hub-Zustände (ready, loading, error, kein Profil), Reihenfolge ohne Detailkarten, `Rechtliches`-Navigation in allen Zuständen, Details-Inhalt und `Bearbeiten`-Navigation, `profileHubGroups`-Reihenfolge, Tab-Label-Konstante
- Hinweis an F-2.5, welche Dateien und Routen neu sind

### F-2.2 Favoriten mit `FoodProductSummary`, gemeinsamer Library-Container

**Agent:** Frontend  
**Goal:** `FavoritesView` auf die Hub-Produktdarstellung umstellen (4.2) und `Favoriten`/`Eigene Lebensmittel` auf einen gemeinsamen Karten-Container stellen. Zuerst per Test bestätigen, ob ein Blob-Pfad-`imageUrl` in `ResultRow.handleFavoriteToggle` an `favoritesApi.addFavorite` geht; falls ja, nur Remote-URLs senden. Keine Backend-/Shared-/API-Änderung.

**Required Knowledge Base:**

- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/domain/03-food-catalog.md`
- `docs/kb/tech/03-mobile.md`

**Required Repository Context:**

- `mobile/src/modules/profile/FavoritesView.tsx`
- `mobile/src/modules/profile/OwnFoodsView.tsx`
- `mobile/src/modules/profile/LibraryScreen.test.tsx`
- `mobile/src/modules/profile/ownFoodItems.ts`
- `mobile/src/modules/profile/LibraryStateView.tsx`
- `mobile/src/shared/components/FoodProductSummary.tsx`
- `mobile/src/shared/components/foodProductSummaryUtils.ts`
- `mobile/src/modules/nutrition/hub/RelationRow.utils.ts`
- `mobile/src/modules/nutrition/hub/RelationRow.tsx` (Mapping-Vorlage für Marke/Rezeptfallback)
- `mobile/src/modules/nutrition/hub/SearchState.tsx`
- `mobile/src/shared/api/favoritesApi.ts`
- `shared/types/userFoodRelation.ts`
- `backend/src/functions/favorites.ts` (nur lesend: `imageUrl`-Schema)

**Required Skills:** None

**Relevant Acceptance Criteria:**

- R2-AC-7
- R2-AC-8
- R2-AC-9
- R2-AC-10
- R2-AC-11
- R2-AC-17
- R2-AC-20

**Dependencies:** F-2.1.

**Expected Handoff:**

- `favoriteSummaryProps` mit Tests (Katalog, eigenes Lebensmittel, Rezept owner/community/nicht verfügbar, fehlende Nährwerte, `isComplete === false`, Remote-URL vs. Blob-Pfad vs. `null`)
- `LibraryFoodCard`, umgestellte `FavoritesView` und `OwnFoodsView`
- erweiterte `LibraryScreen.test.tsx` (Favoriten-Zeile enthält `FoodProductSummary`, Entfernen mit `ConfirmSheet`, Fehler-Snackbar, Fehler/Leer/Laden unverändert)
- Ergebnis der Blob-Pfad-Verifikation (bestätigt/nicht bestätigt) und ggf. Guard in `ResultRow`

### F-2.3 Token-Bereinigung, Thumbnail-Vereinheitlichung, Testlücken

**Agent:** Frontend  
**Goal:** FT-QA-2026-108 (direkte Werte), -112 (Thumbnail-Größen, ungenutzte Komponenten) und die verbleibenden Testlücken aus -111 (`ResultRow`, Wizard-Vorschau-Datenschutzlink) beheben.

**Required Knowledge Base:**

- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/product/04-food-entry-hub.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- `mobile/src/shared/components/FoodProductSummary.tsx`
- `mobile/src/modules/nutrition/hub/SearchState.tsx`
- `mobile/src/modules/nutrition/hub/RelationRow.tsx`
- `mobile/src/modules/nutrition/hub/RecentItem.tsx`
- `mobile/src/shared/components/FoodSearchResultList.tsx`
- `mobile/src/shared/components/ConfirmSheet.tsx`
- `mobile/src/modules/healthConnect/SyncStatusSheet.tsx`
- `mobile/src/modules/profile/ProfileWizardScreen.tsx`
- `mobile/src/modules/profile/ProfileWizardScreen.test.tsx`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- R2-AC-12
- R2-AC-13
- R2-AC-14 (`ResultRow`, Wizard-Vorschau)
- R2-AC-17
- R2-AC-20

**Dependencies:** F-2.2.

**Expected Handoff:**

- Token-konforme `FoodProductSummary.tsx`, `SearchState.tsx`, `SyncStatusSheet.tsx`; ggf. `colors.overlay` im Theme und in `ConfirmSheet`/`SyncStatusSheet`
- `RelationRow` mit `FOOD_THUMBNAIL_SIZE`; `RecentItem.tsx` und `FoodSearchResultList.tsx` entfernt (Grep-Beleg ohne verbleibende Referenzen)
- neuer `ResultRow`-Test (Thumbnail 52 pt über `FoodProductSummary`, Zeilentap ruft nur `onPress`, Herz ruft nur `favoritesApi` und nicht `onPress`, Quick-Accept ruft nur `onQuickAccept`, Blob-Pfad wird nicht an `addFavorite` gesendet)
- neuer Wizard-Test: Link `Datenschutzerklärung` in der Vorschau (Schritt 5) öffnet den Text, Zurück erhält die Eingaben, `profileApi.createProfile` wird dabei nicht aufgerufen
- Liste der gemappten Werte (alt → Token) für den QA-Abgleich

### F-2.4 `LabelScanReviewScreen`: Alert und Emoji ersetzen

**Agent:** Frontend  
**Goal:** FT-QA-2026-107 beheben mit dem unter „Proposed Technical Solution“ beschriebenen Scope: `Alert.alert` im Edit-Flow durch `ConfirmSheet`, Emoji/Unicode-Icons im ganzen Screen durch `Icon`/Text; keine Logikänderung an Erfassungsflows.

**Required Knowledge Base:**

- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/tech/03-mobile.md`

**Required Repository Context:**

- `mobile/src/modules/nutrition/LabelScanReviewScreen.tsx`
- `mobile/src/modules/nutrition/AddItemModal.tsx`
- `mobile/src/modules/nutrition/hub/LabelSubFlow.tsx`
- `mobile/src/modules/nutrition/hub/ManuellerSubFlow.tsx`
- `mobile/src/modules/profile/OwnFoodsView.tsx`
- `mobile/src/shared/components/ConfirmSheet.tsx`
- `mobile/src/shared/components/Icon.tsx`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- R2-AC-15
- R2-AC-16
- R2-AC-17
- R2-AC-20

**Dependencies:** F-2.3.

**Expected Handoff:**

- `LabelScanReviewScreen` ohne `Alert`-Import und ohne Emoji/Unicode-Icon-Zeichen
- neuer Test für den Edit-Speichern-Pfad (`ConfirmSheet` statt `Alert`; `Nur Produkt` → `reusableItemsApi.update(..., false)`, `Produkt + Tagebuch-Einträge` → `(..., true)`; `Abbrechen` ruft nichts auf) und Erhalt des Erfassungs-Speicherpfads
- Hinweis zum verschachtelten Modal (Verhalten auf Gerät: MANUAL VALIDATION REQUIRED)

### F-2.5 Knowledge-Base-Abgleich

**Agent:** Frontend  
**Goal:** KB auf den umgesetzten Stand bringen: neue Hub-Struktur, `ProfileDetails`, Tab-Label-Entscheidung, Favoriten-Darstellung, Entfernen überholter Aussagen und „Known limitations“.

**Required Knowledge Base:**

- `docs/kb/product/02-navigation.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/product/04-food-entry-hub.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**

- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/app/navigation/profileTab.ts`
- `mobile/src/modules/profile/`
- `mobile/src/modules/nutrition/LabelScanReviewScreen.tsx`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- R2-AC-19
- R2-AC-17

**Dependencies:** F-2.1 bis F-2.4.

**Expected Handoff:**

- `docs/kb/product/02-navigation.md`: Stack-Baum um `ProfileDetails`, `ProfileStackParamList`, IA-Tabelle und Diagramm (Gruppe `Persönliche Daten` zuerst, Hub zeigt nur `Basisdaten`), Begründung `Profil` statt `Mehr`, Hub-Zustände inkl. `Rechtliches` immer erreichbar
- `docs/kb/product/05-ux-patterns.md`: Abschnitt „Profil-Hub“ (neuer Aufbau, Zustände), „Favorite Heart Toggle“ (überholten Satz „favorite management UI is a separate future story“ ersetzen; Favoritenansicht mit `FoodProductSummary`, Entfernen mit Bestätigung), Hinweis auf gemeinsame Produktdarstellung Hub/Bibliothek
- `docs/kb/tech/03-mobile.md`: Moduleinträge (`ProfileDetailsScreen`, `ProfileSummaryCards`, `useProfileData`, `LibraryFoodCard`, `favoriteFoodSummary`, `profileTab`), `FoodProductSummary` nun auch in `FavoritesView`, „Known limitations“ ohne `LabelScanReviewScreen`, `RecentItem`, `FoodSearchResultList` (bei bestehenden Restpunkten korrekt neu formulieren), neuer Token `colors.overlay` falls eingeführt; dokumentierte offene Punkte: Blob-Pfad-Fotos (PO-1)
- `docs/kb/product/04-food-entry-hub.md`: Verweise auf entferntes `RecentItem` korrigieren
- `docs/kb/product/03-design-system.md`: nur falls dort Overlay-/Scrim-Werte tabellarisch geführt werden
- Konflikte KB ↔ Code im Abschlussbericht benennen

## 12. QA Work Package Q-2

**Agent:** QA  
**Goal:** R2-AC-1 bis R2-AC-20 gegen den Repository-Stand, Tests und KB prüfen; die Findings FT-QA-2026-107, -108, -109, -111, -112 einzeln mit Evidenz auflösen (FT-QA-2026-110 bleibt unverändert „Accepted“); Regression der R1-Teile bestätigen; Erfassungsflows von `LabelScanReviewScreen` auf Regression prüfen.

**Required Knowledge Base:**

- `docs/kb/tech/03-mobile.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/product/02-navigation.md`
- `docs/kb/product/03-design-system.md`
- `docs/kb/product/05-ux-patterns.md`
- `docs/kb/product/04-food-entry-hub.md`

**Required Repository Context:**

- `docs/qa/findings.md`
- `docs/qa/reports/PLAN_Profilebereich_Redesign_und_Strukturierung.md`
- `mobile/src/app/navigation/RootNavigator.tsx`
- `mobile/src/app/navigation/profileTab.ts`
- `mobile/src/app/theme/index.ts`
- `mobile/src/modules/profile/`
- `mobile/src/modules/legal/`
- `mobile/src/modules/nutrition/LabelScanReviewScreen.tsx`
- `mobile/src/modules/nutrition/hub/SearchState.tsx`
- `mobile/src/modules/nutrition/hub/RelationRow.tsx`
- `mobile/src/shared/components/FoodProductSummary.tsx`
- `mobile/src/shared/components/ConfirmSheet.tsx`
- `mobile/src/modules/healthConnect/SyncStatusSheet.tsx`
- `docs/legal/datenschutzerklaerung-alpha.md`
- `docs/legal/impressum-alpha.md`

**Required Skills:** None

**Relevant Acceptance Criteria:**

- R2-AC-1 bis R2-AC-20

**Dependencies:** F-2.1, F-2.2, F-2.3, F-2.4 und F-2.5.

**Expected Handoff:**

- QA-Report nach dem vom Orchestrator vorgegebenen Pfad mit Kriterienmatrix R2-AC-1 bis R2-AC-20, Testergebnissen und Finding-Zuordnung (107, 108, 109, 111, 112 gelöst bzw. offen; 110 unverändert)
- manuelle Prüfliste (Gerät, schmaler Viewport, große Schrift, TalkBack/VoiceOver, verschachteltes Modal) als `MANUAL VALIDATION REQUIRED`, wenn nicht ausführbar
- Hinweis, ob die Blob-Pfad-Vermutung aus F-2.2 bestätigt wurde und ob sie weitere Stellen betrifft (z. B. Diary-Eintrag mit `imageUrl`, `diary.ts` validiert ebenfalls `.url()`); als Finding melden, nicht im Rahmen von R2 beheben
- Register `docs/qa/findings.md` nach Orchestrator-Vorgabe aktualisiert

## 13. Acceptance Criteria

**Hub und Details**

- **R2-AC-1:** Der Bottom-Tab zeigt das Label `Profil`; die Route-ID bleibt `Profile`. `RootNavigator.tsx` bezieht Label und Route aus `profileTab.ts` (`PROFILE_TAB_LABEL = 'Profil'`, `PROFILE_TAB_ROUTE = 'Profile'`); ein Test sichert beide Werte.
- **R2-AC-2:** `ProfileMain` zeigt bei geladenem Profil in dieser Reihenfolge: Titel `Profil`, genau eine Karte `Basisdaten` (Geschlecht, Alter, Größe, Gewicht, Zielgewicht, Werte und Formate wie bisher), danach die Linkgruppen. Der Hub rendert **nicht mehr** die Karten `Alltag & Training` und `Ziel`, die Überschrift `Tagesziele` samt `Ruhetag`/`Trainingstag` und die Header-Schaltfläche `Bearbeiten`.
- **R2-AC-3:** Gruppenreihenfolge im Hub: `Persönliche Daten` (Eintrag `Profil & Tagesziele`, Untertext `Details ansehen und bearbeiten`, Ziel `ProfileDetails`) → `Bibliothek` (`Favoriten & Eigene Lebensmittel`, `Library`) → `Integrationen` (`Health Connect`) → `Gemeinsam` (`[Planned]`, nicht gerendert, solange kein Eintrag existiert) → `Rechtliches` (`Impressum`, `Datenschutzerklärung`). Leere Gruppen, tote Routen und Platzhalter-Links werden nicht gerendert; `profileHubGroups.test.ts` prüft Reihenfolge und das Ausblenden von `Persönliche Daten` ohne Profil.
- **R2-AC-4:** `ProfileDetails` zeigt `Alltag & Training`, `Ziel` und `Tagesziele` (`Ruhetag`, `Trainingstag` mit kcal, Protein, Fett, Carbs) mit denselben Feldern, Labels und Formaten wie der bisherige Hub (ohne `Basisdaten`, die im Hub bleibt). Der Header enthält Zurück, Titel `Profil & Tagesziele` und `Bearbeiten`; `Bearbeiten` navigiert zu `ProfileEdit` mit dem geladenen Profil. Laden, Fehler (`Erneut versuchen`) und Pull-to-Refresh funktionieren; ein Refresh-Fehler bei vorhandenen Daten zeigt eine Snackbar und lässt die Daten stehen.
- **R2-AC-5:** In den Zuständen Laden, Fehler und „kein Profil“ rendert der Hub weiterhin Titel sowie die Gruppen `Bibliothek`, `Integrationen` und `Rechtliches`; `Impressum` und `Datenschutzerklärung` sind in allen drei Zuständen navigierbar. Der Kartenplatz zeigt: Laden → `ActivityIndicator` mit Accessibility-Label; Fehler → `Profil konnte nicht geladen werden` und `Erneut versuchen`; kein Profil (erfolgreicher Request ohne Profil) → `Noch kein Profil` und `Profil einrichten` (öffnet den bestehenden Wizard). `Noch kein Profil` erscheint nie nach einem Request-Fehler. Die Gruppe `Persönliche Daten` fehlt in diesen Zuständen. Der Hub bleibt scrollbar und per Pull-to-Refresh aktualisierbar.
- **R2-AC-6:** `ProfileEdit` speichert unverändert (Payload, `profileApi`, Validierung); nach Speichern führt `goBack()` zu `ProfileDetails`, das beim Fokus neu lädt und die geänderten Werte zeigt; der Hub zeigt nach Rückkehr aktualisierte `Basisdaten`. Es gibt keine weitere Route auf `ProfileEdit` außer aus `ProfileDetails`. Berechnung der Ziele und alle API-Verträge bleiben unverändert.

**Favoriten und Library**

- **R2-AC-7:** Jede Favoritenzeile rendert `FoodProductSummary` (dieselbe Komponente wie `SearchState.ResultRow`) mit 52-pt-Thumbnail (Remote-Bild oder Buchstaben-Avatar), Name (bis zu 2 Zeilen), Marke, Herkunfts-Badge und Nährwertzeile gemäß Mapping-Tabelle 4.2 (`OFF` / `Eigen` / `Rezept`; `isComplete === false` → Unvollständig-Hinweis; ohne `nutritionPer100g` keine Nährwertzeile). Die frühere Zeile `Katalog · … · n× verwendet` existiert nicht mehr.
- **R2-AC-8:** Einzige Zeilenaktion in `Favoriten` ist das Entfernen: Herz-Button mit Accessibility-Label `<Name> aus Favoriten entfernen`, Touch-Ziel mindestens 48 pt, `ConfirmSheet` `Aus Favoriten entfernen?`, bei API-Fehler Snackbar `Favorit konnte nicht entfernt werden.` und Zeile bleibt. Relationen vom Typ Rezept ohne Zugriff (`isUnavailableRecipeRelation`) zeigen `Rezept nicht verfügbar` ohne Bild und Nährwerte, bleiben aber entfernbar.
- **R2-AC-9:** `Favoriten` und `Eigene Lebensmittel` verwenden denselben Karten-Container (`LibraryFoodCard`); es gibt keine doppelten Kartenstile. Verhalten von `Eigene Lebensmittel` (Tap = Bearbeiten, Löschen mit `ConfirmSheet`, Suche, Refresh, Enrichment-Reload) und die Lade-/Fehler-/Leerzustände beider Tabs bleiben unverändert (bestehende `LibraryScreen.test.tsx`-Fälle bleiben grün).
- **R2-AC-10:** Favoriten benötigen keine Backend-, Shared- oder API-Änderung und lösen pro Zeile keinen zusätzlichen Request aus. Das Bildverhalten ist identisch zum Such-Hub: Remote-URL → Bild, `null`/Blob-Pfad/Ladefehler → Buchstaben-Avatar. Die Einschränkung für Blob-Pfad-Fotos ist in der KB als offen (PO-1) dokumentiert.
- **R2-AC-11:** `ResultRow` sendet an `favoritesApi.addFavorite` nur dann `imageUrl`, wenn `isRemoteImageUri(item.imageUrl)` gilt, sonst `null`; ein Test mit Blob-Pfad belegt, dass der Herz-Toggle nicht zurückspringt und kein Blob-Pfad gesendet wird. Wird die Blob-Pfad-Ablehnung in F-2.2 widerlegt, entfällt der Guard und der Test belegt den tatsächlichen Ist-Stand; die Entscheidung ist im Handoff dokumentiert.

**Konsistenz und Qualität**

- **R2-AC-12:** `FoodProductSummary.tsx`, `SearchState.tsx` und `SyncStatusSheet.tsx` enthalten keine direkten Werte für Farben (`rgba`/Hex), `fontSize`, Abstände (`padding*`, `margin*`, `gap`), Radien und `hitSlop`; Arithmetik mit Literalen (z. B. `spacing.xs + 1`) entfällt. Zulässig bleiben `borderWidth: 1`, `StyleSheet.hairlineWidth`, `flex`-Werte, benannte Größenkonstanten (`FOOD_THUMBNAIL_SIZE`) und `Icon`-Größen-Tokens. Das Schließen-Symbol `✕` in `SyncStatusSheet` ist ein `Icon`. Der Overlay-Hintergrund nutzt einen Theme-Token (`colors.overlay`), `ConfirmSheet` verwendet denselben.
- **R2-AC-13:** Produkt-Thumbnails in `ResultRow` (über `FoodProductSummary`) und `RelationRow` sind 52 pt (`FOOD_THUMBNAIL_SIZE`). `RecentItem.tsx` und `FoodSearchResultList.tsx` sind entfernt; Grep in `mobile/src` und `docs/kb` zeigt keine verbleibenden Referenzen (KB-Verweise sind korrigiert).
- **R2-AC-14:** Tests existieren und sind grün für: (a) Tab-Label/Route-Konstanten (R2-AC-1); (b) `ResultRow`: 52-pt-Summary, Zeilentap ruft nur `onPress`, Herz ruft nur `favoritesApi` (nicht `onPress`), Quick-Accept ruft nur `onQuickAccept`, Blob-Pfad wird nicht gesendet; (c) Wizard-Vorschau: Link `Datenschutzerklärung` öffnet den Text, Zurück erhält Eingaben, kein `createProfile`-Aufruf.
- **R2-AC-15:** `LabelScanReviewScreen.tsx` importiert und verwendet kein `Alert` mehr. Der Edit-Speichern-Pfad zeigt ein `ConfirmSheet` mit den Aktionen `Nur Produkt` und `Produkt + Tagebuch-Einträge` sowie dem eingebauten `Abbrechen`; die Aktionen lösen `reusableItemsApi.update` mit `updateHistory` `false` bzw. `true` aus, `Abbrechen` löst nichts aus. Ein Test belegt das.
- **R2-AC-16:** `LabelScanReviewScreen.tsx` enthält keine Emoji- oder Unicode-Symbolzeichen als UI-Icons (`✏️`, `📷`, `⚠️`, `🔧`, `✨`, `⏳`, `✕`, `💾`, `🔄`, `‹`); Ersatz sind `Icon` oder reiner Text. Props, State, API-Aufrufe und Speicherverhalten der Erfassungsflows (`AddItemModal`, `LabelSubFlow`, `ManuellerSubFlow`) sind unverändert; deren bestehende Tests bleiben grün.
- **R2-AC-17:** Keine Änderungen in `backend/`, `shared/`, `infra/`, `mobile/app.config.js`, `app.json`, `eas.json`, `android/`, `package.json`/Lockfiles; keine neue Dependency; Mobile Build Impact bleibt `None`. Erlaubt ist ein additiver Token in `mobile/src/app/theme/index.ts`.
- **R2-AC-18 (MANUAL VALIDATION REQUIRED):** Auf einem Android-Gerät und iOS-Gerät/Simulator, schmal und mit größter Schrift: Im geladenen Zustand sind Karte `Basisdaten` und die Überschriften `Persönliche Daten`, `Bibliothek` und `Integrationen` bei Standardschrift ohne Scrollen sichtbar; `Rechtliches` ist höchstens mit minimalem Scrollen erreichbar. Texte brechen um statt abzuschneiden, kein horizontales Scrollen, Touch-Ziele mindestens 48 pt, Zurück-Navigation in `ProfileDetails` → `ProfileEdit` korrekt. `ConfirmSheet` im `LabelScanReviewScreen` öffnet über dem Vollbild-Modal, ist bedienbar und schließt korrekt (iOS und Android). TalkBack/VoiceOver: sinnvolle Reihenfolge und Beschriftung für Hub-Gruppen, Favoriten-Zeile und Entfernen-Button.
- **R2-AC-19:** Die KB-Dokumente aus F-2.5 beschreiben den umgesetzten Stand (Hub-Aufbau, `ProfileDetails`, Entscheidung `Profil` mit Begründung, Favoriten-Darstellung, Hub-Zustände, entfernte Komponenten, kein veralteter „Known limitation“-Eintrag). Offene Punkte (PO-1, `Gemeinsam`) sind als `[Open]`/`[Planned]` markiert; keine Aussage zu Haushaltsrechten.
- **R2-AC-20:** Regression der unverändert zu lassenden R1-Teile: `legalTexts.test.ts`, `LoginScreen.test.tsx`, `ProfileEditScreen.test.tsx` (Platzhalter `Konto löschen`, kein `deleteProfile`), `ownFoodItems.test.ts`, `healthConnectCopy.test.ts` und die Mobile-Suite bleiben grün; `docs/legal/*.md` und `legalTexts.ts` sind unverändert; FT-QA-2026-110 wird nicht bearbeitet.

## 14. Test Strategy

- `npm run typecheck --workspace=@fittrack/mobile`
- `npm test --workspace=@fittrack/mobile`
- `npm run check:encoding` (viele deutsche Umlaute in geänderten Dateien)
- Fokussierte Vitest-/`react-test-renderer`-Tests im Stil der bestehenden Profil-Tests (Mocks für `react-native`, `@react-navigation/native`, `Icon`, `Snackbar`): Hub-Zustände und Reihenfolge, `ProfileDetails`, `profileHubGroups`, `favoriteSummaryProps`, `FavoritesView`/`LibraryScreen`, `ResultRow`, Wizard-Vorschau, `LabelScanReviewScreen`-Edit-Pfad, Tab-Konstanten. Keine neue Test-Dependency.
- Grep-Belege durch QA: kein `Alert`/Emoji in `LabelScanReviewScreen.tsx`; keine verbleibenden Referenzen auf `RecentItem`/`FoodSearchResultList`; keine `rgba`/`fontSize:`/Literal-`padding` in den drei Token-Dateien.
- Manuelle Prüfung gemäß R2-AC-18; nicht ausführbare Geräteprüfungen als `MANUAL VALIDATION REQUIRED` ausweisen.

## 15. Risks and Edge Cases

- **Dichte/Scrollen im Hub:** Die Gruppen stehen jetzt direkt unter einer Karte (rund 5 Zeilen). Auf kleinen Geräten oder bei großer Schrift kann `Rechtliches` weiterhin unter dem Fold liegen. Das ist akzeptiert; entscheidend ist, dass die Links nicht mehr hinter mehreren Detailkarten liegen. Prüfung über R2-AC-18.
- **Bearbeiten in zwei Taps:** bewusste Konsequenz der Linkstruktur (Abschnitt 4.1). Falls der User schnellen Direktzugriff will, wäre die Alternative ein zweiter Eintrag `Profil bearbeiten` unter `Persönliche Daten` (+1 Zeile Höhe); das ist Gegenstand einer Produktrückmeldung, kein Blocker.
- **Veraltete Details nach Bearbeiten:** `ProfileDetails` und Hub laden beim Fokus neu; der Hook darf einen Fokus-Reload nicht als Erstladen mit sichtbarem Spinner behandeln, wenn bereits Daten vorliegen (kein Flackern).
- **Favoriten-Datenqualität:** Ältere Favoriten ohne `nutritionPer100g` zeigen keine Nährwertzeile; Rezept-Relationen haben im Backend generell keinen Cache für Bild/Nährwerte (Avatar, keine Nährwertzeile). Das ist Absicht und kein Fehler.
- **Blob-Pfad bei Favorit/Diary:** `POST /api/favorites` und `POST /api/diary` validieren `imageUrl` als URL; ein Blob-Pfad würde abgelehnt. F-2.2 bestätigt und beschränkt den Guard auf `ResultRow`/Favoriten. Weitere Stellen (z. B. `QuantityView`, `FoodEntryHub` beim Anlegen von Tagebuch-Einträgen) sind nicht Teil von R2; QA meldet sie bei Reproduktion als Finding.
- **Verschachteltes Modal:** `ConfirmSheet` (RN `Modal`) innerhalb des Vollbild-Modals von `LabelScanReviewScreen` muss auf iOS und Android geprüft werden (Reihenfolge, Hardware-Zurück). Fallback bei Problemen: Bestätigung als Inline-Panel im Screen statt `Alert`.
- **Emoji-Ersatz im Erfassungsflow:** reine Darstellungsänderung in einem von mehreren Flows genutzten Screen; Regressionsprüfung durch Tests und QA nötig, Layout-Umbrüche bei schmalen Viewports beachten.
- **Löschen ungenutzter Dateien:** nur nach erneutem Grep (inkl. dynamischer Importe/Tests); `FavoriteChip` ist ein anderes Bauteil und bleibt unberührt.
- **Neuer Theme-Token:** additive Änderung; Wert identisch zu `ConfirmSheet`, damit sich dort optisch nichts ändert (`SyncStatusSheet` wechselt von 0,55 auf 0,6).
- **Hub-Zustandslogik:** Die Wizard-Anzeige (`showWizard`) hat weiterhin Vorrang vor dem Hub; `onComplete` lädt neu. Kein Wechsel des Zustands darf `Rechtliches` ausblenden.

## 16. Documentation Updates

Umfang und Dateien siehe F-2.5. Die KB-Aktualisierung liegt vor QA, damit Q-2 die Dokumentation als Teil von R2-AC-19 prüft.

## 17. Recommended Execution Order

1. Frontend F-2.1: Hub-Umbau, `ProfileDetails`, Hub-Zustände, Tab-Konstante und Tests.
2. Frontend F-2.2: Favoriten mit `FoodProductSummary`, gemeinsamer Library-Container, Blob-Pfad-Verifikation.
3. Frontend F-2.3: Token-Bereinigung, Thumbnail-Vereinheitlichung, Entfernen ungenutzter Komponenten, `ResultRow`- und Wizard-Tests.
4. Frontend F-2.4: `LabelScanReviewScreen` (Alert und Emoji).
5. Frontend F-2.5: Knowledge-Base-Abgleich (`02-navigation.md`, `05-ux-patterns.md`, `03-mobile.md`, `04-food-entry-hub.md`, ggf. `03-design-system.md`).
6. QA Q-2: automatisierte Prüfungen, Grep-Belege, Finding-Zuordnung, manuelle Prüfliste.

Infrastructure & Release: kein Work Package (`Infrastructure Impact: None`, `Mobile Build Impact: None`); ein neuer Build ist nicht erforderlich, da JS-only.
