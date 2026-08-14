# Technischer Plan: US-05 Rezept für gewünschte Portionsanzahl skalieren

**Status:** Freigabefertig.
**Infrastructure Impact:** None
**Mobile Build Impact:** None

## 1. Open Product Owner Decisions

Open Product Owner Decisions: None

**Abgeschlossene Produktentscheidungen:**

- **PO-1:** Zielportionen sind ganze Zahlen von `1` bis `50`, Schrittweite `1`.
- **Quota-Entscheidung für `recipe-scale`:** `free` und `premium` erhalten jeweils `30` Aufrufe pro Kalendermonat. `internal` bleibt unbegrenzt (`Infinity`); der bestehende Admin-Bypass über `isAdmin = true` bleibt unabhängig vom Tier erhalten.
- **PO-3:** Sicher parsebare numerische `amountLabel`-Werte werden skaliert; `nach Geschmack` und unsichere Labels bleiben unverändert.
- **PO-4:** Keine Persistenz des Zielwerts oder der AI-Texte; Nährwerte pro Portion bleiben unverändert; keine Tagebuchkopplung.
- **PO-5:** Keine manuelle fachliche Review-Schleife; während Debounce und Loading werden alte Beschreibung und Schritte ausgeblendet und der feste deutsche Hinweis angezeigt.
- **Neue Klarstellung zu historischen Portionswerten:** Werte außerhalb `1–50` werden vom Scale-Feature nicht behandelt. Der normale Rezept-Wizard validiert künftig ganze Portionswerte `1–50` und schließt andere Werte vor dem Speichern aus. Es gibt im Scale-Feature keine zusätzliche Laufzeitentscheidung, Kompatibilitätsbehandlung, Korrektur oder Migration für solche Bestandsdaten.

## 2. Requirement Assessment

**Klassifikation:** Accept with modifications.

Die strukturierte Zutatenprojektion ist deterministisch und darf keine AI verwenden. AI ist nur für die semantische Anpassung von Beschreibung und Zubereitungsschritten erforderlich, weil die Entscheidung, ob eine Zeit-, Temperatur- oder Verfahrensangabe fachlich von den Mengen abhängt, nicht zuverlässig durch reine Textsubstitution gelöst werden kann.

Die AI-Ausgabe bleibt eine flüchtige, advisory Vorschau. Sie wird weder im Rezept noch im Tagebuch gespeichert. Damit wird die im Knowledge Base dokumentierte Review-Regel für persistierte AI-Ergebnisse nicht verletzt; für diese Story ist gemäß PO-5 dennoch keine zusätzliche Bestätigungsschleife vorgesehen. Der Hinweis „Die KI kann Fehler machen.“ bleibt während und nach einer erfolgreichen Textanpassung sichtbar.

Die wichtigsten Risiken sind veraltete AI-Antworten, fachlich unnötige Änderungen an Temperatur oder Zeit und unsichere Küchenlabels. Sie werden durch eine pure Shared-Funktion, einen konservativen Prompt, Strict Structured Output, serverseitige Antwortprüfung, Debounce, Abbruchsignal und eine monotone Request-Revision begrenzt.

## 3. Recommended Product Behaviour

Die Rezeptdetailansicht zeigt zwei getrennte Konzepte:

- **Portionen:** unveränderliche gespeicherte Original-Portionszahl.
- **Nachkochen für:** flüchtiger Zielwert mit `−`, Wert, `+` und dauerhaft erreichbarem Info-Tooltip.

Der Zielwert startet mit `recipe.portions`. Änderungen projizieren die Zutaten lokal sofort. Beschreibung und Schritte werden während der gesamten Debounce- und Loading-Phase ausgeblendet. Stattdessen werden ein dezenter Ladezustand und exakt folgender Hinweis angezeigt:

> Die KI passt die Texte an die neuen Rezeptmengen an. Die KI kann Fehler machen.

Die Zutaten bleiben währenddessen sichtbar und nutzbar. Eine vollständige, gültige Antwort ersetzt Beschreibung und Schritte gemeinsam. Bei einem AI-Fehler bleiben die skalierten Zutaten erhalten; die ursprünglichen Texte werden als Fallback wieder angezeigt und ein verständlicher deutscher Fehlerhinweis wird eingeblendet. Ein Zurücksetzen auf die Original-Portionszahl zeigt Originalzutaten und Originaltexte synchron ohne AI-Aufruf.

Nach einem AI-Fehler gibt es keinen automatischen Retry. Ein neuer Versuch entsteht nur durch eine neue Zielwertänderung oder einen vom Nutzer ausgelösten erneuten Ablauf außerhalb dieses Features.

Der Tooltip ist über einen separaten Info-Auslöser beim Bereich **Nachkochen für** erreichbar. `−` und `+` öffnen ihn nicht. Der Inhalt lautet unverändert:

> **Für wie viele kochst du?**  
> Zutatenmengen und Zubereitung werden automatisch an die gewählte Portionszahl angepasst. Dein Originalrezept bleibt unverändert.

## 4. Feature Summary

- `targetPortions` startet mit `recipe.portions` und bleibt im Bereich `1–50`.
- Die Zielzutaten werden für jede Anzeige aus dem unveränderten Original und dem Faktor `targetPortions / originalPortions` neu projiziert.
- Strukturierte numerische Mengen, Einheiten und sicher parsebare Küchenlabels werden deterministisch behandelt.
- Beschreibung und Schritte werden nach einem Debounce über `POST /api/ai/recipe-scale/preview` angepasst.
- Der Backend-Endpunkt lädt das Rezept serverseitig aus dem Benutzerkontext und vertraut nicht auf vom Client gesendete Originaltexte oder Originalmengen.
- Abgebrochene, verspätete oder zu einer anderen Rezeptinstanz gehörende Antworten dürfen die Anzeige nicht verändern.
- Das Originalrezept, `nutritionTotal`, `nutritionPerPortion`, Tagebuchdaten und Logik des bestehenden `LogRecipeModal` bleiben unverändert.
- Die AI-Texte und der temporäre Zielwert werden nicht gespeichert.

## 5. Current Behaviour

- `RecipeDetailScreen` lädt ein Rezept, zeigt die gespeicherte Beschreibung, Schritte, Zutaten und `recipe.portions` an, bietet aber keinen temporären Zielwert und keine Zutatenprojektion.
- `buildRecipePreviewViewModel()` formatiert gespeicherte Food-Mengen aus `inputAmount` oder `amountGrams` und Seasoning-Mengen aus `amountLabel` beziehungsweise Gramm.
- `RecipeIngredientGroup` rendert die vom ViewModel gelieferten Mengen; ein Scale-spezifischer ViewModel- oder Calculator-Pfad existiert nicht.
- `LogRecipeModal` skaliert `nutritionPerPortion` ausschließlich für einen Tagebuch-Log-Vorgang. Diese Funktion ist fachlich getrennt und darf nicht für US-05 wiederverwendet werden.
- Es gibt keinen `recipe-scale`-Eintrag in `AiFeature`, keinen passenden Quota-Key, keinen Endpoint und keine mobile `aiApi`-Methode.
- Der vorhandene AI-Rezeptanalysator (`recipe-analyze`) ist ein anderer Workflow für den Recipe Wizard.
- Die Backend-Validierung von `Recipe.portions` akzeptiert derzeit positive Werte, erzwingt aber noch nicht die neue Wizard-Voraussetzung ganze Zahlen `1–50`. Der Scale-Pfad übernimmt diese Validierung nicht als nachträgliche Bestandsdatenbehandlung.

## 6. Desired Behaviour

- Die Detailansicht rendert `Portionen` und `Nachkochen für` als getrennte Werte.
- `−` und `+` ändern den Zielwert jeweils um `1`, klemmen bei `1` und `50` und lösen nach dem Debounce höchstens eine AI-Anfrage für den zuletzt gewählten Wert aus.
- Zielzutaten erscheinen unmittelbar mit denselben Einheiten, Produktreferenzen und Anzeigeeigenschaften wie im Original.
- `1 TL` wird bei Verdopplung zu `2 TL`; `nach Geschmack` bleibt unverändert.
- Die alte Beschreibung und die alten Schritte sind während Debounce und Loading nicht sichtbar.
- Eine gültige AI-Antwort wird nur als konsistentes Paar aus Beschreibung und Schritten übernommen.
- Die Nährwertkacheln zeigen weiterhin die gespeicherten Nährwerte pro Originalportion.
- Reset, Rezept-Reload und Unmount invalidieren ausstehende Antworten und stellen den Originalzustand her.
- Kein Zielwert wird an den Tagebuch-Log übergeben und kein Rezept wird durch die Funktion geschrieben.

## 7. Scope

- Neue pure Shared-Skalierungsfunktion für `RecipeIngredient[]` inklusive sicherer `amountLabel`-Behandlung.
- Gemeinsame Konstanten und DTOs für den Zielbereich `1–50` und den Preview-Vertrag.
- Authentifizierter, quota-geschützter Backend-Preview-Endpunkt für Beschreibung und Schritte.
- Neuer versionierter AI-Prompt mit Strict Structured Output, serverseitiger Strukturprüfung und Prompt-Evals.
- Eigener `recipe-scale`-Quota-Key mit `free: 30/month`, `premium: 30/month` und `internal: Infinity`; der bestehende Admin-Bypass bleibt erhalten.
- Temporärer State, Stepper, InfoOverlay, Zutatenprojektion, Loading-/Fallback-Zustände und Request-Lebenszyklus in der Rezeptdetailansicht.
- Vorgelagerte Voraussetzung im normalen Recipe Wizard: neue oder bearbeitete Rezepte werden vor dem Speichern auf ganze Portionswerte `1–50` begrenzt. Diese Validierung ist die Vertragsvoraussetzung für den Scale-Pfad; sie wird nicht durch eine zusätzliche Scale-Laufzeitentscheidung ersetzt.
- Dokumentation der fertigen Funktion in den betroffenen Knowledge-Base- und API-Dokumenten nach der Implementierung.

## 8. Out of Scope

- Keine Migration, Reparatur, Anzeigeentscheidung oder Sonderbehandlung für bereits gespeicherte `Recipe.portions` außerhalb `1–50` im Scale-Feature.
- Keine Änderung gespeicherter Rezeptportionen, Zutaten, Texte, Nährwerte, Tags, Bilder oder Zeitstempel.
- Keine Neuberechnung von `nutritionTotal`, `nutritionPerPortion` oder Tagebuch-Nährwerten für den Zielwert.
- Keine Übergabe des Zielwerts an `POST /api/recipes/{id}/log`; das bestehende Log-Verhalten bleibt eigenständig.
- Keine Persistenz oder spätere Bearbeitung der AI-Texte.
- Keine manuelle kulinarische Review oder Bestätigung über die vereinbarte Warnung hinaus.
- Keine Änderung am bestehenden `recipe-analyze`-Prompt oder an dessen fachlichem Workflow.
- Keine neuen npm-Pakete, nativen Module, Config-Plugins oder EAS-Build-Anforderungen.
- Keine Bicep-Änderung, kein neuer Cosmos-Container und kein Alpha-Deployment im Rahmen dieser Story.

## 9. Confirmed Facts

### Knowledge Base und Repository

- Rezepte enthalten `portions`, strukturierte `RecipeIngredient[]`, geordnete `RecipeStep[]`, `nutritionTotal` und `nutritionPerPortion`; `amountLabel` ist ein persistentes optionales Anzeige- beziehungsweise Seasoning-Feld. Siehe [docs/kb/domain/06-recipes.md](docs/kb/domain/06-recipes.md), [shared/types/recipes.ts](shared/types/recipes.ts) und [docs/kb/tech/04-shared-library.md](docs/kb/tech/04-shared-library.md).
- Shared-Berechnungen sind pure Funktionen ohne I/O. Die neue Zutatenprojektion folgt dem Muster von [shared/lib/recipeCalculator.ts](shared/lib/recipeCalculator.ts).
- Backend-Handler verwenden `withHandler()`, `requireUser()`, Zod-Validierung sowie `enforceQuota()` vor dem AI-Aufruf und `trackUsage()` erst nach erfolgreicher Antwort. Siehe [docs/kb/tech/02-backend.md](docs/kb/tech/02-backend.md), [backend/src/lib/quota.ts](backend/src/lib/quota.ts) und [docs/kb/domain/08-quota-system.md](docs/kb/domain/08-quota-system.md).
- AI-Aufrufe sind backend-only und maschinenlesbare Antworten verwenden Structured Outputs mit `strict: true` und `additionalProperties: false`. Siehe [docs/kb/tech/06-ai-integrations.md](docs/kb/tech/06-ai-integrations.md) und [backend/src/lib/openai.ts](backend/src/lib/openai.ts).
- Mobile ist eine React-Native-Expo-Anwendung mit lokalen Screen-States, Axios-API-Clients, App-eigenem `InfoOverlay` und tokenbasierter Gestaltung. Siehe [docs/kb/tech/03-mobile.md](docs/kb/tech/03-mobile.md), [docs/kb/product/03-design-system.md](docs/kb/product/03-design-system.md) und [docs/kb/product/05-ux-patterns.md](docs/kb/product/05-ux-patterns.md).
- Azure OpenAI und Authentifizierung sind zwischen Dev und Alpha geteilt; ein neuer Azure-Dienst wird nicht benötigt. Siehe [docs/kb/tech/01-system-overview.md](docs/kb/tech/01-system-overview.md).

### Quota-Darstellung und bestehender Dokumentationskonflikt

- Repository und Shared-Typen modellieren `AiFeature` und `TierLimits` pro Feature für `free`, `premium` und `internal`. Die allgemeine Premium-Zuweisung ist laut KB noch geplant; für `recipe-scale` ist sie durch die aktuelle Produktentscheidung ausdrücklich auf `30/month` festgelegt.
- Ein neuer `recipe-scale`-Wert würde einen zusätzlichen Featurewert in bestehenden `aiUsage`-Dokumenten und zusammengesetzten IDs verwenden; dafür ist kein neuer Container und keine Migration erforderlich.
- Die KB-Tabelle nennt für bestehende Features teilweise andere Werte als [backend/src/lib/quotaConfig.ts](backend/src/lib/quotaConfig.ts) und [backend/src/lib/quotaConfig.test.ts](backend/src/lib/quotaConfig.test.ts), zum Beispiel bei `recipe-analyze`. Dieser bestehende Konflikt wird nicht stillschweigend für `recipe-scale` wiederverwendet und muss bei der Dokumentationspflege sichtbar bleiben.
- Für US-05 gilt ausdrücklich `free: 30/month` und `premium: 30/month`; `internal` bleibt unbegrenzt und Admins werden wie bisher vor der Tierprüfung nicht blockiert.

## 10. Assumptions and Open Questions

- **[Assumption]** Der Preview-Request enthält `recipeId` und `targetPortions`. Das Backend lädt das Rezept über `userId` und `recipeId`; `originalPortions`, Originaltexte und Originalzutaten werden nicht vom Client vertraut.
- **[Assumption]** Der normale Recipe Wizard stellt vor oder mit dem Feature sicher, dass gespeicherte Rezeptportionen ganze Werte `1–50` sind. Der Scale-Code enthält keine Legacy-Verzweigung für andere Werte.
- **[Assumption]** Eine optionale Rezeptbeschreibung wird im Preview-Vertrag als `string | null` übertragen; die Schrittanzahl und Reihenfolge werden beibehalten.
- **[Assumption]** Ein erfolgreicher AI-Aufruf verbraucht einen `recipe-scale`-Quota-Aufruf, auch wenn der Client danach abbricht; Debounce und Reset reduzieren unnötige Aufrufe, können einen bereits gestarteten Serveraufruf aber nicht rückwirkend ungeschehen machen.
- **Produktentscheidungen:** Für diesen Plan bestehen keine weiteren offenen Produktentscheidungen. Die Behandlung historischer Portionswerte außerhalb `1–50` ist ausdrücklich nicht Bestandteil des Scale-Features.

## 11. Existing Components to Reuse

- `shared/types/recipes.ts` für `Recipe`, `RecipeIngredient`, `RecipeStep` und bestehende Metadaten.
- `shared/lib/recipeCalculator.ts` als Muster für pure, testbare Rezeptlogik.
- `backend/src/lib/http.ts`, `backend/src/lib/auth.ts`, `backend/src/lib/quota.ts`, `backend/src/lib/openai.ts` und `backend/src/lib/repositories/recipesRepository.ts`.
- [backend/src/functions/ai.ts](backend/src/functions/ai.ts), [backend/src/functions/recipes.ts](backend/src/functions/recipes.ts) und [backend/src/index.ts](backend/src/index.ts) als Handler-, Rezeptzugriffs- und Registrierungsreferenzen.
- [backend/src/lib/prompts/recipeAnalyze.ts](backend/src/lib/prompts/recipeAnalyze.ts) sowie dessen Eval-Dateien als Muster für versionierte deutsche Prompt-Module.
- [mobile/src/modules/recipes/RecipeDetailScreen.tsx](mobile/src/modules/recipes/RecipeDetailScreen.tsx), [mobile/src/modules/recipes/RecipeIngredientGroup.tsx](mobile/src/modules/recipes/RecipeIngredientGroup.tsx), [mobile/src/modules/recipes/recipePreviewViewModel.ts](mobile/src/modules/recipes/recipePreviewViewModel.ts) und deren bestehende Darstellung.
- [mobile/src/shared/api/aiApi.ts](mobile/src/shared/api/aiApi.ts), [mobile/src/shared/api/client.ts](mobile/src/shared/api/client.ts), [mobile/src/shared/components/InfoOverlay.tsx](mobile/src/shared/components/InfoOverlay.tsx) und [mobile/src/app/theme/index.ts](mobile/src/app/theme/index.ts).

## 12. Proposed Technical Solution

### 12.1 Shared contract and pure projection

Neue Shared-Typen und Konstanten sollen den Zielbereich sowie den Preview-Vertrag für Backend und Mobile gemeinsam definieren. Vorgesehen sind `RECIPE_PORTION_MIN = 1`, `RECIPE_PORTION_MAX = 50`, `RecipeScalePreviewRequest` und `RecipeScalePreviewResponse` in einem neuen Recipe-Scale-Typmodul sowie Exporte über [shared/index.ts](shared/index.ts).

Die pure Funktion `scaleRecipeIngredients(ingredients, originalPortions, targetPortions)` erzeugt neue Objekte und mutiert kein Original. Sie verwendet:

$$
f = \frac{\text{targetPortions}}{\text{originalPortions}}
$$

und für jeden sicher numerischen Mengenwert:

$$
\text{targetAmount} = \text{originalAmount} \times f
$$

Die Funktion hat als Vertragsvoraussetzung ganze `originalPortions` und `targetPortions` im Bereich `1–50`. Werte außerhalb dieses Vertrags werden nicht geklemmt, migriert, mit einem Default ersetzt oder in einen zusätzlichen Scale-Zustand überführt. Die vorgelagerte Wizard-Validierung schließt sie aus.

### 12.2 Deterministische Mengenprojektion

| Feld | Zielverhalten |
|---|---|
| `inputAmount` | Mit `f` skalieren, wenn endlich und vorhanden; `null` bleibt `null`. |
| `amountGrams` | Mit `f` skalieren, wenn endlich und vorhanden; `null` bleibt `null`. |
| `amountLabel` | Nur bei eindeutigem positivem numerischem Präfix sicher skalieren; bei Unsicherheit das vollständige Originallabel zurückgeben. |
| `unit`, `inputMode`, `category` | Unverändert übernehmen. |
| `portionWeightGrams`, `portionLabel` | Als Quellenmetadaten unverändert übernehmen; sie sind kein Rezept-Zielmengenwert. |
| Produkt- und Bibliotheksreferenzen | Unverändert übernehmen. |
| `nutritionPer100g`, `nutritionContribution` | Unverändert als gespeicherte Metadaten übernehmen; keine Ziel-Nährwertberechnung ausführen. |

Für `amountLabel` gelten mindestens diese deterministischen Fälle:

| Original | Faktor | Ergebnis |
|---|---:|---|
| `1 TL` | `2` | `2 TL` |
| `1,5 EL` | `2` | `3 EL` |
| `2 TL optional` | `0,5` | `1 TL optional` |
| `nach Geschmack` | `2` | `nach Geschmack` |
| `1–2 TL` | `2` | `1–2 TL` |

Der Parser darf nur sicher erkennbare positive Dezimalzahlen mit Punkt oder Komma am Anfang akzeptieren. Einheit, Suffix und ihre Reihenfolge bleiben erhalten. Bereiche, Brüche, Texte ohne eindeutigen Zahlenpräfix sowie nicht endliche oder negative Werte fallen ohne Teiländerung auf das Original zurück. Die formatierte Zahl darf keine Floating-Point-Artefakte oder unnötigen Nachkommastellen enthalten.

### 12.3 Backend Preview API

Neuer Endpunkt:

`POST /api/ai/recipe-scale/preview`

**Auth:** erforderlich über `requireUser()`  
**Quota:** eigener `recipe-scale`-Key; `free: 30/month`, `premium: 30/month`, `internal: Infinity`; `isAdmin = true` bypassed die Quota weiterhin vor der Tierprüfung.  
**Request:**

```json
{
  "recipeId": "uuid",
  "targetPortions": 2
}
```

`targetPortions` ist eine ganze Zahl `1–50`. `originalPortions` wird aus dem gespeicherten Rezept geladen. Der Handler prüft Besitz über `userId`, berechnet die Zielzutaten serverseitig mit der Shared-Funktion und übergibt der AI die Originalbeschreibung, Originalschritte, Originalzutaten, serverseitig berechnete Zielmengen sowie Original- und Zielportionen.

**Response 200:**

```json
{
  "targetPortions": 2,
  "description": "...",
  "steps": [
    {
      "order": 1,
      "title": "...",
      "description": "..."
    }
  ]
}
```

`description` ist `string | null`; `steps` behalten Anzahl und Reihenfolge des Originalrezepts. Die Response enthält keine von der AI berechneten Zutatenmengen. Mobile projiziert die Zutaten lokal mit derselben Shared-Funktion.

**Fehlervertrag:**

- `400`: fehlende oder ungültige Requeststruktur, nicht ganze `targetPortions` oder Zielwert außerhalb `1–50`.
- `401`: fehlende oder ungültige Authentifizierung.
- `404`: Rezept ist für den authentifizierten Nutzer nicht vorhanden.
- `422`: AI-Output ist strukturell parsebar, verletzt aber den vereinbarten Schritt- oder Textvertrag.
- `429`: `QuotaExceededResponse` mit `feature: "recipe-scale"`, `used`, `limit`, `period` und `resetsAt`.
- `502`: AI nicht erreichbar, leerer Output oder nicht parsebarer Provider-Output.
- `500`: unerwarteter Backendfehler über `withHandler()`.

`enforceQuota(user, 'recipe-scale')` erfolgt vor dem OpenAI-Aufruf. `trackUsage(user, 'recipe-scale')` erfolgt erst nach erfolgreichem OpenAI-Aufruf und vollständiger Responsevalidierung. Fehlgeschlagene oder strukturell unbrauchbare AI-Aufrufe verbrauchen kein Quota.

### 12.4 AI-, Prompt- und Response-Strategie

- Neuer versionierter Prompt, zunächst `RECIPE_SCALE_PROMPT_VERSION = 'v1'`.
- Deutsche Ausgabe; `temperature: 0`.
- Strict Structured Output mit `additionalProperties: false` auf jeder Objekt-Ebene.
- AI-Ausgabeschema enthält ausschließlich optionale Beschreibung beziehungsweise `null` und geordnete Schritte mit `order`, `title` und `description`.
- Die AI darf keine Zutatenmengen berechnen, keine Zutaten hinzufügen oder entfernen und keine Schritte hinzufügen oder entfernen.
- Mengenänderungen werden nur anhand der vom Backend gelieferten Zielmengen interpretiert.
- Temperatur-, Zeit- und Verfahrensangaben werden nur geändert, wenn die geänderten Mengen dies fachlich eindeutig erfordern; andernfalls wird der Originaltext beibehalten.
- `nach Geschmack`, unsichere Angaben und nicht betroffene Textpassagen bleiben unverändert.
- Eine Response gilt nur bei gleicher Schrittanzahl und gleicher Reihenfolge als gültig.
- Die neue Prompt-Datei benötigt passende `recipeScale.eval.test.ts`- und `recipeScale.eval.fixtures.ts`-Dateien. Erwartungen müssen aus User Story, Acceptance Criteria und Knowledge Base abgeleitet werden, nicht zirkulär aus dem Prompt.

### 12.5 Mobile Request- und Zustandsstrategie

- `targetPortions` wird als lokaler Screen-State geführt; das geladene `recipe` bleibt unverändert.
- Der Stepper verwendet die Grenzen `1` und `50`; `−` und `+` sind getrennte Aktionen vom Info-Auslöser.
- Nach einer Änderung startet ein Debounce von etwa `350–500 ms` (Richtwert `400 ms`). Änderungen innerhalb des Zeitfensters werden zu einer Anfrage für den zuletzt gewählten Wert zusammengefasst.
- Eine neue Anfrage beendet den lokalen Debounce und versucht, die vorherige HTTP-Anfrage über `AbortController` abzubrechen.
- Zusätzlich erhält jede Anfrage eine monotone Revision. Übernommen wird eine Antwort nur, wenn Revision, Rezept-ID, geladene Rezeptinstanz beziehungsweise `updatedAt`-Snapshot und `targetPortions` noch übereinstimmen.
- Reset auf `recipe.portions`, Rezept-Reload und Unmount erhöhen die Revision, löschen ausstehende Timer und verwerfen alte Antworten.
- Zutaten werden sofort aus dem Original projiziert; Textzustände werden getrennt und atomar verwaltet.

## 13. Backend Work Package

### 13.1 Shared-Contract- und Projektionsteil

**Agent:** Backend  
**Status:** Ready

**Goal**

Gemeinsame DTOs, Bereichskonstanten und die pure deterministische Zutatenprojektion für Backend und Mobile bereitstellen.

**Required Knowledge Base:**

- [docs/kb/tech/04-shared-library.md](docs/kb/tech/04-shared-library.md)
- [docs/kb/domain/06-recipes.md](docs/kb/domain/06-recipes.md)
- [docs/kb/tech/08-testing.md](docs/kb/tech/08-testing.md)

**Required Repository Context:**

- [shared/types/recipes.ts](shared/types/recipes.ts)
- [shared/lib/recipeCalculator.ts](shared/lib/recipeCalculator.ts)
- [shared/index.ts](shared/index.ts)
- [shared/lib/recipeCalculator.test.ts](shared/lib/recipeCalculator.test.ts)
- [mobile/src/modules/recipes/recipePreviewViewModel.ts](mobile/src/modules/recipes/recipePreviewViewModel.ts)

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-9
- AC-10

**Dependencies:**

- Keine vorgelagerte Implementierungsabhängigkeit.
- Die verbindliche Vertragsgrenze sind ganze Portionswerte `1–50`; die Wizard-Durchsetzung und der Backend-Vertrag müssen vor dem Feature-Release übereinstimmen.
- Keine Behandlung historischer Werte außerhalb dieses Vertrags einplanen.

**Expected Handoff:**

- Pure, nicht mutierende `scaleRecipeIngredients()`-Funktion mit sicherem Label-Fallback.
- Gemeinsame `1–50`-Konstanten und Preview-DTOs.
- Unit-Tests für Faktor, strukturierte Felder, Metadaten, Dezimalformate, `1 TL`, `nach Geschmack` und unsichere Labels.
- Export- und Import-Vertrag für Backend und Mobile.

### 13.2 API-, AI- und Quota-Integration

**Agent:** Backend  
**Status:** Ready after the Shared-Contract handoff and Wizard validation handoff

**Goal**

Authentifizierten Preview-Endpunkt, serverseitige Rezeptprojektion, Prompt, Structured Output, Responsevalidierung, `recipe-scale`-Quota und Registrierung implementieren.

**Required Knowledge Base:**

- [docs/kb/tech/02-backend.md](docs/kb/tech/02-backend.md)
- [docs/kb/tech/04-shared-library.md](docs/kb/tech/04-shared-library.md)
- [docs/kb/tech/05-authentication.md](docs/kb/tech/05-authentication.md)
- [docs/kb/tech/06-ai-integrations.md](docs/kb/tech/06-ai-integrations.md)
- [docs/kb/tech/09-api-reference.md](docs/kb/tech/09-api-reference.md)
- [docs/kb/domain/06-recipes.md](docs/kb/domain/06-recipes.md)
- [docs/kb/domain/07-ai-features.md](docs/kb/domain/07-ai-features.md)
- [docs/kb/domain/08-quota-system.md](docs/kb/domain/08-quota-system.md)

**Required Repository Context:**

- [backend/src/functions/ai.ts](backend/src/functions/ai.ts)
- [backend/src/functions/recipes.ts](backend/src/functions/recipes.ts)
- [backend/src/functions/ai.test.ts](backend/src/functions/ai.test.ts)
- [backend/src/functions/recipes.test.ts](backend/src/functions/recipes.test.ts)
- [backend/src/lib/openai.ts](backend/src/lib/openai.ts)
- [backend/src/lib/prompts/recipeAnalyze.ts](backend/src/lib/prompts/recipeAnalyze.ts)
- [backend/src/lib/quota.ts](backend/src/lib/quota.ts)
- [backend/src/lib/quotaConfig.ts](backend/src/lib/quotaConfig.ts)
- [backend/src/lib/quotaConfig.test.ts](backend/src/lib/quotaConfig.test.ts)
- [backend/src/lib/repositories/aiUsageRepository.ts](backend/src/lib/repositories/aiUsageRepository.ts)
- [backend/src/lib/repositories/recipesRepository.ts](backend/src/lib/repositories/recipesRepository.ts)
- [backend/src/index.ts](backend/src/index.ts)

**Required Skills:**

- azure-openai-feature-integration

**Relevant Acceptance Criteria:**

- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11
- AC-12
- AC-13
- AC-15
- AC-16
- AC-17
- AC-18
- AC-19

**Dependencies:**

- Handoff aus 13.1.
- Die Quota-Entscheidung ist festgelegt: `free: 30/month`, `premium: 30/month`, `internal: Infinity`; `isAdmin` bleibt ein unabhängiger unbegrenzter Bypass.
- Die Wizard-Validierung aus 14.1 bestätigt die Vertragsvoraussetzung für gespeicherte Portionswerte.
- Der Endpoint darf keine clientseitig gesendeten Originalmengen als Berechnungsgrundlage verwenden.

**Expected Handoff:**

- Authentifizierter `POST /api/ai/recipe-scale/preview`-Handler mit Besitzprüfung und Fehlervertrag.
- Versionierter deutscher Prompt, Strict Structured Output, serverseitige Responsevalidierung und Eval-Fixtures.
- `recipe-scale` als eigener `AiFeature`-Wert; Free- und Premium-Limit jeweils `30/month`, Internal unbegrenzt und Admin-Bypass unverändert.
- Quota-Tests für Reihenfolge, Erfolgs-Tracking, 429 und fehlende Quota-Belastung bei AI-Fehlern.
- Bestätigung, dass weder Rezept- noch Nährwert- noch Tagebuchdaten geschrieben werden.
- `build:verify`- und Backend-Test-Ergebnisse.
- Aktualisierte Backend-/AI-/Quota-/API-/Shared-Dokumentation gemäß Abschnitt 18.

## 14. Frontend Work Package

### 14.1 Vorgelagerte Recipe-Wizard-Validierung

**Agent:** Frontend  
**Status:** Ready after the Shared-Contract handoff

**Goal**

Den normalen Recipe Wizard so validieren, dass neue oder bearbeitete `portions` ausschließlich ganze Werte `1–50` annehmen und andere Werte vor dem Speichern ausgeschlossen werden.

**Required Knowledge Base:**

- [docs/kb/tech/03-mobile.md](docs/kb/tech/03-mobile.md)
- [docs/kb/tech/04-shared-library.md](docs/kb/tech/04-shared-library.md)
- [docs/kb/domain/06-recipes.md](docs/kb/domain/06-recipes.md)
- [docs/kb/product/03-design-system.md](docs/kb/product/03-design-system.md)

**Required Repository Context:**

- [mobile/src/modules/recipes/RecipeWizardScreen.tsx](mobile/src/modules/recipes/RecipeWizardScreen.tsx)
- [mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx](mobile/src/modules/recipes/RecipeWizardPreviewPhase.tsx)
- [mobile/src/modules/recipes/recipeWizardTypes.ts](mobile/src/modules/recipes/recipeWizardTypes.ts)
- [mobile/src/modules/recipes/recipeWizardEditBootstrap.ts](mobile/src/modules/recipes/recipeWizardEditBootstrap.ts)

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-2
- AC-3
- AC-10

**Dependencies:**

- Handoff aus 13.1 mit den gemeinsamen Grenzen `1–50`.
- Die fachliche Entscheidung `1–50`, Schrittweite `1` ist abgeschlossen.
- Diese Validierung ist die Vertragsvoraussetzung des Scale-Features und keine nachträgliche Scale-Kompatibilitätsbehandlung.

**Expected Handoff:**

- Wizard-Validierung für AI-Vorschlag, Eingabe, Edit-Bootstrap und Save-Grenze.
- Tests für `1`, `50`, Nicht-Ganzzahlen und Werte außerhalb des Bereichs.
- Dokumentierter Handoff, dass der Scale-Pfad keine Bestandsdaten außerhalb `1–50` behandelt.
- Aktualisierung des Frontend-verantworteten Wizard-Teils der Rezeptdokumentation gemäß Abschnitt 18.

### 14.2 Rezeptdetailansicht und Preview-State

**Agent:** Frontend  
**Status:** Ready after Shared-, Backend- and Wizard-handoffs

**Goal**

Den temporären Zielwert, die sofortige Zutatenprojektion, Tooltip, Debounce-/Abort-/Revision-Sicherung und atomaren Textzustände in `RecipeDetailScreen` integrieren.

**Required Knowledge Base:**

- [docs/kb/tech/03-mobile.md](docs/kb/tech/03-mobile.md)
- [docs/kb/tech/04-shared-library.md](docs/kb/tech/04-shared-library.md)
- [docs/kb/tech/05-authentication.md](docs/kb/tech/05-authentication.md)
- [docs/kb/tech/09-api-reference.md](docs/kb/tech/09-api-reference.md)
- [docs/kb/domain/06-recipes.md](docs/kb/domain/06-recipes.md)
- [docs/kb/product/03-design-system.md](docs/kb/product/03-design-system.md)
- [docs/kb/product/05-ux-patterns.md](docs/kb/product/05-ux-patterns.md)

**Required Repository Context:**

- [mobile/src/modules/recipes/RecipeDetailScreen.tsx](mobile/src/modules/recipes/RecipeDetailScreen.tsx)
- [mobile/src/modules/recipes/RecipeIngredientGroup.tsx](mobile/src/modules/recipes/RecipeIngredientGroup.tsx)
- [mobile/src/modules/recipes/recipePreviewViewModel.ts](mobile/src/modules/recipes/recipePreviewViewModel.ts)
- [mobile/src/modules/recipes/recipePreviewViewModel.test.ts](mobile/src/modules/recipes/recipePreviewViewModel.test.ts)
- [mobile/src/shared/api/aiApi.ts](mobile/src/shared/api/aiApi.ts)
- [mobile/src/shared/api/client.ts](mobile/src/shared/api/client.ts)
- [mobile/src/shared/components/InfoOverlay.tsx](mobile/src/shared/components/InfoOverlay.tsx)
- [mobile/src/app/theme/index.ts](mobile/src/app/theme/index.ts)
- [mobile/src/modules/recipes/LogRecipeModal.tsx](mobile/src/modules/recipes/LogRecipeModal.tsx)

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-1 bis AC-16

**Dependencies:**

- Handoff aus 13.1 mit Shared-Funktion, Konstanten und DTOs.
- Handoff aus 13.2 mit endgültigem API-Vertrag und Fehler-/Quota-Verhalten.
- 14.1 ist vor oder mit der Scale-Integration abgeschlossen.

**Expected Handoff:**

- Typisierte `aiApi`-Methode und Rezeptdetail-UI mit `−`/`+`, InfoOverlay und deutschen Zuständen.
- Sofortige, nicht mutierende Zutatenprojektion einschließlich `1 TL` und `nach Geschmack`.
- Debounce, AbortController, monotone Revision sowie Reset-/Reload-/Unmount-Invalidierung.
- Alte Beschreibung und Schritte während Debounce/Loading ausgeblendet; Zutaten bleiben sichtbar.
- Atomare Textübernahme, Original-Fallback bei AI-Fehlern und unveränderte Nährwert-/Logikpfade.
- Mobile Unit- und Typecheck-Ergebnisse.
- Aktualisierte Mobile-/UX-Dokumentation gemäß Abschnitt 18.

## 15. QA Work Package

**Agent:** QA  
**Status:** Ready after all implementation and documentation handoffs

**Goal**

Die vollständige Implementierung gegen alle Acceptance Criteria, den API-/Datenvertrag, die AI-Integrationsregeln, die Persistenzgrenzen, die Mobile-Zustände und die Endpoint-/Health-Verifikation in der bestehenden Development-Umgebung prüfen.

**Required Knowledge Base:**

- [docs/kb/tech/08-testing.md](docs/kb/tech/08-testing.md)
- [docs/kb/tech/09-api-reference.md](docs/kb/tech/09-api-reference.md)
- [docs/kb/tech/04-shared-library.md](docs/kb/tech/04-shared-library.md)
- [docs/kb/domain/06-recipes.md](docs/kb/domain/06-recipes.md)
- [docs/kb/domain/07-ai-features.md](docs/kb/domain/07-ai-features.md)
- [docs/kb/domain/08-quota-system.md](docs/kb/domain/08-quota-system.md)
- [docs/kb/product/03-design-system.md](docs/kb/product/03-design-system.md)
- [docs/kb/product/05-ux-patterns.md](docs/kb/product/05-ux-patterns.md)

**Required Repository Context:**

- Shared-Skalierungsfunktion und zugehörige Tests.
- Backend-Handler, OpenAI-/Prompt-Modul, Eval-Fixtures und Handler-Tests.
- [backend/src/lib/quotaConfig.ts](backend/src/lib/quotaConfig.ts), [backend/src/lib/quota.ts](backend/src/lib/quota.ts) und Quota-Tests.
- [mobile/src/modules/recipes/RecipeDetailScreen.tsx](mobile/src/modules/recipes/RecipeDetailScreen.tsx)
- [mobile/src/modules/recipes/recipePreviewViewModel.test.ts](mobile/src/modules/recipes/recipePreviewViewModel.test.ts)
- [mobile/src/shared/api/aiApi.ts](mobile/src/shared/api/aiApi.ts)
- Aktualisierte API- und Knowledge-Base-Dokumentation.

**Required Skills:**

- azure-openai-feature-integration

**Relevant Acceptance Criteria:**

- AC-1 bis AC-19

**Dependencies:**

- Handoffs aus 13.1, 13.2, 14.1 und 14.2.
- Dokumentationshandoffs aus 13.2, 14.1 und 14.2 liegen vor; QA verifiziert ihre Konsistenz mit der Implementierung.
- Keine offene Produktentscheidung; die Quota-Werte und der bestehende Admin-/Internal-Bypass sind im Plan festgelegt.

**Expected Handoff:**

- Ausgeführte Backend-, Shared- und Mobile-Testbefehle mit Ergebnissen.
- Prompt-Eval-Ergebnis und Prüfung der Azure-OpenAI-Invarianten.
- Acceptance-Criteria-Matrix einschließlich negativer und veralteter-Response-Fälle.
- Quota-, Auth-, Persistenz- und Nicht-Persistenzprüfung.
- Geprüfte Konsistenz der aktualisierten API- und Knowledge-Base-Dokumentation mit der Implementierung.
- Endpoint-/Health-Smoke-Test in der bestehenden Development-Umgebung und dokumentierte Abweichungen.
- Urteil `PASS`, `PASS WITH ISSUES` oder `FAIL`.
- Keine Änderungen am Produktionscode durch QA.

## 16. Shared Package Changes

- Neues Shared-Modul für `recipe-scale`-DTOs und die Grenzen `1–50`.
- Neue pure Skalierungsfunktion und Unit-Test-Datei.
- Export über [shared/index.ts](shared/index.ts), damit Mobile die Typen verwenden kann; Backend nutzt für Value-Imports die bestehende relative Importregel.
- Keine Änderung an `Recipe`, `RecipeIngredient` oder gespeicherten Nährwerttypen erforderlich.
- Keine Persistenz des temporären Zielwerts und keine Änderung an der Rezeptberechnung.

## 17. Infrastructure and Configuration

### Persistence Impact

**Persistence Impact:** Kein neues Feld in `Recipe`, kein neuer Entity-Typ und kein neuer Cosmos-Container. `aiUsage` bleibt der bestehende Container mit Partition Key `/userId`; `recipe-scale` ist lediglich ein neuer zulässiger Featurewert in den bestehenden Nutzungszählern und deren IDs. Das ist eine kompatible Erweiterung ohne Migration. Bestehende `aiUsage`-Dokumente bleiben lesbar. Dev und Alpha benötigen keine Datenmigration.

### Azure and environments

- Keine Bicep-Änderung in [infra/modules/cosmos.bicep](infra/modules/cosmos.bicep) oder anderen Modulen.
- Keine Änderung an [backend/src/lib/cosmos.ts](backend/src/lib/cosmos.ts); der bestehende `aiUsage`-Container wird weiterverwendet.
- Kein neuer Azure-OpenAI-Service; der bestehende gemeinsame Service wird verwendet.
- Der neue Backend-Endpunkt allein begründet keinen Infrastructure Impact. Da keine Bicep-, Azure-Konfigurations-, Ressourcen-, Container-, Partition-Key-, Deployment- oder EAS-Änderung erforderlich ist, bleibt `Infrastructure Impact: None`; Endpoint- und Health-Verifikation erfolgen über Backend-/QA-Tests in der bestehenden Development-Umgebung.
- Alpha-Deployment und Alpha-Datenprüfung sind nicht Teil dieser Story.
- Keine EAS- oder Native-Mobile-Änderung; `Mobile Build Impact: None`.
- Es werden keine Secrets, API-Keys oder Quota-Werte außerhalb der vorgesehenen Konfiguration dokumentiert.

## 18. Documentation Updates

Der Planner identifiziert die erforderlichen Dokumentationsänderungen; nach der Implementierung aktualisieren die zuständigen Implementierungsagenten die ihnen zugeordneten Einträge. QA verifiziert vor dem Abschluss die Konsistenz von Implementierung und Dokumentation:

- **Backend:** [docs/kb/domain/06-recipes.md](docs/kb/domain/06-recipes.md): deterministische Mengenprojektion, Labelregel, keine Persistenz und keine Tagebuchkopplung.
- **Frontend:** [docs/kb/domain/06-recipes.md](docs/kb/domain/06-recipes.md): temporärer Zielwert und Wizard-Voraussetzung `1–50`.
- **Backend:** [docs/kb/domain/07-ai-features.md](docs/kb/domain/07-ai-features.md): flüchtiger `recipe-scale`-Textpreview, neuer Endpunkt, Promptversion, Fehler- und Warnverhalten sowie die begründete Ausnahme ohne manuelle Review-Schleife.
- **Backend:** [docs/kb/domain/08-quota-system.md](docs/kb/domain/08-quota-system.md): `recipe-scale`, Free- und Premium-Limit jeweils `30/month`, Internal-/Admin-Bypass und die bestehende `recipe-analyze`-Abweichung zwischen KB und Repository. Letztere nicht stillschweigend ändern.
- **Frontend:** [docs/kb/tech/03-mobile.md](docs/kb/tech/03-mobile.md): temporärer State, Debounce, Abbruch, Revision und Loading-Verhalten.
- **Backend:** [docs/kb/tech/04-shared-library.md](docs/kb/tech/04-shared-library.md): pure Skalierungsfunktion und sicherer Labelparser.
- **Backend:** [docs/kb/tech/09-api-reference.md](docs/kb/tech/09-api-reference.md): Request, Response, Auth, Quota, Fehlerstatus und fehlende Persistenz.
- **Frontend:** [docs/kb/product/05-ux-patterns.md](docs/kb/product/05-ux-patterns.md): deutscher AI-Hinweis, ausgeblendete alte Texte, InfoOverlay und Fallback.

## 19. Test Strategy

### Shared

- Faktorberechnung für Zielwerte innerhalb `1–50`.
- Skalierung von `inputAmount` und `amountGrams` einschließlich `null` und fraktionaler Werte.
- Erhalt von Einheit, `inputMode`, Kategorie, Produkt- und Bibliotheksreferenzen sowie Quellen-Portionsmetadaten.
- Keine Mutation des Originalarrays oder seiner Ingredient-Objekte.
- Sichere Labelfälle: `1 TL` → `2 TL`, Dezimalpunkt und Dezimalkomma, Suffix-Erhalt, `nach Geschmack` unverändert.
- Unsichere Bereiche, Brüche, negative oder nicht endliche Präfixe bleiben vollständig unverändert.
- Grenzwerte des gültigen Zielbereichs `1` und `50`.
- Kein Scale-Kompatibilitätstest für gespeicherte Originalportionen außerhalb `1–50`; solche Werte sind ausdrücklich außerhalb des Scale-Vertrags und werden durch die Wizard-Voraussetzung ausgeschlossen.

### Recipe Wizard prerequisite

- `1` und `50` werden akzeptiert.
- `0`, Werte größer als `50`, negative Werte, nicht ganzzahlige Werte und nicht parsebare Eingaben werden vor dem Speichern ausgeschlossen.
- AI-Vorschläge werden ebenfalls gegen den Bereich geprüft.
- Die Validierung verändert keine historischen Bestandsdaten durch eine Scale-spezifische Korrektur.

### Backend

- Authentifizierung, Benutzerbesitz und `404` für nicht vorhandene Rezepte.
- Requestvalidierung für `recipeId` und ganze `targetPortions` von `1–50`.
- Server berechnet Zielmengen aus dem gespeicherten Rezept und ignoriert manipulierte Client-Mengen.
- `enforceQuota()` vor dem AI-Aufruf und `trackUsage()` nur nach vollständig gültiger AI-Antwort.
- `recipe-scale` wird als eigener Feature-Key verwendet; Free- und Premium-Limit sind jeweils exakt `30`, Internal bleibt unbegrenzt und Admins werden nicht blockiert.
- Quota-Blockierung mit `429`, korrektem Feature und `resetsAt`.
- Providerfehler, leerer Output, JSON-/Structured-Output-Fehler und ungültige Schrittanzahl beziehungsweise Reihenfolge.
- Strict Structured Output, `additionalProperties: false`, deutsche Promptversion und neue Prompt-Evals.
- Keine Schreiboperation auf Rezept, Rezepttext, Nährwerte oder Tagebuch; erwartete `aiUsage`-Nutzung wird separat geprüft.
- Route-Registrierung über [backend/src/index.ts](backend/src/index.ts) und `registrations.test.ts`.
- `npm run build:verify` nach Shared-Value-Importänderungen.

### Mobile

- Initialisierung von `targetPortions` auf `recipe.portions`.
- Stepper-Schrittweite `1`, Grenzen `1` und `50`, getrennte Tooltip-Aktion.
- Sofortige Zutatenprojektion ohne Mutation; sichtbare Einheiten und Labelbeispiele.
- Unveränderte Nährwertkacheln und unabhängiges `LogRecipeModal`.
- Debounce fasst schnelle Änderungen zusammen; kein AI-Aufruf pro Klick.
- Abbruch älterer HTTP-Anfragen und Ignorieren verspäteter Antworten über Revision, Rezeptinstanz und Zielwert.
- Alte Beschreibung und alte Schritte sind während Debounce und Loading ausgeblendet.
- Zutaten bleiben während Debounce, Loading und Textfehler sichtbar und nutzbar.
- Exakter deutscher Loading-Hinweis.
- Atomare Übernahme von Beschreibung und Schritten aus einer gültigen Antwort.
- Reset auf Original ohne AI-Aufruf, Rezept-Reload und Unmount invalidieren ausstehende Arbeit.
- AI-Fehler setzen die projizierten Zutaten nicht zurück; Originaltexte erscheinen als Fallback.
- Nach einem AI-Fehler wird kein automatischer Retry gestartet.
- Tooltip öffnet nur über den Info-Auslöser, niemals über `−`/`+`.
- Keine hardcodierten Theme-Werte, keine neue Native-Abhängigkeit und sinnvolle bestehende Reanimated-/Fade-Konvention.

### Commands for implementation and QA

```text
cd shared && npx vitest run
cd backend && npx vitest run
cd backend && npm run build:verify
cd backend && npm run test:eval
cd mobile && npx vitest run
cd mobile && npx tsc --noEmit
```

Contract-Tests bleiben auf den Cosmos-Emulator beschränkt. Ein QA-Smoke-Test in der bestehenden Development-Umgebung prüft die Route und die bestehende Health-Route.

## 20. Acceptance Criteria

1. Die Rezeptdetailansicht zeigt `Portionen` und `Nachkochen für` getrennt mit `−`, Wert und `+`.
2. `Nachkochen für` startet mit der gespeicherten Rezept-Portionszahl, verwendet ganze Werte, Schrittweite `1` und akzeptiert nur `1–50`; der normale Recipe Wizard validiert künftig diese gespeicherte Voraussetzung und schließt andere Werte vor dem Speichern aus. Das Scale-Feature behandelt historische Werte außerhalb `1–50` nicht und korrigiert oder migriert sie nicht.
3. Gespeicherte `portions` und `nutritionPerPortion` bleiben unverändert.
4. Strukturierte `inputAmount`- und `amountGrams`-Werte werden unmittelbar und deterministisch mit `targetPortions / originalPortions` skaliert.
5. Einheiten, `inputMode`, Kategorie, Quellen-Portionsmetadaten, Produktreferenzen und Bibliotheksreferenzen bleiben erhalten.
6. Ein sicher parsebares Label `1 TL` wird bei Verdopplung zu `2 TL`; Einheit und Suffix bleiben erhalten.
7. `nach Geschmack`, Bereiche und unsichere Labels bleiben unverändert.
8. Während Debounce und AI-Aufruf bleiben die skalierten Zutaten sichtbar und nutzbar.
9. Alte Beschreibung und alte Zubereitungsschritte werden während Debounce und Loading nicht angezeigt.
10. Während Debounce und Loading wird exakt der Hinweis „Die KI passt die Texte an die neuen Rezeptmengen an. Die KI kann Fehler machen.“ angezeigt.
11. Eine gültige AI-Antwort ersetzt Beschreibung und Schritte atomar und behält Anzahl und Reihenfolge der Schritte bei.
12. Nicht fachlich erforderliche Temperatur-, Zeit- und sonstige Angaben bleiben unverändert.
13. Schnelle Stepper-Änderungen lösen nach dem Debounce höchstens eine Textanfrage für den zuletzt gewählten Zielwert aus; verspätete Antworten werden nicht übernommen.
14. Beim Zurücksetzen auf die Original-Portionszahl werden Originalzutaten und Originaltexte ohne AI-Aufruf angezeigt.
15. AI-Fehler setzen die skalierten Zutaten nicht zurück; die Originaltexte werden als Fallback angezeigt.
16. Über `Nachkochen für` ist der Tooltip mit dem festgelegten deutschen Text dauerhaft erreichbar; `−` und `+` öffnen ihn nicht.
17. Der Backend-Endpunkt ist authentifiziert, besitzgeprüft, quota-geschützt, verwendet `recipe-scale` und Strict Structured Output und berechnet Zutaten serverseitig.
18. Das Free- und Premium-Quota-Limit für `recipe-scale` ist jeweils mit `30/month` dokumentiert; `internal` bleibt unbegrenzt und der bestehende Admin-Bypass gilt weiterhin. Kein Quota-Wert wird aus `recipe-analyze` übernommen.
19. Es wird nichts im Rezept oder Tagebuch persistiert; ein Development-Smoke-Test bestätigt die Erreichbarkeit der Route.

## 21. Risks and Edge Cases

- **Quota-Tier-Konsistenz:** `free` und `premium` verwenden für `recipe-scale` jeweils `30/month`; `internal` bleibt unbegrenzt und `isAdmin = true` wird vor der Tierprüfung nicht blockiert. Die bestehende Abweichung zwischen den dokumentierten und implementierten Werten anderer Features bleibt ein separater Dokumentationspunkt.
- **Bestehender KB-/Repository-Quota-Konflikt:** Die unterschiedlichen bestehenden `recipe-analyze`-Werte dürfen nicht als stiller Präzedenzfall für `recipe-scale` verwendet werden.
- **Ungültige historische Portionswerte:** Sie werden absichtlich nicht behandelt. Wenn der Wizard-Vertrag umgangen oder ein externes Alt-Dokument geladen wird, liegt das außerhalb des unterstützten Scale-Verhaltens. Eine mögliche spätere Alt-Datenbehandlung wäre eine separate Aufgabe und blockiert diesen Plan nicht.
- **AI-Fachfehler:** Die AI kann trotz Prompt und Warnung unnötige oder falsche Änderungen an Kochtexten liefern. Die Vorschau bleibt nicht persistent, zeigt die Warnung und fällt bei technischen Fehlern auf Originaltexte zurück.
- **Keine manuelle Review:** PO-5 akzeptiert die direkte flüchtige Anzeige. Das reduziert Interaktion, erhöht aber das Risiko, dass Nutzer eine fehlerhafte Textanpassung übersehen; die Warnung ist deshalb verpflichtender Bestandteil.
- **Veraltete Responses:** Ein Client-Abbruch beendet den Provideraufruf nicht garantiert. Debounce, AbortController und Revision Guard verhindern jedoch die Übernahme veralteter Ergebnisse; ein bereits erfolgreicher Serveraufruf kann Quota verbrauchen.
- **Client-/Server-Drift:** Beide Seiten verwenden dieselbe Shared-Funktion; der Server berechnet zusätzlich selbst für den AI-Kontext und vertraut nicht auf Clientmengen.
- **Label-Parsing:** Unklare Schreibweisen, Bereiche und Brüche werden vollständig unverändert angezeigt. Dadurch kann ein Nutzerlabel absichtlich nicht proportional aussehen, aber es wird keine unsichere Zahl erfunden.
- **Rezept-Reload und Unmount:** Laufende Timer und Requests müssen invalidiert werden, damit kein Ergebnis in eine andere Rezeptinstanz gelangt.
- **Tagebuchkopplung:** Die bestehende Log-Funktion arbeitet weiterhin mit gespeicherten Originaldaten; eine versehentliche Übergabe des temporären Zielwerts wäre eine Regression.
- **Shared Azure OpenAI:** Dev und Alpha verwenden denselben AI-Service; es ist keine separate Ressource und keine Infrastrukturänderung erforderlich.

## 22. Recommended Execution Order

1. Backend erstellt Shared-DTOs, die Grenzen `1–50` und die pure Zutatenprojektion inklusive Tests. Die Scale-Funktion erhält keine Legacy-Behandlung außerhalb dieses Vertrags.
2. Frontend setzt die Wizard-Voraussetzung für ganze `portions`-Werte `1–50` um und testet, dass andere Werte vor dem Speichern ausgeschlossen werden.
3. Backend implementiert nach dem Shared- und Wizard-Handoff den Preview-Endpunkt, die serverseitige Berechnung, `recipe-scale`-Quota mit `free: 30/month` und `premium: 30/month`, Prompt, Structured Output, Responsevalidierung, Registrierung und Handler-Tests. `internal` und Admins behalten den bestehenden unbegrenzten Bypass.
4. Backend führt Shared-/Backend-Tests, Prompt-Evals und `npm run build:verify` aus, aktualisiert die Backend-verantworteten Dokumentationseinträge aus Abschnitt 18 und übergibt den kompakten Vertrag.
5. Frontend integriert API-Client, temporären State, Stepper, sofortige Zutatenprojektion, Tooltip, Loading-Hinweis, atomare Textzustände sowie Debounce-/Abort-/Revision-Schutz.
6. Frontend führt Mobile-Tests und Typecheck aus, aktualisiert die Frontend-verantworteten Dokumentationseinträge aus Abschnitt 18 und bestätigt die Unverändertheit von Nährwertkacheln und Tagebuchdialog.
7. QA führt die vollständige Acceptance-Criteria-, AI-, Quota-, Persistenz-, UI- und Regression-Prüfung einschließlich der Konsistenzprüfung von Implementierung und Dokumentation sowie des Endpoint-/Health-Smoke-Tests in der bestehenden Development-Umgebung aus und meldet `PASS`, `PASS WITH ISSUES` oder `FAIL`.
8. Eine mögliche spätere Alt-Datenbehandlung oder Alpha-Auslieferung erhält einen separaten Produkt- beziehungsweise Release-Auftrag; beides ist keine offene Entscheidung dieses Plans.