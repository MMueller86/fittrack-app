# Plan: Nutzerdaten-Migration alte Alpha (PRODYNA) in neue Alpha (Fittrack)

**Planrevision:** `2026-10-26-DATA-01` (neuer Plan; ersetzt Abschnitt 12 von `PLAN_Node24-Flex-Migration.md`, Rev 07, ohne diesen zu ändern).
**Status:** Freigegeben (Benutzer, 2026-10-26). Dieser Plan implementiert, testet und führt nichts aus.
**Stand:** 2026-10-26
**Plan-Typ:** Einmalige Datenkopie (kleines Skript, keine Anwendungsänderung)

Infrastructure Impact: Alpha (nur Datenkopie in bestehende Ressourcen; kein Bicep-Diff, kein Functions-Deploy)
Mobile Build Impact: None
Privacy Impact: Review durch den Benutzer (Abschnitt 4), kein technisches Gate
Persistence Impact: Class 0, Schema unverändert; einmalige Upsert-Kopie von 11 Nutzer-Containern und 1 Blob-Container (`recipe-images`)

---

## 1. Ziel und Leitgedanke

Der heutige Datenbestand der alten Alpha wird **einmalig und unverändert** in die neue Alpha kopiert. Es sind keine Nutzer aktiv; es gibt kein Delta, kein Einfrieren und keine Behandlung gleichzeitiger Schreibzugriffe. Die alte Alpha wird nur gelesen und bleibt unverändert. Nutzer-IDs bleiben (CIAM unverändert). Kein Umstellen der Tester (Entscheidung des Benutzers).

| | Quelle (read-only) | Ziel |
|---|---|---|
| Subscription | PRODYNA „Microsoft Azure Sponsorship 26/27-1", RG `rg-Michael-Mueller` | `Fittrack` `dd7539ab-c638-44f8-9173-8bcd28cdbae3`, RG `rg-fittrack-alpha` |
| Cosmos | `cosmos-fittrack-alpha-ppf5sc`, DB `fittrack-db` | `cosmos-fittrack-alpha-wcobsd`, DB `fittrack-db` |
| Storage | `stfittrackalphappf5sc` | `stfittrackalphawcobsd` |

---

## 2. Festlegungen und Entscheidungen

| ID | Entscheidung | Beleg / Begründung |
|---|---|---|
| E-1 | **Skript-Variante: Schwesterskript** `scripts/migrate-alpha-data.mjs` | `migrate-food-products.mjs` ist fest auf Quelle Dev (`ALLOWED_SOURCE_ACCOUNT = cosmos-fittrack-dev-hlpqe7`), ein Container und reines Cosmos zugeschnitten (Z. 14–19, 36–41). Eine Verallgemeinerung würde dessen 6 Tests und den bereits genutzten Seed-Pfad ändern. Das Schwesterskript dupliziert nur `withRetry` und das Parsen des Kontonamens (~15 Zeilen) |
| E-2 | **Container (11):** `users`, `nutritionProfiles`, `profiles`, `weights`, `nutritionDiaryMeals`, `reusableMealItems`, `recipes`, `communityRecipes`, `aiUsage`, `aiInsights`, `userFoodRelations`. **Nicht:** `foodProducts` (Katalog stammt aus Dev, bereits geseedet) | `backend/src/lib/cosmos.ts` Z. 17–32: 12 Container. Partition Keys: `/id` für `users`, `communityRecipes` (und `foodProducts`), alle anderen `/userId`. `aiInsights` hat `defaultTtl: -1` |
| E-3 | **Filter:** `aiInsights` nur `_docType === 'insightFeedback'` (Whitelist). `dailyInsight`, `weeklyInsight`, `profileDeletionLock` entfallen; ebenso Altdokumente **ohne** `_docType` (Legacy-`dailyInsight`, siehe `insightRepository.ts` Z. 445, 523: fehlender `_docType` = `dailyInsight`). Alle anderen Container: alle Dokumente (inkl. `dayMeta`/`hintState`-Dokumente, die Nutzerdaten sind) | `insightRepository.ts` Z. 67, 87; `dailyInsight.ts` Z. 217; `weeklyInsight.ts` Z. 68; `profileDeletionRepository.ts` Z. 22. `insightFeedback` trägt kein `ttl` (nur Caches, `insightRepository.ts` Z. 99, 393) |
| E-4 | **Blobs:** `recipe-images` (inkl. `community/`) vollständig. `product-images` wird nur kopiert, falls in der Quelle vorhanden; ein in der Quelle **fehlender** Container (gemessen: fehlt) ist **kein Fehler**, wird übersprungen und im Bericht als „Quelle nicht vorhanden“ gemeldet; der Ziel-Container bleibt unberührt. **Nicht:** `label-scans`, `azure-webjobs-*`, `function-releases`, `scm-releases`, `app-package-*`. Queue `reusable-items-enrich` nicht übernommen | `storage.ts` Z. 12–13: nur diese zwei Container werden vom Backend genutzt; im Backend-Code gibt es keinen Zugriff auf `label-scans` (Treffer nur Handler-/Parser-Namen) |
| E-5 | **Blob-Kopie per Download/Upload** (SDK, `@azure/storage-blob`), Content-Type, Cache-Control, Content-Encoding/-Disposition/-Language und Metadaten werden übernommen, Upload überschreibt (idempotent) | Server-seitige Kopie bräuchte Quell-SAS pro Blob (mehr Code). Bilder sind ≤ 8 MB (`RECIPE_IMAGE_MAX_BYTES`), Puffer je Blob genügt. Bestehende Muster: `copyRecipeImageToCommunity` (`storage.ts` Z. 185–202) |
| E-4a | **Dokumentschreiben:** reiner Upsert, Systemfelder (alle Felder mit `_`-Präfix **außer** `_docType`) werden entfernt, `ttl` bleibt unverändert | Muster aus `migrate-food-products.mjs` Z. 119 (dort nur feste Liste). `_docType` ist Anwendungsfeld |
| E-6 | **Bildfelder, Regel (bedingt, vor der Kopie festgelegt):** Relative Blobnamen (`recipes.images[].blobName`, `communityRecipes`, `reusableMealItems.imageUrl`) bleiben gültig, weil die Blobs mitkopiert werden. Für **absolute** `imageUrl`-Werte (`userFoodRelations.imageUrl`, `nutritionDiaryMeals` `items[].imageUrl`): **Treffer = 0** mit Quell-Storage-Host: nichts zu tun. **Treffer > 0:** Felder **unverändert kopieren**, bekannte Einschränkung im Bericht dokumentieren; **kein** Entfernen, **kein** Umschreiben. Externe URLs bleiben in beiden Fällen | Belege unten |
| E-7 | **Ziel-Zählung** der 11 Container vor der Kopie als einfacher Check. Standardfall (gemessen, Preflight 2026-10-26): alles leer, da der Smoke-Test keine Daten hinterlassen hat. Alle leer: Upsert. Wider Erwarten nicht leer: **STOP** und Entscheidung des Benutzers (PO-1) | Einfachster sicherer Weg ohne Merge-Logik |
| E-9 | **Referenzwerte (Preflight, Größenordnung, keine harten Gates; Gate bleibt Ziel = Quelle minus Filter):** Cosmos Quelle: `foodProducts` 209696 (nicht kopiert), `nutritionDiaryMeals` 448, `userFoodRelations` 316, `weights` 97, `aiUsage` 36, `aiInsights` 18 (vor Filter), `recipes` 14, `profiles` 3, `reusableMealItems` 1, `communityRecipes` 0, `users` 0, `nutritionProfiles` 0. Storage Quelle: `recipe-images` 13 Blobs / 9.492.935 Bytes, `product-images` nicht vorhanden. Ziel: 11 Nutzer-Container leer, `foodProducts` 209696, `recipe-images` und `product-images` leer | Read-only gemessen. **Zugriff:** CLI-Schlüssel des PRODYNA-Kontos (Token begrenzt gültig); der Infra-Agent holt Schlüssel zur Laufzeit per `az ... keys list` in Prozess-Variablen und baut daraus die Connection-Strings für `SRC_*`/`TGT_*` (nie in Dateien/Logs) |
| E-8 | **Modi im Skript:** `inventory` (nur lesen: Filterzahlen, Bild-Inventur, Blobzählung, Ziel-Zählung), `copy`, `verify`, `clear` (nur Ziel, nur die 11 Container und 2 Blob-Container, nur mit `--yes`; Blob-Container: nur `recipe-images`) | Ein Werkzeug für Preflight, Kopie, Nachweis und die erlaubte Betriebsregel (Abschnitt 8) |

**Belege zu E-6:**
- Blob-Container sind privat (`storage.bicep` Z. 45 `allowBlobPublicAccess: false`, Container `publicAccess: 'None'`).
- Das Backend speichert `imageUrl` unverändert (`diary.ts` Z. 167, 629; `favorites.ts` Z. 23, 119; `userFoodRelationRepository.ts`) und löst beim Lesen **keine** SAS auf. Eine SAS-Auflösung gibt es nur für `reusableMealItems` (`reusableItems.ts` Z. 384–386) und Rezeptbilder.
- Die Mobile-App lädt absolute URLs direkt (`<Image source={{ uri }}>`, `QuantityView.tsx` Z. 412, `FavoriteChip.tsx` Z. 107) und zeigt nur Werte, die `isRemoteImageUri` bestehen (`RelationRow.utils.ts` Z. 27, `foodProductSummaryUtils.ts` Z. 13); Ladefehler fallen auf einen Platzhalter zurück (`FavoriteChip.tsx` `imgError`, `FoodProductSummary.tsx` Z. 42).
- Backend-SAS hat 1 h TTL (`storage.ts` `SAS_TTL_MS`): ein dort gespeicherter Quell-URL war in der alten Umgebung bereits nach 1 h nicht mehr ladbar. Unverändert kopieren verschlechtert nichts; Umschreiben wäre ohne Nutzen. Neuere Backend-Pfade verwerfen `imageUrl` für Rezept-Relationen ohnehin (`cosmosUserFoodRelationRepository.ts` Z. 165; Tests `communityRecipes.test.ts`).

---

## 3. Product Owner Decisions

**PO-1 (nur falls die Ziel-Zählung wider Erwarten nicht leer ist; der Smoke-Test hat keine Daten hinterlassen, daher praktisch entfällig):** Der Benutzer wählt entweder (a) **Upsert drüber** (empfohlen: keine Löschung; IDs kollidieren nur bei gleicher ID; Testdaten bleiben zusätzlich) oder (b) **Testdaten vorher entfernen** (Testnutzer per App-Profillöschung oder Skriptmodus `clear`). Keine Merge-Logik in beiden Fällen. Nur der Pfad „nicht leeres Ziel" in WP-2 wartet darauf; alles andere läuft ohne.

---

## 4. Privacy Impact

Skill `privacy-impact-review` (Kurzprüfung): Es werden keine neuen Datenkategorien erhoben; dieselben Daten wandern von der PRODYNA-Subscription in die private Fittrack-Subscription (Region `germanywestcentral`).

```
Privacy Impact: Review beim Benutzer, kein technisches Gate
Data flow: Nutzerdaten (Profil, Gewicht, Tagebuch, Rezepte, Bilder, Feedback) werden 1:1 von PRODYNA-Ressourcen in private Ressourcen kopiert; Caches entfallen
Policy sections affected: Verantwortlicher/Hosting (PRODYNA statt privat)
Open questions: Verantwortlichkeit und Rechtsgrundlage der Weitergabe an die private Umgebung
```

Der Privacy-Review der Datenkopie (privat statt PRODYNA) liegt beim Benutzer. `docs/legal/` wird nicht geändert.

---

## 5. Work Packages

Strikt sequenziell, genau ein Agent je WP. Ergebnis `PASS`, `STOP` oder `UNVERIFIED`. Secrets nur als Prozess-Umgebungsvariablen, nie in Dateien, Logs, Argumenten oder Chat. Jeder `az`-Befehl mit `--subscription` der jeweils richtigen Subscription.

### WP-1 Backend: Schwesterskript und Tests

Agent: Backend
Goal: `scripts/migrate-alpha-data.mjs` gemäß E-1 bis E-8 liefern; keine Änderung an `backend/src`, `shared`, `mobile`.
Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/07-infrastructure.md
Required Repository Context:
- scripts/migrate-food-products.mjs
- scripts/migrate-food-products.test.mjs
- backend/src/lib/cosmos.ts
- backend/src/lib/storage.ts
- package.json (`test:scripts`)
Required Skills: cosmos-data-model-and-migration (Section 4/7 zur Einordnung: Class 0, keine Schemaänderung)
Relevant Acceptance Criteria: AC-1, AC-2, AC-3
Dependencies: Keine
Inhalt:
- **Eingaben nur per Umgebungsvariablen:** `SRC_COSMOS_CONN`, `SRC_STORAGE_CONN`, `TGT_COSMOS_CONN`, `TGT_STORAGE_CONN` (Connection-Strings; Endpoint/Key werden aus dem String geparst, nichts davon wird ausgegeben).
- **Zielschutz (`assertSafeEnds`, rein, exportiert):** Quelle muss exakt `cosmos-fittrack-alpha-ppf5sc` / `stfittrackalphappf5sc` sein, Ziel exakt `cosmos-fittrack-alpha-wcobsd` / `stfittrackalphawcobsd`; Allowlist statt Präfix, damit Dev nie Quelle oder Ziel sein kann. `inventory`/`verify` brauchen nur die benötigten Seiten, `clear` nur das Ziel.
- **Exportierte reine Funktionen:** `USER_CONTAINERS` (Liste mit Partition Key), `shouldCopy(container, doc)` (E-3), `stripSystemFields(doc)` (E-4a), `classifyImageValue(value, sourceStorageHost)` (`relativ` / `absolut-Quellhost` / `extern` / `sonstig`).
- **`inventory`:** je Container Gesamtzahl, kopierte Zahl, gefilterte Zahl je `_docType` (inkl. „ohne"); Bild-Inventur nur als Zahlen (Klassen je Container und Feld `imageUrl`, `items[].imageUrl`, `images[].blobName`; zusätzlich Anzahl beliebiger String-Werte, die den Quell-Storage-Host enthalten); Blobanzahl und Bytes je Blob-Container (Quelle und Ziel; fehlender Quell-Container wird gemeldet, nicht als Fehler gewertet); Dokumentzahl je Ziel-Container.
- **`copy`:** je Container Query `SELECT * FROM c`, filtern, `stripSystemFields`, `items.upsert`; Blobs aus `recipe-images` listen, herunterladen, mit Headern und Metadaten hochladen; fehlender Quell-Container (`product-images`) wird übersprungen und als „Quelle nicht vorhanden“ gemeldet (kein Fehler, kein Abbruch, Ziel unberührt). 429-Retry wie `withRetry`. Quelle wird nie geschrieben (Quellclient nur Query/List/Download). Fehlgeschlagene Dokumente/Blobs werden gezählt (Exit-Code 1), nie mit IDs, Inhalten oder Secrets geloggt.
- **`verify`:** je Container Quellzahl nach Filter = Zielzahl (bei „Upsert drüber" zusätzlich: fehlende = 0, Mehrzahl = Zahl der vorherigen Ziel-Dokumente); 20 Zufalls-Stichproben je Container feldgleich nach `stripSystemFields`; Blobanzahl und Bytes für `recipe-images` (fehlender Quell-Container `product-images`: übersprungen, „Quelle nicht vorhanden“); Bericht nur Zählwerte.
- **`clear`:** nur Ziel, nur die 11 Container und `recipe-images` (nie `foodProducts`, nie `product-images`), nur mit `--yes`.
- **Tests (`node:test`, neue Datei `scripts/migrate-alpha-data.test.mjs`, `npm run test:scripts` erweitert):** Zielschutz (Quelle = Dev abgelehnt, Quelle = Ziel abgelehnt, Ziel = altes PRODYNA-Konto abgelehnt, Ziel = Dev abgelehnt, richtiges Paar akzeptiert, ungültiger Endpoint, nur ein Konto falsch); `shouldCopy` (`aiInsights`: `insightFeedback` ja; `dailyInsight`, `weeklyInsight`, `profileDeletionLock`, ohne `_docType` nein; andere Container immer ja); `stripSystemFields` (entfernt `_rid`, `_self`, `_etag`, `_attachments`, `_ts`, `_lsn`; behält `_docType`, `ttl`); `classifyImageValue`; **fehlender Quell-Blob-Container wird übersprungen, nicht abgebrochen** (Container-Liste mit Stub, Bericht „Quelle nicht vorhanden“, Exit-Code 0); **Drift-Test:** `USER_CONTAINERS` samt Partition Keys entspricht den Containern aus `backend/src/lib/cosmos.ts` ohne `foodProducts` (Quelltext per Regex gelesen).
- Keine Secrets, keine Endpoints von Dev im Skript, kein Netzwerkzugriff in den Tests.
Expected Handoff: Skriptpfad und Aufrufe, Testausgabe (`npm run test:scripts`, `npm run check:encoding`), Abweichungen.

### WP-2 Infrastructure: Preflight, Kopie, Verifikation, KB

Agent: Infrastructure
Goal: Zugriff prüfen, Ist-Zahlen erheben, Bildfeld-Regel anwenden, Daten kopieren, verifizieren, KB aktualisieren.
Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md
Required Repository Context:
- scripts/migrate-alpha-data.mjs
- docs/kb/tech/07-infrastructure.md
Required Skills: None
Relevant Acceptance Criteria: AC-4 bis AC-10
Dependencies: WP-1 `PASS`
Inhalt (in dieser Reihenfolge):
1. **Preflight Zugriff.** Quelle: Connection-Strings per CLI mit PRODYNA-Konto (`az cosmosdb keys list` / `az storage account keys list`, jeweils `--subscription` PRODYNA) **oder** vom Benutzer bereitgestellte Env-Variablen `SRC_COSMOS_CONN`/`SRC_STORAGE_CONN`; Werte nur in die Prozess-Umgebung, nie anzeigen. Ziel: gleicher Weg mit Subscription `dd7539ab-c638-44f8-9173-8bcd28cdbae3`, RG `rg-fittrack-alpha`. Lesetest je Seite (Zählung). **Kein Zugriff auf die Quelle oder Firewall/Local-Auth blockiert = STOP**, Meldung an den Benutzer.
2. **Inventur.** `inventory`: Filterzahlen je `_docType`, Bildfeld-Inventur, Blobzahlen, Ziel-Zählung. Ergebnis als Zählwerte berichten.
3. **Ziel leer?** Erwartet ja (Standardfall, siehe E-7/E-9): weiter. Wider Erwarten nicht leer: **STOP**, PO-1 abwarten und gemäß Entscheidung fortfahren (a: weiter; b: Daten entfernen, `inventory` wiederholen).
4. **Bildfeld-Regel E-6 anwenden.** Treffer mit Quellhost > 0: unverändert kopieren, Zahl im Bericht als bekannte Einschränkung nennen. Treffer = 0: nichts. Keine weitere Entscheidung nötig.
5. **`copy`**, dann **`verify`**. Bei 429-Fehlern oder Teilausfall `copy` wiederholen (Upsert, idempotent). Nicht behebbar nach Wiederholung: STOP.
6. **KB-Update** in `docs/kb/tech/07-infrastructure.md` (Abschnitt „Alpha catalog seed", `[Planned]`-Zeilen ca. 87–88): Hinweis, dass die Nutzerdaten-Migration der alten Alpha durchgeführt wurde (Datum, Skript, Umfang in einem Satz), `[Planned]` entfernen; Zeile „Alpha starts without user data" entsprechend anpassen. Keine weiteren Dokumente.
7. **Benutzer-Smoke** anstoßen (nicht selbst ausführen): `preview-flex`, Login mit dem bestehenden Alpha-Nutzer, Daten sichtbar, Rezeptbild lädt.
Expected Handoff: Zugriffsweg (ohne Werte), Inventur-/Verifikationszählwerte je Container, Bildfeld-Zahlen, Blobanzahl/Bytes, PO-1-Ergebnis (falls aufgetreten), geänderte KB-Datei, Hinweis auf offenen Benutzer-Smoke.

### WP-3 QA

Agent: QA
Goal: Alle Acceptance Criteria gegen Evidence prüfen; Verdict `PASS`, `PASS WITH ISSUES` oder `FAIL`; fehlende Evidence ist nie PASS.
Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/07-infrastructure.md
Required Repository Context:
- Diff von `scripts/`, `package.json`, `docs/kb/tech/07-infrastructure.md`
Required Skills: cosmos-data-model-and-migration (Section 9, QA-Checkliste), privacy-impact-review
Relevant Acceptance Criteria: AC-1 bis AC-10
Dependencies: WP-2 `PASS`
Expected Handoff: QA-Bericht mit einem Verdict. Der Benutzer-Smoke (AC-10) wird als „Benutzer-Evidence" geführt und ist nicht durch die QA ersetzbar.

---

## 6. Execution Order

1. WP-1 Backend: Skript und Tests (Backend)
2. WP-2 Preflight, Kopie, Verifikation, KB (Infrastructure)
3. WP-3 QA (QA)

**Danach, durch den Benutzer (kein WP):** Smoke mit `preview-flex`; Entscheidung über die Umstellung der Tester; Privacy-Review der Datenkopie.

**Deploy:** keiner. `backend/src` bleibt unverändert; es gibt keinen Functions-Deploy und keinen EAS-Build.

---

## 7. STOP-Fälle

Kein Zugriff auf Quelle oder Ziel; Zielschutz schlägt an (Quelle/Ziel nicht das erlaubte Paar); Ziel wider Erwarten nicht leer bis PO-1 entschieden; Zähl-/Stichprobenabweichung nach einer Wiederholung; Secret in Ausgabe, Log, Datei oder Argument.

---

## 8. Betriebsregel (statt Rückfall)

Die alte Alpha bleibt unverändert und wird nur gelesen; ein Rückfall ist nicht nötig. Bei Fehlern dürfen die Nutzer-Container der neuen Alpha (nicht `foodProducts`) mit `clear` geleert und neu kopiert werden, **solange kein Nutzer die neue Alpha produktiv nutzt**. Danach nicht mehr; ein erneuter Lauf erfordert dann eigene Planung.

---

## 9. Abweichungen und Unsicherheiten

- **Plan Rev 07, Abschnitt 12 sah „Merge/Upsert" und „Bild-Inventur" vor:** hier übernommen und vereinfacht; `PLAN_Node24-Flex-Migration.md` bleibt unverändert (der Verweis in dessen Abschnitt 12 und in der KB bleibt gültig, bis WP-2 die KB aktualisiert).
- **Nicht geprüft (kein Azure-Zugriff durch den Planner):** Größe des Bestands, Durchsatz/RU des Ziel-Cosmos (bei 429 greift Retry), Firewall-/Local-Auth-Einstellungen der alten Konten, ob der Quell-Storage-Host tatsächlich in Dokumenten vorkommt (klärt die Inventur), ob Soft-Delete/Versioning im Ziel zusätzliche Blobkopien erzeugt (7 Tage Soft-Delete laut KB, betrifft nur Überschreiben/Löschen).
- **`label-scans`:** kein Backend-Zugriff gefunden; die Nicht-Kopie ist durch den Code gedeckt (Container existiert nur laut KB `07-infrastructure.md` Z. 31).
- **`ttl` in kopierten `insightFeedback`-Dokumenten:** laut Code nicht gesetzt; fände die Inventur welche, wären sie nach Kopie mit neuem `_ts` länger gültig. Wird nur berichtet, keine Sonderbehandlung.
- **Absolute `imageUrl` mit Quellhost:** Regel E-6 setzt voraus, dass alte SAS-Werte bereits abgelaufen sind (Backend-TTL 1 h); ob alte Builds längere SAS erzeugten, ist nicht geprüft und für die Regel irrelevant (unverändert kopieren schadet nicht).
- Die Skriptdatei existiert noch nicht; alle Aussagen dazu sind Planung.

---

## 10. Acceptance Criteria

1. **AC-1** `scripts/migrate-alpha-data.mjs` existiert, nutzt nur Umgebungsvariablen (`SRC_*`/`TGT_*`), enthält keine Secrets und keine Dev-Endpoints; Quelle wird nur gelesen (Query/List/Download).
2. **AC-2** Zielschutz erlaubt exakt das Paar Quelle `cosmos-fittrack-alpha-ppf5sc`/`stfittrackalphappf5sc` und Ziel `cosmos-fittrack-alpha-wcobsd`/`stfittrackalphawcobsd`; Dev, Quelle = Ziel und falsche Paare werden abgelehnt (Tests).
3. **AC-3** `npm run test:scripts` und `npm run check:encoding` sind grün; Tests decken Zielschutz, Filter (`aiInsights` nur `insightFeedback`), Systemfeld-Bereinigung, Bildklassifikation und den Drift-Test gegen `cosmos.ts` (11 Container, Partition Keys) ab; `migrate-food-products.mjs` und dessen Tests sind unverändert grün.
4. **AC-4** Preflight dokumentiert Zugriff auf Quelle und Ziel (ohne Secretwerte) und die Ziel-Zählung je Container vor der Kopie; bei wider Erwarten nicht leerem Ziel liegt eine PO-1-Entscheidung vor. Zahlen aus E-9 dienen als Referenz (Größenordnung), nicht als hartes Gate.
5. **AC-5** Inventur-Zahlen (Filterzahlen je `_docType`, Bildfeld-Klassen, Blobzahlen) liegen vor der Kopie vor; die Bildfeld-Regel E-6 wurde gemäß Ergebnis angewandt, die Anzahl absoluter Quellhost-Werte ist im Bericht genannt.
6. **AC-6** `foodProducts` im Ziel ist unverändert (209696 Dokumente); `label-scans`, Host-Container, Deployment-Container und Queue wurden nicht kopiert; `product-images` im Ziel ist unberührt (Quelle nicht vorhanden); `aiInsights` im Ziel enthält ausschließlich `insightFeedback`.
7. **AC-7** `verify` bestätigt je Container: Ziel = Quelle minus gefilterte Dokumente (bei „Upsert drüber": fehlende = 0, Mehrzahl = Zahl der vorherigen Ziel-Dokumente; Standardfall leeres Ziel: Ziel = Quelle minus Filter); 20 Stichproben je Container feldgleich (ohne Systemfelder).
8. **AC-8** Blobanzahl und Bytes von `recipe-images` (inkl. `community/`) stimmen zwischen Quelle und Ziel überein; fehlender Quell-Container `product-images` ist als „Quelle nicht vorhanden“ gemeldet (kein Fehler); Content-Type bei Stichproben erhalten.
9. **AC-9** Die alte Alpha wurde nicht verändert (nur Lese-Operationen); kein Secret in Datei, Log, Argument oder Chat; Berichte enthalten nur Zählwerte.
10. **AC-10** `docs/kb/tech/07-infrastructure.md` enthält keinen `[Planned]`-Hinweis zur Nutzerdaten-Migration mehr und nennt die durchgeführte Migration; Benutzer-Smoke mit `preview-flex` (Login mit bestehendem Alpha-Nutzer, Daten sichtbar, Rezeptbild lädt) ist als Benutzer-Evidence vermerkt oder ausdrücklich offen.
