# PLAN — US-02: Standardsuche für Rezeptzutaten (Revision 2 — PO-Feedback iteriert)

**User Story:** [US-02_Standardsuche_fuer_Rezeptzutaten.md](US-02_Standardsuche_fuer_Rezeptzutaten.md)  
**Status:** Revised — ready for implementation.  
**Revision:** 2 — Basiert auf akkumuliertem PO-Feedback (3 Iterationen). Ersetzt Revision 1 vollständig.  
**Infrastructure Impact:** None  
**Mobile Build Impact:** None (OTA via Dev Build)

---

## Kontext: Warum dieser Plan Revision 1 ersetzt

Revision 1 (implementiert) hat `AddIngredientModal` von einer React Native `Modal` in ein `BottomSheetModal` umgebaut und `SearchState` darin eingebettet. Das war korrekt und ist weiterhin die Grundlage für den „Ersetzen"-Flow.

Das PO-Feedback (drei Iterationen) zeigt jedoch, dass das Modell „Suchen-Button → BottomSheet" für die `needs-selection`-Karte **nicht das ist, was der PO will**. Der PO will:

- Suchergebnisse **inline in der Zutatenkarte** — kein separater Button, kein BottomSheet für diesen Flow
- Die Karte **expandiert und zeigt sofort die Suchergebnisse**, mit dem `displayName` als automatischer Startquery
- Optisch identisch mit dem Suchhub: Thumbnail, Makros, Favoriten-Toggle (`ResultRow`-Qualität)
- Kein manueller Suchbutton mehr

Der „Ersetzen"-Button bei confirmed/auto-matched Zutaten bleibt via `AddIngredientModal` (BottomSheetModal) — ist aber defekt und muss repariert werden.

---

## 1. Technische Analyseergebnisse (aus Repository-Lesung)

### Frage A — Kann `SearchState` inline in der Karte verwendet werden?

**Nein.** `SearchState` verwendet `BottomSheetFlatList` aus `@gorhom/bottom-sheet` (explizit im Render-Return für sowohl die Ergebnisliste als auch die Recents-Liste). `BottomSheetFlatList` muss zwingend innerhalb eines BottomSheet-Kontexts (`BottomSheet` oder `BottomSheetModal`) gerendert werden. In einem regulären `ScrollView` des `RecipeWizardScreen` würde es crashen oder keine Scroll-Koordination haben.

**Konsequenz:** `SearchState` wird in der `needs-selection`-Karte **nicht direkt** gerendert. Stattdessen entsteht eine neue Komponente `IngredientSearchResults`, die dieselbe Suchlogik und dasselbe visuelle Layout verwendet, aber auf `BottomSheetFlatList` verzichtet.

### Frage B — Warum öffnet sich `AddIngredientModal` (BottomSheet) nicht?

**Root Cause: Lifecycle-Problem durch Early Return.**

`RecipeWizardScreen` hat einen Early Return für `phase === 'analyzing'`:

```tsx
// RecipeWizardScreen.tsx
if (phase === 'analyzing') {
  return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator ... />
    </SafeAreaView>
  );
}
// Haupt-Return enthält AddIngredientModal
return (
  <SafeAreaView>
    ...
    <AddIngredientModal ... />
  </SafeAreaView>
);
```

Das bedeutet: Während `phase === 'analyzing'` ist `AddIngredientModal` — und damit der darin enthaltene `BottomSheetModal` mit `sheetRef` — **vollständig unmounted**. Wenn die Analyse abgeschlossen ist und die Phase zu `'ingredients'` wechselt, wird `AddIngredientModal` neu gemountet. Bei `@gorhom/bottom-sheet` benötigt ein frisch gemountetes `BottomSheetModal` mindestens einen vollständigen Render-Cycle zur internen Initialisierung. Wenn der `useEffect` in `AddIngredientModal` (`sheetRef.current?.present()`) in diesem Zeitfenster feuert, oder wenn es einen Timing-Konflikt mit der internen Sheet-Initialisierung gibt, schlägt `present()` still fehl — der optionale Chaining (`?.`) unterdrückt den Fehler.

Beide Buttons („Suchen" und „Ersetzen") teilen denselben Mechanismus (`setAddIngredientVisible(true)` → `useEffect` → `sheetRef.current?.present()`). Darum sind beide defekt.

**Fix:** Den Early Return für `'analyzing'` so umstrukturieren, dass `AddIngredientModal` **immer** im DOM bleibt. Der Analysezustand wird als bedingtes Rendering des Screen-Inhalts gelöst, nicht als Early Return des gesamten Screens.

### Frage C — Warum reagiert der „Ersetzen"-Button nicht?

Identische Ursache wie Frage B. Identischer Fix.

---

## 2. Technische Entscheidung: Option A (inline Suchergebnisse)

**Gewählte Option: A — Inline-Suchergebnisse in der expandierten Zutatenkarte.**

Begründung:
- Der PO will die Ergebnisse „innerhalb der Karte" sehen, explizit als Teil des Karten-Expandierens
- Ein neues BottomSheet-Öffnen (Option B) entspricht nicht der PO-Aussage „kein manueller Suchbutton"
- Option A ist technisch realisierbar mit einer neuen, schlanken `IngredientSearchResults`-Komponente
- `AddIngredientModal` bleibt bestehen und wird repariert — ausschließlich für den „Ersetzen"-Flow bei confirmed/auto-matched Zutaten

---

## 3. Betroffene Dateien

| Datei | Aktion |
|---|---|
| `mobile/src/modules/recipes/IngredientSearchResults.tsx` | **Neu erstellen** |
| `mobile/src/modules/nutrition/hub/SearchState.tsx` | `ResultRow` und `ResultRowProps` exportieren (1-Zeilen-Änderung) |
| `mobile/src/modules/recipes/RecipeWizardScreen.tsx` | `needs-selection`-Block umbauen; Early-Return-Fix |
| `mobile/src/modules/recipes/AddIngredientModal.tsx` | Keine Änderungen |
| `mobile/src/app/App.tsx` | Keine Änderungen |

---

## 4. Korrekturplan — Nummerierte Subtasks

---

### Subtask 1 — `ResultRow` aus `SearchState.tsx` exportieren

**Agent:** Frontend  
**Datei:** `mobile/src/modules/nutrition/hub/SearchState.tsx`

**Motivation:** `ResultRow` ist derzeit nicht exportiert. Der PO verlangt „Look and Feel des Suchhubs" — das bedeutet exakte visuelle Parität, die am einfachsten durch Wiederverwendung der Originalkomponente erreicht wird.

**Konkrete Änderung:**

```tsx
// Vorher:
const ResultRow = React.memo(function ResultRow(...) { ... });
interface ResultRowProps { ... }

// Nachher:
export interface ResultRowProps { ... }
export const ResultRow = React.memo(function ResultRow(...) { ... });
```

Keine funktionale Änderung an `ResultRow` selbst. Kein Eingriff in `SearchState`-Logik, `FoodEntryHub` oder andere Nutzer dieser Datei.

**Lieferung:** `SearchState.tsx` mit `export` vor `ResultRow` und `ResultRowProps`.

---

### Subtask 2 — Neue Komponente `IngredientSearchResults.tsx` erstellen

**Agent:** Frontend  
**Datei (neu):** `mobile/src/modules/recipes/IngredientSearchResults.tsx`

**Zweck:** Inline-Suchkomponente für die expandierte Zutatenkarte. Führt bei Mount automatisch eine Suche mit `initialQuery` aus, zeigt Ergebnisse in `ResultRow`-Qualität, benötigt keinen BottomSheet-Kontext.

**Props-Interface:**

```ts
interface Props {
  initialQuery: string;                         // displayName der Zutat — Startquery beim Mount
  onSelect: (item: FoodSearchResult) => void;   // Auswahl eines Produkts
  onRequestAiEstimate: () => void;              // Fallback: KI-Schätzung auslösen
  onRequestManual: () => void;                  // Fallback: Manuell via AddIngredientModal öffnen
}
```

**Internes Verhalten:**

- State: `query: string` (initialisiert mit `initialQuery`), `results: FoodSearchResult[]`, `loading: boolean`, `error: string | null`
- `useEffect([])` (Mount): Startet sofort `foodApi.search(initialQuery)` wenn `initialQuery.trim().length > 0`
- `query`-Änderungen durch den User: Standard-Debounce (300 ms) wie in `SearchState`
- Such-Input: normales React Native `TextInput` (kein `BottomSheetTextInput`)
- Ergebnisliste: `results.map(item => <ResultRow ... />)` in einer regulären `View` — kein `FlatList`, kein `BottomSheetFlatList`; das Scrolling übernimmt der `ScrollView` des `RecipeWizardScreen`
- Ladezustand: `ActivityIndicator`
- Fehlerzustand: Inline-Fehlermeldung mit Retry
- Keine Ergebnisse: Kurzer „Kein Treffer"-Text + Fallback-Buttons für KI-Schätzung und Manuell
- Recents: nicht benötigt

**Visuelles Ziel:** Ergebniszeilen müssen mit dem Suchhub übereinstimmen — Thumbnail (44 pt), Buchstaben-Avatar als Fallback, Produktname + Herz-Toggle, Marke + Badges, Makroleiste. Sichergestellt durch Import von `ResultRow` (nach Subtask 1).

**Lieferung:** `IngredientSearchResults.tsx` mit Implementierung aller Zustände (loading, error, results, empty).

---

### Subtask 3 — `RecipeWizardScreen` umbauen

**Agent:** Frontend  
**Datei:** `mobile/src/modules/recipes/RecipeWizardScreen.tsx`

#### 3a — Early-Return-Fix (behebt gleichzeitig den „Ersetzen"-Button)

Das `phase === 'analyzing'` Early Return wird umstrukturiert, sodass `AddIngredientModal` außerhalb der konditionellen Phasen-Logik bleibt.

**Vorher (schematisch):**
```tsx
if (phase === 'analyzing') {
  return <SafeAreaView style={styles.center}>...</SafeAreaView>;
  // AddIngredientModal fehlt in diesem Pfad
}
return (
  <SafeAreaView style={styles.container}>
    {/* Header, ScrollView, Phasen */}
    <AddIngredientModal ... />
  </SafeAreaView>
);
```

**Nachher (schematisch):**
```tsx
return (
  <SafeAreaView style={styles.container}>
    {phase === 'analyzing' ? (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.analyzingTitle}>KI analysiert dein Rezept…</Text>
        <Text style={styles.analyzingSubtext}>Das kann einige Sekunden dauern.</Text>
      </View>
    ) : (
      <>
        {/* Header */}
        {/* KeyboardAvoidingView > ScrollView > alle Phasen */}
      </>
    )}
    {/* AddIngredientModal IMMER gemountet — außerhalb der phase-Bedingung */}
    <AddIngredientModal
      visible={addIngredientVisible}
      onClose={...}
      onAdd={...}
      replacingIngId={replacingIngId}
      initialQuery={initialQuery}
    />
  </SafeAreaView>
);
```

**Hinweis:** `styles.center` war bisher direkt auf der `SafeAreaView`. Dieser Style muss auf eine `View` innerhalb der `SafeAreaView` übertragen werden; die `SafeAreaView` selbst erhält `styles.container`.

#### 3b — `needs-selection`-Block ersetzen

**Entfernen:**
- Den „🔍 Suchen"-Button (der `setAddIngredientVisible(true)` aufrief)
- Die `selectionActionRow`-View und den `candidateToggleBtn` mit dem `X Treffer wählen`-Text
- Die `candidates.map()`-Liste mit `candidateRow`-Einträgen
- Zugehörige Styles: `selectionActionRow`, `candidateToggleBtn`, `candidateToggleText`, `candidateRow`, `candidateArrow`, `candidateName`, `candidateMeta`

**Beibehalten:**
- `expandedIngId`-State (umfunktioniert: steuert das Expandieren für die Inline-Suche)
- `handleSelectCandidate`-Funktion — weiterhin verwendet als `onSelect`-Handler für `IngredientSearchResults`

**Neues Rendering für `needs-selection`:**

```tsx
{ing.status === 'needs-selection' && (
  <>
    <TouchableOpacity
      style={styles.candidateToggleBtn}
      onPress={() => setExpandedIngId(isExpanded ? null : ing.id)}
    >
      <Text style={styles.candidateToggleText}>
        {isExpanded ? '▲ Treffer verbergen' : '▼ Treffer anzeigen'}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.aiBtn}
      onPress={() => handleAiEstimate(ing.id)}
    >
      <Text style={styles.aiBtnText}>✦ KI-Schätzung</Text>
    </TouchableOpacity>

    {isExpanded && (
      <IngredientSearchResults
        initialQuery={ing.parserItem.displayName}
        onSelect={(item) => handleSelectCandidate(ing.id, item)}
        onRequestAiEstimate={() => handleAiEstimate(ing.id)}
        onRequestManual={() => {
          setReplacingIngId(ing.id);
          setInitialQuery(ing.parserItem.displayName);
          setAddIngredientVisible(true);
        }}
      />
    )}
  </>
)}
```

#### 3c — „Ersetzen"-Logik bleibt unverändert

Der „Ersetzen"-Link bei confirmed/auto-matched Zutaten bleibt wie bisher. Durch den Fix in 3a öffnet sich `AddIngredientModal` ab sofort zuverlässig.

**Lieferung:**
- `RecipeWizardScreen.tsx` mit Early-Return-Fix und umgebautem `needs-selection`-Block
- „🔍 Suchen"-Button ist entfernt; Kandidatenliste (5 Treffer) ist entfernt
- `IngredientSearchResults` rendert inline wenn `isExpanded`
- „Ersetzen"-Button bei confirmed/auto-matched Zutaten funktioniert korrekt

---

### Subtask 4 — Manuelle Verifikation (QA / Frontend)

**Kein Build nötig** — alle Änderungen sind reines JS/TS, OTA via Dev Build.

**Verifikationsschritte:**

| Schritt | Erwartetes Verhalten |
|---|---|
| `needs-selection`-Karte: Toggle antippen | Suchergebnisse erscheinen inline in der Karte, kein BottomSheet |
| Suchergebnisse prüfen | Thumbnails, Makroleiste, Favoriten-Toggle — wie Suchhub |
| Produkt aus Inline-Liste auswählen | Karte wechselt in `confirmed`-Zustand; Nährwerte korrekt |
| „Treffer verbergen" antippen | Suchergebnisse verschwinden |
| „Ersetzen"-Button bei confirmed Zutat | `AddIngredientModal` öffnet sich korrekt mit vorausgefüllter Query |
| Vollständiger Wizard-Durchlauf | Rezept speicherbar; `perPortion`-Nährwerte korrekt |

---

## 5. Out of Scope

- `AddIngredientModal.tsx` — keine Änderungen (bleibt für „Ersetzen"-Flow)
- `SearchState.tsx` — nur `export`-Keyword; keine funktionale Änderung
- `FoodEntryHub.tsx`, `QuantityView.tsx`, `hubReducer.ts` — nicht berührt
- Backend-Endpunkte — keine Änderungen
- `RecipeCreateScreen.tsx` — nicht betroffen
- AI-Analyse-Pipeline, Batch-Estimation, Auto-Match — nicht berührt

---

## 6. Risiken

| Risiko | Schweregrad | Mitigation |
|---|---|---|
| Viele Suchergebnisse rendern via `map()` ohne Virtualisierung | Niedrig | `foodApi.search()` gibt typisch 10–20 Ergebnisse zurück |
| `handleSelectCandidate` erwartet `FoodSearchResult` — Typkompatibilität | Niedrig | Beide Typen sind `FoodSearchResult` aus `@fittrack/shared`; Compiler prüft |
| `styles.center` muss von `SafeAreaView` auf `View` übertragen werden | Niedrig | Explizit im Plan beschrieben |
| Early-Return-Umbau: `SafeAreaView`-Style (container vs. center) | Niedrig | `styles.container` für äußere `SafeAreaView`; `styles.center` für innere `View` |

---

## 7. Akzeptanzkriterien (Revision 2)

**AC-R2-1:** Eine `needs-selection`-Zutatenkarte zeigt nach Antippen des Toggle-Buttons sofort Suchergebnisse in der Karte an — kein BottomSheet öffnet sich für diesen Flow.

**AC-R2-2:** Die Suche startet automatisch mit dem `parserItem.displayName` als Query; keine manuelle Eingabe nötig für erste Ergebnisse.

**AC-R2-3:** Jede Ergebniszeile zeigt Thumbnail (oder Buchstaben-Avatar), Produktname, Marke, Badges, Makroleiste und Favoriten-Toggle — identisch mit dem Suchhub.

**AC-R2-4:** Ein Antippen eines Suchergebnisses wechselt die Zutat in `confirmed` mit korrekten Nährwerten.

**AC-R2-5:** Der Toggle-Button wechselt zwischen `▼ Treffer anzeigen` und `▲ Treffer verbergen`.

**AC-R2-6:** Der „Ersetzen"-Button bei einer confirmed/auto-matched Zutat öffnet `AddIngredientModal` (BottomSheetModal) korrekt und mit vorausgefüllter Query.

**AC-R2-7:** Kein „🔍 Suchen"-Button mehr in der `needs-selection`-Karte sichtbar.

**AC-R2-8:** Vollständiger Wizard-Durchlauf produziert korrekte `perPortion`-Nährwerte.

---

## 8. Ausführungsreihenfolge

```
Subtask 1 — ResultRow exportieren (SearchState.tsx)
      ↓
Subtask 2 — IngredientSearchResults.tsx erstellen
      ↓
Subtask 3 — RecipeWizardScreen umbauen (Early-Return-Fix + needs-selection-Block)
      ↓
Subtask 4 — Manuelle Verifikation
```