# Implementierungsplan – Mehrfachauswahl im Ernährungstagebuch

Status: Approved; the user explicitly reapproved this plan on 2026-10-05.
Execution Status: Original implementation work packages F1, B1, B2, F2, F3 and B3 complete; blocking AC-10 and AC-8 QA corrections and follow-ups FT-QA-2026-058 through FT-QA-2026-061 verified and closed; final QA review `PASS` for AC-1 through AC-19; backend 1,248 tests and shared 450 tests passed, prior full mobile run 631 tests passed; current backend typecheck and build verification passed. Cosmos contract execution remains `UNVERIFIED` because the emulator was unreachable (17 tests skipped before assertions); Android/TalkBack remains `MANUAL VALIDATION REQUIRED` because `adb` is unavailable; no Azure deployment or Alpha release occurred.
Infrastructure Impact: Dev
Mobile Build Impact: None

## Bestätigte Produktentscheidungen

### PO-1: Zielmahlzeit beim Kopieren mehrerer Einträge — entschieden

**Bestätigt:** Alle ausgewählten Einträge werden in genau eine vom Nutzer explizit ausgewählte Zielmahlzeit kopiert. Die Zielauswahl verwendet den vorhandenen Copy-/„Mahlzeit anlegen“-Pfad. Der Nutzer kann eine vorhandene Mahlzeit oder eine dort neu anzulegende Mahlzeit wählen.

**Technische Konsequenz:** Der Bulk-Copy-Request adressiert entweder eine vorhandene Zielmahlzeit oder den Typ einer neu anzulegenden Zielmahlzeit. Bei einer Neuanlage erstellt das Backend die Zielmahlzeit gemeinsam mit den Kopien in derselben Cosmos-Transaktion; die Mobile-App darf die Zielmahlzeit nicht vorab mit einem separaten Create-Request persistieren.

### PO-2: Fehler- und Größenverhalten einer Mehrfachaktion — entschieden

**Bestätigt:** Jede Mehrfachaktion ist all-or-nothing. Konflikt, ungültige Referenz oder Überschreitung der Cosmos-Transaktionsgrenzen führen zu null Änderungen an den Tagebuch-Meals. Aktionen dürfen nicht in unabhängige Teilaktionen zerlegt werden.

**Fehlerverhalten:** Bei fehlgeschlagener atomarer Mutation bleibt der Auswahlmodus zur Korrektur oder Wiederholung aktiv. Die App zeigt eine konkrete, zum Fehler passende Meldung und lädt die aktuell angezeigte Tagebuchansicht neu. Beim Normalisieren des geladenen Zustands werden nicht mehr vorhandene Referenzen aus der Auswahl entfernt.

### PO-3: Food-Usage bei Löschen, Verschieben und Kopieren — entschieden

**Beschlossen:**

- **Delete:** Das bestehende Verhalten bleibt unverändert. Delete erzeugt keine neue Usage und bucht keine frühere Usage zurück. `UserFoodRelation`-Historie sowie `ReusableItem.usageCount` und `Recipe.usageCount` werden nicht korrigiert oder zurückgesetzt. Es gibt keine rückwirkende Bereinigung früherer Einträge oder Move-Nebenwirkungen.
- **Move:** Move erzeugt keine zusätzliche Usage und ändert keine bestehenden Usage-Relationen oder Quellzähler. `usageDates` wird weder ergänzt noch umgehängt: die Einträge enthalten keine `MealItem`-ID, mit der eine einzelne frühere Verwendung eindeutig identifiziert werden könnte. Bulk- und Einzel-Move mutieren die Diary-Meals direkt und verwenden nicht Add-then-delete. Bereits historisch gespeicherte Nebenwirkungen früherer Moves bleiben unberührt.
- **Copy:** Jedes kopierte, referenzierte Food erzeugt nach erfolgreichem Diary-Commit eine neue Usage nach der bestehenden Add-Konvention am `targetMeal.date` und `targetMeal.type`. Mehrere Kopien derselben Quelle erzeugen je Item eine Usage. Der Snapshot-Klon löst Nährwerte nicht erneut auf.
	- Persönliches Reusable Item (`sourceId` vorhanden und kein `openFoodFacts:`-Katalogpräfix): `UserFoodRelation` mit `foodRefType: 'personal'`; `ReusableItem.usageCount` wird wie im Add-Pfad nur erhöht, wenn das Reusable Item mit `nutritionPer100g` aufgelöst wird.
	- Open Food Facts (`sourceId` mit `openFoodFacts:`): `UserFoodRelation` mit `foodRefType: 'catalog'`; es gibt keinen zusätzlichen Catalog-Produktzähler.
	- Rezept (`recipeId` vorhanden): `UserFoodRelation` mit `foodRefType: 'recipe'` für den kopierenden Nutzer und dem Zieltag/-mahlzeit-Kontext. `Recipe.usageCount` wird für den Recipe-Eigentümer nur erhöht, wenn `resolveRecipeForRead()` das Rezept nach den bestehenden Owner-/Community-Regeln auflösen kann. Ein inzwischen nicht verfügbares oder gelöschtes Recipe-Snapshot bleibt kopierbar; die Nutzer-Relation wird für die Kopie aufgezeichnet, ein nicht auflösbarer Eigentümerzähler wird nicht aktualisiert.
	- Manuelle, KI- und AI-Meal-Estimate-Items ohne `sourceId`/`recipeId` haben nach der bestehenden Add-Konvention keine referenzierte Usage-Relation und keinen Quellzähler. Es wird keine künstliche Food-Referenz erzeugt. Ein auf ein Reusable Item verweisender Eintrag wird dagegen als persönliche Quelle getrackt, unabhängig von der Herkunft des Reusable Items.
- `UserFoodRelationRepository.recordUsage()` erhält für Copy das explizite Zieldatum und die Zielmahlzeit. Seine bestehenden Usage-Felder (`usageCount`, `lastUsedAt`, `usageDates` und – sofern Eingabemodus/-menge vorliegen – Eingabepräferenzen) bleiben maßgeblich.
- Tracking wird ausschließlich nach erfolgreichem Diary-Commit angestoßen und bleibt wie beim bestehenden Add-Pfad best effort. Fehler vor dem Commit verursachen keine Usage-Nebenwirkung; ein nachgelagerter Usage-Fehler rollt den erfolgreichen Diary-Commit nicht zurück.

**Kompatibilitätsregel für die Quellklassifikation:** Der normale Add-Handler verwendet `sourceType` für die initiale Relation-Zuordnung, persistiert ihn aber außer bei `ai-meal-estimate` nicht durchgängig im `MealItem`. B3 klassifiziert bestehende Items daher anhand der stabilen gespeicherten Referenzen (`recipeId`, `sourceId` und `openFoodFacts:`-Präfix) und nicht allein anhand von `MealItem.sourceType`. Das erfordert keine Änderung am Dokument-Schema.

## 1. Requirement Assessment

- **Nutzerproblem:** Wiederholte Einzelaktionen im Tagebuch sind bei mehreren Einträgen unnötig aufwendig.
- **Lösungsfit:** Ein lokaler Auswahlmodus auf der angezeigten Tagebuchseite mit den bestehenden Aktionen als Mehrfachaktionen löst das Problem ohne neuen dauerhaften Auswahlzustand.
- **Produkt- und Domain-Fit:** Die Tagebuchansicht ist bereits auf einen einzelnen date-only-Tag begrenzt. Mahlzeiten enthalten die Einträge; die Nährwerte eines `MealItem` sind gespeicherte Snapshots. Die Story führt keine neue Ernährungsregel oder Berechnung ein. Die PO-3-Entscheidung unterscheidet Delete, Move und Copy und verwendet für Copy die vorhandenen, quelltypspezifischen Add-Zähler.
- **Sicherheit:** Alle Mutationen bleiben serverseitig authentifiziert und auf die `userId` des Tokens begrenzt. Der Client übermittelt Referenzen, keine autoritativen Nährwerte oder fremden Nutzerdaten.
- **Gesundheitsrisiko:** Es entstehen keine Empfehlungen oder Berechnungen. Falsche Teilmutationen könnten jedoch zu fehlenden oder doppelten Tagebucheinträgen führen; daher wird Atomarität als PO-2 geklärt.
- **AI:** Nicht erforderlich.
- **Klassifizierung:** Accept with modifications. US-01 wird mit den bestätigten Vorgaben PO-1, PO-2 und PO-3 geplant; es verbleibt keine offene Produktentscheidung.

## 2. Confirmed Product Behaviour

- Auswahl gilt nur für den im Tagebuch angezeigten Tag; Einträge verschiedener Mahlzeiten dieses Tages dürfen kombiniert werden.
- **„Verschieben“ behält die bestehende Semantik:** Ein bestehendes Ziel muss am selben Tag liegen und von jeder Quellmahlzeit der Auswahl verschieden sein; alternativ wird eine neue Mahlzeit desselben Tages atomar angelegt. Eine Quellmahlzeit kann nicht zugleich Ziel sein. Diary-Meals ändern sich atomar; Usage-Historien und Quellzähler bleiben unverändert.
- „Auf anderen Tag kopieren“ verlangt einen vom Quelltag verschiedenen Zieltageintrag und genau eine explizit vom Nutzer ausgewählte Zielmahlzeit für alle ausgewählten Items. Diese kann über den vorhandenen „Mahlzeit anlegen“-Pfad neu angelegt werden; Zielmahlzeit und Kopien werden gemeinsam atomar geschrieben. Referenzierte Quellen werden nach PO-3 als zusätzliche Usage am Zieltag/-mahlzeit getrackt.
- Löschen, Verschieben und Kopieren verändern die Tagebuch-Meals entweder vollständig für die gesamte Auswahl oder gar nicht. Bei Konflikt, ungültiger Referenz oder Cosmos-Grenzüberschreitung gibt es keine Teilmutation; die App meldet den konkreten Fehler, aktualisiert die aktuelle Tagebuchansicht und hält die gültige Auswahl zur Korrektur/Wiederholung bereit.
- Eine Mahlzeitenauswahl bedeutet die Auswahl ihrer enthaltenen Einträge, nicht die Löschung oder Verschiebung des Meal-Dokuments als Ganzes.
- Delete behält die vorhandene Tracking-Semantik ohne neue oder kompensierende Usage-Schreibvorgänge bei. Move schreibt keine Usage. Copy folgt den quelltypspezifischen Regeln unter PO-3; nicht referenzierte Einzel-Items erhalten keinen künstlichen Tracking-Datensatz.

## 3. Feature Summary

`DiaryScreen` erhält einen flüchtigen Auswahlmodus. Einzelne `MealItem`-Referenzen und ganze Mahlzeiten können kombiniert ausgewählt werden. Die Auswahl wird sichtbar angezeigt und auf Löschen, Verschieben oder Kopieren angewendet. Backend-Bulk-Befehle arbeiten auf serverseitig geladenen Einträgen; Auswahl und Aktionsstatus werden nicht persistiert. Delete und Move verändern keine Food Usage; Copy zeichnet pro referenziertem und vom bestehenden Add-Tracking erfasstem Item eine zusätzliche Zieltag/-mahlzeit-Usage auf.

## 4. Current Behaviour

- `DiaryScreen` lädt einen Tag und rendert mehrere Meal-Dokumente mit eingebetteten Items. Es gibt weder Auswahlmodus noch Bulk-Aktionsleiste.
- Das explizite Löschen eines Eintrags aus `EditItemSheet` verwendet `ConfirmSheet`. Swipe-to-delete löscht dagegen direkt und bietet eine Undo-Snackbar. Das Löschen einer Mahlzeit bestätigt und entfernt das gesamte Meal-Dokument samt Items. Die Item- und Meal-Delete-Handler ändern keine Food-Usage-Relationen oder Quellzähler; es gibt keine kompensierende Usage-Operation.
- `MoveItemSheet` verschiebt einen Eintrag innerhalb desselben Tages: Ziel gegebenenfalls anlegen, Eintrag über `POST .../items` hinzufügen, Quelle anschließend über `DELETE .../items/{itemId}` löschen. Es gibt keinen Move-Endpunkt und die Sequenz ist nicht atomar. Der Add-Aufruf kann `UserFoodRelation`-Usage und – je nach Referenz – `ReusableItem.usageCount` oder `Recipe.usageCount` erhöhen; der folgende Delete-Aufruf nimmt diese Erhöhungen nicht zurück. Das ist der zu korrigierende Ist-Zustand, keine gewünschte Move-Semantik.
- `CopyItemSheet` fragt einen anderen Tag und danach eine Zielmahlzeit ab. Beim vorhandenen „Mahlzeit anlegen + kopieren“-Pfad ruft der Client zuerst separat `createMeal` und danach `addItem` auf; es gibt keinen Copy-Endpunkt. Der Add-Pfad kann eine neue Usage-Aufzeichnung und quelltypspezifische Zähleränderungen auslösen. Diese mehrteilige Sequenz darf für die Mehrfachaktion nicht wiederverwendet werden, weil sie die bestätigte All-or-nothing-Semantik verletzen könnte.
- Der aktuelle Copy-Payload löst grammbasierte Einträge mit `sourceId` beim Add erneut über das aktuelle Reusable-Item auf. Damit können kopierte Makros vom gespeicherten MealItem-Snapshot abweichen. Der flache Fallback überträgt außerdem nicht alle Rezept-/Quellmetadaten.
- Die API bietet einzelne Meal- und Item-Mutationen, aber keine Bulk-Routen. `nutritionDiaryService` stößt nach Einzelmutationen Health-Connect-Synchronisation an. Der Backend-Add-Pfad ruft für getrackte Food-Referenzen `UserFoodRelationRepository.recordUsage()` auf; bei aufgelösten persönlichen Foods mit `nutritionPer100g` erhöht er zusätzlich `ReusableItem.usageCount`. Der Recipe-Add-Pfad erhöht nach erfolgreicher Owner-/Community-Auflösung `Recipe.usageCount` und zeichnet die Relation des protokollierenden Nutzers auf. Delete ändert diese Werte nicht; Move übernimmt heute unbeabsichtigt Add-Nebenwirkungen.
- Bei regulären Nicht-Recipe-Adds nutzt der Handler das Request-`sourceType` zur Relation-Zuordnung, reicht es aber nicht an `DiaryRepository.addItem()` weiter; dort wird deshalb meist `sourceType: 'manual'` gespeichert. `sourceId` bleibt erhalten. Katalog-IDs verwenden das Präfix `openFoodFacts:`; Recipe-Items speichern `recipeId`. Eine Copy-Implementierung kann die bestehenden Quellen anhand dieser Referenzen unterscheiden und darf `MealItem.sourceType` nicht als alleinige Klassifikation verwenden.

## 5. Desired Behaviour

- Eine Aktion im Tagebuch-Header startet den Modus; eine klare Abbrechen-/Beenden-Aktion beendet ihn.
- Item-Zeilen lassen sich einzeln an- und abwählen. Mahlzeiten zeigen den Zustand nicht ausgewählt, teilweise ausgewählt oder vollständig ausgewählt. Tippen auf eine teilweise oder nicht ausgewählte Mahlzeit wählt alle ihre vorhandenen Items; Tippen auf eine vollständig ausgewählte Mahlzeit hebt alle ihre Items ab.
- Leere Mahlzeiten erzeugen keine Auswahl und erhalten im Modus kein aktivierbares Auswahlziel.
- Während der Auswahl sind Editieren, Swipe-Mutationen, Mahlzeit-Löschen und Hinzufügen deaktiviert bzw. verborgen, damit Gesten nicht versehentlich eine andere Aktion auslösen.
- Eine fixierte Aktionsleiste zeigt Anzahl und die drei geforderten Aktionen. Löschen erhält eine einmalige Bestätigung für die gesamte Auswahl.
- Beim Verschieben muss ein bestehendes Ziel am angezeigten Tag liegen und von allen Quellmahlzeiten der Auswahl verschieden sein; alternativ kann eine neue Mahlzeit desselben Tages gewählt werden. Kein ausgewähltes Quell-Meal ist als Ziel zulässig.
- Beim Kopieren wählt der Nutzer explizit genau eine Zielmahlzeit für alle ausgewählten Items. Eine neue Zielmahlzeit wird über den vorhandenen „Mahlzeit anlegen“-Pfad gewählt und gemeinsam mit den Kopien atomar erstellt.
- Nach einem fehlgeschlagenen atomaren Request zeigt die App eine konkrete Fehlermeldung und lädt die aktuell angezeigte Tagebuchansicht neu. Nicht mehr vorhandene Referenzen werden beim Normalisieren aus der lokalen Auswahl entfernt; die verbleibenden gültigen Referenzen bleiben ausgewählt.
- Ein Wechsel des Tagebuchdatums beendet den Modus und verwirft die alte Auswahl. Nach Refresh werden Referenzen, die nicht mehr im geladenen Tag vorhanden sind, aus der lokalen Auswahl entfernt.
- Food-Usage folgt PO-3: Delete erzeugt keine neue Usage und nimmt keine alte zurück; Move lässt alle Usage-Historien und Quellzähler unverändert; Copy erfasst referenzierte Quellen einmal je kopiertem Item mit Zieldatum/-mahlzeit und den einschlägigen vorhandenen Add-Zählern. Items ohne Food-Referenz bleiben ungetrackt. Bei Fehler vor dem Diary-Commit wird keine Usage-Nebenwirkung ausgelöst.

## 6. Scope

- Auswahlmodus in `DiaryScreen` für den dargestellten Tag.
- Item-Auswahl, Mahlzeiten-Auswahl, kombinierte Auswahl und klare visuelle/accessibility-relevante Zustände.
- Bestätigtes Bulk-Löschen ausgewählter Items, ohne nicht ausgewählte Items oder Meal-Dokumente zu entfernen.
- Bulk-Verschieben auf eine bestehende Mahlzeit desselben Tages, die von allen Quellmahlzeiten der Auswahl verschieden ist, oder auf eine wie heute neu anzulegende Mahlzeit.
- Bulk-Kopieren auf einen anderen Tag in genau eine explizit vom Nutzer ausgewählte Zielmahlzeit; vorhandene oder über „Mahlzeit anlegen“ neu zu erstellende Zielmahlzeit.
- Backend-Validierung und user-scoped Repository-Mutationen, typed API-Client und Health-Connect-Synchronisation nach erfolgreichem Commit. Delete und Move schreiben keine Usage; Copy schreibt bestätigte, quelltypspezifische Tracking-Nebenwirkungen erst nach erfolgreichem Commit.
- Die bestehenden Einzeleintrags-Flows für Verschieben und Kopieren auf dieselben Backend-Befehle mit einer Referenz umstellen, damit Einzel- und Mehrfachaktionen dieselbe Snapshot-, Mutations- und Tracking-Logik verwenden.

## 7. Out of Scope

- Freunde, Kontakte, fremde Tagebücher oder Übernahme fremder Einträge.
- Auswahl über mehrere Tage hinweg.
- Löschen, Verschieben oder Kopieren ganzer Meal-Dokumente als neue Aktion.
- Neue Kopier-, Lösch- oder Verschiebelogik außerhalb der Unterstützung der Einzel-/Mehrfachauswahl.
- Änderungen an Ernährungsberechnung, Rezeptauflösung, AI-Flows, Zielen oder Tageszusammenfassungen.
- Neue Cosmos-Entitäten, Container, Partition Keys, Native Modules oder App-Config-/Plugin-Änderungen.

## 8. Confirmed Facts

- `Meal.items` enthält die `MealItem`-Objekte; `MealItem.macros` ist laut Domain-Dokumentation ein Snapshot.
- Cosmos speichert jedes Meal als Dokument im Container `nutritionDiaryMeals`, Partition Key `/userId`. `DayMeta` liegt ebenfalls im bestehenden Container, ist für diese Aktionen aber nicht zu ändern.
- Das vorhandene Tagebuch-Repository hat In-Memory- und Cosmos-Implementierungen sowie getrennte Unit- und Emulator-Contract-Tests.
- Die mobile API verwendet den bestehenden Axios-Client mit Bearer-Token-Interceptor. Backend-Handler authentifizieren mit `requireUser()`.
- Zum ursprünglichen Planungszeitpunkt wurden Single-Item Move/Copy im Mobile-Client aus bestehenden Add-/Delete-Endpunkten zusammengesetzt. Beim damaligen Copy-Pfad konnte die Zielmahlzeit separat vor dem Add angelegt werden; die damalige API-Dokumentation enthielt keine eigenen Move-/Copy-Routen.
- Die US-01-User-Story benennt das vorhandene Verhalten eines einzelnen Moves ausdrücklich als fachliche Grundlage. `MoveItemSheet` bietet bestehende Mahlzeiten außer den Quellmahlzeiten der Auswahl als Ziel an; In-Memory- und Cosmos-Repositories sowie die API-Referenz weisen ein vorhandenes Ziel zurück, wenn dessen ID zu einer Quellmahlzeit gehört.
- `MealItem` enthält bereits die für Kopie und Editierbarkeit nötigen Felder, u. a. `sourceType`, `sourceId`, `macros`, Menge/Einheit, Rezeptreferenz/-portionen, AI-Metadaten und Kategorie.
- Die KB-Regel zum `UserFoodRelation`-Usage-Tracking verlangt das explizite `Meal.date` und beschreibt `usageCount`, `lastUsedAt` sowie `usageDates`; `recordUsage()` speichert zusätzlich den Mahlzeitentyp und kann Eingabepräferenzen aktualisieren. Es gibt keine Decrement- oder Reattribution-Operation und keine Diary-Item-Referenz in den Usage-Einträgen.
- `POST /api/diary/meals/{id}/items` zeichnet nach erfolgreichem Diary-Add `UserFoodRelation`-Usage auf. Für ein aufgelöstes persönliches Reusable Item mit `nutritionPer100g` erhöht der Handler zusätzlich `ReusableItem.usageCount`. Open-Food-Facts-Referenzen werden als `catalog`-Relation getrackt; dafür existiert kein zusätzlicher Produktzähler.
- `addRecipeDiarySnapshot()` verwendet die aktuelle Recipe-Owner-/Community-Auflösung, schreibt einen Recipe-Snapshot, erhöht `Recipe.usageCount` beim Rezept-Eigentümer und zeichnet eine Recipe-Relation für den protokollierenden Nutzer auf. Eine inzwischen nicht verfügbare fremde Recipe-Quelle ist über den bestehenden Add-Pfad nicht mehr auflösbar.
- Reguläre Adds speichern `sourceId`, aber `addItemHandler` reicht `sourceType` – außer für `ai-meal-estimate` – derzeit nicht an das Diary-Repository weiter. Repository-Lese-/Updatepfade klassifizieren Open Food Facts anhand `openFoodFacts:` und andere produktgebundene `sourceId`-Werte als persönliche Reusable-Quelle. Recipe-Logs führen `recipeId`.
- Der Item- und Meal-Delete-Handler ändert ausschließlich Diary-Dokumente. Es existiert keine kompensierende Usage-Operation; die neue Delete-Semantik kann daher das aktuelle Verhalten unverändert beibehalten.
- Die aktuelle Mobile-Move-Sequenz löst über Add neue Usage-Nebenwirkungen aus und lässt sie nach Delete bestehen. Das ist zu ersetzen; bereits gespeicherte historische Usage wird nicht rückwirkend korrigiert.
- Die bestätigte PO-3-Entscheidung unterscheidet Delete, Move und Copy. Bei Copy gelten bestehende Add-Zähler nur für die jeweilige referenzierte Quelle; unreferenzierte manuelle/KI-Einträge besitzen nach der bestehenden Konvention keinen Quellzähler.

## 9. Assumptions and Constraints

- Die Auswahl ist auf die im `DiaryScreen` geladene Tagesansicht begrenzt. Dafür sprechen die vorhandene Navigation und der Wunsch, Einträge aus verschiedenen Mahlzeiten zu kombinieren; eine Auswahl über Tage ist nicht angefordert.
- Eine leere Mahlzeit ist nicht auswählbar, da sie keine Einträge enthält. Das ist eine UI-Ausgestaltung, keine neue Domain-Regel.
- Kopieren übernimmt den gespeicherten MealItem-Snapshot samt Herkunftsmetadaten und lädt keine aktuellen Produkt-/Rezeptwerte nach. Das folgt der dokumentierten Snapshot-Regel und behebt die oben beschriebene Abweichung des gegenwärtigen Client-Copy-Pfads.
- Es werden keine zusätzlichen npm-Pakete benötigt.
- Auswahlumfang, Leermahlzeiten-Verhalten und Snapshot-Kopie sind durch den bestehenden Plan, die User Story und die dokumentierten Diary-Regeln festgelegt. PO-1, PO-2 und PO-3 sind entschieden; es bleibt keine offene Produktentscheidung. Für Copy wird die persistierte Quellreferenz verwendet, weil `MealItem.sourceType` im aktuellen Add-Pfad nicht zuverlässig erhalten bleibt.
- Die Move-Zielbeschränkung ist keine neue Produktannahme: Die User Story macht den bestehenden Einzel-Move zur fachlichen Grundlage, dessen Zielauswahl Quellmahlzeiten ausschließt; Diary-Domain, API-Dokumentation und Repository-Validierung bestätigen dieselbe Regel. Dafür ist keine zusätzliche PO-Entscheidung und keine Änderung an PO-1, PO-2 oder PO-3 erforderlich.

## 10. Existing Components to Reuse

- `DiaryScreen` / `MealCard` für Datums- und Mahlzeitenkontext.
- `DiaryItemRow` für Eintragsdarstellung; Auswahlzustand über vorhandene Theme-Tokens und das bestehende Icon-System ergänzen.
- `ConfirmSheet` für die einmalige Löschbestätigung; keine `Alert.alert`-Bestätigung.
- `MoveItemSheet`, `CopyItemSheet` und deren Datums-/Mahlzeitenwahl als Ausgangspunkt, erweitert auf mehrere Referenzen. Die Move-Zielauswahl schließt alle Quellmahlzeiten der aktuellen Auswahl aus. Die Zielauswahl für eine neu anzulegende Mahlzeit bleibt im bestehenden UI-Pfad; die persistente Anlage erfolgt innerhalb der atomaren Bulk-Mutation.
- `nutritionDiaryService`, bestehender Axios-Client, `diaryApi` und `nutritionSyncService`.
- `DiaryRepository` / `CosmosDiaryRepository` sowie vorhandene Vitest- und Cosmos-Emulator-Testmuster.
- `UserFoodRelationRepository`, `ReusableItemsRepository`, `RecipesRepository` und `resolveRecipeForRead()` für die bestehenden Food-/Recipe-Usage-Zähler; B3 setzt die bestätigte Copy-Regel um und hält Delete/Move frei von Tracking-Schreibvorgängen.

## 11. Proposed Technical Solution

### Auswahlmodell und UI

- Auswahlzustand bleibt Screen-lokal und ist eine Menge eindeutiger `{ mealId, itemId }`-Referenzen. Die IDs werden nicht aus clientseitigen Item-Kopien als Autorität an das Backend gesendet.
- Mahlzeitenzustand wird aus den enthaltenen Referenzen abgeleitet. Der visuelle Zwischenzustand entspricht einer teilweise ausgewählten Mahlzeit; wiederholtes Tippen folgt dem in „Desired Behaviour“ beschriebenen Select-all/Clear-all-Verhalten.
- Die Aktionsleiste zeigt eine stabile Anzahl; Aktionen sind bei leerer Auswahl deaktiviert. Die Item- und Mahlzeitenzustände erhalten verständliche Screenreader-Rollen, Namen und ausgewählt/teilweise ausgewählt-Zustände.
- Die aktuelle Tagesnavigation bleibt erhalten. Ein Datumswechsel setzt Auswahl und Modus zurück.
- Bei Erfolg wird der aktuelle Tag neu geladen und die Auswahl beendet. Bei explizitem Abbruch wird sie ebenfalls beendet. Bei einem fehlgeschlagenen atomaren Request bleibt die Auswahl erhalten.

### API-Vertrag

Neue geschützte Command-Routen, alle mit `requireUser()` und strikter Zod-Validierung:

| Methode / Route | Request (Skizze) | Erfolgsantwort |
|---|---|---|
| `POST /api/diary/items/bulk-delete` | `{ sourceDate, items: [{ mealId, itemId }] }` | `{ deletedCount, deletedItemIds }` |
| `POST /api/diary/items/bulk-move` | `{ sourceDate, items, target: { mealId } \| { newMealType } }` | `{ movedCount, removedItemIds, targetMeal }` |
| `POST /api/diary/items/bulk-copy` | `{ sourceDate, targetDate, items, target: { mealId } \| { newMealType } }` | `{ copiedCount, targetMeal }` |

Der Copy-Request enthält genau eine Zielangabe für alle ausgewählten Items: eine vorhandene `mealId` oder `newMealType` für eine über den bestehenden „Mahlzeit anlegen“-Pfad gewählte neue Zielmahlzeit. Die Neuanlage und das Kopieren erfolgen in derselben Transaktion; Mobile ruft dafür nicht vorab `POST /api/diary/meals` auf. Die Antwort von Move/Copy enthält die Zielmahlzeit einschließlich der neu angelegten Item-IDs, damit Mobile die bestehende Health-Connect-Synchronisation fortsetzen kann. Der Request akzeptiert keine Item-Nährwerte oder beliebigen Item-Felder.

Validierung und Fehlergrenzen:

- `sourceDate` und Copy-`targetDate` sind echte date-only-Kalendertage; Copy verlangt `targetDate !== sourceDate`.
- Leere oder doppelte Referenzlisten werden mit `400 invalid_diary_bulk_request` abgelehnt. Jede Quellmahlzeit muss zum authentifizierten Nutzer und `sourceDate` gehören; ein bestehendes Move-Ziel muss zum selben Datum gehören und darf zu keiner Quellmahlzeit der Auswahl gehören. Eine Ziel-ID, die mit einer Quellmahlzeit übereinstimmt, wird als `400 invalid_diary_bulk_request` abgelehnt. Das Copy-Ziel muss zum `targetDate` gehören.
- Nicht vorhandene oder nicht zum Nutzer gehörende Meal-/Item-Referenzen ergeben eine nicht unterscheidende `404 diary_bulk_reference_not_found`-Antwort. Kein Request-Feld darf eine `userId` vorgeben.
- Bei einem ETag-/Schreibkonflikt wird die vollständige Aktion ohne Änderungen mit `409 diary_bulk_conflict` abgelehnt. Bei Überschreitung der Cosmos-Transaktionsgrenzen für Operationsanzahl oder Requestgröße wird sie ohne Änderungen mit `413 diary_bulk_operation_limit_exceeded` abgelehnt. Ungültige Referenzen und Grenzüberschreitungen dürfen keine Teilresultate liefern.
- Cosmos prüft jede Mutation als eine Transactional Batch in der `/userId`-Partition. Alle Referenzen werden vor dem Commit validiert; ETag-Bedingungen schützen bestehende Meal-Dokumente, die durch die Aktion geschrieben werden. Batch-Grenzen werden vor dem Submit geprüft und Cosmos-Fehler atomar behandelt. Die Auswahl wird nie in mehrere Batches oder unabhängige Teilaktionen zerlegt.
- Die genannten Fehlercodes und Statuscodes sind Teil des API-Vertrags und werden in `docs/kb/tech/09-api-reference.md` dokumentiert. Mobile übersetzt sie in konkrete deutsche Meldungen, lädt bei jedem fehlgeschlagenen Bulk-Request den aktuell angezeigten Quelltag neu und löst keine Health-Connect-Synchronisation aus.

### Repository und Mutation

- `DiaryRepository` erhält Bulk-Operationen; beide Implementierungen validieren die vollständige Auswahl und bereiten alle Änderungen vor, bevor sie Daten mutieren.
- Cosmos gruppiert Schreiboperationen nach eindeutigem Meal-Dokument. Delete schreibt nur Quellmahlzeiten; Move schreibt Quellmahlzeiten und Ziel; Copy schreibt nur das Ziel. Alle Dokumente gehören zur selben `/userId`-Partition und werden in einer Cosmos Transactional Batch geändert.
- Vor dem Commit werden alle Quellreferenzen und Ziele geprüft. Für Move muss die ID eines bestehenden Ziels von jeder Quellmahlzeit verschieden sein; eine Überschneidung wird vor dem Schreiben als `invalid_diary_bulk_request` abgelehnt. Bestehende Meal-Dokumente, die geschrieben werden, werden mit ihren gelesenen ETags aktualisiert, damit parallele Änderungen nicht überschrieben werden. Ein Konflikt oder eine ungültige Referenz verhindert die gesamte Aktion.
- Die Implementierung prüft die Operationsanzahl und die serialisierte Requestgröße gegen die Cosmos-Transaktionsgrenzen. Eine Überschreitung führt vor dem Commit zu einem stabilen Limitfehler; kommt eine Grenze erst beim Cosmos-Submit zum Tragen, wird dessen atomarer Fehler auf denselben Fehlervertrag abgebildet. Es gibt kein Aufteilen oder automatisches Wiederholen als Teilerfolg.
- Beim Löschen werden ausgewählte Items aus `Meal.items` entfernt; die Quellmahlzeit bleibt auch dann bestehen, wenn sie anschließend leer ist.
- Beim Verschieben werden ausgewählte Items aus ihren Quellen entfernt und mit neuen Item-IDs zum Ziel ergänzt. Die restlichen MealItem-Felder einschließlich Snapshot und Herkunft bleiben erhalten; neue IDs entsprechen dem bisherigen Add-then-delete-Einzelverhalten.
- Beim Kopieren klont der Server das gespeicherte MealItem, vergibt eine neue Item-ID und verändert die Quelle nicht. `macros`, Menge/Einheit, `sourceType`/`sourceId`, Rezeptfelder, AI-Metadaten und Kategorie bleiben unverändert. Es gibt keine Live-Auflösung von Reusable Item oder Rezept.
- Neue Zielmahlzeiten werden innerhalb derselben Transaktion erstellt, wenn die UI über den bestehenden „Mahlzeit anlegen“-Pfad `newMealType` wählt. Die UI-Auswahl wird wiederverwendet, aber die separate `createMeal`-Mutation des bisherigen Einzel-Copy-Flows nicht. So bleibt bei fehlgeschlagenem Bulk-Copy kein leeres Zielmahlzeit-Dokument zurück.
- **Food Usage:** Delete und Move schreiben keine neuen Usage-Einträge, dekrementieren keine Zähler und reattribuieren keine Historie. Copy nutzt `recordUsage()` pro referenziertem Item mit dem Datum und Mahlzeitentyp des atomar bestimmten Ziel-Meals. Catalog (`openFoodFacts:`) aktualisiert nur die Catalog-Relation; persönliche Reusable-Quellen aktualisieren die Personal-Relation und den `ReusableItem`-Zähler nach den bestehenden Auflösungsbedingungen; Recipe-Quellen aktualisieren die Relation des kopierenden Nutzers und den Eigentümer-Recipe-Zähler nur bei erfolgreicher bestehender Owner-/Community-Auflösung. Items ohne Quellreferenz erhalten keinen künstlichen Usage-Datensatz. Die Kompatibilitätsklassifikation verwendet `recipeId` bzw. `sourceId` und nicht allein `MealItem.sourceType`.
- **Nebenwirkungsgrenze:** Food-Usage-Tracking und Health-Connect-Sync werden ausschließlich nach erfolgreichem atomarem Diary-Commit angestoßen. Ein abgelehnter oder fehlgeschlagener Bulk-Request löst keine dieser Nebenwirkungen aus. Die Atomarität umfasst gemeinsam alle Diary-Meals; nachgelagerte Usage-/Sync-Nebenwirkungen bleiben best effort und rollen den Diary-Commit nicht zurück.
- **Move/Delete:** Backend-Move und Bulk-Delete mutieren Diary-Meals direkt. Move darf nicht als Add-then-delete umgesetzt werden; weder Move noch Delete ruft Usage-Schreibvorgänge oder Kompensationen auf.
- **Copy:** Das serverseitige Snapshot-Klonen und die atomare Zielmahlzeit-Anlage bleiben unabhängig von einer Live-Nährwertauflösung. Nach dem Commit führt B3 die bestätigten referenzbasierten Usage-Schreibvorgänge aus. Für inzwischen nicht verfügbare Recipe-Snapshots bleibt die Diary-Kopie erhalten; ohne aktuelle Recipe-Auflösung wird kein Eigentümerzähler verändert.

### Authentifizierung und Datenschutz

- Bestehender Bearer-/JWT-Vertrag bleibt unverändert. Jede Route authentifiziert über `requireUser()`.
- Quell- und Zielreferenzen werden ausschließlich im `userId`-Partition-Kontext aufgelöst. Fehler für fremde und unbekannte IDs offenbaren keinen Unterschied.
- Es werden keine fremden Nutzer- oder Tagebuchdaten geladen oder unterstützt.

## 12. Backend Work Package

### B1. Bulk Delete und Move

Agent: Backend

Goal: Shared Referenz-/Request-Typen sowie authentifizierte Bulk-Delete- und Bulk-Move-Routen und passende Repository-Operationen mit der bestätigten All-or-nothing-, Fehler- und PO-3-Tracking-Semantik bereitstellen. Ein vorhandenes Move-Ziel muss von allen Quellmahlzeiten verschieden sein; eine Übereinstimmung wird vor der Mutation abgelehnt.

**Food-Usage-Grenze:** B1 implementiert die Diary-Mutation direkt und nicht als Add-then-delete-Sequenz. Delete und Move schreiben keine Usage und verändern keine bisherigen Usage-Daten oder Quellzähler. B3 ergänzt ausschließlich die bestätigte Copy-Usage.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/diary.ts
- backend/src/functions/diary.test.ts
- backend/src/lib/repositories/diaryRepository.ts
- backend/src/lib/repositories/diaryRepository.test.ts
- backend/src/lib/repositories/cosmosDiaryRepository.ts
- backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts
- backend/src/lib/cosmos.ts
- backend/src/test-utils/cosmosEmulator.ts
- shared/types/diary.ts

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-6
- AC-8
- AC-9
- AC-11
- AC-13
- AC-14
- AC-17

Dependencies:
- Keine; PO-2 und PO-3 sind entschieden und als verbindliche Vertragsvorgaben festgelegt.

Expected Handoff:
- getypte Referenz-, Request- und Response-Typen sowie dokumentierter Delete-/Move-API-Vertrag
- In-Memory- und Cosmos-Repository-Implementierung mit Transaktions-/Konfliktverhalten
- Move-Ziele aus der Quellmahlzeitenmenge werden als `400 invalid_diary_bulk_request` abgelehnt, ohne Diary-Änderung; Tests decken einzelne und mehrere Quellmahlzeiten ab
- Handler-, Repository- und Cosmos-Emulator-Contract-Tests
- Move mutiert Diary-Meals direkt ohne Add-basierte Food-Usage-Nebenwirkungen; Delete lässt alle bestehenden Usage-Daten und Quellzähler unverändert
- explizite Bestätigung: keine Schema-, Container-, Partition-Key- oder Migrationsänderung

### B2. Bulk Copy und Copy-Snapshot


Agent: Backend

Goal: Bulk-Copy als serverseitiges Klonen vorhandener MealItem-Snapshots in genau eine explizit gewählte Zielmahlzeit implementieren, den Einzel-Copy-Endpunktvertrag wiederverwendbar machen und die Diary-/API-Dokumentation vervollständigen. B3 ergänzt danach die bestätigten, quelltypspezifischen Food-Usage-Nebenwirkungen.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/diary.ts
- backend/src/functions/diary.test.ts
- backend/src/lib/repositories/diaryRepository.ts
- backend/src/lib/repositories/cosmosDiaryRepository.ts
- backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts
- shared/types/diary.ts
- mobile/src/modules/nutrition/diaryItemUtils.ts
- mobile/src/modules/nutrition/CopyItemSheet.tsx

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-6
- AC-7
- AC-11
- AC-12
- AC-13
- AC-14
- AC-16
- AC-18
- AC-19

Dependencies:
- B1 shared reference and response contracts
- PO-1, PO-2 und PO-3 sind entschieden; ihre Semantik ist verbindlicher API-Input.

Expected Handoff:
- Bulk-Copy-Request mit genau einer vorhandenen oder atomar neu anzulegenden, explizit gewählten Zielmahlzeit
- serverseitiger Snapshot-Klon mit neuen IDs und Tests für Originalerhalt sowie alle MealItem-Metadaten
- API-Referenz und Diary-Domain-Dokumentation aktualisiert
- Copy-Handler hält Snapshot-Klon und Diary-Commit atomar; B3 ergänzt die bestätigte referenzbasierte Usage nach erfolgreichem Commit

### B3. Operation-specific Food Usage

Agent: Backend

Goal: PO-3 vollständig umsetzen: Delete und Move ohne Usage-Schreibvorgänge oder rückwirkende Korrektur; Copy mit je Quelltyp korrekter Relation und den anwendbaren Add-Zählern nach erfolgreichem Diary-Commit.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/domain/03-food-catalog.md
- docs/kb/domain/06-recipes.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/diary.ts
- backend/src/lib/recipeDiary.ts
- backend/src/lib/communityRecipes.ts
- backend/src/lib/repositories/userFoodRelationRepository.ts
- backend/src/lib/repositories/userFoodRelationRepository.test.ts
- backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts
- backend/src/lib/repositories/cosmosUserFoodRelationRepository.contract.test.ts
- backend/src/lib/repositories/reusableItemsRepository.ts
- backend/src/lib/repositories/recipesRepository.ts
- backend/src/functions/diary.test.ts

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-17
- AC-18
- AC-19

Dependencies:
- B1 und B2 Diary-Mutationen abgeschlossen

Expected Handoff:
- Delete und Move verändern weder UserFoodRelation-Historie noch `ReusableItem.usageCount` oder `Recipe.usageCount`; es gibt keine rückwirkende Korrektur
- Copy zeichnet je kopiertem referenziertem Item die UserFoodRelation-Usage am Zieltag/-mahlzeit auf; Open Food Facts, persönliche Reusable Items und Recipes folgen den unter PO-3 festgelegten Zählerregeln
- Tests belegen jede Quelltyp-/Operationskombination, mehrfache gleiche Referenzen, nicht verfügbare Recipe-Snapshots und keine Usage bei fehlgeschlagenem Diary-Commit
- Kein Schema- oder Migrationsbedarf; Knowledge Base dokumentiert die bestätigte Semantik und die Referenzklassifikation für bestehende MealItems

## 13. Frontend Work Package

### F1. Auswahlmodus und Zustandsdarstellung

Agent: Frontend

Goal: Screen-lokalen Mehrfachauswahlmodus, Meal-Tri-State, Item-Toggles, Auswahlzähler und klares Beenden/Zurücksetzen im Tagebuch bereitstellen, ohne bereits Aktionsrequests auszulösen.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md

Required Repository Context:
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/nutrition/diaryItemUtils.ts
- mobile/src/modules/nutrition/diaryItemUtils.test.ts
- mobile/src/shared/components/DiaryItemRow.tsx
- mobile/src/shared/components/Icon.tsx
- mobile/src/app/theme/index.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-10

Dependencies:
- Keine API-Abhängigkeit; die F1-Interaktionen müssen der in diesem Plan empfohlenen Select-all/Clear-all-Semantik folgen.

Expected Handoff:
- getestete lokale Auswahlzustandslogik mit eindeutigen Item-Referenzen
- integrierte Auswahl-/Zwischenzustände für Items und Mahlzeiten
- dokumentierter UI-Handoff für Aktionsleiste und Mutationsintegration

### F2. Delete-/Move-Aktionsfluss und Sync

Agent: Frontend

Goal: Bestätigtes Bulk-Löschen und Bulk-Verschieben an den vereinbarten API-Vertrag anschließen, in der Move-Zielauswahl alle Quellmahlzeiten ausschließen und Health-Connect-Synchronisation nur nach erfolgreichem Commit auslösen. Mobile schreibt keine Food Usage; Delete und Move erzeugen gemäß PO-3 keine Tracking-Änderung.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/05-authentication.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/nutrition/MoveItemSheet.tsx
- mobile/src/shared/api/diaryApi.ts
- mobile/src/shared/api/diaryApi.test.ts
- mobile/src/services/nutritionDiaryService.ts
- mobile/src/services/health/nutritionSyncService.ts
- mobile/src/shared/components/ConfirmSheet.tsx
- mobile/src/shared/components/Snackbar.tsx

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-6
- AC-8
- AC-9
- AC-10
- AC-11
- AC-13
- AC-15
- AC-17

Dependencies:
- F1
- B1 API-Handoff

Expected Handoff:
- Bulk Delete und Bulk Move senden je Nutzeraktion genau eine API-Anfrage.
- Einzel-Move verwendet denselben Endpoint mit genau einer Referenz und behält die bisherige Tages-/Zielmahlzeiten-Semantik bei.
- Bestehende Move-Ziele aus der vollständigen Quellmahlzeitenmenge sind in der UI nicht auswählbar; ein direkt gesendeter solcher Request wird vom Backend ohne Mutation abgelehnt.
- Bei Erfolg: Reload, Health-Connect-Sync der betroffenen IDs und Auswahlende.
- Bei Fehler: konkrete Meldung und Reload, keine Sync-Nebenwirkung und Erhalt gültiger Auswahl.

### F3. Copy-Aktionsfluss und Dokumentation

Agent: Frontend

Goal: Datums- und Auswahl einer einzelnen, expliziten Zielmahlzeit für die gesamte Auswahl integrieren, bei Neuanlage den atomaren `newMealType`-Pfad verwenden, den Einzel-Copy-Fluss auf denselben Snapshot-Copy-Endpunkt umstellen und die Mobile-Knowledge-Base aktualisieren. Copy-Usage wird nicht im Client erzeugt, sondern serverseitig durch B3 nach der bestätigten PO-3-Regel behandelt.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/nutrition/CopyItemSheet.tsx
- mobile/src/modules/nutrition/diaryItemUtils.ts
- mobile/src/modules/nutrition/diaryItemUtils.test.ts
- mobile/src/shared/api/diaryApi.ts
- mobile/src/shared/api/diaryApi.test.ts
- mobile/src/services/nutritionDiaryService.ts
- mobile/src/services/health/nutritionSyncService.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-6
- AC-7
- AC-10
- AC-11
- AC-12
- AC-13
- AC-15
- AC-16
- AC-18
- AC-19

Dependencies:
- F1
- F2 selection/action-bar integration
- B2 Copy-API-Handoff

Expected Handoff:
- Bulk Copy verwendet eine API-Anfrage und die vom PO bestätigte Zielmahlzeiten-Semantik
- Einzel-Copy verwendet denselben Snapshot-Endpunkt mit einer Item-Referenz
- Quelle bleibt unverändert; Zieltag wird nach erfolgreichem Copy nicht mit dem Quelltag verwechselt
- Keine clientseitige Food-Usage-Schreiblogik; Bulk- und Einzel-Copy verwenden die serverseitigen, in B3 spezifizierten quelltypspezifischen Tracking-Regeln
- `docs/kb/tech/03-mobile.md` beschreibt den aktuellen Auswahl- und Aktionsfluss

## 14. QA Work Package
Agent: QA

Goal: Alle User- und technischen Akzeptanzkriterien gegen Backend, Mobile, API-Vertrag, Persistenz und dokumentierte Grenzen prüfen; Ergebnisse in einem dauerhaften QA-Report festhalten.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/domain/03-food-catalog.md
- docs/kb/domain/06-recipes.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/05-authentication.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/diary.ts
- backend/src/functions/diary.test.ts
- backend/src/lib/recipeDiary.ts
- backend/src/lib/communityRecipes.ts
- backend/src/lib/repositories/diaryRepository.test.ts
- backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts
- backend/src/lib/repositories/userFoodRelationRepository.test.ts
- backend/src/lib/repositories/cosmosUserFoodRelationRepository.contract.test.ts
- backend/src/lib/repositories/reusableItemsRepository.ts
- backend/src/lib/repositories/reusableItemsRepository.test.ts
- backend/src/lib/repositories/recipesRepository.ts
- backend/src/test-utils/cosmosEmulator.ts
- shared/types/diary.ts
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/nutrition/diaryItemUtils.test.ts
- mobile/src/shared/api/diaryApi.test.ts
- mobile/src/services/health/nutritionSyncService.ts
- docs/qa/reports/README.md

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-1
- AC-2
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
- AC-14
- AC-15
- AC-16
- AC-17
- AC-18
- AC-19

Dependencies:
- B1, B2 und B3 abgeschlossen
- F1, F2 und F3 abgeschlossen
- Backend-, Domain-, API- und Mobile-Dokumentation aktualisiert

Expected Handoff:
- QA-Report im vom Orchestrator vorgegebenen `docs/qa/reports/`-Pfad im Format `fittrack-qa-v1`
- Kriterienmatrix für AC-1 bis AC-19, Testbefehle mit Exit-Code sowie getrennte `UNVERIFIED`-/manuelle Prüfpunkte
- AC-8 weist nach, dass ein bestehendes Ziel aus der Quellmahlzeitenmenge abgelehnt wird und keine Diary-Änderung auslöst.
- keine Einträge in `docs/qa/findings.md`; diese Datei gehört dem Orchestrator

## 15. Shared Package Changes

- `shared/types/diary.ts` erhält nur die API-Vertragstypen für `DiaryItemReference`, Bulk Delete/Move/Copy Requests und Responses. Der Copy-Zieltyp ist bestätigt: genau eine vorhandene Zielmahlzeit (`mealId`) oder ein `newMealType` für die atomare Neuanlage.
- Beim Move ist ein vorhandenes `mealId` nur gültig, wenn es nicht zu den Quellreferenzen gehört; diese querfeldliche Bedingung wird serverseitig validiert und erfordert keinen zusätzlichen Shared-Typ.
- `Meal` und `MealItem` werden nicht um persistente Felder erweitert. Keine Runtime-Validierung wird in das Shared-Paket verlagert; Request-Validierung bleibt im Backend bei Zod.
- Shared-Änderungen sind typ-only. Kein neuer Export von Runtime-Funktionen und keine Schema- oder Migrationsänderung.

## 16. Infrastructure and Configuration

**Persistence Impact:** Schema-neutral / Class 0: vorhandene Diary-, `UserFoodRelation`-, ReusableItem- und Recipe-Dokumente werden ausschließlich über bestehende Felder und Repository-Operationen aktualisiert. Es kommen keine Felder, Entitäten oder Container hinzu; bestehende Dev- und Alpha-Dokumente bleiben lesbar, keine Migration und kein Backfill. `usageDates` wird weder umgehängt noch rückwirkend korrigiert. Keine Änderung an `backend/src/lib/cosmos.ts` (`CONTAINER_DEFS`) oder `infra/modules/cosmos.bicep` ist geplant. Cosmos-Contract-Tests laufen ausschließlich gegen den Emulator.

- `Infrastructure Impact: Dev` bedeutet Ausführung und integrierte Prüfung im bestehenden Development-Setup mit lokalem Azure Functions Host und lokalem bzw. konfiguriertem Dev-Cosmos. Es wird keine Azure-Ressource angelegt oder umkonfiguriert.
- Keine neue Funktion-App, kein Bicep- oder Pipeline-Umbau und keine neue Mobile-Konfiguration.
- `Mobile Build Impact: None`: ausschließlich TypeScript/JavaScript. Keine nativen Module, Config Plugins oder `app.config.js`-Änderungen; kein neuer Dev Build erforderlich.
- Alpha verwendet nach der üblichen Freigabe dieselbe unveränderte Datenform. Ein Alpha-Rollout ist kein eigener Feature-Arbeitsschritt dieses Plans.
- Kein separates Infrastructure-&-Release-Work-Package: Es gibt keine Infrastrukturentscheidung oder Ressource zu implementieren; Development verwendet den bestehenden lokalen Laufzeitpfad.

## 17. Documentation Updates

Die Knowledge Base wird vor QA mit der implementierten, durch PO-1/PO-2/PO-3 bestätigten Semantik aktualisiert:

- `docs/kb/domain/02-diary.md`: Auswahlumfang, Item-/Meal-Semantik, bestätigtes Einzelziel beim Copy, Move-Ziel muss von allen Quellmahlzeiten verschieden sein, Move-/Copy-Snapshot-Verhalten und die bestätigte Lifecycle-Regel für Usage.
- `docs/kb/domain/03-food-catalog.md`: `UserFoodRelation`-Usage-Effekte je Quelltyp, Delete-/Move-Neutralität, Copy-Zieldatum/-mahlzeit und die Referenzklassifikation für bestehende MealItems.
- `docs/kb/domain/06-recipes.md`: Recipe-Usage-Zähler für Copy nach der bestehenden Owner-/Community-Auflösung sowie Verhalten bei nicht verfügbaren historischen Recipe-Snapshots.
- `docs/kb/tech/09-api-reference.md`: neue Routen, Request-/Response-Formen, Auth, Validierung einschließlich Ablehnung eines Move-Ziels aus der Quellmahlzeitenmenge, atomare Zielmahlzeit-Anlage sowie Konflikt-/Limit-Fehler.
- `docs/kb/tech/02-backend.md`: Diary-Bulk-Routen und Repository-/Transaktionsverantwortung.
- `docs/kb/tech/03-mobile.md`: lokaler Auswahlzustand, UI-Aktionen, Einzel-/Bulk-Endpunktnutzung und Health-Connect-Sync.
- `docs/kb/tech/04-shared-library.md`: nur falls dort die neuen geteilten API-Vertragstypen laut bestehender Dokumentationsstruktur aufgeführt werden.
- Die User-Story-Datei bleibt unverändert; dieser Plan ist das separate `PLAN_*.md`-Artefakt.

Backend aktualisiert API-/Diary-Dokumentation in B2 und Food-/Recipe-Usage-Dokumente in B3; Frontend aktualisiert Mobile-Dokumentation in F3. Alle betroffenen Dokumente müssen vor QA vorliegen.

## 18. Test Strategy

- **Backend Unit/Handler:** Happy Path und Validierungsfehler; authentifizierter Besitzer; fehlende/fremde IDs; ungültige Daten; doppelte/leere Referenzen; falsche Quell-/Zieltage; Zielmahlzeit-ID bzw. atomare Neuanlage; stabile Fehlercodes für Konflikt und Transaktionslimit.
- **Food Usage (B3):** Delete und Move verändern für alle Quelltypen keine `UserFoodRelation`-Historie und keine `ReusableItem`-/Recipe-Zähler; es gibt weder Decrement noch Reattribution oder Backfill. Copy prüft persönliche Reusable-Quellen (Personal-Relation und bedingter Reusable-Zähler), Open-Food-Facts-Quellen (Catalog-Relation, kein Produktzähler), Recipes (Relation des kopierenden Nutzers und Recipe-Eigentümerzähler nur bei bestehender Owner-/Community-Auflösung) sowie Items ohne Quellreferenz (kein Usage-Datensatz). Mehrere Kopien derselben Quelle zählen pro kopiertem Item einzeln. Jede Relation verwendet `targetMeal.date` und `targetMeal.type`.
- **Usage-Kompatibilität:** Tests klassifizieren anhand `recipeId` bzw. `sourceId` und belegen Legacy-Normal-Adds, deren gespeichertes `MealItem.sourceType` wegen des bestehenden Add-Handlers nicht zuverlässig den Request-Quelltyp enthält. Ein nicht verfügbares Recipe-Snapshot lässt sich weiterhin kopieren und erzeugt die Nutzer-Relation, aber keinen nicht auflösbaren Eigentümerzähler. Copy übergibt das explizite Zieldatum an die bestehende 90-Tage-`usageDates`-Fensterlogik.
- **In-Memory Repository:** Mehrere Quellmahlzeiten, Items aus derselben Quellmahlzeit, Move zu einem Ziel außerhalb der Quellmenge, Ablehnung eines Move-Ziels, das mit einer einzelnen oder einer von mehreren Quellmahlzeiten übereinstimmt, ohne irgendeine Diary-Änderung; leere Quellmahlzeit nach erfolgreicher Aktion, Snapshot-/Metadaten-Erhalt und keine Mutation bei ungültiger Gesamtauswahl oder simulierter Batch-Grenzüberschreitung.
- **Cosmos Contract:** Transaktion gegen den Emulator; Änderungen über mehrere Meals derselben `/userId`-Partition; Move-Ziel aus der Quellmenge wird ohne Teilcommit abgelehnt; ETag-Konflikt, ungültige Referenz und Transaktionslimit ohne Teilcommit; atomare Erstellung eines neuen Copy-Ziels; keine Änderung in fremder Partition; bestehende Meal-Dokumentform bleibt unverändert.
- **Mobile Selection:** Item an-/abwählen, Mahlzeit ganz auswählen/abwählen, Zwischenzustand, Kombination mehrerer Mahlzeiten, leere Mahlzeit, Reset bei Datumswechsel sowie Fehler-/Abbruchverhalten einschließlich konkreter Fehlermeldung, Reload und Erhalt gültiger Auswahl bei fehlgeschlagener Mutation.
- **Mobile API/Service:** Route und Payload der Bulk-Aufrufe; Move-Zielauswahl blendet alle Quellmahlzeiten aus; Einzel-Move/Copy als Ein-Referenz-Aufruf; Backend-Ablehnung eines direkt eingesandten Quellziels ohne Mutation; Tagesreload; Health-Connect-Sync erst nach Backend-Erfolg und nur für betroffene IDs.
- **Usage-Fehlergrenze:** Invalid-Reference-, ETag-Konflikt- und Cosmos-Limitfehler ändern keine Usage-Felder. Nach erfolgreichem Diary-Commit werden nur die bestätigten, quelltypspezifischen Copy-Nebenwirkungen angestoßen; ein Fehler in einem nachgelagerten Usage-Repository rollt den Diary-Commit nicht zurück.
- **Snapshot-Kopie:** Manuelles Item, Reusable Item mit zwischenzeitlich geänderten Quelldaten, AI Meal Estimate und Rezept-Snapshot; Original bleibt unverändert, Kopie erhält neue ID und bleibt normal editierbar.
- **Manuelle Mobile-Prüfung:** Auswahlzustände und Accessibility auf Android-Gerät/Emulator; Toolbar ohne Überdeckung der letzten Einträge; Bestätigungsdialog, Zielauswahl, Cancel und Fehlerhinweis. Nicht verfügbare Geräte-/Screenreader-Prüfungen im QA-Report als `UNVERIFIED` bzw. `MANUAL VALIDATION REQUIRED` aufführen.

Vorgesehene Gates:

- `cd backend && npx vitest run`
- `cd backend && npx vitest run --config vitest.contract.config.mts` (Cosmos-Emulator erforderlich)
- `cd backend && npm run build:verify`
- `cd shared && npx vitest run`
- `cd shared && npx tsc --noEmit`
- `cd mobile && npm test`
- `cd mobile && npm run typecheck`

Keine Prompt-Evals, AI-Kontingenttests oder externen Nutrition-Expertenprüfungen erforderlich.

## 19. Acceptance Criteria

Die folgenden AC-1 bis AC-10 übernehmen die Story und machen die Prüfung beobachtbar. AC-11 bis AC-16 ergänzen Backend-/Integrationsinvarianten und die bestätigte atomare Zielmahlzeit-Anlage. AC-17 bis AC-19 legen die bestätigte Food-Usage-Policy und ihre Quellenklassifikation fest.

1. **AC-1:** Im Tagebuch kann der Nutzer den Mehrfachauswahlmodus starten und über eine sichtbare Abbrechen-/Beenden-Aktion verlassen.
2. **AC-2:** Im Auswahlmodus kann jedes Item ein- und abgewählt werden; die Auswahl eines Items öffnet nicht dessen Editieransicht.
3. **AC-3:** Eine nicht ausgewählte Mahlzeit wählt alle ihre Items aus; eine vollständig ausgewählte Mahlzeit hebt alle ihre Items ab. Teilweise Auswahl ist sichtbar und leere Mahlzeiten erzeugen keine Item-Auswahl.
4. **AC-4:** Items aus mindestens zwei Mahlzeiten desselben dargestellten Tages können gemeinsam ausgewählt werden, auch zusammen mit einer Mahlzeitenauswahl.
5. **AC-5:** Auswahlanzahl sowie Item-, vollständiger Meal- und partieller Meal-Zustand bleiben visuell und für Accessibility eindeutig erkennbar.
6. **AC-6:** Jede der Aktionen Löschen, Verschieben und Auf anderen Tag kopieren kann genau einmal auf die vollständige aktuelle Auswahl gestartet werden; Löschen zeigt vor dem Commit eine gemeinsame FitTrack-Bestätigung.
7. **AC-7:** Nach erfolgreichem Kopieren existieren die Quell-Items unverändert weiter und sämtliche Kopien liegen am vom Nutzer explizit gewählten anderen Tag in genau einer Zielmahlzeit.
8. **AC-8:** Nach erfolgreichem Verschieben liegen alle ausgewählten Items am gewählten Ziel desselben Tages; nicht ausgewählte Items bleiben in ihren Quellen. Ein vorhandenes Ziel muss von jeder Quellmahlzeit der Auswahl verschieden sein; ein Ziel aus der Quellmenge wird mit `400 invalid_diary_bulk_request` und ohne Diary-Änderung abgelehnt. Eine neu angelegte Mahlzeit desselben Tages ist ein zulässiges Ziel.
9. **AC-9:** Nach erfolgreichem Löschen sind ausschließlich die ausgewählten Items entfernt. Meal-Dokumente und nicht ausgewählte Items bleiben bestehen; auch eine dadurch leere Mahlzeit wird nicht als Ganzes gelöscht.
10. **AC-10:** Erfolg oder expliziter Abbruch beendet den Auswahlmodus und leert die Auswahl. Bei jedem fehlgeschlagenen atomaren Request bleibt der Auswahlmodus aktiv, die App zeigt einen konkreten Fehler und lädt den angezeigten Quelltag neu; nach dem Reload bleiben gültige ausgewählte Referenzen markiert und nicht mehr vorhandene Referenzen werden entfernt.
11. **AC-11:** Backend-Mutationen sind authentifiziert, prüfen alle Quellen/Ziele im Token-Nutzerkontext und weisen ungültige oder fremde Referenzen ohne Datenänderung zurück.
12. **AC-12:** Jede Kopie hat eine neue Item-ID, übernimmt den gespeicherten MealItem-Snapshot und dessen Herkunfts-/Rezept-/AI-Metadaten ohne Live-Neuberechnung; die Kopie lässt sich wie ein normales Tagebuch-Item bearbeiten.
13. **AC-13:** Bulk Delete, Move und Copy sind jeweils all-or-nothing über alle betroffenen Diary-Meals. Ungültige Referenzen, ETag-/Schreibkonflikte und Cosmos-Transaktionsgrenzen führen zu null Diary-Änderungen und einem stabilen dokumentierten Fehlercode; es gibt keine Teilaktionen.
14. **AC-14:** Cosmos-Dokumentform, Partition Key und Container bleiben unverändert; bestehende Dev-/Alpha-Daten benötigen keine Migration und werden von den neuen Lese-/Schreibpfaden unterstützt.
15. **AC-15:** Health-Connect-Synchronisation erfolgt erst nach erfolgreichem Diary-Commit und nur für betroffene Einträge. Ein fehlgeschlagener oder abgelehnter Bulk-Request löst keine Health-Connect-Synchronisation aus. Food Usage wird separat nach AC-17 geprüft.
16. **AC-16:** Wird beim Bulk-Copy über den vorhandenen „Mahlzeit anlegen“-Pfad eine neue Zielmahlzeit gewählt, werden Zielmahlzeit und sämtliche Kopien gemeinsam atomar erstellt. Scheitert die Transaktion, existieren weder Kopien noch ein neu angelegtes leeres Zielmahlzeit-Dokument.
17. **AC-17:** Bulk- und Einzel-Delete sowie Bulk- und Einzel-Move ändern keine bestehende `UserFoodRelation`-Usage, kein `ReusableItem.usageCount` und kein `Recipe.usageCount`; sie erzeugen auch keine neue Usage. Move attribuiert keine frühere Usage um. Frühere Historie bleibt unverändert und wird nicht rückwirkend bereinigt.
18. **AC-18:** Nach erfolgreichem Copy wird für jedes referenzierte kopierte Item genau eine neue `UserFoodRelation`-Usage mit Zieldatum und Zielmahlzeit aufgezeichnet. Persönliche Reusable-Quellen aktualisieren zusätzlich `ReusableItem.usageCount` nur unter den bestehenden Add-Auflösungsbedingungen; Open Food Facts aktualisiert keinen eigenen Produktzähler; Recipes aktualisieren `Recipe.usageCount` beim Eigentümer nur, wenn die bestehende Owner-/Community-Auflösung gelingt. Ein nicht verfügbares Recipe-Snapshot bleibt kopierbar, erzeugt die Relation des kopierenden Nutzers und aktualisiert keinen nicht auflösbaren Eigentümerzähler. Items ohne Food-/Recipe-Referenz erzeugen keinen synthetischen Usage-Datensatz.
19. **AC-19:** Die Copy-Quellklassifikation funktioniert auch mit bestehenden Diary-Dokumenten, in denen `sourceType` bei normalen Adds nicht durchgängig gespeichert wurde: Recipe wird über `recipeId`, Catalog über das `openFoodFacts:`-Präfix und persönliche Reusable-Quellen über die übrige `sourceId` erkannt. Es werden keine Dokumentfelder, Container oder rückwirkenden Datenkorrekturen benötigt. Für fehlgeschlagene Diary-Commits werden keinerlei Usage-Felder geändert; nach erfolgreichem Commit bleiben Usage-Schreibvorgänge best effort.

## 20. Risks and Edge Cases

- Die bestätigte Copy-Semantik verlangt genau eine ausdrücklich gewählte Zielmahlzeit. Die UI darf weder anhand der Quellmahlzeit noch anhand des Typs ein Ziel stillschweigend auswählen.
- Die heutige Add-then-delete-Move-Sequenz kann bereits zusätzliche Usage-Zähler/Historie erzeugt haben. Neue Moves schreiben keine Usage; vorhandene historische Nebenwirkungen bleiben ohne rückwirkende Korrektur bestehen.
- `usageDates` enthält Datum und Mahlzeitstyp, aber keine Diary-Item-ID. Move kann daher keine einzelne frühere Verwendung sicher umhängen; bestehende Relationseinträge bleiben unverändert.
- Der normale Add-Handler persistiert `sourceType` nicht zuverlässig, obwohl er ihn zur initialen Usage-Zuordnung verwendet. B3 muss `recipeId` und `sourceId` samt `openFoodFacts:`-Präfix auswerten und Legacy-Items testen, statt ausschließlich auf `sourceType` zu vertrauen.
- Ein Recipe-Snapshot kann nach Entzug der Community-Veröffentlichung oder Löschung weiterhin als gespeicherter Snapshot kopierbar sein. Die Relation des kopierenden Nutzers kann getrackt werden; `Recipe.usageCount` wird nur aktualisiert, wenn die bestehende Owner-/Community-Auflösung einen Eigentümer liefert.
- `recordUsage()` hält `usageDates` in einem 90-Tage-Fenster relativ zum übergebenen Diary-Datum. Beim Kopieren auf ein historisches Zieldatum ist diese bestehende Fensterlogik anzuwenden; Tests müssen das Ziel- statt Quell- oder aktuelle Datum prüfen.
- Die Food-Usage-Aufzeichnung ist eine nachgelagerte Best-Effort-Nebenwirkung und nicht Teil der Diary-Transaktion. Ein Usage-Repository-Fehler darf keinen bereits erfolgreichen Diary-Commit rückgängig machen; ein fehlgeschlagener Diary-Commit darf dagegen keine Usage auslösen.
- Eine Tagesauswahl kann viele Items und separate Meal-Dokumente umfassen. Cosmos-Grenzüberschreitungen werden vollständig und ohne Mutation abgelehnt; die Auswahl wird nicht in Teilaktionen zerlegt.
- ETag-Konflikte durch gleichzeitige Bearbeitung müssen als fehlgeschlagene atomare Aktion sichtbar werden; veraltete Client-Nährwerte dürfen nicht als Quelle dienen. Nach Fehler bleiben Modus und gültige Auswahl für Korrektur/Wiederholung erhalten, während die Tagebuchansicht neu geladen wird.
- Die bisherige Risikonotiz zu einem Move-Ziel gleich einer Quellmahlzeit widersprach dem bestätigten Einzel-Move-Verhalten. Ein vorhandenes Ziel aus der Quellmenge ist unzulässig und wird vor jeder Mutation abgelehnt; es gibt daher weder No-op-/Duplikatsemantik für bereits dort liegende Items noch ein Teilverschieben aus den übrigen Quellmahlzeiten.
- Der heutige Client-Copy-Pfad weicht bei Reusable Items vom dokumentierten Snapshot-Prinzip ab und verliert im flachen Pfad teils Metadaten. Der neue serverseitige Copy-Pfad muss diese Abweichung vermeiden; Einzel- und Bulk-Copy teilen denselben Endpunkt.
- Health Connect referenziert Items über deren IDs. Move erhält das bestehende Einzelverhalten mit neuen Ziel-IDs und synchronisiert erst nach Backend-Commit; Copy synchronisiert die neuen IDs, Delete entfernt die ausgewählten IDs.
- Refresh und Datumswechsel können die lokale Auswahl veralten lassen. Referenzen werden anhand der geladenen Mahlzeiten normalisiert; beim Datumswechsel wird die Auswahl beendet. Die separate Mahlzeit-Anlage des bestehenden Einzel-Copy-Flows darf im Bulk-Copy nicht vor der atomaren Kopie ausgeführt werden.
- Eine Bestätigung darf weder ein ganzes Meal-Dokument löschen noch nicht ausgewählte Items einschließen.

## 21. Recommended Execution Order

Die Ausführung bleibt strikt sequenziell. Diese Planfassung wurde vom Nutzer am 2026-10-05 ausdrücklich freigegeben; der genehmigte Scope sowie PO-1, PO-2 und PO-3 bleiben unverändert. Die ursprünglichen Implementierungs-Work-Packages F1, B1, B2, F2, F3 und B3 sind abgeschlossen. Die blockierenden QA-Korrekturen AC-10 und AC-8 sowie die Follow-ups `FT-QA-2026-058`, `FT-QA-2026-059`, `FT-QA-2026-060` und `FT-QA-2026-061` sind implementiert, verifiziert und geschlossen. Die 061-Tests prüfen, dass eine Referenz von Nutzer B im Kontext von Nutzer A dasselbe Not-found-Verhalten wie eine unbekannte Referenz hat und dass ein gemischter Request mit gültiger A- und fremder B-Referenz beide Tagebücher unverändert lässt. Das finale QA-Review hat `PASS` für AC-1 bis AC-19 ergeben. Backend: 1,248 Tests bestanden; Shared: 450 Tests bestanden; Mobile: 631 Tests im vorherigen vollständigen Lauf bestanden. Backend-Typecheck und Build-Verifikation bestanden. Die Cosmos-Contract-Ausführung bleibt `UNVERIFIED`, da der Emulator unter `127.0.0.1:18081` nicht erreichbar war und 17 Contract-Tests vor den Assertions übersprungen wurden. Android/TalkBack bleibt `MANUAL VALIDATION REQUIRED`; `adb` ist nicht verfügbar. Es erfolgte kein Azure-Deployment und kein Alpha-Release. Die Move-Zielregel bleibt unverändert: ein bestehendes Ziel darf keiner Quellmahlzeit entsprechen.
