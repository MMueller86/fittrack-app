# Technischer Plan: Instagram Recipe Renderer - Backend Azure Function Integration

- **Status:** READY FOR IMPLEMENTATION - explicit `APPROVE` required
- **Plan-Typ:** Medium/large Backend-Integration als Folge des akzeptierten Renderer-PoC
- **Klassifikation:** Accept with modifications

Infrastructure Impact: Alpha
Mobile Build Impact: None

**Erster Meilenstein:** Eine authentifizierte Azure Function rendert ein privates
FitTrack-Rezept mit den vorhandenen Produktdaten und liefert ein deploybares
`1080 x 1350` PNG. Der Renderer bleibt die einzige Layout-Autoritaet. Mobile-
Integration, Share-UI und EAS-Build sind in diesem Meilenstein nicht enthalten,
ausser eine technische Blockade macht eine kleine gemeinsame Vertragsaenderung
unvermeidbar.

**Ausfuehrungsgate:** Dieser Plan wird erst nach einer expliziten Nutzerantwort
`APPROVE` an den Orchestrator zur Umsetzung uebergeben. Bis dahin werden keine
Produktionsdateien, Tests, Infrastrukturdateien oder Deployment-Artefakte
geaendert.

## Open Product Owner Decisions

Keine. Route, Authentifizierung, Request-Defaults, fehlende Metadaten und die
Golden-Strategie sind fuer den Backend-first-Meilenstein als technische
Entscheidungen festgelegt. Eine kuenftige fachliche Entscheidung zu automatisch
abgeleiteten Nutrition-Badges oder dauerhaft gespeicherter Share-Praesentation
liegt ausserhalb dieses Plans und darf nicht vorweggenommen werden.

## 1. Requirement Assessment

### Nutzerproblem und Loesungsfit

Der Renderer ist derzeit ein isolierter POC. Es fehlt der produktive Backend-
Pfad, der ein authentifiziertes Rezept laedt, sein Blob-Foto sicher liest, die
vorhandenen Rezeptdaten an den POC-Renderer adaptiert und das erzeugte PNG als
Azure-Function-Antwort bereitstellt.

Der vorgeschlagene Weg ist technisch tragfaehig: Satori, Resvg und Sharp
koennen innerhalb einer Node-20-Linux-Azure-Function denselben Renderer nutzen,
wenn Runtime, native Pakete, lokale Fonts, statische Assets und Render-Input
kontrolliert und reproduzierbar gebuendelt werden. Die Antwort auf die
Leitfrage lautet daher **ja**, aber nicht mit einem Windows-`node_modules`-
Verzeichnis oder mit Assets, die nur im Quellbaum vorhanden sind.

### Anpassung gegenueber dem Originalwunsch

Die fuenf bestaetigten Arbeitsbereiche werden angenommen, mit diesen
Einschraenkungen:

- Der Handler akzeptiert nur Render- und Praesentationsoptionen. Titel, Tags,
  Portionen und Nutrition werden serverseitig aus dem eigenen Recipe-Dokument
  gelesen und nicht vom Client vertraut.
- Zeit und Schwierigkeit werden im ersten Meilenstein nicht in `Recipe` oder
  Cosmos eingefuehrt. Sie sind optionale Request-Metadaten; fehlen sie, wird
  die optionale Meta-Zeile vollstaendig weggelassen.
- Der Endpoint ist authentifiziert und user-scoped. Es gibt keinen anonymen,
  oeffentlichen oder Instagram-Callback-Pfad.
- Die historische V1.7-Golden-Datei bleibt unveraendert. Eine aktuelle,
  akzeptierte Referenz wird separat versioniert und nicht an die historische
  Datei angepasst.

### Produkt- und Domaenenbewertung

- Der Pfad erzeugt nur ein Bild und veraendert weder Rezept- noch
  Nutrition-Daten. Es gibt keinen Health-Risk- oder AI-Entscheidungsanteil.
- Die Nutrition-Karte verwendet die vorhandene `nutritionPerPortion`-Semantik.
  Es werden keine neuen fachlichen Schwellen fuer `high-protein` oder `low-fat`
  erfunden; ein Badge bleibt ein expliziter optionaler Request-Input und
  defaultet auf `null`.
- Private Rezepte bleiben privat. Der Zugriff wird ueber `requireUser()` und
  das user-scoped Repository abgesichert.
- Ein request-level Adapter ist einfacher und rueckwaertskompatibel als neue
  persistente Recipe-Felder oder eine Migration fuer noch nicht entschiedene
  Share-Praesentation.

## 2. Recommended Product Behaviour

Der Backend-Meilenstein stellt `POST /api/recipes/{id}/instagram-render` fuer
den authentifizierten Besitzer eines Rezepts bereit. Die Funktion liefert bei
Erfolg direkt `image/png` und speichert weder das Render-Ergebnis noch neue
Praesentationsdaten.

Die aktuelle POC-Komposition, das Format, die Fonts, die lokale Assetquelle,
die Tag-Icon-Aufloesung, die Nutrition-Karte, die Hantel, `PRO PORTION`, Badge-
Position und Wortmarke bleiben unveraendert. Der Handler berechnet keine
Layoutwerte und dupliziert keine Compose-Logik.

Mobile bleibt bewusst ausserhalb des ersten Meilensteins. Ein spaeterer
Frontend-Plan kann den Endpoint konsumieren, muss aber nicht Teil dieser
Backend-Bereitstellung sein.

## 3. Feature Summary

Die Umsetzung besteht aus vier technisch getrennten Schichten:

1. Eine geschuetzte HTTP-Funktion validiert Request und Recipe-ID,
   authentifiziert den Benutzer und orchestriert Repository, Blob-Download,
   Adapter und Renderer.
2. Ein Renderer-Adapter bildet das bestehende `Recipe`-Modell auf den bereits
   vorhandenen `RenderInput` ab. Er setzt nur die festgelegten Defaults und
   reicht keine Client-Daten fuer Rezeptinhalt oder Nutrition durch.
3. Eine Storage-Lesefunktion laedt das bereits autorisierte Blob direkt als
   Buffer. Es wird kein SAS-URL-Roundtrip und kein vom Client gelieferter
   Blobname verwendet.
4. Dependency-Lock, Linux-native Runtime-Pakete, Fonts, SVGs, PNGs und der
   kompilierte Function-Code werden in einem reproduzierbaren
   `_deploy_staging`-Paket verifiziert.

## 4. Current Behaviour

- Der oeffentliche Einstiegspunkt ist
  `backend/src/lib/instagramRenderer/render.ts`:
  `renderInstagramRecipe(input): Promise<RenderResult>`.
- Der Renderer nutzt lazy geladene `satori`, `@resvg/resvg-js` und `sharp`,
  lokale Inter-Fonts, lokale PNG-/SVG-Assets, `embedFont: true` und
  `loadSystemFonts: false`.
- `RenderInput` verlangt `image`, `presentation`, `title`, `tags`,
  `nutritionHighlight` und `nutrition`; `recipeMeta` ist optional, aber als
  vollstaendiges Objekt validiert.
- `Recipe` unter `shared/types/recipes.ts` enthaelt Name, Portionen, Tags,
  `nutritionPerPortion` und Blob-Metadaten (`images[].blobName`), aber keine
  top-level Felder fuer Gesamtzeit, Schwierigkeit, FocusX, FocusY oder Zoom.
- `backend/src/functions/recipes.ts` laedt Rezepte user-scoped und erzeugt
  SAS-URLs, bietet aber noch keinen direkten Blob-Download fuer den Renderer.
- `backend/src/index.ts` importiert kein Renderer-Function-Modul. Es gibt daher
  derzeit keinen produktiven HTTP-Pfad.
- `backend/package.json` enthaelt die POC-Runtime-Pakete bereits, aber der
  Root-`package-lock.json` und `_deploy_staging/package.json`/
  `_deploy_staging/package-lock.json` spiegeln die Renderer-Pakete noch nicht
  vollstaendig wider. Das aktuelle Staging-Paket enthaelt nur `sharp` aus dem
  Renderer-Set.
- `tsc` kopiert den Assetordner nicht automatisch nach `dist`. Der deployed
  Renderer darf deshalb nicht auf den Workspace-Quellpfad angewiesen sein.
- Das Function-App-Bicep ist bereits Linux, Node 20, Functions v4 und
  `WEBSITE_RUN_FROM_PACKAGE=1`; es gibt keinen neuen Azure-Ressourcentyp.
- Der historische Test gegen
  `fittrack_instagram_golden_v1_7_unified_ambient.png` nutzt weiterhin
  `pixelmatch`-Threshold `0.10` und ein Differenz-Gate von `0.03`. Der aktuelle
  akzeptierte POC-Stand weicht absichtlich staerker ab; der zuletzt gemessene
  Wert liegt bei rund `5.50 %` (`0.0549972565`). Eine aktuelle Referenzdatei
  `fittrack_instagram_current_approved.png` existiert noch nicht.

## 5. Desired Behaviour

### 5.1 Azure Function route and auth

| Eigenschaft | Vertrag |
|---|---|
| Function name | `recipes-render-instagram` |
| Methode | `POST` |
| Route | `/api/recipes/{id}/instagram-render` |
| Azure authLevel | `anonymous`, wie bei den bestehenden Functions |
| Anwendungsauth | `requireUser(request)` ist zwingend; fehlender/ungueltiger Bearer ergibt `401` |
| Autorisierung | `getRecipesRepository().get(userId, id)`; nur das private Rezept des JWT-Users ist renderbar |
| Quota | Keine AI-Quota; Rendering ist deterministisch und nicht Azure-OpenAI-basiert |
| Speicherung | Kein PNG-Upload, kein neuer Cosmos-Datensatz, keine Aenderung am Rezept |
| Cache | `Cache-Control: no-store`, da das Bild private Rezeptdaten enthaelt |

`backend/src/index.ts` muss das neue Function-Modul importieren. Die bestehende
Registrierungspruefung muss dadurch automatisch die Route abdecken.

### 5.2 Request body

Der Request wird als striktes JSON-Objekt mit `parseBody()` und Zod validiert:

```json
{
  "imageId": "optional-recipe-image-uuid",
  "presentation": {
    "focusX": 0.5,
    "focusY": 0.46,
    "zoom": 1.0
  },
  "nutritionHighlight": "high-protein",
  "recipeMeta": {
    "totalTimeMinutes": 25,
    "difficulty": "Einfach"
  }
}
```

Alle Felder sind optional. Ein leerer JSON-Body ist gueltig und rendert mit
den Defaults. Es gibt keine Client-Felder fuer `title`, `tags`, `portions`,
`nutrition`, `blobName` oder `ownerUserId`.

| Feld | Validierung und Verhalten |
|---|---|
| `imageId` | Optionale UUID. Fehlt das Feld, wird das Bild mit kleinster `order`, bei Gleichstand kleinster ID verwendet. Ein unbekanntes Bild ergibt `404`. |
| `presentation.focusX` | Optionale endliche Zahl in `[0, 1]`; fehlt sie, wird `0.5` verwendet. |
| `presentation.focusY` | Optionale endliche Zahl in `[0, 1]`; fehlt sie, wird der bestaetigte POC-Wert `0.46` verwendet. |
| `presentation.zoom` | Optionale endliche Zahl `>= 1`; fehlt sie, wird `1.0` verwendet. Es gibt kein Clamping. |
| `nutritionHighlight` | `"high-protein"`, `"low-fat"` oder `null`; fehlt es, wird `null` verwendet. Es gibt keine automatische Schwellenlogik. |
| `recipeMeta.totalTimeMinutes` | Nur innerhalb von `recipeMeta` erlaubt; positive ganze Zahl. Zusammen mit `difficulty` erforderlich. |
| `recipeMeta.difficulty` | Nur innerhalb von `recipeMeta` erlaubt; sichtbare einzeilige Zeichenkette. Zusammen mit `totalTimeMinutes` erforderlich. |
| `recipeMeta.portions` | Nicht vom Client akzeptiert. Der Renderer erhaelt die Portionen aus `recipe.portions`. |

Wenn nur ein Teil von `presentation` fehlt, wird nur dieses Teilfeld
defaultet. Wenn `recipeMeta` fehlt, wird die Meta-Zeile nicht gerendert. Wenn
ein `recipeMeta`-Objekt nur teilweise geliefert wird, antwortet die Funktion
mit `400`, statt leere Labels oder erfundene Werte zu erzeugen. Wenn die
gespeicherten Portionen fuer eine angeforderte Meta-Zeile keine positive ganze
Zahl sind, antwortet sie mit `422`; die Funktion repariert keine historischen
Dokumente.

### 5.3 Server-side Recipe-to-RenderInput adapter

Der Adapter, zum Beispiel
`backend/src/lib/instagramRenderer/recipeAdapter.ts`, erzeugt den kompletten
Renderer-Input:

| RenderInput-Feld | Quelle |
|---|---|
| `image` | Buffer aus dem autorisierten `RecipeImage.blobName` |
| `presentation` | Request-Werte mit den festgelegten POC-Defaults |
| `title` | `recipe.name` |
| `tags` | Reihenfolge aus `recipe.tags`; jedes String-Tag wird als `{ id: tag, label: tag }` uebergeben, damit die bestehende Icon-Registry entscheidet |
| `nutritionHighlight` | Request-Wert oder `null`; keine Ableitung aus Nutrition |
| `nutrition` | `recipe.nutritionPerPortion.calories`, `protein`, `carbs`, `fat` |
| `recipeMeta` | Nur wenn Request-Meta vollstaendig ist; `totalTimeMinutes` und `difficulty` aus dem Request, `portions` ausschliesslich aus `recipe.portions` |

Der Adapter kuerzt Titel oder Tags nicht, sortiert sie nicht neu und veraendert
keine Nutrition-Werte. Renderer-Fehler wie `TITLE_OVERFLOW`, `TOO_MANY_TAGS`
oder `TAG_ROW_OVERFLOW` werden als kontrollierte nicht renderbare Recipe-
Eingabe behandelt, nicht durch Layoutkopien im Handler umgangen.

### 5.4 Image acquisition

- Nach Authentifizierung und Recipe-Ownership prueft der Handler das ausgewaehlte
  `RecipeImage`-Metadatum.
- Der Storage-Layer erhaelt nur den serverseitig gelesenen `blobName` und laedt
  den Blob direkt ueber `BlockBlobClient.downloadToBuffer()`.
- Es wird kein SAS-URL-HTTP-Fetch fuer den eigenen Backend-Renderpfad genutzt;
  damit haengen Rendering und SAS-Ablauf nicht voneinander ab.
- Die bestehende Upload-Grenze von 8 MB wird auch fuer den Render-Download als
  Schutzgrenze verwendet. Ein groesserer Blob wird als nicht renderbar
  abgelehnt und nicht unlimitiert in den Speicher geladen.
- Der Buffer wird als `{ buffer }` an `renderInstagramRecipe` gegeben. Der
  Renderer identifiziert das tatsaechliche Bildformat ueber Sharp.
- Kein Rezeptbild ergibt `422` mit einem stabilen Fehlercode. Ein fehlendes
  ausgewaehltes `imageId` ergibt `404`; ein inkonsistenter Blob-Metadaten-
  zustand wird geloggt und nicht als anderer Benutzerzugriff behandelt.

### 5.5 Response and error behaviour

#### Erfolg

`200` mit dem PNG-Buffer als Response-Body und:

```text
Content-Type: image/png
Content-Length: <buffer.byteLength>
Content-Disposition: inline; filename="fittrack-recipe.png"
Cache-Control: no-store
```

Die Funktion liefert keinen Base64-Wrapper und kein separates JSON-Metadatum.
`width`, `height` und `format` bleiben intern durch den Renderer garantiert;
die HTTP-Antwort ist immer genau das gerenderte PNG.

#### Fehler

Die JSON-Fehler behalten das bestehende `{ error: string }`-Muster. Bei einem
kontrollierten Renderer-Fehler wird zusaetzlich ein stabiler `code` geliefert;
interne `cause`-Werte werden nie an den Client gesendet.

| Status | Faelle |
|---:|---|
| `400` | Ungueltiges JSON, unbekannte Felder, ungueltige UUID, ungueltiges Focus/Zoom, unvollstaendiges `recipeMeta` |
| `401` | Fehlender oder ungueltiger Bearer; kommt ueber `requireUser()` und `withHandler()` |
| `404` | Rezept gehoert dem User nicht, existiert nicht oder angefordertes `imageId` ist nicht enthalten |
| `422` | Rezept hat kein renderbares Bild, Blob ist zu gross/ungueltig, gespeicherte Portionen sind fuer Meta ungueltig oder der Renderer meldet erwartbaren Layout-/Input-Overflow |
| `500` | Fehlendes Deployment-Asset, native Runtime-/Storage-/Renderer-Fehler oder sonstiger unerwarteter Fehler; nur generische Meldung nach aussen, Details strukturiert ins Log |

### 5.6 Renderer authority

Der Handler ruft ausschliesslich `renderInstagramRecipe()` auf. Er darf keine
Satori-Nodes, Layoutkonstanten, Fontnamen, Pixelkoordinaten, Crop-Formeln,
Tag-Icon-Aufloesung oder Nutrition-Rundung neu implementieren. Layout- und
Fehlersemantik bleiben in `backend/src/lib/instagramRenderer/`.

## 6. Scope

- Neues authentifiziertes `POST`-Function-Modul und Registrierung in
  `backend/src/index.ts`.
- Zod-Request-Schema, serverseitiger Recipe-Adapter und kontrolliertes
  Mapping der Renderer-Fehler.
- Direkter, user-authorisierter Blob-Download als Buffer mit 8-MB-Grenze.
- Synchronisierung von Backend-Manifest, Root-Lockfile, Staging-Manifest und
  Staging-Lockfile fuer alle Runtime-Renderer-Pakete.
- Reproduzierbarer Copy-Schritt fuer Fonts, SVGs, PNGs, Lizenzdatei und andere
  Renderer-Assets nach `dist` und `_deploy_staging`.
- Linux-x64-Node-20-Kompatibilitaetsgate fuer Sharp und Resvg-native Pakete.
- Handler-, Adapter-, Registrierungs-, Packaging- und Renderer-Integrationstests.
- Aktuelle versionierte Referenz fuer den akzeptierten POC-Stand, ohne das
  historische V1.7-Golden zu veraendern.
- Dokumentation des API-Vertrags, Asset-/Deploy-Vertrags und Golden-Verfahrens.
- Sequenzierte Dev-Bereitstellung und Alpha-Release-Vorbereitung.

## 7. Out of Scope

- Keine React-Native-Screens, API-Client-Aufrufe, Navigation, Share-Sheet,
  Kamera-, Crop- oder Preview-UI.
- Kein Mobile-Asset- oder Native-Modul-Update und kein EAS-Build.
- Keine neuen Recipe-Felder, keine Cosmos-Migration, kein neuer Container und
  keine Persistenz des Crop-/Focus-Zustands.
- Keine automatische Nutrition-Highlight-Berechnung.
- Kein oeffentlicher Download, kein Instagram-API-Upload und keine anonyme
  Funktion.
- Keine Layout-Neugestaltung und keine Aenderung der freigegebenen POC-
  Komposition.
- Keine Aenderung oder Loeschung des historischen V1.7-Golden, seines
  Pixelmatch-Thresholds oder seines Differenz-Gates.
- Kein Rueckbau der bestehenden Storage-/Repository-Abstraktion.
- Keine neue Azure-Ressource oder neuer Resource Group. Bicep-Aenderungen sind
  nur zulassig, falls die Packaging-/Runtime-Pruefung eine konkret benoetigte
  App-Setting-Aenderung nachweist.

## 8. Confirmed Facts

- Der Renderer liegt unter
  `backend/src/lib/instagramRenderer/` und exportiert
  `renderInstagramRecipe`.
- Der Renderer verwendet Satori -> Resvg -> PNG, lokale Fonts, lokale Assets,
  `embedFont: true` und `loadSystemFonts: false`.
- Das Produktmodell speichert Rezeptbilder als Blob-Referenzen und gibt SAS-
  URLs nur als Response-Details aus; der Backend-Besitznachweis erfolgt vorher
  ueber das Recipe-Repository.
- `Recipe` besitzt Name, Portionen, Tags, `nutritionPerPortion` und
  `images[]`, aber keine gespeicherten Zeit-, Schwierigkeits- oder
  Praesentationsfelder.
- `backend/src/index.ts` registriert aktuell keinen Instagram-Renderer.
- Die Backend-Package-Datei enthaelt die POC-Abhaengigkeiten bereits; Root-
  und Deployment-Locks sind fuer diesen POC-Teil unvollstaendig.
- Das Azure-Function-Bicep verwendet Linux und Node 20 und die bestehende
  Deployment-Organisation verlangt Clean Build, `robocopy /MIR`, Staging-
  Verifikation und `func ... publish --no-build --javascript`.
- `backend/README.md` enthaelt noch den historischen M1-Text, dass Auth und
  viele Handler Stubs seien. Das widerspricht dem aktuellen `auth.ts`, den
  produktiven Handlern und der KB. Dieser Plan folgt der aktuellen
  Implementierung als Verhaltensquelle; B-IR-3 muss die veraltete README-
  Beschreibung entweder aktualisieren oder klar als historische Information
  markieren.
- Der historische Golden-Test misst im aktuellen POC ungefaehr `5.50 %`
  Differenz gegen die unveraenderte V1.7-Datei. Dieser Unterschied ist durch
  die akzeptierten visuellen Aenderungen erklaert und darf nicht durch ein
  groesseres Toleranz-Gate versteckt werden.
- Der aktuelle Arbeitsrender wurde laut bestehendem QA-Report visuell
  akzeptiert; die aktuelle Referenzdatei wurde bewusst noch nicht promoviert.

## 9. Assumptions and Open Questions

### Technische Annahmen

- Dev und Alpha besitzen die vorhandene Function-App, Storage-Konfiguration,
  CIAM-Einstellungen und mindestens ein Recipe mit einem erreichbaren Blob.
- Ein Linux-Node-20-x64-Runner oder eine gleichwertige Packaging-Umgebung steht
  fuer die native Dependency-Installation zur Verfuegung. Windows-
  `node_modules` werden nicht in das Azure-Paket uebernommen.
- Die vorhandenen Fonts, SVGs und PNGs bleiben unveraendert und werden nur an
  den im POC verwendeten dist-relativen Pfad kopiert.
- Ein einzelner Render passt in die vorhandenen Consumption-Ressourcen. Die
  8-MB-Bildgrenze und die lazy Asset-Ladung begrenzen den ersten Meilenstein;
  Performance-Tuning ist ein spaeterer Messpunkt.

### Technische Gates, keine Product-Owner-Entscheidungen

- Wenn der Linux-Runner oder ein echter Dev-Blob fehlt, darf der entsprechende
  Deploy-/E2E-Schritt als `UNVERIFIED` an QA uebergeben werden. Er wird nicht
  durch eine Windows-Native-Installation oder Test-Bypass ersetzt.
- Wenn ein gespeichertes Recipe mehr als vier Tags oder einen zu langen Titel
  besitzt, bleibt der Request deterministisch mit `422` fehlgeschlagen. Eine
  kuenftige Kurzform-/Truncation-Regel benoetigt einen separaten Produktplan.

## 10. Existing Components to Reuse

- `backend/src/lib/instagramRenderer/index.ts` und `render.ts` als alleinige
  Render-API.
- `backend/src/lib/instagramRenderer/types.ts`, `layout.ts`, `compose.ts`,
  `photo.ts`, `tagIcons.ts` und die bestehenden Assetordner.
- `backend/src/lib/instagramRenderer/fixtures/` fuer POC- und Meta-Fixtures.
- `backend/src/lib/instagramRenderer/__tests__/` fuer Renderer-Regressionen.
- `backend/src/lib/repositories/recipesRepository.ts` und die Factory
  `getRecipesRepository()`.
- `backend/src/lib/storage.ts` fuer den bestehenden Blob-Client und die neue
  Download-Funktion.
- `backend/src/lib/auth.ts`, `backend/src/lib/http.ts` und `withHandler()` /
  `parseBody()` fuer Auth, Validierung, Logging und Fehlergrenzen.
- `backend/src/index.ts` und `backend/src/lib/registrations.test.ts` fuer
  Function-Registrierung.
- `backend/tsconfig.json`, `backend/scripts/` und die bestehende Staging-
  Konvention fuer Build und Assetvorbereitung.
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md` und
  `docs/tag-icon-mapping.md` fuer die getrennte historische/aktuelle
  Referenzdokumentation.

## 11. Proposed Technical Solution

### 11.1 Layering

```text
POST /api/recipes/{id}/instagram-render
        |
        v
functions/instagramRecipe.ts
        |
        +--> requireUser + parseBody + RecipesRepository
        +--> storage.downloadRecipeImage(blobName)
        +--> instagramRenderer/recipeAdapter.ts
        +--> renderInstagramRecipe(renderInput)
        v
image/png response
```

Der Handler bleibt Orchestrator. Der Adapter kennt Recipe- und Request-Typen,
aber keine Satori-Layoutdetails. Der Renderer kennt nur `RenderInput` und
bleibt auch ausserhalb des HTTP-Pfads testbar.

### 11.2 Dependency and lock policy

- Die bereits verifizierten POC-Versionen werden nicht ungefragt aktualisiert:
  `satori ~0.33.4`, `@resvg/resvg-js ~2.6.2`, `lucide-static ~1.46.0`,
  `@tabler/icons ~3.46.0`, `sharp ^0.34.5`; `pixelmatch ~7.2.0` bleibt
  test-only.
- Der Root-Lock muss den Backend-Workspace-Eintrag und alle aufgeloesten
  Pakete, Integrities und optionalen nativen Plattformpakete enthalten.
- `_deploy_staging/package.json` enthaelt nur die zur Laufzeit benoetigten
  Renderer-Pakete neben den bestehenden Backend-Runtime-Paketen.
- `_deploy_staging/package-lock.json` wird aus diesem Manifest reproduzierbar
  erzeugt und versioniert. `pixelmatch`, TypeScript und Testpakete gehoeren
  nicht in das Produktions-Staging.
- QA prueft, dass kein Manifest eine andere Renderer-Version einfuehrt, ohne
  dass die planmaessige Stable-Version und der Grund dafuer dokumentiert sind.

### 11.3 Static asset packaging

Der Build-/Release-Vertrag muss den kompletten Ordner
`backend/src/lib/instagramRenderer/assets/` nach
`backend/dist/backend/src/lib/instagramRenderer/assets/` kopieren. Dazu
gehoeren mindestens:

- `fonts/*.ttf` und `fonts/LICENSE.txt`
- `nutrition/*.svg`
- `nutrition-highlights/*.png`
- `branding/micha-logo-writing.svg`
- `branding/fittrack-wordmark.png` als dokumentierter Legacy-Fallback

Der Copy-Schritt wird als reproduzierbares Node-20-Skript oder gleichwertiger
Repository-Schritt ausgefuehrt, nicht als unprotokollierter manueller Einzel-
Copy-Vorgang. Danach spiegelt `robocopy /MIR` den kompletten `dist`-Baum nach
`_deploy_staging/dist`. Der kompilierte Renderer muss im Staging zuerst
`__dirname/assets` verwenden koennen, ohne auf `backend/src` zuzugreifen.

### 11.4 Native Linux runtime

- Staging-`node_modules` wird in Linux Node 20 x64 aus dem Staging-Lockfile mit
  Produktionsabhaengigkeiten erzeugt. Eine auf Windows installierte Sharp-
  oder Resvg-Binary darf nicht deployt werden.
- Der Packaging-Gate prueft `require.resolve()` fuer Satori, Resvg, Sharp,
  Lucide und Tabler sowie den Start des kompilierten Renderers in einer
  Linux-Umgebung.
- Fonts werden explizit eingebettet; System-Fonts bleiben deaktiviert. Ein
  fehlender Asset- oder Native-Binding-Nachweis blockiert den Release.
- Die vorhandenen Function-App-Einstellungen fuer Linux, Node 20,
  `WEBSITE_RUN_FROM_PACKAGE=1` und Functions v4 werden wiederverwendet. Eine
  Bicep-Aenderung ist nicht erwartet.

### 11.5 Persistence impact

**Persistence Impact:** Keine Persistenz-Aenderung, Class 0 / no migration.
Der Request-Adapter verwendet ausschliesslich bestehende Recipe-Felder und
optionale nicht persistierte Request-Werte. Es gibt keinen neuen
Cosmos-Container, keine neue Partition, keine Bicep-Cosmos-Aenderung und
keine Rueckwaertskompatibilitaetsarbeit in Dev oder Alpha. Die Skill-
`cosmos-data-model-and-migration` ist fuer diesen Plan nicht erforderlich.

Eine spaetere Entscheidung, `totalTimeMinutes`, `difficulty` oder
`presentation` dauerhaft zu speichern, muss als eigener Datenmodell-Plan mit
Migrationseinstufung erfolgen.

### 11.6 Golden and reference policy

1. `fittrack_instagram_golden_v1_7_unified_ambient.png` bleibt unveraendert.
   Die bestehenden Werte `pixelmatch threshold 0.10` und `max ratio 0.03`
   werden nicht angehoben, die Datei wird nicht ersetzt.
2. Der historische Vergleich wird aus dem normalen aktuellen Release-Gate
   heraus als expliziter Diagnosepfad aufgerufen, zum Beispiel ueber eine
   eigene Vitest-Konfiguration und ein Script
   `test:instagram:historical`. Der Testinhalt, die Fixture und die Schwellen
   bleiben erhalten. Der bekannte ungefaehre `5.50 %`-Befund wird als erwartete
   historische Abweichung dokumentiert, nicht als gruener aktueller Zielwert.
3. Der normale Testlauf erhaelt einen separaten aktuellen Referenztest fuer
   `fittrack_instagram_current_approved.png`. Diese Datei wird erst im
   Implementierungs-/QA-Schritt aus dem akzeptierten POC-Arbeitsrender
   promoviert, ihre Fixture, Runtime, PNG-Metadaten und SHA-256 werden in der
   Renderer-Dokumentation festgehalten.
4. Der aktuelle Referenztest nutzt fuer die vollstaendige POC-Komposition das
   bestehende Meta-Fixture, weil das vorhandene Render-Script dieses akzeptierte
   Bild erzeugt. Der Endpoint wird zusaetzlich ohne Meta und mit vollstaendiger
   Meta-Anfrage gegen den direkten Renderer-Aufruf verglichen. Dadurch wird
   sowohl die historische Abweichung als auch die neue Adapterstrecke sichtbar,
   ohne die visuelle Komposition neu zu definieren.
5. Ein neuer Pixel- oder Layoutunterschied wird nicht durch ein groesseres
   Toleranzfenster verborgen. Bei Abweichung entstehen Diff-Artefakte und ein
   QA-Finding beziehungsweise ein Backend-Handoff.

## 12. Backend Work Package

### B-IR-1 - API, Auth, Adapter und Storage-Lesepfad

**Agent:** Backend

**Goal**

Die geschuetzte Function, der request-level Adapter und der direkte Blob-
Download werden implementiert, ohne Renderer-Layout oder Recipe-Persistenz zu
duplizieren.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`

**Required Repository Context:**

- `backend/src/index.ts`
- `backend/src/functions/recipes.ts`
- `backend/src/lib/auth.ts`
- `backend/src/lib/http.ts`
- `backend/src/lib/repositories/recipesRepository.ts`
- `backend/src/lib/storage.ts`
- `shared/types/recipes.ts`
- `backend/src/lib/instagramRenderer/types.ts`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/tagIcons.ts`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

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

**Dependencies:**

- Dieser Plan und der bestehende Renderer-PoC.
- Keine Frontend- oder Cosmos-Aenderung.

**Expected Handoff:**

- `instagramRecipe.ts` mit Route, `requireUser()`, `parseBody()`, Repository-
  Zugriff, Blob-Auswahl, Renderer-Aufruf und Response-/Fehlermapping.
- `recipeAdapter.ts` mit den dokumentierten Quellen und Defaults.
- Storage-Download-Funktion mit Blob-Grenze und Testschnittstelle.
- Aktualisierter Import in `backend/src/index.ts`.
- Eine kurze API-Vertragszusammenfassung fuer Infrastructure und QA.

### B-IR-2 - Dependency-, Asset- und Build-Vertrag

**Agent:** Backend

**Goal**

Die bestehenden POC-Abhaengigkeiten werden im Repository-Lock reproduzierbar
verankert und ein deterministischer Asset-Copy-Schritt fuer `dist` wird als
Build-Vertrag bereitgestellt.

**Required Knowledge Base:**

- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**

- `backend/package.json`
- `package.json`
- `package-lock.json`
- `backend/tsconfig.json`
- `backend/src/lib/instagramRenderer/assets/`
- `backend/scripts/render-golden.mjs`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-12
- AC-13
- AC-14
- AC-15
- AC-18
- AC-19

**Dependencies:**

- B-IR-1 liefert den stabilen Function-/Adapter-Code.

**Expected Handoff:**

- Root-Lockfile mit den aufgeloesten Renderer-Runtime-Paketen.
- Ein deterministischer Asset-Copy-Schritt oder Script mit Source-/Target-
  Pfad und vollstaendiger Assetliste.
- Dokumentierte Trennung von Runtime- und Test-Dependencies.
- Handoff an Infrastructure mit dem erwarteten Staging-Manifest und dem
  Linux-Node-20-Paketvertrag.

### B-IR-3 - API- und Renderer-Dokumentation

**Agent:** Backend

**Goal**

Den neuen API-Vertrag, die fehlenden Metadaten, die Server-Mappings und die
aktuelle/historische Golden-Politik in den zustaendigen Dokumenten festhalten.

**Required Knowledge Base:**

- `docs/kb/README.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/tech/02-backend.md`

**Required Repository Context:**

- `docs/kb/tech/09-api-reference.md`
- `docs/kb/tech/02-backend.md`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`
- `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Azure-Function-Integration.md`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-4
- AC-5
- AC-10
- AC-18
- AC-19
- AC-20

**Dependencies:**

- B-IR-1 und B-IR-2.

**Expected Handoff:**

- API-Reference-Eintrag mit Route, Request, Response, Auth und Fehlern.
- Backend-/Deploy-Hinweis fuer direkte Blob-Downloads und Asset-Paketierung.
- Renderer-Dokumentation mit aktueller Referenz, historischer V1.7-Diagnose
  und ohne widerspruechliche Behauptung ueber das aktive Wortmarken-Asset.

## 13. Infrastructure and Release Work Package

### I-IR-1 - Linux-Paket und Staging vorbereiten

**Agent:** Infrastructure

**Goal**

Ein deploybares `_deploy_staging`-Paket mit gesperrten Runtime-Abhaengigkeiten,
Linux-nativen Modulen, kompiliertem Code und allen Renderer-Assets erzeugen und
vor einer Function-Publikation pruefen.

**Required Knowledge Base:**

- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

**Required Repository Context:**

- `backend/package.json`
- `package-lock.json`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`
- `_deploy_staging/host.json`
- `backend/tsconfig.json`
- `backend/src/lib/instagramRenderer/assets/`
- `infra/modules/functionapp.bicep`
- `infra/release-records/US_Daily-Insight-Feedback-Status_Alpha-Deploy-and-Closure_Evidence.md`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-12
- AC-13
- AC-14
- AC-15
- AC-21

**Dependencies:**

- B-IR-1, B-IR-2 und B-IR-3.
- Linux Node 20 x64 Packaging-Umgebung.

**Expected Handoff:**

- Staging-Manifeste und Locks mit allen Runtime-Renderer-Paketen.
- Nachweis, dass `sharp` und `@resvg/resvg-js` aus Linux-kompatiblen
  Abhaengigkeiten stammen.
- `backend/dist` mit kopierten Assets und identischer Spiegelung in
  `_deploy_staging/dist`.
- Positiver Pfadcheck fuer die neue kompilierte Function und alle Fonts/SVGs/
  PNGs.
- Release-Entscheidung `Dev Build Required: NO`, da kein Mobile-Code und keine
  native Mobile-Konfiguration betroffen ist.

### I-IR-2 - Dev Function deployen und verifizieren

**Agent:** Infrastructure

**Goal**

Den neuen Backend-Pfad in der Development-Funktion mit dem bestehenden
Clean-Build-, Mirror- und `--no-build`-Ablauf bereitstellen und die Laufzeit-
Voraussetzungen nachweisen.

**Required Knowledge Base:**

- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

**Required Repository Context:**

- `_deploy_staging/`
- `backend/src/functions/instagramRecipe.ts`
- `backend/src/lib/instagramRenderer/assets/`
- `backend/src/lib/registrations.test.ts`
- `infra/modules/functionapp.bicep`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-2
- AC-3
- AC-8
- AC-14
- AC-15
- AC-21

**Dependencies:**

- I-IR-1 muss ohne Packaging- oder Assetfehler abgeschlossen sein.
- QA muss die lokalen Gates aus Q-IR-1 bestanden oder als nicht deployrelevantes
  `UNVERIFIED` gekennzeichnet haben.

**Expected Handoff:**

- FitTrack Release Report fuer Dev mit Build-, Mirror-, Function-List- und
  Health-Check-Nachweis.
- Authentifizierter Endpoint-Smoke-Nachweis oder explizite manuelle
  Validierungsanweisung, falls kein Dev-Token/Recipe vorhanden ist.
- Kein EAS- oder Dev-Build-Auftrag.

### I-IR-3 - Alpha Release als explizit angeforderter Betriebsschritt

**Agent:** Infrastructure

**Goal**

Nach bestandenem Dev-Gate und einer separaten expliziten Nutzeranfrage
`Deploy to Alpha` denselben verifizierten Backend-Pfad nach Alpha bringen.

**Required Knowledge Base:**

- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

**Required Repository Context:**

- `_deploy_staging/`
- `infra/main.bicep`
- `infra/parameters/alpha.bicepparam`
- `infra/modules/functionapp.bicep`
- `docs/kb/tech/05-authentication.md`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-3
- AC-8
- AC-14
- AC-15
- AC-21

**Dependencies:**

- I-IR-2 Dev-Nachweis.
- Expliziter Alpha-Deploy-Auftrag. Alpha wird nicht automatisch ausgefuehrt.

**Expected Handoff:**

- Alpha Release Report mit gegebenenfalls zuerst angewendeter Infrastruktur,
  danach Backend-Publikation, Function-Liste, Health-Check und Endpoint-
  Smoke-Test.
- Aussage, dass kein Expo Preview Build erforderlich war.

## 14. QA Work Package

### Q-IR-1 - Request-, Adapter-, Auth- und Renderer-Integrationstests

**Agent:** QA

**Goal**

Alle positiven, negativen und Randfaelle des neuen Backend-Pfads sowie die
Paritaet zum bestehenden Renderer automatisiert pruefen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/09-api-reference.md`
- `docs/kb/domain/06-recipes.md`

**Required Repository Context:**

- `backend/src/functions/instagramRecipe.ts`
- `backend/src/functions/recipes.test.ts`
- `backend/src/lib/instagramRenderer/recipeAdapter.ts`
- `backend/src/lib/instagramRenderer/render.ts`
- `backend/src/lib/instagramRenderer/types.ts`
- `backend/src/lib/instagramRenderer/fixtures/`
- `backend/src/lib/instagramRenderer/__tests__/`
- `backend/src/lib/repositories/recipesRepository.ts`
- `backend/src/lib/storage.ts`
- `backend/src/lib/auth.ts`
- `backend/src/lib/registrations.test.ts`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

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
- AC-16
- AC-17

**Dependencies:**

- B-IR-1 implementiert den Pfad und B-IR-2 liefert den Build-/Asset-Vertrag.

**Expected Handoff:**

- Bestehende oder neue Unit-Tests fuer Auth, Ownership, Request-Defaults,
  Meta-Verhalten, Bildauswahl, Storage-Fehler, Renderer-Fehler und PNG-Header.
- Nachweis, dass Client-Titel, Nutrition, Portionen und Blobnamen ignoriert
  oder abgelehnt werden.
- Registrierungs- und Build-Verification-Ergebnis.
- Liste verbleibender `UNVERIFIED`-Checks fuer Infrastructure.

### Q-IR-2 - Golden-, Asset- und Release-Gate

**Agent:** QA

**Goal**

Die aktuelle Referenzstrategie, die historische Abweichung und die gebuendelte
Azure-Runtime unabhaengig gegen die Acceptance Criteria pruefen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

**Required Repository Context:**

- `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`
- `backend/src/lib/instagramRenderer/__tests__/current-reference.test.ts`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png`
- `backend/src/lib/instagramRenderer/test-fixtures/golden/fittrack_instagram_current_approved.png`
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`
- `backend/src/lib/instagramRenderer/assets/`
- `backend/dist/backend/src/lib/instagramRenderer/`
- `_deploy_staging/dist/backend/src/lib/instagramRenderer/`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-12
- AC-13
- AC-14
- AC-16
- AC-18
- AC-19
- AC-20

**Dependencies:**

- Q-IR-1.
- I-IR-1 erzeugt das Linux-kompatible Staging-Paket.

**Expected Handoff:**

- QA-Report unter
  `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Azure-Function-Integration.md`.
- Aktueller Referenzvergleich inklusive Fixture-Provenienz, PNG-Metadaten und
  Hash.
- Historischer V1.7-Lauf mit unveraendertem Threshold/Gate und gemessenem
  bekannten Differenzwert, getrennt vom aktuellen Gate.
- Asset- und Staging-Manifestbefund.
- Klare Freigabe oder konkrete Findings fuer den Orchestrator.

### Q-IR-3 - Post-Deploy- und manuelle E2E-Validierung

**Agent:** QA

**Goal**

Die tatsaechliche Azure-Function-Antwort in Dev und nach expliziter Alpha-
Bereitstellung gegen den lokalen Adapter-/Renderer-Vertrag pruefen.

**Required Knowledge Base:**

- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**

- `docs/kb/tech/09-api-reference.md`
- `_deploy_staging/`
- `backend/src/functions/instagramRecipe.ts`
- `backend/src/lib/instagramRenderer/fixtures/`
- `infra/release-records/`

**Required Skills:**

- None

**Relevant Acceptance Criteria:**

- AC-3
- AC-8
- AC-9
- AC-14
- AC-15
- AC-21

**Dependencies:**

- I-IR-2 Dev-Deployment-Report.
- I-IR-3 nur nach expliziter Alpha-Anforderung.

**Expected Handoff:**

- Status der Dev-/Alpha-HTTP-Pruefung mit Auth, PNG-Headers, Dimensionen und
  sichtbarer Bilddatei.
- `UNVERIFIED`-Markierung, wenn kein echter Benutzer-Token, Blob oder
  geeigneter Client vorhanden ist; kein Test-Bypass.
- Abschlussbeitrag fuer den QA-Report.

## 15. Shared Package Changes

Keine. `shared/types/recipes.ts` bleibt unveraendert. Der API-Request ist ein
backend-only Vertrag, weil Mobile in diesem Meilenstein keinen Client konsumiert
und keine gemeinsame TypeScript-Oberflaeche fuer die Renderfunktion benoetigt
wird. Falls spaeter ein Mobile-Client hinzukommt, wird der Request-Vertrag dann
als additive shared/API-Typaenderung geplant.

## 16. Infrastructure and Configuration - Development and Alpha

### Development

1. Backend liefert Code, Lockfile-Anforderungen und Asset-Copy-Vertrag.
2. Infrastructure erzeugt die Linux-Node-20-Staging-Abhaengigkeiten und baut
   das Paket. Kein Windows-`node_modules` wird weiterverwendet.
3. Falls keine Bicep- oder App-Setting-Aenderung erforderlich ist, ist der
   Infrastruktur-Apply-Schritt `N/A`; andernfalls wird Dev-Infrastruktur vor
   dem Backend-Deploy angewendet.
4. `backend/dist` wird sauber gebaut, Assets werden kopiert und per
   `robocopy /MIR` nach `_deploy_staging/dist` gespiegelt.
5. `Test-Path` auf die kompilierte neue Function und einen Font-/SVG-/PNG-
   Pfad muss erfolgreich sein.
6. Die Publikation erfolgt aus `_deploy_staging` mit
   `func azure functionapp publish ... --no-build --javascript`.
7. Nach dem Deploy werden Function-Liste, Health-Check und ein authentifizierter
   Render-Smoke geprueft.

### Alpha

- Alpha wird nie automatisch angewendet. Der Orchestrator wartet auf den
  separaten expliziten Deploy-Auftrag.
- Falls Bicep oder App Settings in der Umsetzung unveraendert bleiben, ist der
  Alpha-Infrastruktur-Schritt `N/A`; andernfalls gilt strikt Infrastruktur vor
  Backend-Publikation.
- Das bereits verifizierte Linux-Staging-Paket wird nach dem Dev-Gate erneut
  sauber gebaut beziehungsweise freigegeben und von `_deploy_staging` aus
  publiziert.
- Es gibt keinen Expo Preview Build, weil nur Backend-Code, Backend-Locks und
  Backend-Assets betroffen sind.
- Der Release Report muss Auth, Function-Liste, Health-Check und den neuen
  Route-Smoke getrennt ausweisen.

## 17. Documentation Updates

Vor QA-Abschluss aktualisieren die zustaendigen Agenten nur die direkt
betroffenen Dokumente:

- `docs/kb/tech/09-api-reference.md`: Route, Request-Defaults, Auth,
  serverseitige Recipe-Quelle, PNG-Erfolg und Fehlerstatus.
- `docs/kb/tech/02-backend.md`: neues Function-Modul, Adapter-/Storage-
  Layering und Build-Asset-Vertrag.
- `docs/kb/tech/07-infrastructure.md`: Renderer-Pakete, Linux-native
  Staging-Abhaengigkeiten, Asset-Mirror und Verifikationsschritt.
- `backend/README.md`: den veralteten M1-Auth-/Stub-Abschnitt an den aktuellen
  JWT-/Handler-Zustand angleichen oder eindeutig als historische Information
  kennzeichnen.
- `backend/src/lib/instagramRenderer/docs/golden-metrics.md`: historische
  V1.7-Datei, aktuelle Referenz, Provenienz und getrennte Gates.
- `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`: aktive
  Wortmarken-/Assetbeschreibung ohne den bekannten widerspruechlichen
  Legacy-Status als aktuellen Zustand.

Die User-Story-Dateien werden nicht veraendert. Der vorliegende Plan bleibt das
separate technische Artefakt. `docs/qa/findings.md` wird nicht von QA
gepflegt; der Orchestrator uebernimmt nur tatsaechlich bestaetigte Findings.

## 18. Test Strategy

### Unit and handler tests

- Adaptertests decken alle Defaults, optionale Meta-Zeile, serverseitige
  Nutrition-/Tag-/Portionsquellen, ungultige Eingaben und Overflow ab.
- Functiontests decken `401`, Ownership/`404`, fehlendes Bild, falsches
  `imageId`, zu grossen/defekten Blob, kontrollierte `422`-Rendererfehler,
  generisches `500`, PNG-Headers und `Cache-Control` ab.
- Tests mocken Repository, Storage und Renderer; sie greifen nicht auf Azure
  Cosmos oder Blob Storage zu.
- `registrations.test.ts` prueft den Import des neuen Function-Moduls.

### Renderer and reference tests

- Bestehende fokussierte Renderer-Tests bleiben aktiv.
- Ein aktueller Referenztest prueft den akzeptierten POC-Stand und die
  `1080 x 1350`-Metadaten.
- Ein Integrationsvergleich rendert einen identischen Input einmal direkt und
  einmal ueber den Handler; die PNG-Buffer muessen im selben Zielruntime-Gate
  identisch sein.
- Der historische V1.7-Vergleich bleibt als expliziter Diagnosepfad mit den
  unveraenderten Konstanten und dem dokumentierten ungefaehren `5.50 %`-Befund.

### Build and package tests

- `npm run build:verify --workspace=backend` prueft Kompilierung und den
  bestehenden Shared-Import-Gate.
- Der Asset-Copy-Schritt wird auf Vollstaendigkeit und Zielpfad geprueft.
- Ein Linux-Node-20-Staging-Smoke importiert den kompilierten Renderer aus dem
  Paket mit Fonts, SVGs, PNGs und nativen Modulen.
- QA fuehrt die betroffenen Backend-Unit-Tests und den expliziten historischen
  Diagnosebefehl getrennt aus. Ein historischer erwarteter Nicht-Null-Lauf ist
  kein aktueller Release-Pass und kein stiller Testfehler.

### Release tests

- Dev: Function-Liste, Health-Check, Auth und ein Rezeptbild mit PNG-Headers.
- Alpha: dieselben Checks nur nach ausdruecklicher Alpha-Anforderung.
- Fehlende Credentials, fehlendes Recipe oder fehlender Real-Blob werden als
  `UNVERIFIED` beziehungsweise manuelle Validierung ausgewiesen, nicht durch
  Testdaten in Produktionsumgebungen ersetzt.

## 19. Acceptance Criteria

| ID | Testbare Bedingung |
|---|---|
| AC-1 | `renderInstagramRecipe()` bleibt der einzige Layout-/Render-Aufruf; das Ausgabeformat bleibt PNG mit exakt `1080 x 1350` Pixeln und die bestehende POC-Komposition wird nicht neu gestaltet. |
| AC-2 | `POST /api/recipes/{id}/instagram-render` ist als importiertes Azure-Function-Modul registriert und akzeptiert nur `POST`; die Registrierungspruefung besteht. |
| AC-3 | Ohne gueltigen Bearer antwortet der Pfad mit `401`; ein gueltiger User kann nur sein eigenes privates Recipe rendern, nicht ein fremdes oder nicht existentes. |
| AC-4 | `{}` rendert mit `focusX=0.5`, `focusY=0.46`, `zoom=1.0` und ohne Meta-Zeile; einzelne fehlende Presentation-Felder werden einzeln defaultet, ungueltige Werte werden mit `400` abgewiesen. |
| AC-5 | Titel, Tags, Portionen und `nutritionPerPortion` werden ausschliesslich aus dem serverseitig geladenen Recipe gebildet; vom Client gelieferte Ersatzwerte oder Blobnamen werden nicht akzeptiert oder nicht verwendet. |
| AC-6 | Ohne `imageId` wird das deterministisch erste Bild verwendet; ein unbekanntes `imageId` ergibt `404`; der direkte Blob-Download verwendet nur das nach Ownership gelesene `blobName` und nie einen Client-SAS-URL. |
| AC-7 | Fehlende Zeit/Schwierigkeit fuehrt ohne `recipeMeta` zu keiner Meta-Zeile und zu keinem erfundenen Wert; partielle Request-Meta ergibt `400`; vollstaendige Request-Meta nutzt die gespeicherten Portionen; ungueltige gespeicherte Portionen ergeben `422`. |
| AC-8 | Eine erfolgreiche Antwort ist ein direkter PNG-Body mit `200`, `Content-Type: image/png`, `Content-Disposition: inline`, `Content-Length` und `Cache-Control: no-store`; sie enthaelt kein Base64- oder JSON-Wrapper-Objekt. |
| AC-9 | Erwartbare Input-/Layout-/Bildfehler werden mit den festgelegten `400`/`404`/`422`-Statuswerten und stabilen Codes behandelt; interne Ursachen, Stacktraces und Assetdetails werden nicht an den Client geleakt und unerwartete Fehler werden zu generischem `500`. |
| AC-10 | Es werden keine `Recipe`-Felder, shared Types, Cosmos-Container, Partition Keys oder Rezeptdokumente geaendert; das Render-Ergebnis wird nicht persistiert. |
| AC-11 | Handler und Adapter enthalten keine Satori-Nodes, Layoutkoordinaten, Font-/Icon-Registry oder eigene Nutrition-Rundung; diese Entscheidungen bleiben im Renderer. |
| AC-12 | Root-Lock und Backend-/Staging-Manifeste enthalten alle benoetigten Runtime-Pakete mit reproduzierbaren aufgeloesten Versionen und Integrities; `pixelmatch` bleibt test-only. |
| AC-13 | Ein Linux-Node-20-x64-Paket enthaelt Linux-kompatible `sharp`-/Resvg-native Module; ein isolierter Paket-Smoke importiert den kompilierten Renderer ohne Windows-Binaries oder System-Font-Abhaengigkeit. |
| AC-14 | Fonts, Lizenzdatei, SVGs, PNGs und Legacy-Fallback liegen im dist-relativen Assetpfad und nach `robocopy /MIR` identisch unter `_deploy_staging/dist`; die neue Function-Datei ist im Staging vorhanden. |
| AC-15 | Dev- und gegebenenfalls Alpha-Deploy folgen Clean Build -> Asset-Copy -> `robocopy /MIR` -> `Test-Path` -> Publish aus `_deploy_staging` mit `--no-build --javascript`; Alpha bleibt explizit angefordert und Infrastruktur kommt vor Backend, falls Bicep betroffen ist. |
| AC-16 | Der aktuelle Referenztest fuer `fittrack_instagram_current_approved.png` besteht gegen den akzeptierten POC-Stand; Fixture, Runtime, Dimensionen und Hash sind dokumentiert und die Datei wird nur nach QA-Gate promoviert. |
| AC-17 | Der historische V1.7-Test behalt die Originaldatei, Fixture, `0.10`-Threshold und `0.03`-Gate; der bekannte ungefaehre `5.50 %`-Mismatch wird separat diagnostiziert und nicht durch Toleranzanhebung, Fixture-Ersetzung oder Testloeschung verborgen. |
| AC-18 | Unit- und Handlertests decken Auth, Ownership, Defaults, Meta, Bildauswahl, Storagefehler, Rendererfehler, Response-Header und Registrierung ab; `build:verify` besteht. |
| AC-19 | `docs/kb/tech/09-api-reference.md`, Backend-/Infrastructure-Dokumentation und Renderer-Golden-Dokumentation beschreiben den implementierten Zustand und behaupten fehlende Metadaten nicht als persistente Felder. |
| AC-20 | Es gibt keine Aenderung an `mobile/src`, `mobile/package.json`, `app.config.js`, Native-Projekten oder EAS-Konfiguration; Infrastructure meldet `Dev Build Required: NO`. |

## 20. Risks and Edge Cases

| Risiko / Fall | Behandlung |
|---|---|
| Windows-native `sharp`/Resvg-Binaries im Linux-Paket | Linux-Installation aus Staging-Lock erzwingen, Plattformpruefung und isolierten Start vor Publish ausfuehren. |
| Assets werden von `tsc` nicht kopiert | Repository-Copy-Schritt, dist-relativer Pfadtest und `robocopy /MIR`-Manifest als Release-Gate. |
| Lockfiles driften zwischen Workspace und Staging | Root-, Backend- und Staging-Manifeste nach jeder Dependency-Aenderung synchronisieren; QA prueft Version/Integrity. |
| Fehlende Zeit oder Schwierigkeit im bestehenden Recipe | Meta-Zeile ganz weglassen; keine Platzhalter, keine inferierte Dauer und keine Cosmos-Aenderung. |
| Recipe hat mehr als vier Tags oder langen Titel | Renderer meldet kontrollierten Fehler; Endpoint liefert `422`; keine stille Kuetzung oder Layoutkopie. |
| Keine Bilder oder defekter Blob | Kein leerer Platzhalter. Status und Fehlercode wie im API-Vertrag; technische Inkonsistenz wird geloggt. |
| Stale `_deploy_staging/dist` | Clean Build, `robocopy /MIR`, `Test-Path` auf neue Function und Asset vor jedem Publish. |
| Historisches Golden bleibt rot | Historischen Test unveraendert als Diagnose ausfuehren; aktuelles Gate auf eigene akzeptierte Referenz und direkte Endpoint-Paritaet setzen. |
| Cross-platform Anti-Aliasing | Referenz im Zielruntime-Gate erzeugen; lokale Windows-Vergleiche nur diagnostisch verwenden und nicht durch breitere Toleranz kompensieren. |
| Private Bilddaten in Proxies/Logs | `no-store`, keine SAS-URL im Render-Response, keine Buffer-/Token-Logs und generische externe Fehler. |
| Fehlende Azure-Credentials oder Dev-Recipe | Als `UNVERIFIED`/manuelle Validierung melden; keine Auth-Bypasses und keine echten Geheimnisse in Tests oder Dokumentation. |
| Spaetere Nachfrage nach persistenter Presentation | Separater Planner-/Cosmos-Plan erforderlich; nicht in diesem Endpoint still einfuehren. |

## 21. Recommended Execution Order

Der Orchestrator fuehrt die Schritte strikt in dieser Reihenfolge aus. Jeder
Schritt liefert den genannten Handoff, bevor der naechste beginnt.

1. **B-IR-1:** API-Vertrag, Auth, Ownership, Blob-Download, Adapter und
   Function-Registrierung implementieren.
2. **B-IR-2:** Root-Lockfile synchronisieren, Asset-Copy-Vertrag im Backend
   bereitstellen und Runtime-/Test-Dependency-Grenze dokumentieren.
3. **B-IR-3:** API-, Backend-, Infrastructure- und Renderer-Dokumentation auf
   den geplanten implementierten Vertrag vorbereiten.
4. **I-IR-1:** Linux-Node-20-Staging-Abhaengigkeiten erzeugen, Assets in
   `dist`/Staging spiegeln und native/isolierte Packaging-Gates ausfuehren.
5. **Q-IR-1:** Handler-, Adapter-, Auth-, Storage-, Fehler- und
   Registrierungstests ausfuehren und fehlende Abdeckung zurueckgeben.
6. **Q-IR-2:** Aktuelle Referenz pruefen oder nach dem Gate promovieren,
   historischen V1.7-Diagnosepfad ausfuehren, Asset-/Staging-Manifest und
   `build:verify` bewerten.
7. **I-IR-2:** Nach bestandenem QA-Gate Dev clean bauen, spiegeln, publizieren
   und mit Function-Liste, Auth und Render-Smoke verifizieren.
8. **Q-IR-3:** Dev-E2E pruefen und den QA-Report abschliessen. Fehlende echte
   Credentials oder Blobdaten als `UNVERIFIED` ausweisen.
9. **I-IR-3:** Nur nach einem separaten expliziten `Deploy to Alpha`-Auftrag:
   gegebenenfalls Alpha-Infrastruktur anwenden, danach denselben verifizierten
   Backend-Pfad publizieren und den Release Report erstellen.
10. **Orchestrator-Handoff:** Plan-ACs, Backend-Handoffs, QA-Report,
    Release-Reports und offene technische Findings zusammenfuehren. Keine
    Mobile-Arbeit und kein EAS-Build werden aus diesem Plan abgeleitet.

**Endzustand des ersten Meilensteins:** Der Backend-Endpoint ist authentifiziert,
user-scoped, deterministic, asset-complete, Linux-kompatibel getestet und aus
dem bestehenden Azure-Function-Deploymentweg bereitstellbar. Der visuelle POC
bleibt die Autoritaet; Mobile wartet auf einen eigenen Folgeauftrag.