# PLAN US-11 - Community-Rezepte veroeffentlichen und entdecken

Status: Approved - automatisch gemaess Nutzerauftrag, da keine offenen PO-Entscheidungen vorliegen. Umsetzung noch nicht begonnen.
Infrastructure Impact: Alpha
Mobile Build Impact: None

Erstellt: 2026-10-03
User Story: [US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md](US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md)

## Open Product Owner Decisions

Keine blockierenden PO-Rueckfragen. Die neun Produktentscheidungen und alle 17 Akzeptanzkriterien der Story werden unveraendert umgesetzt. Automatische Freigabe ist eine Planfreigabe, kein Implementierungs-, QA- oder Deployment-Nachweis.

## 1. Requirement Assessment

Classification: Accept as proposed

- Nutzerproblem: Rezepte bewusst innerhalb der angemeldeten Community zugaenglich machen, ohne private Inhalte unbeabsichtigt freizugeben oder Lebensmittelkopien anzulegen.
- Product Fit: bestehende Rezeptverwaltung, Favoritenreferenzen und portionsbasierte Tagebuch-Snapshots wiederverwenden; keine neue Top-Level-Navigation.
- Domain Validity: bestehende serverseitige Rezeptberechnung und Snapshot-Regeln beibehalten. Herkunftshinweise sind keine Qualitaetsbewertung oder Ernaehrungsempfehlung.
- Health Risk: manuelle und KI-basierte Werte erkennbar machen, aber weder Genauigkeit noch Verifikation behaupten. Historisch unbekannte Herkunft nicht als manuell oder OFF ausgeben.
- Simplicity: Originalrezept bleibt die einzige Quelle. Kein Community-Spiegelcontainer, keine Zutatenkopie und kein eigenes Moderationssystem.
- Cross-Feature Impact: Favoriten und FoodEntryHub sind betroffen, weil ihr aktueller Schnelleintrag mit denormalisierten Naehrwerten die neue Zugriffskontrolle sonst umgehen koennte.
- AI Necessity: keine neuen KI-Aufrufe, Prompts, Klassifikatoren oder Quotas. Herkunft und Zugriff werden deterministisch ausgewertet. Bestehende Eigentuemer-KI-Flows bleiben unveraendert.

## 2. Feature Summary und Scope

Im Recipes-Stack gibt es die Bereiche `Deine Rezepte` und `Community-Rezepte`. Standard beim neuen Oeffnen der Uebersicht ist `Deine Rezepte`; die Rueckkehr aus einem Detail darf den aktuellen Bereich und die Scrollposition erhalten. Eigene private und veroeffentlichte Rezepte bleiben in der persoenlichen Liste.

Eigentuemer veroeffentlichen explizit, bestaetigen die Inhaltsfreigabe und waehlen pro Veroeffentlichung eine standardmaessig ausgeschaltete Anzeigenamenfreigabe. Andere angemeldete Nutzer sehen gespeicherte Rezeptinhalte, Hinweise, freigegebenen Namen oder exakt `Anonymous`, koennen favorisieren und portionsweise protokollieren.

In Scope: Shared-Vertraege, RecipesRepository mit beiden Implementierungen, HTTP-Handler, Profilprojektion, gesicherter Community-Bildabruf, Favoriten-/Recent-Projektion, Rezept-Snapshot-Pfade, mobile Liste/Detail/FoodEntryHub, Tests, KB und Release-Nachweise.

Out of Scope: Rezept- oder Zutatenkopien, oeffentlicher Webzugriff, neue Moderation/Admin-UI, Instagram-Freigabe fuer fremde Rezepte, neue AI-Features, neue native Module, neue Azure-Ressourcen oder Resource Groups. Keine Erweiterung der Eigentuemerrechte auf fremde private Daten. Kein Umbau allgemeiner manueller Tagebucheintraege.

## 3. Current Behaviour und bestaetigte Fakten

Repository-Pruefung am 2026-10-03: keine bestehende Plan-Datei oder Implementierung fuer US-11 gefunden; Suche nach `US-11`, Community-Rezepten und entsprechenden Dateinamen liefert nur die User Story.

- `shared/types/recipes.ts`: `RecipeVisibility` ist ausschliesslich `private`; Zutaten besitzen `isAiEstimate`, aber keinen verlaesslichen allgemeinen Herkunfts-Snapshot.
- `backend/src/lib/repositories/recipesRepository.ts` und `cosmosRecipesRepository.ts`: Create setzt privat; Reads und Writes sind eigentuemergebunden. Cosmos nutzt unveraendert `/userId`. ETags und Compare-and-Replace existieren bereits.
- `backend/src/functions/recipes.ts`: eigene Liste, Detail und Log verwenden die Nutzerpartition. Log speichert Name, Portion, `recipeId`, `recipePortions` und skalierte Naehrwerte im Tagebuch des aufrufenden Nutzers.
- `backend/src/functions/favorites.ts`: `foodRefType: 'recipe'` existiert bereits. Der aktuelle Add-Favorite-Handler prueft jedoch keine Rezeptberechtigung und akzeptiert Client-Anzeigedaten/Naehrwerte.
- `mobile/src/modules/nutrition/hub/FoodEntryHub.tsx`: Direct-Add sendet Rezeptreferenzen mit Client-Naehrwerten an `diaryApi.addItem`; Rezeptreferenzen werden auch wie persoenliche Lebensmittel fuer die Auswahl aufgebaut.
- `backend/src/functions/diary.ts`: der generische Add-Item-Pfad akzeptiert `sourceType: 'recipe'`, prueft aber kein Originalrezept und kann auf Client-Naehrwerte zurueckfallen. Deshalb reicht eine Aenderung von `recipes.log` allein nicht aus.
- `mobile/src/modules/recipes/ingredientBuilders.ts`: auch Bibliothekskandidaten landen in `linkedProductId`, `linkedReusableItemId` bleibt null und `buildFromProduct` setzt `isAiEstimate: false`. Eine Bibliotheks-ID allein beweist keine manuelle Herkunft.
- `backend/src/functions/foodSearch.ts`: Bibliothekssuche kennt `ReusableItem.sourceType` und liefert bei KI-Artikeln bereits `isAiEstimate`; persoenliche Quelldaten sind serverseitig vorhanden.
- Profil-Anzeigename ist optional (`shared/types/profile.ts`); `ProfileRepository.get(ownerUserId)` existiert.
- `backend/src/lib/storage.ts`: Rezeptbilder liegen in privaten Blobs; bestehende Eigentuemerantworten enthalten eine Stunde gueltige SAS-URLs. `downloadRecipeImage` kann ein autorisiertes Bild bereits direkt und auf 8 MB begrenzt laden.

### KB-Abweichungen und notwendige Aktualisierung

Die KB beschreibt Rezepte aktuell zutreffend als privat. Diese Aussage wird erst mit der Implementierung angepasst. Zusaetzlich nennt `docs/kb/domain/03-food-catalog.md` fuer `ReusableItem.sourceType` auch `recipe`; der aktuelle Shared-Typ erlaubt nur `manual | openFoodFacts | ai | label-scan`. Fuer diesen Plan gilt der Shared-Typ als aktueller Vertrag. Die betroffene Herkunftsbeschreibung ist bei der Dokumentationsarbeit zu korrigieren, nicht durch eine neue `recipe`-Zutatenquelle zu implementieren.

## 4. Technische Festlegungen und Annahmen

- Der Anzeigename wird bei berechtigtem Lesen aus dem aktuellen FitTrack-Profil ermittelt, nicht als Namenskopie gespeichert. Nur die Freigabe fuer dieses Rezept wird persistiert. Fehlendes Profil, fehlender oder leerer Name ergibt `Anonymous`; Infrastrukturfehler werden nicht als fehlendes Profil verschleiert.
- Privatstellen beendet die aktuelle Namensfreigabe. Bei erneuter Veroeffentlichung wird erneut explizit gefragt, initial ohne Haken. Die Inhaltsbestaetigung bei jeder Veroeffentlichung ist eine konservative Wiederverwendung desselben Dialogs und erfuellt die vorgeschriebene erstmalige Bestaetigung.
- Community-Liste zeigt alle explizit veroeffentlichten Rezepte, einschliesslich eigener. Es gibt kein zusaetzliches Ranking-, Such-, Filter- oder Moderationsprodukt. Technische Pagination begrenzt Ressourcenverbrauch.
- Bereits ausgelieferte Inhalte oder vom Leser angefertigte Kopien koennen nicht rueckwirkend geloescht werden. Widerruf verhindert neue autorisierte Abrufe und neue Rezeptprotokollierungen nach dem Widerruf; er ist keine Fernloeschung auf fremden Geraeten.
- Requests lesen Berechtigung und Naehrwerte aus derselben aktuellen Rezeptrevision. Die Autorisierungspruefung ist der Entscheidungszeitpunkt fuer einen bereits laufenden Request. Es wird keine atomare Transaktion zwischen der Eigentuemerpartition und dem Tagebuch eines anderen Nutzers behauptet.

Diese Festlegungen betreffen Umsetzung und Datenschutz, nicht neue Produktfunktionen. Falls die Implementierung eine hiervon abweichende Produktentscheidung benoetigt, nur das betroffene Arbeitspaket stoppen und dem PO vorlegen; nicht stillschweigend erweitern.

## 5. Bestehende Komponenten wiederverwenden

- `requireUser`, `withHandler`, `parseBody` und strukturierte Logs.
- `RecipesRepository`, ETags/Compare-and-Replace und In-Memory-/Cosmos-Auswahl.
- `ProfileRepository`, `ReusableItemsRepository`, vorhandener OFF-Katalogzugriff.
- `UserFoodRelationRepository`, `foodRefType: 'recipe'`, Favoritenentfernung und Nutzungshistorie mit explizitem Tagebuchdatum.
- Rezeptberechnung und bestehende Rundung im Recipe-Log; gespeicherte `MealItem`-Snapshots.
- `RecipeListScreen`, `RecipeDetailScreen`, `RecipeImageHeroImage`, `LogRecipeModal`, `recipeLoggingViewModel`, API-Client mit zentraler Token-Erneuerung.
- `ConfirmSheet`, `InfoOverlay`, Theme-Tokens, gemeinsame Icons und vorhandene Testdateien.
- `downloadRecipeImage`: kein externer Download anhand einer Client-URL und kein SAS-Redirect fuer Community-Bilder.

## 6. Shared- und Persistenzmodell

### Rezepte

- `RecipeVisibility = 'private' | 'community'`. Nur exakt `community` gewaehrt Community-Zugriff; fehlende oder unbekannte gespeicherte Werte werden privat projiziert.
- Optionales Rezeptfeld `communityPublication?: { contentConfirmedAt: string; displayNameConsent: boolean }`. Zeitpunkt ist server-owned. Privatstellen entfernt die aktive Publication-Metadaten bzw. setzt sie inaktiv; Reads muessen den Widerruf eindeutig abbilden. `sharedWithUserIds` bleibt reserviert und gibt keinerlei Community-Berechtigung.
- Optionales `RecipeIngredient.nutritionSource?: 'openFoodFacts' | 'manual' | 'ai' | 'label-scan' | 'unknown'`, als Snapshot der Naehrwertherkunft, unabhaengig von `food | seasoning` und Eingabeeinheit.
- Bestehendes `isAiEstimate: true` bleibt ein verlaesslicher positiver KI-Nachweis. Unbekannte Altzutaten werden nicht pauschal manuell. Ein automatisch aus Rezepttext erkannter Gewuerzeintrag ohne geschaetzte Naehrwerte ist nicht allein wegen des Parsings eine KI-Naehrwertschaetzung.

### Community-Projektion

Separater Shared-DTO `CommunityRecipe` statt ungefilterter `Recipe`-Serialisierung. Felder: `id`, `name`, optionale `description`, `portions`, projizierte `ingredients`, `steps`, `images`, `nutritionTotal`, `nutritionPerPortion`, `tags`, `createdAt`, `updatedAt`, `authorDisplayName`, `isOwnRecipe` und `ingredientNotices: { containsAiEstimates: boolean; containsManualIngredients: boolean }`.

Zutatenprojektion enthaelt Identitaet innerhalb des Rezepts, Namen, Mengen/Einheiten, saisoning-/portionbezogene Anzeigefelder, Naehrwerte und Herkunftshinweise. Sie enthaelt keine privaten `linkedReusableItemId` oder `linkedProductId`; alle benoetigten Werte kommen aus dem Rezept-Snapshot. Bildprojektion enthaelt `id`, `order`, effektives `heroCrop` und transienten geschuetzten API-Pfad, niemals `blobName` oder SAS-URL. Nicht enthalten: `ownerUserId`, Partition, `sharedWithUserIds`, Consent-Zeitpunkte, Profilfelder, Nutzungshistorie und Exportansicht/Fingerprints.

Favoriten behalten `foodRefType: 'recipe'` und `foodRef = recipe.id`. Keine neue Entitaet oder Rezeptkopie. Optionales response-only `recipeAccess: 'owner' | 'community' | 'unavailable'` auf der Rezeptrelation zeigt dem Hub die sichere Auswahl-/Entfernungsmoeglichkeit. Nicht in Cosmos speichern. Alte Clients duerfen auch bei fehlender Kenntnis dieses Feldes keine Serverpruefung umgehen.

### Persistence Impact

- Visibility-Readdefault und fehlende Consent-Metadaten: Class 1, read compatibility. Fehlend bedeutet privat bzw. keine Namensfreigabe.
- Publication-Metadaten und optionaler Herkunfts-Snapshot: Class 0, keine globale Migration oder Pflicht-Backfill. Alte Zutaten bleiben ohne belegte Herkunft lesbar; auf normalem Edit keine erfundene Herkunft schreiben.
- Neue, geaenderte oder neu zugeordnete Zutaten erhalten den bestaetigten Herkunfts-Snapshot. Unveraenderte alte Zutaten behalten unbekannte Herkunft; aktueller Bibliotheksinhalt darf nicht rueckwirkend die historische Herkunft ersetzen.
- Vorhandene `recipes`, `userFoodRelations` und Tagebuchcontainer weiterverwenden; keine neuen Container und keine Aenderung an `/userId`, `CONTAINER_DEFS` oder Bicep erforderlich.
- Community-Rezepte werden im bestehenden Container gezielt cross-partition gelesen. Dies ist eine begruendete Erweiterung des bisherigen eigentuemergebundenen Lesemodells, keine Lockerung seiner Schreibpfade. Keine Replikation privater Daten in einen gemeinsamen Spiegel.
- Contract-Tests mit Legacy-Dokumenten und zwei Nutzerpartitionen sind Pflicht. Dev und Alpha getrennt validieren, ohne Datenmigration. Rollback auf ein altes Backend wuerde die Community-Funktion unzugaenglich machen; daher Rollout-/Rollback-Builds koordinieren.

## 7. API und Autorisierung

Alle nachfolgenden Routen verlangen `requireUser`; Azure Functions `authLevel: 'anonymous'` ist keine anonyme Produktberechtigung.

| Route | Vertrag und Zugriff |
|---|---|
| `GET /api/recipes` | Unveraendert nur eigene Rezepte, privat und community; Eigentuemermodell mit aktuellem Sichtbarkeitsstatus. |
| `GET /api/recipes/{id}` | Unveraendert nur Eigentuemerdetail. Fremde Community-Details ueber die eigene Community-Route. |
| `PUT /api/recipes/{id}/visibility` | Eigentuemer-only. Strict Body: privat `{ visibility: 'private' }`; community `{ visibility: 'community', confirmContentSharing: true, displayNameConsent: boolean }`. Server setzt Publication-Zeitpunkt; unbekannte/fehlende Pflichtfelder 400. 200 mit aktuellem Eigentuemermodell und ETag. |
| `GET /api/community-recipes?limit=20&continuationToken=...` | 200 `{ recipes: CommunityRecipe[], continuationToken?: string }`; nur explizit community. Limit ganzzahlig 1..50, sonst 400. Opaque Continuation-Token; invalides Token 400. |
| `GET /api/community-recipes/{id}` | 200 `CommunityRecipe`; privat, geloescht, fehlend 404 mit derselben Fehlerform. Keine Existenz-/Eigentuemerinformation fuer fremde private IDs. |
| `GET /api/community-recipes/{id}/images/{imageId}` | 200 Bildbytes, erlaubter JPEG/PNG Content-Type, `Cache-Control: no-store`; vor jedem Abruf Recipe und Image-Zugehoerigkeit pruefen. Fehlender Zugriff oder Bild 404; ohne Anmeldung 401. Kein Redirect/SAS. |
| `POST /api/recipes/{id}/log` | Body bleibt `{ portions, mealId }`; erweitert auf eigenes oder aktuell community Rezept. Recipe serverseitig aufloesen, Meal gehoert Aufrufer. Bestehende Antwort `Meal` und Rundung beibehalten. |
| `POST /api/favorites` mit `foodRefType: 'recipe'` | Rezeptzugriff pruefen; Anzeigename/Referenzmetadaten serverseitig ableiten, Client-Naehrwerte sind keine Autoritaet. 201 Relation. Privat/fremd/geloescht 404; keine Anlage bei verweigertem Zugriff. Andere FoodRef-Arten unveraendert. |
| `DELETE /api/favorites/{foodRef}` | Eigene Relation kann auch nach Rueckzug geloescht werden, ohne Zugriff auf das Original zu verlangen. |
| Favoriten-/grouped-/recent-/frequent-Reads | Rezeptrelationen fuer aktuellen Aufrufer aufloesen und `recipeAccess` projizieren. Nicht verfuegbare Referenz darf entfernbar bleiben, aber keine alten Zutaten, Bilder oder zum neuen Logging nutzbaren Naehrwerte liefern. |

### Repository-Abgrenzung

Bestehende `get(userId, id)`-/Write-Methoden nicht zu globalen Reads umdefinieren. Ergaenzen: paginiertes `listCommunity` und gezieltes `getCommunityById`. Cosmos-Query parametrisiert, Filter `c.visibility = 'community'` und `c.id = @id`, Owner-Partition nur serverintern aus gefundenem Dokument. Kein vom Client geliefertes `ownerUserId` als Berechtigung.

Community-Liste nach `updatedAt DESC`, single-field Index und Cosmos-Continuation nutzen; nicht `fetchAll` auf den Gesamtbestand. In-Memory bildet Limits, Fortsetzung und Filtersemantik gleichwertig ab. Bei mehrdeutigen historischen IDs fail closed, statt beliebige Eigentuemer zu waehlen. Bei einem Detail-/Logzugriff keine zuvor gecachte Liste oder Favoritenrelation als Berechtigungsquelle verwenden.

Ein kleiner gemeinsamer Backend-Resolver laedt zuerst das eigene Rezept, sonst das explizit veroeffentlichte Rezept. Er liefert serverintern Original und Owner fuer Detailprojektion/Logging. Mutationen, Bilderverwaltung, Exportvorbereitung, Instagram-/Share-Bundle-Handler und bestehende AI-Scale-Pfade bleiben owner-only. Community-Aufrufer erhalten keine freigeschalteten Export- oder Verwaltungsaktionen. Bei eigenen Community-Karten kann die App ins Eigentuemerdetail wechseln.

Visibility-Write nutzt ETag/Compare-and-Replace wie Recipe-Update: optionales Client-`If-Match` pruefen, internen Read immer konditional ersetzen; Konflikt 412 `recipe_revision_conflict`, keine automatische Wiederveroeffentlichung aus einem veralteten Draft. Generische Create-/Update-Bodies duerfen weder Visibility noch Consent einschleusen; neue Felder dort explizit zurueckweisen. Normale Inhaltsupdates erhalten die bestehende Freigabe unveraendert.

### Tagebuch und Schnelleintrag

- Beide Rezept-Eintragspfade verwenden denselben autorisierten Rezept-Snapshot und dieselbe bestehende Berechnung. Name/Naehrwerte stammen nie aus der Favoritenrelation.
- Generischer `POST /api/diary/meals/{id}/items`: fuer `sourceType: 'recipe'` ist `productId` als Rezeptreferenz erforderlich. Vor jedem Client-Naehrwert-Fallback in den gemeinsamen Rezeptpfad verzweigen. Fehlende Referenz 400, nicht verfuegbares Rezept 404.
- Legacy-Input mit `inputMode: 'portion'` nutzt die eingegebenen Portionen; `grams` wird anhand der aktuellen gespeicherten Gesamtzutatenmasse pro Portion in Portionen umgerechnet. Die vorhandene Quick-Entry-Gewichtsregel aus `recipeUtils.ts` kompatibel wiederverwenden (inklusive vorhandener Fallback-Regel), nicht neue Naehrwertformeln erfinden. Gleiche Bounds wie Recipe-Log, keine Client-`portion.weightGrams` als Autoritaet.
- Nicht als `sourceType: 'recipe'` markierte Referenzen, die ausschliesslich eine fremde Rezeptrelation bezeichnen, duerfen nicht ueber persoenliche Produkt-Fallbacks erneut geladen/protokolliert werden. Rezeptreferenzen in Relation- und Quantity-Auswahl nicht als persoenliche Lebensmittel umetikettieren.
- Unverbundene manuelle Eintraege bleiben moeglich; selbst getippte Werte sind keine nachtraegliche Originalrezept-Leseberechtigung.
- Ergebnis im Tagebuch des Aufrufers: `sourceType: 'recipe'`, `recipeId`, `recipePortions`, Name, Portion und aktuelle Naehrwerte. Bestehende Historie wird bei Edit, Widerruf und Loeschung niemals neu berechnet.
- Recipe-Usage auf der tatsaechlichen Owner-Partition aktualisieren, nur nach erfolgreichem Diary-Write. UserFoodRelation-Usage im aufrufenden Nutzerkontext mit Datum der Zielmahlzeit aufzeichnen. Zaehlerschreibvorgaenge duerfen keine widerrufene Visibility wiederherstellen.
- Tagebuch-Kopie/Verschieben existierender Snapshots bleibt historische Tagebuchbearbeitung und benoetigt kein Originalrezept. Ein neuer Eintrag ueber eine Originalrezept-/Favoritenreferenz verlangt hingegen immer aktuellen Zugriff.

### Zutatenherkunft

Beim Create und beim Austausch/Neuzuordnen einer Zutat verknuepfte Quelle serverseitig aufloesen: persoenlicher Artikel nur in der Owner-Partition, OFF nur im vorhandenen Katalog. Die heutige historische Nutzung von `linkedProductId` auch fuer Bibliotheks-IDs beruecksichtigen. Neue Builder setzen die richtigen Links und erhalten `isAiEstimate` fuer AI-Bibliotheksartikel.

Snapshot-Werte leiten sich aus belegter Quelle ab: OFF-Katalog oder Bibliothek `openFoodFacts` -> OFF; Bibliothek `manual` -> manual; Bibliothek `ai` oder explizit bestaetigte AI-Schaetzung -> ai; `label-scan` bleibt eigene belegte Herkunft, nicht als manuell oder AI-Naehrwertschaetzung umdeuten. Fehlende Quelle -> unknown. Ein expliziter manueller No-Link-Input benoetigt die deklarierte manuelle Quelle; Null-Links allein genuegen nicht.

Neue widerspruechliche Provenienz/AI-Flags nicht stillschweigend akzeptieren; bei historischen Widerspruechen bekannte positive AI-Information nicht verstecken. Create/Update-Validierung und Projektion muessen denselben getesteten Resolver verwenden. Kein nachtraeglicher KI-Klassifikator und kein Match allein nach Zutatenname.

## 8. Mobile-Verhalten

- Bestehende Liste bekommt zwei zugaengliche Tabs/Segmentbereiche. Persoenliche Liste behaelt Favoriten und letzte Verwendung; Community-Liste zeigt begrenzt geladene Eintraege mit Nachladen, Refresh, Empty-/Loading-/Retry-Zustaenden.
- Eigentuemer sehen `Privat`/`Community` sowie eine getrennte Aktion zur Sichtbarkeit. `ConfirmSheet` oder vorhandene app-eigene Entscheidungssheet-Struktur zeigt die konkret freigegebenen Inhalte; Checkbox fuer Namen initial aus. Kein `Alert.alert` fuer diesen neuen Produktflow.
- Community-Detail verwendet eigene API/DTO und denselben Inhalts-/Naehrwertrenderer soweit passend, nicht einen unsafe Cast zu `Recipe`. Zeigt Name/Beschreibung/Portionen/Zutaten/Zubereitung/Naehrwerte/Bilder, Autor und exakt die geforderten positiven Hinweise.
- Fremde Details haben Favorit und Portion-eintragen, aber weder Edit/Delete/Image-Management noch Instagram-Share oder AI-Exportvorbereitung. Die owner-only AI-Scale-Steuerung wird dort nicht gestartet; gespeichert angezeigte Inhalte bleiben Originalinhalt. Eigene Detailfunktionen bleiben erhalten.
- Community-Bilder ueber den zentral authentifizierten API-Client laden und als fluechtigen Bild-Source darstellen; Token-Refresh bleibt zentral. Keine Tokens in URL, DTO, Logs oder Persistenz; keine dauerhaften Bilddateien. `RecipeImageHeroImage` fuer den vorhandenen Crop wiederverwenden. Bereits vorhandene binaere Response-Verarbeitung als Muster verwenden, keine neue native Abhaengigkeit.
- Favoriten- und Hub-Rezeptauswahl laedt das aktuelle berechtigte Rezept statt gecachte Naehrwerte als Produkt zu behandeln. Portionspicker/`submitRecipeLog` nutzen; historische bevorzugte Grammenge bei Bedarf nach obiger kompatibler Gewichtsregel umrechnen. Rezeptrelation nicht in persoenliche Lebensmittel-/Zutatenkopie umwandeln.
- Verweigerter Zugriff beim Detail, Bild, Favorisieren oder Logging entfernt veraltete aktive Inhalte/Previews; Anzeige `Rezept nicht mehr verfuegbar`, Rueckkehr/Refresh und Entfernen der eigenen Favoritenreferenz anbieten. Kein Fallback vom fehlgeschlagenen Recipe-Log auf Client-Naehrwerte.
- Owner-Mutation, Tabwechsel, Reload und Unmount invalidieren veraltete Requests. Spaete Antworten duerfen ein inzwischen privates/unverfuegbares Rezept nicht wieder als aktiv zeigen.
- Bestehende HealthConnect-Sync nach erfolgreichem Recipe-Log erhalten; kein Sync nach abgelehntem Write. KB-Navigations- und Theme-Konventionen beibehalten, TalkBack, kleine Displays und vergroesserte Schrift pruefen.

## 9. Work Packages

Alle Arbeitspakete werden strikt nacheinander ausgefuehrt. PO-Freigabe liegt vor; fachliche Erweiterungen sind nicht automatisch mitfreigegeben.

### B-1 - Shared-Vertraege, Persistenz und Zugriff

Agent: Backend

Goal: Typisierte Community-Vertraege, kompatible Persistenz und gezielte autorisierte Reads implementieren.

Required Knowledge Base:
- docs/kb/tech/01-system-overview.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/04-shared-library.md
- docs/kb/tech/05-authentication.md
- docs/kb/domain/06-recipes.md
- docs/kb/domain/03-food-catalog.md

Required Repository Context:
- shared/types/recipes.ts
- shared/types/diary.ts
- shared/types/userFoodRelation.ts
- shared/index.ts
- backend/src/lib/repositories/recipesRepository.ts
- backend/src/lib/repositories/cosmosRecipesRepository.ts
- backend/src/lib/repositories/recipesRepository.test.ts
- backend/src/lib/repositories/cosmosRecipesRepository.contract.test.ts
- backend/src/lib/repositories/reusableItemsRepository.ts
- backend/src/lib/repositories/foodProductRepository.ts
- backend/src/lib/repositories/profileRepository.ts

Required Skills: cosmos-data-model-and-migration

Relevant Acceptance Criteria: AC-2, AC-3, AC-4, AC-7, AC-8, AC-11, AC-16

Dependencies: Approved Plan

Expected Handoff: Shared-DTOs/Inputtypen, Repository-Methoden, Provenienz- und Legacy-Regeln, bestandene lokale Unit-/Emulator-Contracttests. Keine Container-/Bicep-Aenderung.

Tasks:
- Vertragsanpassungen gemaess Abschnitten 6/7; kleine Access-/Provenienz-/Projektionshelper nur fuer tatsaechlich geteilte Logik.
- In-Memory und Cosmos fuer Defaults, Publication-Erhalt bei anderen Writes, konditionalen Sichtbarkeitswechsel, paginierte Community-Reads und ID-Aufloesung angleichen.
- Unit- und Emulator-Contracttests mit zwei Nutzern, unbekannter Herkunft, fehlender Visibility/Consent und ETag-Konflikten.

### B-2 - HTTP, Bilder, Favoriten und sichere Snapshot-Pfade

Agent: Backend

Goal: Alle neuen und bestehenden referenzbasierten Pfade serverseitig absichern.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/05-authentication.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/02-diary.md
- docs/kb/domain/03-food-catalog.md
- docs/kb/domain/06-recipes.md

Required Repository Context:
- backend/src/functions/recipes.ts
- backend/src/functions/recipes.test.ts
- backend/src/functions/favorites.ts
- backend/src/functions/favorites.test.ts
- backend/src/functions/diary.ts
- backend/src/functions/diary.test.ts
- backend/src/functions/instagramRecipe.ts
- backend/src/functions/ai.ts
- backend/src/functions/ai.test.ts
- backend/src/lib/storage.ts
- backend/src/lib/repositories/diaryRepository.ts
- backend/src/lib/repositories/userFoodRelationRepository.ts
- backend/src/index.ts
- backend/src/lib/registrations.test.ts
- mobile/src/modules/recipes/recipeUtils.ts

Required Skills: cosmos-data-model-and-migration

Relevant Acceptance Criteria: AC-2 bis AC-17

Dependencies: B-1 Handoff

Expected Handoff: Finale API-Vertraege/Fehlerformen, Autorisierungs- und Snapshot-Testmatrix, geschuetzter Bildpfad, keine produktiven Secrets oder AI-Aenderungen. Vollstaendige Zugriffsmatrix fuer Frontend und QA.

Tasks:
- Visibility-/Community-/Bildhandler mit Auth, strikter Body-Validierung, Projektion und Registrierungen implementieren.
- Recipe-Favorisieren und alle Relation-Reads absichern; gespeicherte SAS/Naehrwerte fuer nicht verfuegbare Community-Referenzen nicht ausliefern.
- `recipes.log` und generischen Recipe-Add-Item auf denselben aktuellen Snapshot/Access-Pfad bringen; Rezeptreferenz-/Client-Naehrwert-Bypass und fremde Meal-ID negativ testen.
- Eigentuemer-only Mutationen/Export/AI-Scale gegen fremde Community-IDs regressionspruefen, ohne diese AI-Endpunkte fachlich zu erweitern.
- Build-Verifikation, Auth-/Storage-Mocks und schmale Handler-Tests zuerst, dann betroffene Testsuiten.

### F-1 - Rezeptbereiche, Freigabe und Community-Detail

Agent: Frontend

Goal: Story-UX auf bestehenden Screens umsetzen, inklusive sicherer Bild- und Logging-Nutzung.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/05-authentication.md
- docs/kb/product/02-navigation.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md
- docs/kb/domain/06-recipes.md

Required Repository Context:
- mobile/src/modules/recipes/RecipeListScreen.tsx
- mobile/src/modules/recipes/RecipeDetailScreen.tsx
- mobile/src/modules/recipes/RecipeDetailScreen.test.tsx
- mobile/src/modules/recipes/RecipeIngredientGroup.tsx
- mobile/src/modules/recipes/RecipeImageHeroImage.tsx
- mobile/src/modules/recipes/LogRecipeModal.tsx
- mobile/src/shared/api/recipeApi.ts
- mobile/src/shared/api/recipeApi.test.ts
- mobile/src/shared/api/favoritesApi.ts
- mobile/src/shared/api/client.ts
- mobile/src/shared/viewModels/recipeLoggingViewModel.ts
- mobile/src/app/navigation/RootNavigator.tsx
- mobile/src/shared/components/ConfirmSheet.tsx
- mobile/src/shared/components/InfoOverlay.tsx

Required Skills: None

Relevant Acceptance Criteria: AC-1 bis AC-15, AC-17

Dependencies: B-2 API-Handoff

Expected Handoff: Liste/Freigabe/Community-Detail mit Tests, Client-Methoden und Request-Invalidierung; keine Erweiterung fremder Verwaltungs- oder Exportrechte.

Tasks:
- Vertragsanpassung und getrennte Detail-Ladewege ohne Owner-ID in Navigation.
- Veroeffentlichungsdialog, explizite Namenscheckbox, Abbruch/Widerruf, Statusanzeige und 412-Recovery durch Reload.
- Community-Inhaltsrenderer, Herkunftshinweise und geschuetzte Bilddarstellung; Lade-/Fehler-/Widerrufszustaende.
- Vorhandenes portionsweises Logging und HealthConnect-Sync nach erfolgreichem Write weiterverwenden.

### F-2 - Herkunft erhalten und Favoriten-/Hub-Integration

Agent: Frontend

Goal: Neue Zutaten korrekt kennzeichnen und Community-Referenzen in allen Auswahlpfaden sicher verwenden.

Required Knowledge Base:
- docs/kb/domain/03-food-catalog.md
- docs/kb/domain/06-recipes.md
- docs/kb/product/04-food-entry-hub.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/recipes/ingredientBuilders.ts
- mobile/src/modules/recipes/ingredientBuilders.test.ts
- mobile/src/modules/recipes/recipeWizardEditBootstrap.ts
- mobile/src/modules/recipes/recipeWizardEditBootstrap.test.ts
- mobile/src/modules/recipes/RecipeWizardScreen.tsx
- mobile/src/modules/recipes/recipeUtils.ts
- mobile/src/modules/nutrition/hub/FoodEntryHub.tsx
- mobile/src/modules/nutrition/hub/QuantityView.tsx
- mobile/src/modules/nutrition/hub/RelationRow.tsx
- mobile/src/modules/nutrition/hub/FoodEntryHub.test.ts
- mobile/src/shared/api/favoritesApi.ts
- mobile/src/shared/viewModels/recipeLoggingViewModel.ts

Required Skills: None

Relevant Acceptance Criteria: AC-11 bis AC-17

Dependencies: F-1 Handoff und B-2 API-Handoff

Expected Handoff: Herkunfts-/Edit-Roundtrip und sichere Hub-Rezeptauswahl inkl. Direct-Add/Quantity-Fallback mit Tests; keine Lebensmittelkopie; Widerruf blockiert alle neuen Recipe-Log-Aktionen.

Tasks:
- Richtige Links und AI-Flags fuer neue Bibliotheks-/Katalogzutaten; unbekannte Altprovenienz bei unveraendertem Edit erhalten.
- `foodRefType: 'recipe'` vor generischem Produktaufbau abzweigen, aktuell laden und ueber autorisierten Recipe-Log protokollieren.
- Unavailable-Referenz neutral darstellen und entfernen koennen; keine stale Preview oder Client-Write-Fallbacks. Fremde Rezeptreferenzen nicht als Zutatenkopie zurueckgeben.
- Nicht-Rezept-Favoriten und bestehende Ingredient-Hub-Callbacks unveraendert regressionspruefen.

### D-1 - Knowledge Base und API-Dokumentation

Agent: Backend

Goal: Nach Implementierung betroffene KB-Inhalte an den nachgewiesenen Stand angleichen.

Required Knowledge Base:
- docs/kb/README.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/06-recipes.md
- docs/kb/domain/03-food-catalog.md
- docs/kb/domain/02-diary.md
- docs/kb/product/04-food-entry-hub.md
- docs/kb/tech/05-authentication.md

Required Repository Context:
- B-1/B-2/F-1/F-2 Handoffs und geaenderte Implementierungsdateien

Required Skills: None

Relevant Acceptance Criteria: AC-1 bis AC-17

Dependencies: F-2 Handoff

Expected Handoff: Aktualisierte KB mit neuen Routes/DTOs, Owner-/Community-Matrix, Widerruf/Bildabruf, Herkunftskompatibilitaet und Snapshot-Regeln; aktuelle Implementierungsnachweise fuer QA.

Tasks: Keine geplante Funktion als umgesetzt markieren. Nur betroffene Abschnitte aktualisieren, einschliesslich benannter ReusableItem-Quellenabweichung und Auth-Ausnahme fuer ausdruecklich publizierte Rezeptinhalte. Keine generelle Lockerung aller Nutzerpartitionen dokumentieren.

### Q-1 - Vollstaendige Story- und Sicherheitspruefung

Agent: QA

Goal: Implementierung gegen alle Story-ACs, Planvertraege und Datenkompatibilitaet pruefen.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/05-authentication.md
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/02-diary.md
- docs/kb/domain/03-food-catalog.md
- docs/kb/domain/06-recipes.md
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- docs/User Stories/Reciepe/US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md
- docs/User Stories/Reciepe/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md
- B-1/B-2/F-1/F-2/D-1 Handoffs und deren geaenderte Dateien/Tests
- backend/src/lib/repositories/cosmosRecipesRepository.contract.test.ts
- backend/src/test-utils/cosmosEmulator.ts

Required Skills: cosmos-data-model-and-migration

Relevant Acceptance Criteria: AC-1 bis AC-17, vollstaendige Pruefung

Dependencies: D-1 Handoff

Expected Handoff: Findings nach Schweregrad mit Dateireferenzen; AC-Matrix Pass/Fail/Unverified, Test-/Typecheck-/Buildnachweise, Sicherheits- und Legacy-Befund; keine pauschale Freigabe bei ausgelassenem Emulator- oder Zwei-Nutzer-Test.

Tasks: Abschnitt 10 und 11 vollstaendig verifizieren; Dokumentation gegen Implementierung pruefen. QA implementiert keine fehlenden Featureteile. Befunde an den jeweiligen Implementation-Owner zurueckgeben.

### I-1 - Infrastructure & Release Gate

Agent: Infrastructure

Goal: Die neue geschuetzte Community-Leseoberflaeche in Dev und anschliessend Alpha betrieblich pruefen und den koordinierten Rollout ausfuehren.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- Q-1 Handoff
- backend/src/index.ts
- infra/modules/cosmos.bicep
- infra/modules/storage.bicep
- mobile/app.config.js
- mobile/eas.json

Required Skills: None

Relevant Acceptance Criteria: AC-8, AC-9, AC-14, AC-15, AC-16 und Zwei-Nutzer-E2E

Dependencies: Q-1 ohne offene releaseblockierende Findings

Expected Handoff: Dev-/Alpha-Smokenachweis, `Dev Build Required: YES | NO` mit Begruendung, Deployment-/Rollout-/Rollback-Nachweis, keine neuen Ressourcen/Secrets.

Tasks:
- Dev pruefen: Routes registriert, echte CIAM-Anmeldung zweier Nutzer, private Blobs, authentifizierter Byteabruf ohne SAS/Redirect, paginierte Cosmos-Query unter Standardindex.
- Falls entgegen Plan ein Index/Resource-/Native-Impact erforderlich wird, Implementation stoppen und Plan nachziehen. Keine Ad-hoc-Infrastruktur/neue native Pakete.
- Keine Bicep-Aenderung geplant. Wenn eine genehmigte Infrastrukturkorrektur benoetigt wird: Infrastruktur zuerst, Backend-Code danach; Skills Sections 4/7 fuer Datenkompatibilitaet beachten.
- Nach Merge/Gates `Deploy to Alpha` als direkte operative Release-Aktion ausfuehren, kein separates Build-Featureprojekt. Backend zuerst, kompatiblen mobilen JS-Stand danach bereitstellen. Alpha-Smoke mit zwei Nutzern wiederholen.

## 10. Test Strategy und Gates

Focused Checks pro Umsetzungsschritt zuerst; danach die betroffenen kompletten Suiten. Bestehende Testdateien bevorzugen, neue Tests nur neben neuen verantwortlichen Modulen.

1. Unit/Handler: Owner A, Reader B, unauthenticated. Private/Legacy/private-after-revoke/deleted fuer Liste, Detail, Bilder, Favorite-Add, Recipe-Log und generischen Recipe-Add-Item.
2. Positive Community-Reads geben nur freigegebene DTO-Felder aus; keine Owner-ID, Bibliotheks-ID, Blobpfade, SAS, Consent-Daten oder andere Profilfelder. Namensvarianten: false/fehlend, true+Name, true+fehlender Name, Reset bei neuer Veroeffentlichung.
3. Herkunft: direkte KI, KI-Bibliotheksartikel, manuelle Bibliothek, OFF direkt/in Bibliothek, label-scan, beide Hinweise, unknown legacy, seasoning ohne AI-Naehrwertschaetzung. Create/Edit/Reload behalten bekannte Werte; unbekannte Altwerte werden nicht erfunden.
4. Snapshot: 0.5/1/2 Portionen, bestehende Rundung, Name/Portion/Fiber/Makros nach Recipe-Edit/Widerruf/Loeschung unveraendert. Falsche Meal-ID abweisen; keine Zutaten-/ReusableItem-Anlage auf Read/Favorite/Log.
5. Bypass-Tests: manipulierte Visibility/Consent im allgemeinen PUT/POST; fremde Owner-/Blob-ID; gefaelschte Favorite-Naehrwerte; `sourceType: 'recipe'` im generischen Diary-Endpoint; Recipe-Relation durch Direct-Add und Quantity-Fallback; kein Write nach Zugriffsentzug.
6. ETags/Concurrency: veraltete Publication-ETags 412, Inhalts-/Bild-/Usage-Writes erhalten Consent/Visibility; Usage-Retry darf Widerruf nicht zurueckrollen. Ein neuer Request nach erfolgreichem Widerruf scheitert; laufende Requests werden nach Abschnitt 4 bewertet.
7. Contract (nur lokaler Cosmos-Emulator): Legacy ohne neue Felder, mehrere Nutzerpartitionen, Pagination mit mehr als einer Seite, unpublish/delete verschwinden aus neuen Reads, keine private Partition in Responses. Keine Tests gegen Remote Dev/Alpha Cosmos.
8. Mobile: Defaultbereich, Ruecknavigation, Abbruch/Freigabe/Name-checkbox, fremde Aktionsausblendung, geschuetzte Bilder, 401-Refresh, 404/412, stale Requests, Empty/Retry/Load-more, Favorite-Removal nach Widerruf. Recipe- und Nicht-Rezept-Hub-Pfade getrennt testen.
9. Zwei-Nutzer-E2E in Dev und Alpha: A erstellt privat; B findet/liest nicht; A publiziert; B sieht/favorisiert/loggt; A editiert; B sieht aktuelle Inhalte; A widerruft/loescht; B kann keine neuen Inhalte/Logs abrufen; sein alter Diary-Snapshot bleibt. Fuer B auch alte Favoriten- und Direct-URLs verwenden.

Pflichtkommandos fuer Implementation/QA, nicht im Planner ausfuehren:

```powershell
npm run typecheck
npm run test:backend
npm run test:shared
npm run test:mobile
npm run build:verify --workspace=backend
node scripts/check-encoding.mjs
git diff --check
```

Zusaetzlich Contract-Kommando im `backend`-Arbeitsverzeichnis als `npx vitest run --config vitest.contract.config.mts` ausfuehren, entsprechend der vorhandenen Konfiguration. Keine Live-AI-Evals erforderlich, solange AI-Vertraege unveraendert bleiben. Falls Emulator/Geraet/zweiter Account fehlen, die betroffenen Gates `Unverified` nennen, nicht als bestanden werten. Mobile Sichtpruefung auf kleinem/grossem Display, mit vergroesserter Schrift und TalkBack dokumentieren.

## 11. Acceptance Criteria

AC-1 bis AC-17 entsprechen nummerngleich den Story-ACs; die folgenden Konkretisierungen dienen QA, ohne die Story zu ersetzen.

1. AC-1: Bereiche `Deine Rezepte`/`Community-Rezepte`; bei frischem Oeffnen eigene Liste ausgewaehlt.
2. AC-2: Eigene private und publizierte Rezepte sichtbar, Eigentuemer erkennt ihren Status; keine fremden privaten Rezepte.
3. AC-3: Create bleibt privat, auch bei injiziertem Visibility-/Consent-Payload; Freigabe nur separate explizite Owner-Aktion.
4. AC-4: Legacy ohne Visibility/Publication wird privat gelesen und nie in Community geliefert.
5. AC-5: Owner kann privat/community wechseln; B kann weder Visibility noch Inhalt/Images/Owner-Export von A mutieren.
6. AC-6: Bestaetigung nennt Texte, Zutaten, Zubereitung und Bilder; Abbruch macht keinen Veroeffentlichungsrequest; fehlende Bestaetigung wird serverseitig abgewiesen.
7. AC-7: Namensfreigabe initial aus; je Rezept nur explizit freigegebener Profilname, sonst exakt `Anonymous`; kein Tokenname/anderes Profilfeld als Ersatz.
8. AC-8: Community-Liste nur angemeldet und explizit community, auch bei Pagination; ohne Anmeldung 401.
9. AC-9: Detail liefert gespeicherte Name/Beschreibung/Portionen/Zutaten/Steps/Naehrwerte/Bilder; Bild-URL ohne Bearer ermoeglicht keinen anonymen Abruf.
10. AC-10: Autor sichtbar; fremde Details ohne Edit/Delete/Image-Management und ohne implizite Eigentuemerrechte.
11. AC-11: KI-Nachweis zeigt `Enthaelt KI-Schaetzungen`, manueller Nachweis `Enthaelt manuell erfasste Zutaten`; im UI mit normaler deutscher Schreibweise gemaess Story. Beide Nachweise zeigen beide Hinweise. Unknown behauptet keine Herkunft; keine Verifikationsbehauptung.
12. AC-12: Favorite-Add/Remove speichert nur persoenliche Relation; keine Recipe-/Food-Kopie; nach Widerruf eigene Relation weiterhin entfernbar, keine neue Originalberechtigung.
13. AC-13: Portions-Log in eigenes Diary aus aktuell servergelesenen Werten; generischer Recipe-Quickentry hat dieselbe Pruefung und Snapshot-Semantik.
14. AC-14: Bereits geschriebener Name, Portion und alle Naehrwerte bleiben nach Edit, Privatstellen und Loeschen gleich.
15. AC-15: Nach Privatstellen kein neuer Listen-/Detail-/Bild-/Favorite-/Logzugriff durch B, einschliesslich alter Favoriten und alter direkter IDs; stale Hub-Naehrwerte erlauben keinen Fallback-Write.
16. AC-16: Server-Auth-/Access-Tests fuer Liste/Detail/Log und Bild/Favoriten/Quickentry; bekannte IDs und UI-State allein reichen nicht. HTTP-Fehler verraten keine fremden privaten Ownerdaten.
17. AC-17: Keine Uebernahme-in-eigene-Rezepte-Aktion; Read/Favorite/Log veraendern die Lebensmittelsammlung nicht.

## 12. Risiken und Trade-offs

- Cross-partition Queries verursachen mehr RU als Eigentuemerreads. Bewusst gewaehlt statt doppelter Community-Replikation; begrenzte Pagination und gezielte Reads, kein unbeschraenktes `fetchAll`. RU/Latenz im Release-Smoke dokumentieren.
- Geschuetzter Bildproxy kostet Function-Bandbreite und ist gegenueber SAS-Auslieferung mehr Backend-Arbeit. Er verhindert anonyme Linknutzung und prueft Widerruf bei jedem neuen Abruf; vorhandene bounded Storage-Downloads halten die Umsetzung klein.
- Anzeigename aus aktuellem Profil kann sich nach Profilbearbeitung aendern. Er wird nur bei aktiver rezeptgebundener Zustimmung gelesen; keine PII-Kopie und keine Cross-User-Profilantwort.
- Nicht alle Altzutaten lassen sich eindeutig klassifizieren. Unknown ist absichtlich erlaubt; kein globales Backfill aus heute veraenderten Produkten.
- Stale Favorite-/Hub-Pfade sind ein Sicherheitsrisiko; deshalb serverseitiger Snapshot-/Access-Resolver auch auf generischem Diary-Recipe-Pfad, nicht nur UI-Aktionsausblendung.
- Abgerufenes Wissen und Screenshots sind nicht widerrufbar; keine entsprechenden Datenschutzversprechen im Dialog. Berechtigung fuer neue Requests ist widerrufbar.
- Keine neuen Pakete geplant; falls doch erforderlich, Planner-Neubewertung inklusive aktueller stabiler Version und Native-Impact.

## 13. Recommended Execution Order und Uebergabe

1. B-1 Shared/Persistenz/Resolver mit fokussierten Tests.
2. B-2 HTTP/Bilder/Favoriten/Diary mit Sicherheits- und Build-Gates.
3. F-1 Rezeptbereiche und Community-Detail.
4. F-2 Herkunft und Hub-Integration.
5. D-1 KB/API-Dokumentation.
6. Q-1 vollstaendige Verifikation inklusive Dokumentation und Dev-Zwei-Nutzer-E2E; Findings an zustaendigen Owner, danach erneut pruefen.
7. I-1 Release-Gate und koordinierter Alpha-Rollout; Alpha-E2E-Nachweis nach Deployment.

Plan ist repositoryseitig persistiert und automatisch approved. Die Ausfuehrung muss durch FitTrack-Orchestrator/Backend/Frontend/QA/Infrastructure erfolgen. Der aktive FitTrack Planner darf weder Produktionscode/Tests aendern noch Builds/Deployments ausfuehren. Es wird keine begonnene oder abgeschlossene Entwicklung behauptet.