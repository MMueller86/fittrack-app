# Technischer Plan – US-08: UX-Optimierung der Zutatenzuordnung

**User Story:** [US-08_UX-Optimierung_Zutatenzuordnung.md](US-08_UX-Optimierung_Zutatenzuordnung.md)  
**Status:** Bereit zur Implementierung

Infrastructure Impact: None  
Mobile Build Impact: None

---

## Bewertung der Anforderung

**Klassifikation:** Accept with modifications

Die User Story und die Orchestrator-Zusatzvorgaben sind in sich schlüssig und produktkonsistent. Die zwingende Wiederverwendung des Search Hubs ist architektonisch korrekt – die bestehende `AddIngredientModal`-Parallelimplementierung ist eine technische Schuld, die durch diese Story bereinigt werden kann.

Eine Modifikation war erforderlich bei AC-3 (küchenübliche Mengenangaben für Gewürze): Das Backend lieferte aktuell nur numerische Grammwerte. Diese Lücke wird durch WP-5 (Backend-Erweiterung) geschlossen — PO-Entscheidung gefallen, Option (a) gewählt.

AC-4 erfordert eine Extraktion von `DiaryItemRow` als wiederverwendbare Shared Component — PO-Entscheidung gefallen, Option (a) gewählt.

---

## Search Hub Wiederverwendungsprüfung (Pflichtanalyse)

### Wie wird der Search Hub im Homescreen und Ernährungstagebuch aufgerufen?

**Aufrufmechanismus — identisch in beiden Screens:**

```ts
const openHub = useFoodEntryHubStore((s) => s.open);

// DiaryScreen:
openHub({ mealId, date, mealType, onSuccess: () => loadDay(date), topInset: ... });

// HomeScreen:
openHub({ onSuccess: onRefresh, topInset: insets.top + brandHeaderHeight });
openHub({ initialSubflow: 'ai', autoCloseOnSave: true, ... });
```

**Komponenten:**
- `FoodEntryHub` (`mobile/src/modules/nutrition/hub/FoodEntryHub.tsx`) — globaler Singleton, einmalig in `App.tsx` gerendert, innerhalb `<BottomSheetModalProvider>`
- Gesteuert via `useFoodEntryHubStore` (Zustand) — beliebige Komponente ruft `.open()` auf
- Bottom Sheet: `@gorhom/bottom-sheet` v5, `BottomSheetModal`, Snap Points `['85%']`, Backdrop-Opacity 0.10
- Interner Zustand: `hubReducer` mit HubMode `idle | search | product | subflow`
- Produktauswahl → `QuantityView` → `diaryApi.addItem()` → `onAdded` → `onSuccess` beim Schließen

### Ist die exakt gleiche Aufrufweise aus dem Recipe Builder technisch möglich?

**Ja — mit kontrollierten Erweiterungen am Hub Store.**

`RecipeWizardScreen` ist ein vollständiger Stack-Screen innerhalb von `RootNavigator`, der seinerseits innerhalb `<BottomSheetModalProvider>` gerendert wird (via `App.tsx`). Ein Aufruf von `useFoodEntryHubStore.open()` aus dem Wizard öffnet den Hub als Bottom Sheet auf exakt dieselbe Weise wie aus DiaryScreen — identische Animation, Höhe, Darstellung und Bedienung.

Das Hub-Singleton ist immer im Render-Tree. Kein zusätzliches Mounting oder Provider-Wrapping notwendig.

### Welche konkreten Anpassungen am Hub sind erforderlich?

Der Hub wurde für Tagebuch-Einträge gebaut (`diaryApi.addItem`). Für den Rezept-Kontext muss er statt eines Tagebucheintrags ein `FoodSearchResult` + Menge an den Aufrufer zurückgeben. Folgende **additive** Änderungen sind notwendig — keine bestehende Tagebuchfunktion wird modifiziert:

**1. `useFoodEntryHubStore.ts`** — neue optionale Parameter in `open()`:
- `initialQuery?: string` — setzt die Suche beim Öffnen direkt vor
- `prefillAmount?: { mode: 'grams' | 'portion'; amount: number } | null` — KI-vorgeschlagene Menge für Schnellauswahl und QuantityView-Vorbelegung
- `onSelectIngredient?: (product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => void` — Rezept-Modus-Callback; wenn gesetzt, ist der Hub im Rezept-Modus

**2. `FoodEntryHub.tsx`** — beim Öffnen mit `initialQuery`:
- `SET_QUERY(initialQuery)` an den Reducer dispatchen
- `searchQuery` State auf `initialQuery` setzen
- `searchActive` State auf `true` setzen (Suche sofort aktiv, kein Idle-Screen)
- Im Rezept-Modus: Subtitle des Sheets auf neutralen Text setzen (kein Mahlzeit-Kontext)
- Im Rezept-Modus: "Wie immer"-Direktauswahl in IdleState mit `prefillAmount` und `onSelectIngredient`-Callback verknüpfen (statt `diaryApi.addItem`)
- Nach Aufruf von `onSelectIngredient`: `close()` aufrufen

**3. `QuantityView.tsx`** — rezeptfähiger Modus:
- Neue optionale Props: `onSelectIngredient?: ...` (aus Hub-Store), `prefillAmount?: ...`
- Wenn `onSelectIngredient` gesetzt: Mahlzeit-Selektor ausblenden, CTA-Label auf "Zur Rezept hinzufügen" ändern
- Bei Bestätigung: `onSelectIngredient(product, unit, amount)` aufrufen statt `diaryApi.addItem()`
- Tagebuch-Snackbar wird nicht ausgelöst (kein `onAdded`)
- `prefillAmount` seeded die Mengenauswahl (bestehende `prefill`-Prop deckt dies ab — `prefillAmount` wird zu `prefill` gemappt)

**4. `SearchState.tsx` / `ResultRow`** — Schnellauswahl (AC-9):
- Neue optionale Props in `SearchState`: `quickAcceptLabel?: string`, `onQuickAccept?: (product: FoodSearchResult) => void`
- `ResultRow` bekommt `quickAcceptLabel` / `onQuickAccept` durchgereicht
- Wenn gesetzt: jeder `ResultRow` zeigt eine Schnellauswahl-Pill (visuell identisch zur "Wie immer"-Pill in `RelationRow`) mit der KI-vorgeschlagenen Menge
- Tippen auf Pill → `onQuickAccept(product)` → Hub ruft `onSelectIngredient(product, prefillMode, prefillAmount)` auf → Hub schließt
- Diary-Nutzung übergibt diese Props nicht → bestehende `ResultRow`-Darstellung unverändert

Alle vier Änderungen sind **additiv**: kein bestehendes Verhalten wird modifiziert, alle Diary-Aufrufe bleiben unverändert.

### Fazit

**Wiederverwendung ist möglich.** Die technische Grundvoraussetzung — identische Bottom-Sheet-Infrastruktur, identischer Provider, identische Snap Points — ist erfüllt. Die notwendigen Hub-Erweiterungen sind chirurgisch und isoliert.

---

## Entschiedene PO-Entscheidungen

### PO-1 → Option (a): Backend-Erweiterung (WP-5 aktiv)

AC-3 verlangt küchenübliche Mengenangaben für Gewürze (z. B. `1 TL`, `1 Prise`, `nach Geschmack`). Die Entscheidung ist gefallen: Option (a) — Backend-Erweiterung. Das Rezept-Analyse-Prompt und der Shared-Type `MealParserPreviewItem` werden um `kitchenAmountText?: string` erweitert. Die KI generiert diesen Wert zutatensensitiv für jedes Seasoning-Item. WP-5 ist damit vollständig aktiv und nicht mehr geblockt.

### PO-2 → Option (a): Extraktion von `DiaryItemRow` (DiaryScreen-Refactor)

AC-4 fordert die identische Tagebuch-Darstellung im Wizard. Die Entscheidung ist gefallen: Option (a) — Extraktion. `DiaryItemRow` wird als rein presentationale Shared Component aus `DiaryScreen` extrahiert und in `RecipeWizardScreen` sowie `DiaryScreen` genutzt. Der erforderliche DiaryScreen-Refactor ist explizit als Unteraufgabe **WP-2c-Refactor** in WP-2c eingeplant.

---

## Arbeitspakete

### WP-1: Hub-Erweiterungen für Rezept-Modus (Frontend)

**Dateien:**
- `mobile/src/modules/nutrition/hub/useFoodEntryHubStore.ts`
- `mobile/src/modules/nutrition/hub/FoodEntryHub.tsx`
- `mobile/src/modules/nutrition/hub/QuantityView.tsx`
- `mobile/src/modules/nutrition/hub/SearchState.tsx` (+ `ResultRow`)

**Änderungen:**

#### `useFoodEntryHubStore.ts`
Neue Store-Felder und `open()`-Parameter:
```ts
// Neuer Store-State:
initialQuery: string;
prefillAmount: { mode: 'grams' | 'portion'; amount: number } | null;
onSelectIngredient: ((product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => void) | null;

// Neue open()-Parameter:
initialQuery?: string;
prefillAmount?: { mode: 'grams' | 'portion'; amount: number } | null;
onSelectIngredient?: (product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => void;
```
Defaults: `initialQuery: ''`, `prefillAmount: null`, `onSelectIngredient: null`.  
Kein bestehender Parameter wird geändert oder entfernt.

#### `FoodEntryHub.tsx`
Im `isOpen`-useEffect: wenn `initialQuery` nicht leer ist:
```ts
dispatch({ type: 'SET_QUERY', query: initialQuery });
setSearchQuery(initialQuery);
setSearchActive(true);
```

Subtitellogik: wenn `onSelectIngredient` gesetzt → Subtitle bleibt leer oder zeigt "Zutat suchen" (kein Mahlzeit-Label).

Schnellauswahl (Wie immer) im IdleState: wenn `onSelectIngredient` gesetzt und `prefillAmount` nicht null → `onDirectAdd` ruft `onSelectIngredient(product, ...)` auf statt `diaryApi.addItem()`.

Nach Aufruf von `onSelectIngredient`: `close()` aufrufen.

`SearchState` erhält im Rezept-Modus:
```ts
quickAcceptLabel={prefillAmount ? `+ ${prefillAmount.amount} ${prefillAmount.mode === 'grams' ? 'g' : 'Stk.'}` : undefined}
onQuickAccept={onSelectIngredient ? (product) => { onSelectIngredient(product, prefillAmount.mode, prefillAmount.amount); close(); } : undefined}
```

#### `QuantityView.tsx`
Neue Props:
```ts
onSelectIngredient?: (product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => void;
```
`prefillAmount` wird als `prefill`-Prop weitergegeben (bestehende Mechanik).

Wenn `onSelectIngredient` gesetzt:
- `MealSelector` nicht rendern
- CTA-Button: "Zur Rezept hinzufügen"
- `handleAdd`: `onSelectIngredient(product, unit === 'portion' ? 'portion' : 'grams', parseFloat(quantityStr))` aufrufen; kein `diaryApi.addItem()`, kein Snackbar

#### `SearchState.tsx` / `ResultRow`
Neue Props in `SearchState`:
```ts
quickAcceptLabel?: string;
onQuickAccept?: (product: FoodSearchResult) => void;
```
Diese werden an jede `ResultRow` durchgereicht.

`ResultRow`: wenn `quickAcceptLabel` und `onQuickAccept` gesetzt, eine Schnellauswahl-Pill rendern — visuell identisch zur `computeDirectAddLabel`-Pill in `RelationRow` (gleicher `styles.directAddLabel`-Style, gleicher Pill-Touch-Handler).

**Tagebuch-Impact:** Keine. Der Hub dispatcht `onSelectIngredient = null` in allen Diary/Home-Aufrufen.

**Testanforderungen:**
- Unit-Tests für `hubReducer`: `SET_QUERY` aus leerem Zustand → search mode ✓
- Unit-Tests für `QuantityView`: recipe mode prop → kein `diaryApi`-Aufruf, kein Meal-Selector ✓

---

### WP-2: RecipeWizardScreen – Hub-Integration und neue Zutatenphase (Frontend)

**Datei:** `mobile/src/modules/recipes/RecipeWizardScreen.tsx`

#### 2a: Hub-Aufruf statt AddIngredientModal

Alle Aufrufe von `setAddIngredientVisible(true)` werden durch `useFoodEntryHubStore.open({...})` ersetzt:

**Bei Antippen einer Hauptzutat (confirmed/auto-matched, status: needs-selection/needs-ai):**
```ts
const openHub = useFoodEntryHubStore((s) => s.open);

// Bei Tap auf Hauptzutat (AC-6, AC-7, AC-8, AC-9):
openHub({
  initialQuery: ing.parserItem.displayName,
  prefillAmount: ing.parserItem.inputAmount != null && ing.parserItem.inputMode !== 'unknown'
    ? { mode: ing.parserItem.inputMode as 'grams' | 'portion', amount: ing.parserItem.inputAmount }
    : null,
  onSelectIngredient: (product, mode, amount) => {
    handleSelectViaHub(ing.id, product, mode, amount);
  },
});
```

**Neue Handler-Funktion `handleSelectViaHub`:**
```ts
const handleSelectViaHub = (ingId: string, product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => {
  const ingredient = buildFromProduct(product, mode, amount);
  setIngredients(prev => prev.map(i => i.id !== ingId ? i : {
    ...i,
    status: 'confirmed',
    resolvedIngredient: { ...ingredient, id: ingId },
  }));
  setAmountEdits(e => ({ ...e, [ingId]: { mode, value: String(amount) } }));
};
```
Ersetzt `handleSelectCandidate`.

**Bei "Zutat hinzufügen" (neuer Eintrag):**
```ts
openHub({
  onSelectIngredient: (product, mode, amount) => {
    handleAddManualViaHub(product, mode, amount);
  },
});
```

**Beim "Ersetzen" einer Zutat:**
```ts
openHub({
  initialQuery: replacedIng.displayName,
  onSelectIngredient: (product, mode, amount) => {
    handleReplaceViaHub(replacingIngId, product, mode, amount);
  },
});
```

State-Variablen `addIngredientVisible`, `initialQuery`, `replacingIngId` (bisherige Modal-Steuerung) entfallen oder werden auf Hub-Aufrufe umgestellt.

#### 2b: "Automatisch erkannt"-Bereich (AC-1, AC-2, AC-3)

Oberhalb der Hauptzutaten-Liste wird ein eingeklappter Bereich "Automatisch erkannt" ergänzt.

**State:**
```ts
const [seasoningsExpanded, setSeasonsExpanded] = useState(false);
```

**Rendering:**
```tsx
{/* Automatisch erkannt — nur wenn Seasonings vorhanden */}
{ingredients.filter(i => i.status === 'seasoning').length > 0 && (
  <TouchableOpacity
    style={styles.seasoningHeader}
    onPress={() => setSeasonsExpanded(v => !v)}
  >
    <Text style={styles.seasoningHeaderTitle}>
      Automatisch erkannt ({count})
    </Text>
    <Icon name={seasoningsExpanded ? 'chevron-up' : 'chevron-down'} ... />
  </TouchableOpacity>
)}
{seasoningsExpanded && ingredients
  .filter(i => i.status === 'seasoning')
  .map(ing => (
    <SeasoningRow key={ing.id} ing={ing} onRemove={handleRemoveIngredient} />
  ))
}
```

**SeasoningRow:** zeigt Zutatenname + Küchenmengenangabe:
- `ing.parserItem.kitchenAmountText` (von Backend geliefert, z. B. `"1 TL"`, `"1 Prise"`, `"nach Geschmack"`) — gesetzt für alle Seasoning-Items ab WP-5
- Fallback für ältere API-Responses (z. B. beim Offline-Test): leer lassen oder `rawText` anzeigen
- Aktionen: Entfernen (mit Undo-Snackbar); kein Ersetzen-Button (AC-1 sagt keine Produktsuche für Seasonings)

#### 2c: Kompakte Hauptzutaten-Darstellung (AC-4, AC-5)

Die bestehenden expandierten Karten für `confirmed` / `auto-matched`-Zutaten werden durch kompakte Zeilen ersetzt. Die Darstellung basiert auf der extrahierten `DiaryItemRow`-Komponente (siehe WP-2c-Refactor).

##### WP-2c-Refactor: Extraktion von `DiaryItemRow` aus `DiaryScreen` (DiaryScreen-Refactor)

**Neue Datei:** `mobile/src/shared/components/DiaryItemRow.tsx`

Extrahiere die inline-Itemzeile aus `DiaryScreen.tsx` als rein presentationale Komponente:

```ts
export interface DiaryItemRowProps {
  name: string;
  amountLabel: string;          // z. B. "250 g" oder "1 Portion"
  kcal: number;
  protein: number;
  aiBadgeLabel?: string;        // optional, z. B. "✨ KI-Schätzung"
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function DiaryItemRow({ name, amountLabel, kcal, protein, aiBadgeLabel, onPress, style }: DiaryItemRowProps) {
  // ...
}
```

Das visuelle Layout entspricht dem bestehenden Item-Row in `DiaryScreen` (zwei Zeilen: Name + Menge, kcal + Protein). Alle Styles werden in die neue Datei übertragen oder aus dem Theme referenziert.

**Änderungen in `DiaryScreen.tsx`:**
- Import `DiaryItemRow` aus `../../shared/components/DiaryItemRow`
- Bestehende inline-Item-Render-Logik (die `TouchableOpacity`-Zeile pro `MealItem` mit den zwei `Text`-Lines) durch `<DiaryItemRow>` mit entsprechenden Props ersetzen
- `amountLabel` aus `item.unit` und `item.quantity` berechnen (bestehende Logik inline übertragen)
- AI-Badge-Label aus `item.sourceType === 'ai-meal-estimate'` und `item.aiMealEstimatePhotoUsed` ableiten
- Kein äußerlich wahrnehmbarer Verhaltensunterschied; alle Swipe-, Tap- und Animations-Wrapper bleiben in `DiaryScreen`

**Testanforderungen (WP-2c-Refactor):**
- Kein Snapshot-Test; keine Business-Logik in der Komponente
- Sicherstellen: `DiaryScreen`-Integrationstests (sofern vorhanden) bleiben grün

##### WP-2c-Main: Wizard-Zutatenzeilen mit `DiaryItemRow`

**Datei:** `mobile/src/modules/recipes/RecipeWizardScreen.tsx`

Nach Abschluss von WP-2c-Refactor: Import `DiaryItemRow` und verwende sie für `confirmed` / `auto-matched`-Zutaten:

```tsx
<DiaryItemRow
  name={ing.resolvedIngredient.name}
  amountLabel={amountEdits[ing.id]?.mode === 'portion'
    ? `${amountEdits[ing.id]?.value} Portion${parseFloat(amountEdits[ing.id]?.value ?? '1') !== 1 ? 'en' : ''}`
    : `${Math.round(parseFloat(amountEdits[ing.id]?.value ?? '0'))} g`}
  kcal={Math.round(ing.resolvedIngredient.macros.calories)}
  protein={Math.round(ing.resolvedIngredient.macros.protein)}
  onPress={() => openHub({ initialQuery: ing.parserItem.displayName, ... })}
/>
```

Für Zutaten mit `status: 'needs-selection'` oder `'needs-ai'` (noch nicht aufgelöst):
- Kompakter Hinweis-Zustand: Zutatenname + "Tippen zum Zuordnen" (AC-10)
- Tippen → Hub öffnen mit vorinitialisiertem Suchbegriff
- `DiaryItemRow` wird hier **nicht** verwendet (keine Makros vorhanden); stattdessen einfaches Hinweis-Layout

Für `status: 'ai-estimating'`: `ActivityIndicator` in Zeilenposition (kein Tippen möglich).

Die bisherigen `IngredientSearchResults`-Inlinekomponenten in der `needs-selection`-Karte entfallen vollständig (AC-12).

**Testanforderungen (WP-2c-Main):**
- Snapshot-Tests nicht erforderlich (keine pure Logik)
- Integration: `DiaryItemRow` erhält korrekte Props; Hub wird mit korrektem `initialQuery` geöffnet

---

### WP-3: RecipeCreateScreen – Hub-Migration (Frontend)

**Datei:** `mobile/src/modules/recipes/RecipeCreateScreen.tsx`

`RecipeCreateScreen` nutzt aktuell `AddIngredientModal`. Da `AddIngredientModal` entfernt wird, muss es auf den Hub migriert werden.

**Änderungen:**
- Import von `AddIngredientModal` entfernen
- `useFoodEntryHubStore` importieren
- `setAddIngredientVisible(true)` → `openHub({ onSelectIngredient: (product, mode, amount) => handleAddIngredient(buildFromProduct(product, mode, amount)) })`
- State-Variablen `addIngredientVisible`, `initialQuery`, `replacingIngId` (Modal-Steuerung) entfernen oder anpassen
- `AddIngredientModal`-JSX entfernen

**Keine UX-Änderung:** Für den Nutzer ist das Ergebnis identisch — der Hub öffnet sich. Da kein `initialQuery` oder `prefillAmount` übergeben wird, öffnet sich der Hub im normalen Idle-Modus.

---

### WP-4: Bereinigung rezeptspezifischer Suchartefakte (Frontend)

**Dateien löschen:**

| Datei | Begründung |
|---|---|
| `mobile/src/modules/recipes/AddIngredientModal.tsx` | Vollständig durch Hub ersetzt (WP-1 + WP-2 + WP-3) |
| `mobile/src/modules/recipes/IngredientSearchResults.tsx` | Duplikat von Hub-`SearchState`; nach WP-2 nicht mehr referenziert |
| `mobile/src/modules/recipes/RecipeIngredientAmountView.tsx` | Duplikat von Hub-`QuantityView` in Rezept-Modus; nach Entfernung von `AddIngredientModal` nicht mehr referenziert |

**Importbereinigung:** Alle Referenzen auf die drei Dateien in `RecipeWizardScreen.tsx` und `RecipeCreateScreen.tsx` entfernen.

**Hinweis:** `ingredientBuilders.ts` und `ingredientBuilders.test.ts` bleiben erhalten — sie enthalten reine Berechnungslogik (`buildFromProduct`, `buildIngFromCandidate` etc.) und werden weiterhin von `RecipeWizardScreen` genutzt.

---

### WP-5: Backend-Erweiterung Gewürz-Küchenmengen (Backend)

**Required Skills:** `azure-openai-feature-integration`

**Persistence Impact:** Kein Cosmos-Dokument wird verändert. `kitchenAmountText` ist ein transienter Response-Wert der AI-Pipeline — er wird nicht persistiert. Class 0, keine Migration.

**Dateien:**

| Datei | Änderung |
|---|---|
| `backend/src/lib/prompts/recipeAnalyze.ts` | Prompt-Erweiterung: neues Feld `kitchenAmountText` für Seasoning-Items |
| `backend/src/lib/openai.ts` | `AiRecipeIngredientLine`-Interface und `RECIPE_ANALYZE_SCHEMA` erweitern |
| `backend/src/functions/ai.ts` | `MealParserPreviewItem`-Interface und Seasoning-Konstruktion erweitern |
| `mobile/src/shared/api/aiApi.ts` | Client-seitigen `MealParserPreviewItem`-Type erweitern |
| `backend/src/functions/ai.test.ts` | Neue Unit-Tests für `kitchenAmountText`-Durchleitung |

#### `backend/src/lib/prompts/recipeAnalyze.ts`

Im `RECIPE_ANALYZE_SYSTEM_PROMPT` den Ingredients-Abschnitt um das neue Feld erweitern:

```
- **kitchenAmountText**: Nur für Zutaten mit category "seasoning". Eine küchenübliche Mengenangabe auf Deutsch,
  z. B. "1 TL", "½ TL", "1 Prise", "1 Msp.", "nach Geschmack", "1 Handvoll". Leite sie aus der Originalangabe
  ab (z. B. "1 EL" bleibt "1 EL") oder schätze eine realistische Kücheneinheit. Für food-Zutaten: null.
```

**Prompt-Version** in `RECIPE_ANALYZE_PROMPT_VERSION` von `'v4'` auf `'v5'` erhöhen.

#### `backend/src/lib/openai.ts`

**Interface `AiRecipeIngredientLine`** — neues optionales Feld:
```ts
export interface AiRecipeIngredientLine {
  line: string;
  displayName: string;
  category: 'food' | 'seasoning';
  amountGrams: number | null;
  kitchenAmountText: string | null;  // neu: nur für seasoning gefüllt; für food: null
}
```

**`RECIPE_ANALYZE_SCHEMA`** — im `ingredients.items.properties`-Objekt ergänzen:
```ts
kitchenAmountText: { type: ['string', 'null'] as const },
```
`kitchenAmountText` in `required`-Array des Ingredient-Items aufnehmen (nach `amountGrams`).

#### `backend/src/functions/ai.ts`

**Interface `MealParserPreviewItem`** — neues optionales Feld:
```ts
export interface MealParserPreviewItem {
  // ... bestehende Felder unverändert ...
  kitchenAmountText?: string | null;  // neu: von Backend für seasoning-Items befüllt
}
```

**Seasoning-Konstruktion** (im `recipeAnalyzeHandler`, ca. Zeile 505) — `kitchenAmountText` aus der AI-Antwort durchreichen:
```ts
const resolvedSeasonings: MealParserPreviewItem[] = seasoningIngredients.map((s) => ({
  rawText: s.line,
  displayName: s.displayName,
  status: 'seasoning' as ItemStatus,
  selectedProductId: null,
  selectedProductName: null,
  candidates: [],
  inputMode: 'grams' as const,
  inputAmount: s.amountGrams,
  amountGrams: s.amountGrams,
  kitchenAmountText: s.kitchenAmountText ?? null,  // neu
  needsReview: false,
  warnings: [],
  category: 'seasoning' as const,
}));
```

#### `mobile/src/shared/api/aiApi.ts`

**Interface `MealParserPreviewItem`** — neues optionales Feld:
```ts
export interface MealParserPreviewItem {
  // ... bestehende Felder unverändert ...
  kitchenAmountText?: string | null;  // neu: nur für seasoning-Items befüllt
}
```

#### `backend/src/functions/ai.test.ts`

Bestehende Seasoning-Tests erweitern:

```ts
it('passes kitchenAmountText from AI response to seasoning item', async () => {
  // AI-Mock gibt kitchenAmountText: '1 TL' zurück
  // Assert: response.ingredients[0].kitchenAmountText === '1 TL'
});

it('sets kitchenAmountText to null when AI returns null', async () => {
  // AI-Mock gibt kitchenAmountText: null zurück
  // Assert: response.ingredients[0].kitchenAmountText === null
});
```

**Contract-Änderung:** Neues optionales Feld im `MealParserPreviewItem`-Response — vollständig rückwärtskompatibel. Bestehende Clients, die das Feld nicht kennen, ignorieren es. Bestehende Tagebuch-AI-Flows (`/ai/meal-parser/preview`) sind nicht betroffen — `kitchenAmountText` wird nur im `recipe-analyze`-Response befüllt.

---

## Abhängigkeiten und Reihenfolge

```
Phase 1 — parallel:
  WP-5  (Backend: kitchenAmountText)
  WP-1  (Hub-Erweiterungen)
  WP-2c-Refactor  (DiaryItemRow-Extraktion aus DiaryScreen)

Phase 2 — nach Phase 1:
  WP-2a  (Hub-Aufruf in RecipeWizardScreen, benötigt WP-1)
  WP-3   (RecipeCreateScreen Hub-Migration, benötigt WP-1)

Phase 3 — nach Phase 2 + WP-5:
  WP-2b  ("Automatisch erkannt"-Bereich, benötigt WP-2a + WP-5)
  WP-2c-Main  (kompakte Hauptzutaten-Darstellung, benötigt WP-2a + WP-2c-Refactor)

Phase 4 — nach Phase 3 + WP-3:
  WP-4  (Bereinigung / Datei-Löschung, benötigt WP-2b + WP-2c-Main + WP-3)
```

**Kritische Reihenfolgebedingung:** WP-5 muss **vor** WP-2b abgeschlossen sein (lokal verfügbar via `func start`), da WP-2b `kitchenAmountText` aus dem Backend-Response konsumiert. WP-2c-Main darf erst beginnen, wenn WP-2c-Refactor abgeschlossen ist (DiaryItemRow muss existieren).

---

## Akzeptanzkriterien-Mapping

| AC | Work Package | Umsetzung |
|---|---|---|
| AC-1: Seasoning-Bereich „Automatisch erkannt" | WP-2b | Eigene Section in `RecipeWizardScreen` |
| AC-2: Eingeklappt oberhalb Hauptzutaten | WP-2b | `seasoningsExpanded`-State, default `false` |
| AC-3: Küchenübliche Mengenangabe | WP-2b + WP-5 | `kitchenAmountText` aus Backend (WP-5), angezeigt in SeasoningRow (WP-2b) |
| AC-4: Kompakte Darstellung wie Tagebuch | WP-2c-Refactor + WP-2c-Main | `DiaryItemRow` extrahiert (Refactor), in Wizard genutzt (Main) |
| AC-5: Menge + Lebensmittel + Einheit + kcal + Protein | WP-2c-Main | Alle Felder via `DiaryItemRow`-Props |
| AC-6: Antippen öffnet Hub | WP-2a | `useFoodEntryHubStore.open(...)` |
| AC-7: Hub mit KI-Suchbegriff vorinitialisiert | WP-1 + WP-2a | `initialQuery` im Store/Hub |
| AC-8: Normaler Suchflow → QuantityView mit KI-Menge vorinitialisiert | WP-1 | `prefillAmount` → `prefill` in QuantityView |
| AC-9: „So wie immer"-Schnellauswahl mit KI-Menge | WP-1 | `quickAcceptLabel`/`onQuickAccept` in SearchState/ResultRow |
| AC-10: Kein Treffer → Hinweis, Antippen öffnet Hub | WP-2c-Main | Hinweis-Zustand mit Hub-Open |
| AC-11: Hub vollständig funktionsfähig | WP-1 | Alle Subflows unverändert, kein Verhalten entfernt |
| AC-12: Keine eigene Such-/Mengen-Logik außerhalb Hub | WP-4 | Alle drei Artefakte gelöscht |
| AC-13: Identische Animation/Darstellung/Höhe | WP-1 + WP-2a | Gleicher Singleton-Hub, gleiche BottomSheetModal-Config |

---

## Testanforderungen

| Test | Art | Datei |
|---|---|---|
| `hubReducer`: `SET_QUERY` von idle → search mode | Unit | `hubReducer.test.ts` (erweitern) |
| `useFoodEntryHubStore.open()`: neue Parameter werden korrekt gesetzt | Unit | neues Test-File oder Store-Test erweitern |
| `QuantityView` recipe mode: kein `diaryApi`-Aufruf, keine Meal-Selector-Anzeige | Unit (mock) | neues Test-File |
| `ingredientBuilders`: bestehende Tests bleiben unverändert grün | Unit | `ingredientBuilders.test.ts` |
| `ai.test.ts`: `kitchenAmountText` aus AI-Response wird an Seasoning-Item durchgereicht | Unit | `backend/src/functions/ai.test.ts` (erweitern) |
| `ai.test.ts`: `kitchenAmountText: null` bei null-Rückgabe der AI | Unit | `backend/src/functions/ai.test.ts` (erweitern) |
| `DiaryScreen` Smoke: bestehende Item-Darstellung nach Extraktion unverändert | Integration | optional, falls DiaryScreen-Tests vorhanden |
| `RecipeWizardScreen` Smoke: Hub wird geöffnet, nicht `AddIngredientModal` | Integration | optional |

---

## Nicht in Scope

- Neue Backend-Endpunkte außer WP-5
- Änderungen an Rezept-Datenmodell oder API-Kontrakt (außer `kitchenAmountText` im transienten Preview-Response)
- Navigation zwischen Wizard-Phasen (unverändert)
- Design-System-Änderungen (Farben, Typografie, Spacing)
- Entfernung von `RecipeCreateScreen` oder Änderung am Form-basierten Rezept-Flow (außer Hub-Migration in WP-3)
- Änderungen am Ernährungstagebuch-Flow (außer der Extraktion von `DiaryItemRow` in WP-2c-Refactor)

---

## Konflikte zwischen Dokumentation und Implementierung

`docs/kb/domain/06-recipes.md` beschreibt `AddIngredientModal` als die etablierte Ingredient-Picker-Komponente. Nach Abschluss dieser Story wird `AddIngredientModal` entfernt und durch den Hub ersetzt. Das Knowledge-Base-Dokument muss nach Implementierung entsprechend aktualisiert werden.

---

## Recommended Execution Order

Die folgende Reihenfolge gilt für die Ausführung durch die Implementierungsagenten. Alle Arbeiten innerhalb einer Phase können parallel ausgeführt werden.

### Phase 1 — Parallel, keine gegenseitigen Abhängigkeiten

| Schritt | Work Package | Agent | Abhängigkeit |
|---|---|---|---|
| 1a | **WP-5** — Backend: `kitchenAmountText` in Prompt, Schema, `MealParserPreviewItem`, Seasoning-Konstruktion | Backend | — |
| 1b | **WP-1** — Hub-Erweiterungen (`useFoodEntryHubStore`, `FoodEntryHub`, `QuantityView`, `SearchState`/`ResultRow`) | Frontend | — |
| 1c | **WP-2c-Refactor** — `DiaryItemRow` aus `DiaryScreen` extrahieren nach `shared/components/DiaryItemRow.tsx` | Frontend | — |

### Phase 2 — Nach Phase 1 (WP-1 abgeschlossen)

| Schritt | Work Package | Agent | Abhängigkeit |
|---|---|---|---|
| 2a | **WP-2a** — Hub-Aufruf statt `AddIngredientModal` in `RecipeWizardScreen` | Frontend | WP-1 |
| 2b | **WP-3** — `RecipeCreateScreen` auf Hub migrieren | Frontend | WP-1 |

### Phase 3 — Nach Phase 2 + WP-5 + WP-2c-Refactor

| Schritt | Work Package | Agent | Abhängigkeit |
|---|---|---|---|
| 3a | **WP-2b** — "Automatisch erkannt"-Bereich mit `SeasoningRow` und `kitchenAmountText` | Frontend | WP-2a + WP-5 |
| 3b | **WP-2c-Main** — Kompakte Hauptzutaten-Darstellung mit `DiaryItemRow` im Wizard | Frontend | WP-2a + WP-2c-Refactor |

### Phase 4 — Nach Phase 3 + WP-3

| Schritt | Work Package | Agent | Abhängigkeit |
|---|---|---|---|
| 4 | **WP-4** — `AddIngredientModal`, `IngredientSearchResults`, `RecipeIngredientAmountView` löschen; Imports bereinigen | Frontend | WP-2b + WP-2c-Main + WP-3 |

### Phase 5 — QA-Review

| Schritt | Work Package | Agent | Abhängigkeit |
|---|---|---|---|
| 5 | QA-Review aller WPs gegen alle 13 ACs; AI-Feature-Checklist (WP-5) | QA | WP-4 abgeschlossen |
