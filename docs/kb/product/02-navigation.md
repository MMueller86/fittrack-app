# Navigation

## Structure

React Navigation with one `BottomTabNavigator` and per-tab native stacks.

```
RootNavigator (NavigationContainer)
├── Tab: Home
│   └── HomeStack
│       └── HomeMain → HomeScreen
├── Tab: Nutrition
│   └── (NutritionStack — DiaryScreen is the root)
│       ├── DiaryMain → DiaryScreen
│       ├── HikingInput → HikingInputScreen (param: date, existing?)
│       └── CyclingInput → CyclingInputScreen (param: date, existing?)
├── Tab: Rezepte (route id `Recipes`)
│   └── RecipeStack
│       ├── RecipeList → RecipeListScreen
│       ├── RecipeDetail → RecipeDetailScreen (param: id, transient intent?)
│       └── RecipeWizard → RecipeWizardScreen (param: editId?; create or edit)
├── Tab: Progress
│   └── (ProgressStack)
│       └── ProgressMain → ProgressScreen
└── Tab: Profil (route id `Profile`)
    └── ProfileStack
        ├── ProfileMain → ProfileScreen (Profil-Hub: Karte `Basisdaten`, Linkgruppen; kein wiederholter Seitentitel)
        ├── ProfileDetails → ProfileDetailsScreen (Alltag & Training, Ziel, Tagesziele; Header-Aktion `Bearbeiten`)
        ├── ProfileEdit → ProfileEditScreen (param: profile; nur über ProfileDetails erreichbar)
        ├── Library → LibraryScreen (Tabs `Favoriten` / `Eigene Lebensmittel`; einziger Bibliotheksweg)
        ├── HealthConnect → HealthConnectScreen
        ├── Imprint → ImprintScreen (modules/legal; In-App-Text, kein externer Link)
        └── PrivacyPolicy → PrivacyPolicyScreen (modules/legal; In-App-Text, kein externer Link)

In-App-Datenschutz außerhalb des Profil-Stacks: `LoginScreen` und `ProfileWizardScreen` (Willkommensschritt und Vorschau vor `Profil übernehmen`)
ersetzen sich lokal per State durch `LegalDocumentView` (ohne Auth, ohne Navigator); Zurück-Button und Android-Zurück kehren zum Ausgangsscreen zurück, Wizard-Eingaben bleiben erhalten.

Modals (overlaid on top):
├── ProfileWizardScreen — shown on first launch (no SKIP_WIZARD_KEY in AsyncStorage)
└── FoodEntryHub — BottomSheetModal, open from any screen via useFoodEntryHubStore
```

### Profil-Hub: Informationsarchitektur

`ProfileMain` zeigt genau eine Karte (`Basisdaten`: Geschlecht, Alter, Größe, Gewicht, Zielgewicht) und danach die Navigationsgruppen aus `mobile/src/modules/profile/profileHubGroups.ts` in fester Reihenfolge (leere Gruppen werden nicht gerendert). Der Tab `Profil` liefert den Screen-Kontext; ein zusätzlicher Seitentitel wird nicht wiederholt. `Alltag & Training`, `Ziel` und `Tagesziele` liegen nicht im Hub, sondern in `ProfileDetails`.

```
Profil (Tab)
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

| # | Gruppe | Inhalt | Ziel-Route |
|---|---|---|---|
| 1 | `Persönliche Daten` | `Profil & Tagesziele` (Detailzeile `Details ansehen und bearbeiten`). Nur mit geladenem Profil. | `ProfileDetails` |
| 2 | `Bibliothek` | `Favoriten & Eigene Lebensmittel` | `Library` |
| 3 | `Integrationen` | `Health Connect` | `HealthConnect` |
| 4 | `Gemeinsam` | [Planned] Freunde / gemeinsamer Haushalt (Arbeitsname). Noch kein Eintrag, Route oder Screen; die Gruppe wird erst gerendert, wenn die Funktion implementiert ist. | — |
| 5 | `Rechtliches` | `Impressum`, `Datenschutzerklärung` (native In-App-Seiten) | `Imprint`, `PrivacyPolicy` |

- `Rechtliches` steht fest am Ende des Hubs; `Gemeinsam` steht fest zwischen `Integrationen` und `Rechtliches`; `Persönliche Daten` steht fest an erster Stelle.
- `ProfileDetails` (`ProfileDetailsScreen`, Param `undefined`) hat einen Header mit Zurück, zentriertem Titel `Profil & Tagesziele` und rechts `Bearbeiten`; der Inhalt besteht aus `Alltag & Training`, `Ziel` und `Tagesziele` (Ruhetag/Trainingstag). `Bearbeiten` öffnet `ProfileEdit` mit dem geladenen Profil und ist der einzige Einstieg dorthin (Profil bearbeiten braucht damit zwei Taps). Der Screen lädt bei Fokus neu, sodass nach `ProfileEdit` → Speichern → Zurück die aktuellen Werte erscheinen. Ohne Profil zeigt er `Noch kein Profil` ohne `Bearbeiten` und ohne Einrichten-Button; die Einrichtung startet nur im Hub.
- `Favoriten` und `Eigene Lebensmittel` sind ausschließlich über `Profil > Bibliothek` (`LibraryScreen`, zwei Tabs) erreichbar. Es gibt keine eigene Route und keinen zweiten Einstieg für `Eigene Lebensmittel`. `Eigene Lebensmittel` listet nur selbst angelegte Einträge und schließt `sourceType: 'openFoodFacts'` aus.
- Datenschutz ist erreichbar über `Profil > Rechtliches`, `LoginScreen` und `ProfileWizardScreen` (Willkommensschritt und Vorschau), also auch vor dem ersten Speichern des Profils.
- Die Profilbearbeitung (`ProfileEdit`) enthält keine aktive Löschfunktion; `Konto löschen` ist ein deaktivierter Platzhalter (`Wird später verfügbar`) ohne API-Aufruf.

#### Hub-Zustände

Die Gruppen `Bibliothek`, `Integrationen` und `Rechtliches` werden in jedem Zustand gerendert; `Impressum` und `Datenschutzerklärung` sind daher auch bei Lade- oder Profilfehler im Profil-Tab erreichbar. Nur der Platz der Karte `Basisdaten` und die Gruppe `Persönliche Daten` hängen vom Profilzustand ab:

| Zustand | Kartenplatz | `Persönliche Daten` |
|---|---|---|
| Laden | `ActivityIndicator` (`Profil wird geladen`) | ausgeblendet |
| Fehler | `Profil konnte nicht geladen werden` + `Erneut versuchen` | ausgeblendet |
| Kein Profil (erfolgreicher Request ohne Profil) | `Noch kein Profil` + `Profil einrichten` (öffnet den Wizard) | ausgeblendet |
| Profil geladen | `Basisdaten` | sichtbar |

#### Tab-Label `Profil` (Entscheidung)

Das sichtbare Label bleibt `Profil`, die Route-ID bleibt `Profile`. Die Werte stehen in `mobile/src/app/navigation/profileTab.ts` (`PROFILE_TAB_ROUTE`, `PROFILE_TAB_LABEL`) und werden von `RootNavigator` verwendet. Begründung:

1. Die einzige Karte im Hub ist die persönliche Karte `Basisdaten`; der Hub bleibt ein Ort mit Nutzeridentität. Ein generisches `Mehr` würde diese Karte und `Favoriten & Eigene Lebensmittel` hinter einem Sammelbegriff verstecken.
2. Das Problem, dass Einstellungen erst nach Scrollen sichtbar waren, löst die Hub-Struktur, nicht das Label.
3. `Mehr` bräuchte ein neues Tab-Icon (`ProfileIcon` ist ein Personen-Symbol) und ordnet die künftige Gruppe `Gemeinsam` [Planned] schlechter ein.

Neubewertung, falls der Hub mehrere nicht profilbezogene Bereiche aufnimmt, sodass die persönliche Karte nicht mehr der Kern ist.

Siehe [05-ux-patterns.md](05-ux-patterns.md#profil-hub) für Komponenten und Verhaltensregeln.

## Navigation Theme

The `NavigationContainer` uses a custom dark theme derived from `DarkTheme`:

```ts
background → colors.background   (#0B0F0C)
card       → colors.surface      (#141A15)
text       → colors.text         (#F2F4F1)
border     → colors.border       (#2A352C)
primary    → colors.primary      (#67B23E)
```

## Tab Icons

Custom SVG icons in `mobile/src/assets/icons/TabIcons.tsx`:
- `HomeIcon`, `NutritionIcon`, `RecipesIcon`, `ProfileIcon`, `ProgressIcon`

Active tab icon uses `colors.primaryBright` (`#8FD157`). Inactive uses `colors.textMuted`.

## FoodEntryHub — Global Entry Point

The `FoodEntryHub` is a `BottomSheetModal` that can be opened from any screen.

Opening from code:
```ts
const { open } = useFoodEntryHubStore();
open({
  mealId?: string,    // if known (from diary meal button)
  date?: string,      // default: today
  mealType?: MealType, // default: time-based suggestion
  onSuccess?: () => void,
  autoFocusSearch?: boolean,
});
```

The hub must be mounted in the root navigation tree so it overlays any tab.

In recipe-ingredient mode the hub is opened with `purpose: 'recipeIngredient'` or ingredient callbacks. This keeps the hub as an overlay while disabling diary mutations and returning the selected product or explicit single-food AI estimate to `RecipeWizardScreen`.

### Wochenrückblick auf HomeMain

`HomeScreen` rendert die `WeeklyReviewCard` unmittelbar nach `DayNutritionCard`. Die Karte bleibt Teil des bestehenden Home-Scroll-Inhalts und erzeugt keine neue Route. Sie zeigt sieben feste Spalten im verfügbaren Viewport ohne horizontales Scrollen; jeder Balken ist ein zugänglicher Trigger für das bestehende `InfoOverlay` und öffnet zuerst ausschließlich informative Tagesdetails. Nur die sekundäre Aktion `Tagebuch öffnen` im Overlay navigiert über den Root-Tab nach `Nutrition -> DiaryMain({ date })`; der Balken selbst navigiert nicht, bearbeitet keine Daten und löst keine Mutation oder FoodEntryHub-Aktion aus. Nur der Kartenfehlerzustand bietet die bestehende Retry-Aktion zum erneuten Laden an.

Der Wochenrequest wird beim Fokus des Home-Screens und bei Pull-to-Refresh ausgelöst. Sein lokales Referenzdatum dient nur dem Wochenvertrag; die Darstellung selbst verändert keine Navigation und ersetzt keine Tages-, Aktivitäts- oder Food-Entry-Flows.

## First Launch Flow

```
App starts
  → RootNavigator checks AsyncStorage for SKIP_WIZARD_KEY
  → Not found → ProfileWizardScreen shown as modal
  → User completes wizard → POST /api/profile → SKIP_WIZARD_KEY set
  → User skips → SKIP_WIZARD_KEY set (skip permanently)
  → Next launch → go directly to bottom tabs
```

### ProfileWizardScreen — 6 Steps

| Step | Content |
|---|---|
| 0 | Welcome — dismiss option (skips wizard permanently) |
| 1 | Basisdaten (age, height, weight, target weight) |
| 2 | Alltag (steps or activity level; "Kenne ich nicht" shows activity picker) |
| 3 | Training (frequency, duration, sports) |
| 4 | Ziel (goal type + intensity) |
| 5 | Vorschau — calculated targets with inline tooltips (BMR, PAL, goal adjustment) |

Navigation: swipe left/right (PanResponder) + Cancel (X) on steps 1–4 with confirmation dialog. No data is persisted until step 5 is confirmed. Weight field pre-filled from last 7 diary entries (new profiles only).

## Navigation Parameter Types

```ts
HomeStackParamList = {
  HomeMain: undefined;
  HikingInput: { date: string; existing?: SpecialActivity };
  CyclingInput: { date: string; existing?: SpecialActivity };
}

NutritionStackParamList = {
  DiaryMain: { date?: string } | undefined;
  HikingInput: { date: string; existing?: SpecialActivity };
  CyclingInput: { date: string; existing?: SpecialActivity };
}

ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileDetails: undefined;
  ProfileEdit: { profile: UserProfile | null };
  Library: undefined;
  HealthConnect: undefined;
  Imprint: undefined;
  PrivacyPolicy: undefined;
}

RecipeStackParamList = {
  RecipeList: undefined;
  RecipeDetail: { id: string; intent?: 'openLogRecipeModal' };
  RecipeWizard: { editId?: string } | undefined;
}

RootTabParamList = {
  Home: undefined;
  Nutrition: NavigatorScreenParams<NutritionStackParamList> | undefined;
  Recipes: undefined;
  Weight: undefined;
  Profile: undefined;
}
```

### Recipe Create/Edit and transient logging intent

For both recipe creation and editing, `RecipeWizardScreen` saves the recipe and then replaces the wizard with `RecipeDetail`, passing `{ id, intent: 'openLogRecipeModal' }`. Normal navigation from the recipe list passes only `{ id }`.

`RecipeDetailScreen` loads the recipe first. Once the recipe is available, it consumes the transient intent once via a ref, clears the route parameter with `navigation.setParams({ intent: undefined })`, and opens `LogRecipeModal`. Focus refreshes and later returns to the detail screen therefore cannot open the modal again. After successful logging, the modal closes and the detail view reloads.

## Weight Screen

The bottom tab route is named `Weight` and renders `ProgressScreen`; the visible tab label is `Progress`.

## Related Documents

- [product/04-food-entry-hub.md](04-food-entry-hub.md) — Hub state machine and UX
- [tech/03-mobile.md](../tech/03-mobile.md) — mobile app module structure
