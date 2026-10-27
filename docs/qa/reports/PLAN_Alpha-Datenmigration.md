# QA Report: Nutzerdaten-Migration alte Alpha in neue Alpha

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Alpha-Datenmigration.md`
- Verdict: `PASS`

## Scope

Geprüft: `scripts/migrate-alpha-data.mjs`, `scripts/migrate-alpha-data.test.mjs`, `package.json` (`test:scripts`), `docs/kb/tech/07-infrastructure.md`, `docs/kb/tech/01-system-overview.md`, unabhängige Read-only-Zählung von Quelle und Ziel (Cosmos, Blob), Unverändertheit von `docs/legal/`, `backend/src`, `shared`, `mobile/src`.
Nicht geprüft: Benutzer-Smoke mit `preview-flex` (siehe Verification Notes). Datenschutz ist kein QA-Kriterium dieses Reviews (Review beim Benutzer laut Plan, Abschnitt 4).

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Skript liest nur `SRC_*`/`TGT_*` aus der Umgebung (`readSides`); keine Connection-Strings, Keys oder Dev-Endpoints im Quelltext (grep nach `AccountKey=`, `sig=`, `hlpqe7`: keine Treffer). Quellclients nur Query/`exists`/List/`downloadToBuffer`; Schreibaufrufe (`upsert`, `uploadData`, `delete`) nur auf Zielobjekten. Ausgaben nur Zählwerte; Fehler über `safeError` (nur Code), Kopierfehler ohne IDs/Inhalte. |
| AC-2 | PASS | `assertSafeEnds` ist exakte Allowlist (Quelle `cosmos-fittrack-alpha-ppf5sc`/`stfittrackalphappf5sc`, Ziel `cosmos-fittrack-alpha-wcobsd`/`stfittrackalphawcobsd`). Tests: Dev als Quelle, Quelle = Ziel, altes PRODYNA-Konto als Ziel, Dev/Nicht-Alpha-Ziel, falsche Quelle, ungültiger Endpoint abgelehnt; richtiges Paar akzeptiert. |
| AC-3 | PASS | `npm run test:scripts` 23/23 grün, `npm run check:encoding` grün. Tests decken Zielschutz, `shouldCopy`, `stripSystemFields`, `classifyImageValue`, Blob-Skip, `verifyBlobs`, Drift-Test gegen `backend/src/lib/cosmos.ts`. Die 6 Tests von `migrate-food-products` laufen grün mit. |
| AC-4 | PASS | Handoff (Zugriff ohne Werte, Ziel vor Kopie alle 11 Container leer); unabhängig: CLI-Zugriff auf Quelle und Ziel funktionierte (siehe AC-7). Ziel nicht leer trat nicht auf, daher keine PO-1-Entscheidung nötig. Die Vorher-Zählung selbst ist nicht rekonstruierbar, nur durch Handoff belegt. |
| AC-5 | PASS | Handoff-Inventur (aiInsights 5/11/2, 1 absolute `userFoodRelations.imageUrl` mit Quellhost). Nachprüfung Quelle: `aiInsights` insightFeedback 5, weeklyInsight 10, dailyInsight 2 (eine TTL-abgelaufene weeklyInsight-Zeile seit der Inventur entfallen, wie gemeldet). Bildfeld-Regel E-6 (unverändert kopieren, Einschränkung dokumentiert) angewandt. |
| AC-6 | PASS | Ziel `foodProducts` = 209696. `aiInsights` im Ziel: 5, ausschließlich `insightFeedback`. `product-images` Quelle nicht vorhanden; Ziel 0 Blobs (unberührt). Ziel `label-scans` 0 Blobs. Skript enthält weder `foodProducts` noch Host-/Deployment-Container noch Queue (`USER_CONTAINERS`, `BLOB_COPY_CONTAINERS`). |
| AC-7 | PASS | Eigene Vollvergleichsprüfung (read-only, Cosmos-Query): Ziel = Quelle minus Filter in allen 11 Containern (profiles 3, weights 97, nutritionDiaryMeals 449, reusableMealItems 1, recipes 14, aiUsage 36, userFoodRelations 316, aiInsights 5; users/nutritionProfiles/communityRecipes 0); fehlend 0 und Feldabweichung 0 für jedes Quelldokument nach `stripSystemFields`; gleiche `id` und gleicher Partition-Key-Wert (`userId` bzw. `id`) in Quelle und Ziel. Übertrifft die geforderten 20 Stichproben. |
| AC-8 | PASS | Quelle und Ziel `recipe-images`: 13 Blobs, 9.492.935 B, Content-Type durchgängig `image/jpeg`; `product-images` in der Quelle nicht vorhanden, im Skript als „Quelle nicht vorhanden“ ohne Fehler behandelt (Test). |
| AC-9 | PASS | Nur Lese-Operationen auf der Quelle im Skript (siehe AC-1); Quellzahlen unverändert zum Handoff (einzige Abweichung: TTL-Ablauf eines Cache-Dokuments in `aiInsights`, plattformbedingt). `git grep` nach Key-/SAS-Mustern im Skript und Test ohne Treffer. Eigene Prüfung mit Read-only-Schlüsseln als Prozess-Variablen, danach entfernt. |
| AC-10 | UNVERIFIED | KB-Teil erfüllt: `docs/kb/tech/07-infrastructure.md` Abschnitt „Alpha user-data migration“ nennt Datum, Skript, Umfang, Einschränkung; kein `[Planned]`/„starts without user data“ zur Migration mehr (git grep), `01-system-overview.md` konsistent. Benutzer-Smoke mit `preview-flex` steht aus, nicht durch QA ersetzbar; laut Plan zulässig als „ausdrücklich offen“. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm run test:scripts` | 0 | 23/23 pass (17 neu + 6 bestehend) |
| `npm run check:encoding` | 0 | Encoding check passed |
| Read-only Ziel-/Quell-Vergleich (Cosmos-Query + Blob-Liste, temporäres Node-Skript, entfernt) | 0 | alle 11 Container identisch (fehlend 0, Feldabweichung 0); `foodProducts` 209696; `recipe-images` 13 Blobs / 9.492.935 B beidseitig |

Backend-/Shared-/Mobile-Tests nicht ausgeführt: `git diff HEAD --stat -- backend/src shared mobile/src` leer (nur Skripte betroffen).

## Prüfpunkte (a)–(g)

- (a) Zielschutz/Secret-Freiheit: erfüllt (AC-1, AC-2, AC-9). `clear` prüft nur das Ziel.
- (b) Filter `aiInsights` = Whitelist `insightFeedback`; kein `foodProducts`-Kopieren (Ziel unverändert 209696).
- (c) `clear`: nur `USER_CONTAINERS` im Ziel und `BLOB_CLEAR_CONTAINERS = ['recipe-images']`; erfordert `--yes`.
- (d) Unabhängige Zählung und ID/PartitionKey-Abgleich: bestätigt (AC-7, AC-8).
- (e) KB-Aussagen (Zahlen 3/97/449/1/14/36/316/5, 13 Blobs, 9.492.935 B) stimmen mit dem Ist-Zustand überein.
- (f) `docs/legal/` unberührt (`git diff HEAD --stat` leer, kein Eintrag in `git status`).
- (g) Einschränkung zur einen absoluten Bild-URL ist in `docs/kb/tech/07-infrastructure.md` dokumentiert und entspricht E-6. Dass der Wert eine abgelaufene SAS-URL ist, wurde nicht separat geprüft (Plan: SAS-TTL 1 h, App-Fallback auf Platzhalter).

## Verification Notes

- State: `UNVERIFIED` (AC-10, Benutzer-Evidence)
- Reason: Login braucht Benutzer-Token auf dem Gerät mit `preview-flex`.
- Manual action (Benutzer-Checkliste, Ergebnisfeld jeweils ausfüllen):
  1. `preview-flex`-Build installieren und mit dem bestehenden Alpha-Nutzer anmelden. Erwartet: Login erfolgreich, kein Onboarding-Neustart. Ergebnis: ____
  2. Profil und Gewichtsverlauf ansehen (3 Profile/97 Gewichte in Summe). Erwartet: bekannte Daten sichtbar. Ergebnis: ____
  3. Ernährungstagebuch eines Tages mit Einträgen öffnen. Erwartet: Mahlzeiten vorhanden. Ergebnis: ____
  4. Rezepte öffnen (14) und ein Rezept mit Bild ansehen. Erwartet: Bild lädt. Ergebnis: ____
  5. Wiederverwendbaren Eintrag (1) und Favoriten/Relationen ansehen. Erwartet: sichtbar; Eintrag mit altem Quell-Bild zeigt Platzhalter (bekannte Einschränkung). Ergebnis: ____
  6. Verbleibende Smoke-Punkte aus `docs/qa/reports/PLAN_Node24-Flex-Migration.md` durchgehen. Ergebnis: ____
  7. Optional: Insight-Feedback bleibt erhalten, Wochen-/Tages-Insights werden neu erzeugt (Caches bewusst nicht kopiert). Ergebnis: ____

## Findings

No actionable findings.

Beobachtung ohne Finding-Status: Das Arbeitsverzeichnis enthält weitere uncommittete Änderungen aus dem Flex-Plan (z. B. `scripts/migrate-food-products.mjs`, Bicep, KB). Sie gehören nicht zu diesem Plan und wurden hier nicht bewertet; die zugehörigen Tests laufen grün.
