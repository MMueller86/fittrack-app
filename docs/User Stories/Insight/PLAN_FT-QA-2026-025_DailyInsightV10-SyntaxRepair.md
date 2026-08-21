# Plan: FT-QA-2026-025 – Repair dailyInsightV10.ts Syntax Error

**Bezug:** QA Finding FT-QA-2026-025 (docs/qa/findings.md)  
**Eltern-Plan:** [PLAN_US_Home-Screen-Insights_Prompt-Provenance-Correction.md](PLAN_US_Home-Screen-Insights_Prompt-Provenance-Correction.md)  
**Status:** Ready for approval  
**Approval:** Pending

Infrastructure Impact: Dev  
Mobile Build Impact: None

---

## 1. Requirement Assessment

**Klassifikation:** Accept as proposed.

`build:verify` schlägt mit Exitcode 2 fehl, weil `backend/src/lib/prompts/dailyInsightV10.ts` ungültigen TypeScript-Code enthält. Die Datei besteht aus vier Zeilen rohem Prompt-Prosatext statt einer gültigen TypeScript-Deklaration.

**Ursache (aus Commit-History bestätigt):**

- Commit `28649c2` (insight refactoring): Datei existiert als vollständige TypeScript-Datei mit Imports, Typen und `buildDailyInsightPrompt()`.
- Commit `6a167b8` (correction daily insight): Datei wird aus dem Repository entfernt (war als Teil des Provenance-Correction-Plans zur Löschung vorgesehen).
- Commit `9f193b9` (small corrections, HEAD): Datei wird versehentlich neu angelegt — mit nur 4 Zeilen, die den Inhalt zweier Template-Literal-Fragmente aus der ursprünglichen Datei enthalten. Diese 4 Zeilen sind kein gültiger TypeScript-Code.

**Aktueller Inhalt (4 Zeilen):**
```
Die Aktivität und ihr serverseitig berechnetes effektives Tagesziel...
Wenn remainingProteinG höchstens 20 ist...`
Der verbindliche Intent ist nutrition_guidance...`
export {};
```
Die ersten drei Zeilen sind roher Prompt-Text ohne String-Delimiter; zwei Zeilen enden mit einem freistehenden Backtick — TypeScript-Syntaxfehler.

**Korrekte Maßnahme: Datei löschen.**

Die aktive Prompt-Kette ist `openai.ts → dailyInsightPrompt.ts (v14)`. Es gibt keine aktive Import-Referenz auf `dailyInsightV10.ts` im Quellcode (`backend/src/**/*.ts`). Der Provenance-Correction-Plan hatte die Löschung explizit vorgesehen. Die versehentliche Neu-Anlage in kaputtem Zustand muss rückgängig gemacht werden.

---

## 2. Confirmed Facts

- `grep_search` über `backend/src/**/*.ts` für `dailyInsightV10` und `from './dailyInsightV10'` liefert 0 Treffer.
- QA-Report `PLAN_US_Home-Screen-Insights_Prompt-Provenance-Correction.md` AC-1 PASS: „The active reference audit found no `dailyInsightV10.ts` import."
- `git show 9f193b9 -- backend/src/lib/prompts/dailyInsightV10.ts` zeigt `new file mode 100644` mit exakt 4 Zeilen. Die Datei wurde in diesem Commit erstmals (in ihrer aktuellen Form) angelegt.
- `build:verify` läuft TypeScript-Kompilierung vor den Verifikationschecks. Die 4-Zeilen-Datei bricht die Kompilierung ab, bevor Check 1 oder 2 ausgeführt werden.
- `_deploy_staging/dist` enthält eine ältere kompilierte Version (aus dem letzten korrekten Build). Relevanz: `build:verify` liest aus `backend/dist`, nicht aus `_deploy_staging/dist`.

---

## 3. Scope

- Löschen von `backend/src/lib/prompts/dailyInsightV10.ts`
- Laufenlassen von `cd backend; npm run build:verify` zum Beweis der Reparatur

---

## 4. Out of Scope

- Änderungen an `dailyInsightPrompt.ts` oder dem aktiven Prompt-Stack.
- Änderungen an `_deploy_staging` (kein Release in dieser Aufgabe).
- Aktualisierung der QA-Findings-Datei (wird vom QA-Agent nach Bestätigung aktualisiert).

---

## 5. Backend Work Package

**Agent:** Backend

**Goal:** `dailyInsightV10.ts` löschen, Build-Reparatur verifizieren.

**Required Knowledge Base:**
- None

**Required Repository Context:**
- backend/src/lib/prompts/dailyInsightV10.ts
- backend/src/lib/prompts/dailyInsightPrompt.ts (Bestätigung des aktiven Pfades)

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-1, AC-2, AC-3

**Dependencies:**
- None

**Expected Handoff:**
- `dailyInsightV10.ts` ist nicht mehr vorhanden
- `cd backend; npm run build:verify` Exitcode 0

**Deliverables:**
1. `backend/src/lib/prompts/dailyInsightV10.ts` löschen.
2. Sicherstellen, dass kein aktiver Import dieser Datei existiert (Bestätigung durch `grep -r "dailyInsightV10" backend/src`).
3. `cd backend; npm run build:verify` ausführen und Exitcode 0 bestätigen.

---

## 6. QA Work Package

**Agent:** QA

**Goal:** Verifizieren, dass kein aktiver Code gebrochen wurde und `build:verify` durchläuft.

**Required Knowledge Base:**
- None

**Required Repository Context:**
- backend/src/lib/prompts/ (Verzeichnisinhalt nach Löschung)
- backend/src/lib/openai.ts (aktive Imports)

**Required Skills:**
- None

**Relevant Acceptance Criteria:**
- AC-1, AC-2, AC-3, AC-4

**Dependencies:**
- Backend Work Package abgeschlossen

**Test commands:**

| Kommando | Erwarteter Exitcode |
|---|---|
| `cd backend; npm run build:verify` | 0 |
| `cd backend; npx vitest run` | 0 |

---

## 7. Acceptance Criteria

- **AC-1:** `backend/src/lib/prompts/dailyInsightV10.ts` existiert nicht mehr im Dateisystem.
- **AC-2:** `grep -r "dailyInsightV10" backend/src` findet keine Treffer in TypeScript-Quelldateien.
- **AC-3:** `cd backend; npm run build:verify` exitiert mit Code 0.
- **AC-4:** `cd backend; npx vitest run` exitiert mit Code 0.

---

## 8. Recommended Execution Order

1. **Backend WP:** Datei löschen, Build verifizieren
2. **QA WP:** Vollverifikation
3. **QA:** QA-Finding FT-QA-2026-025 auf `Closed` setzen mit Verweis auf diesen Plan
