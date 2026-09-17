## Aktive Footer-Wortmarke

Der aktive Footer verwendet seit B-IPR-1 die transparente SVG-Kopie. Diese
Beschreibung ist der aktuelle Renderer-Zustand; die spaetere PNG-Beschreibung
weiter unten ist ausschliesslich historischer Fallback.

- **Aktives Asset:** [`../assets/branding/micha-logo-writing.svg`](../assets/branding/micha-logo-writing.svg)
- **Quelle:** `mobile/assets/brand/micha_logo_writing_02.svg`
- **ViewBox:** `0 0 1197.24 197.35`
- **Renderer-Pfad:** UTF-8-SVG mit `image/svg+xml`; die Rasterbild-
   Hintergrundnormalisierung wird auf diesen Pfad nicht angewendet.
- **Position:** Layoutbox `x=460`, `y=1242`, `width=160 px`, proportional
   `height=26.3739935...`, horizontal auf `x=540` zentriert.
- **Transparenz:** keine vollflaechige Hintergrund-`rect`; transparente
   Ecken zeigen weiterhin das Ambient-Feld.
# Recipe Tag → Icon Mapping (Alpha, v1)

**Status:** Reference. Wird vom PoC-Renderer als Grundlage für das Tag-Icon-Rendering verwendet.  
**Zweck:** Gemeinsame Design-Referenz für Tag-Pills auf der Instagram-Share-Karte und späteren Rezept-Screens.  
**Grundlage:** Auswertung aller Rezept-Tags in der Alpha-Cosmos-DB (Stand 2026-09-15, 12 Rezepte, 25 einzigartige Tags).

## Icon-Bibliotheken

- **Primär:** [Lucide](https://lucide.dev) (MIT), feste gepinnte Version.
- **Ausnahmen:** [Tabler Icons](https://tabler.io/icons) (MIT), nur wo Lucide keine passende Entsprechung hat.
- **Prinzip:** Nicht jeder Tag muss ein Icon haben. Tags ohne semantisch tragfähiges Icon bleiben icon-los und werden nur als Text-Pill dargestellt.

## Mapping-Tabelle

| Tag (Alpha) | Icon-Name | Bibliothek |
|---|---|---|
| **Schnell** | `timer` | Lucide |
| **Vegetarisch** | `leaf` | Lucide |
| **Familienrezept** | `house-heart` | Lucide |
| **Backen** | `microwave` *(closest available appliance icon; no exact oven asset installed)* | Lucide |
| **Gesund** | `heart-pulse` | Lucide |
| **Snack** *(inkl. Legacy-Wert `Snacks`)* | `popcorn` | Lucide |
| **Wraps** | `sandwich` | Lucide |
| **Salat** | `salad` | Lucide |
| **Grillen** | `flame` | Lucide |
| **Italienisch** | `pizza` | Lucide |
| **Vollkorn** | `wheat` | Lucide |
| **Sauerteig** | `bread` | Tabler (`@tabler/icons@3.46.0`, package-relativer Specifier `@tabler/icons/outline/bread.svg`, physischer Paketpfad `icons/outline/bread.svg`) |
| **Dessert** | `cake-slice` | Lucide |
| **Klassisch** | `book-open` | Lucide |
| **Einfach** | `sparkles` | Lucide |
| **Frühstück** | `croissant` | Lucide |
| **Kontaktgrill** | `flame` *(reuse)* | Lucide |
| **Hähnchen** | `drumstick` | Lucide |
| **Curry** | — *(kein Icon)* | — |
| **One Pot** | `cooking-pot` | Lucide |
| **Pasta** | `bowl` | Tabler (`@tabler/icons@3.46.0`, package-relativer Specifier `@tabler/icons/outline/bowl.svg`, physischer Paketpfad `icons/outline/bowl.svg`) |
| **Fingerfood** | `hand-platter` | Lucide |

## Nährwert-Badges (nicht Teil der Tag-Pills)

Diese Werte kommen im Datenbestand auch als Tags vor, gehören aber in ein separates **Nährwert-Badge-System**. Auf der Share-Karte wird maximal ein Badge oben rechts dargestellt.

| Wert | Badge-Asset | Auslöser (offen für Produktion) |
|---|---|---|
| **Proteinreich** | [`../assets/nutrition-highlights/high-protein.png`](../assets/nutrition-highlights/high-protein.png) | Schwellwert Protein/Portion — noch festzulegen |
| **Fettreduziert** | [`../assets/nutrition-highlights/low-fat.png`](../assets/nutrition-highlights/low-fat.png) | Schwellwert Fett/Portion — noch festzulegen |

### Badge-Regeln
- **Ableitung, nicht Tag:** Badges werden aus den Nährwerten pro Portion berechnet, nicht aus einem manuellen Tag. Bestehende Tags `Proteinreich` und `Fettreduziert` bleiben lesbar, führen aber selbst nicht mehr zum Badge — der Nährwert entscheidet.
- **Max. Anzahl auf der Share-Karte:** 1.
- **Konkurrenzregel** wenn mehrere Bedingungen zutreffen: offen (Vorschlag: Priorität `HIGH PROTEIN` > `LOW FAT` > weitere).
- **Renderer-Kontrakt:** `nutritionHighlight: "high-protein" | "low-fat" | null`. `null` = kein Badge, das restliche Layout bleibt unverändert.

### Offene Design-Entscheidungen (Post-PoC)
- Konkrete Schwellwerte für `HIGH PROTEIN` und `LOW FAT`
- Weitere Badge-Kategorien (`LOW CARB`, `HIGH FIBER`, `LOW SUGAR`, …) inkl. Assets
- Anzeige-Ort außerhalb der Share-Karte (Rezept-Detail, Rezept-Liste, Filter)

### Historischer PNG-Fallback

[`../assets/branding/fittrack-wordmark.png`](../assets/branding/fittrack-wordmark.png)
ist die Kopie aus `mobile/assets/brand/fittrack_wordmark_v1.png`. Sie bleibt
als historische Vergleichs- und Fallback-Datei im isolierten Asset-Set, ist
aber nicht das aktive Standard-Asset.

Das 24-Bit-PNG besitzt keinen Alpha-Kanal und hat einen nahezu schwarzen
Rechteck-Hintergrund (ungefaehr `RGB (3, 6, 4)`). Die fruehere
Hintergrundnormalisierung und das Ambient-Feld zum Verschlucken dieser Box
gehoeren nur zu diesem Fallback-Pfad. Der aktive SVG-Pfad verwendet keine
solche Rechteck-Normalisierung.

## Regeln für den Verbrauch

1. **Fallback für unbekannte Tags:** Text-Pill ohne Icon. Kein generisches `tag`-Symbol erzwingen.
2. **Bewusst icon-lose Tags** (aktuell nur `Curry`): explizit im Mapping als leerer Eintrag geführt, damit klar ist, dass es keine Lücke, sondern eine bewusste Entscheidung ist.
3. **Legacy-Normalisierung im PoC:** Der Golden-Fixture-Wert `Snacks` (Plural) bleibt für das Golden-Bild bestehen. Die spätere fachliche Normalisierung auf `Snack` ist davon unabhängig.
4. **Tabler-Ausnahmen** (`bread`, `bowl`): Stroke-Width, Größe und Farbe müssen im Rendering optisch auf Lucide-Standard angeglichen werden:
   - `stroke-width: 2` (Tabler-Default ist kompatibel, ggf. minimal auf `2.1` erhöhen)
   - `stroke-linecap: round`, `stroke-linejoin: round`
   - `stroke: currentColor` — Farbe kommt aus Design-Token (`#B9EF12` für Icons auf Tag-Pills)
5. **Erweiterung der Tabelle:** Neue Tags werden vor Feature-Nutzung in dieser Datei ergänzt.

## Änderungshistorie

| Datum | Änderung |
|---|---|
| 2026-09-15 | Initiale Version, Auswertung aus Alpha-Cosmos |
| 2026-09-15 | Nährwert-Badge-Assets referenziert |
| 2026-09-15 | Footer-Wortmarke referenziert |
| 2026-09-15 | PoC-Footer-Workaround dokumentiert |
| 2026-09-15 | Migration nach `backend/src/lib/instagramRenderer/`, Pfade angepasst |
| 2026-09-16 | B-IPR-1: transparente SVG als aktiver Footer, PNG nur historischer Fallback |
| 2026-09-16 | B-IR-3: aktives Wortmarken-Asset und historischer PNG-Fallback eindeutig getrennt |
