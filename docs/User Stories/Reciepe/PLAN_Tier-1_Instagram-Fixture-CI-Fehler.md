# Tier 1: Offline-faehige Instagram-Detailtests

Status: Implemented; lokale Verifikation bestanden, Linux-CI-Verifikation ausstehend.
Infrastructure Impact: None
Mobile Build Impact: None

## Assessment

Accept as proposed. Ziel ist eine vollstaendig gruene Tier-1-Suite ohne Abschwaechung der Assertions. Keine Produktentscheidung, AI-Aenderung, API-Aenderung oder Cosmos-Migration erforderlich.

## Befund vom 2026-10-03

- `npm test --workspace=backend -- --no-cache`: 62 Dateien und 1160 Tests bestanden auf dem lokalen Windows-System, darunter alle 23 Detailtemplate-Tests.
- `npm run typecheck --workspace=shared --workspace=backend --workspace=mobile`: alle drei Typechecks bestanden.
- `npm run verify:daily-insight-prompt --workspace=backend`: bestanden, sieben Script-Tests und zwei Manifest-Tests.
- `node scripts/check-encoding.mjs`: bestanden.
- `gefluegelfrikadellen-details.ts` referenziert ein lokales Foto unter `backend/output/alpha-recipe-assets/`. `git ls-files -- backend/output/alpha-recipe-assets` liefert keine versionierten Dateien.
- `nine-ingredients-details.ts` und `twenty-ingredients-details.ts` uebernehmen dieses Bild. Alle acht gemeldeten Assertion-Fehler verwenden direkt oder im zweiten Renderaufruf diese Abhaengigkeit.
- `renderInstagramRecipeDetailsTemplate()` laedt das Bild vor den Textmessungen. Ein fehlendes Foto erzeugt ueber `loadPhoto()` einen `UnreadableImageError`, den der Detailrenderer aktuell als `INTERNAL` zurueckgibt. Deshalb erreicht auch der erwartete Description-Overflow die Layoutpruefung nicht.
- Das bestehende `backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png` ist versioniert und wird bereits von der erfolgreichen Quarkbroetchen-Fixture verwendet.

Die fehlende Checkout-Verfuegbarkeit des Alpha-Fotos ist belegt. Der konkrete CI-Fehlergrund in `error.cause` wurde nicht bereitgestellt; die Zuordnung aller CI-Assertions zu dieser Ursache ist eine stark gestuetzte Hypothese, noch kein ausgefuehrter Linux-Nachweis. Die Ubuntu-26-Migrationsmeldung allein belegt keinen Testfehler.

## Scope und Loesung

Nur die Unit-Test-Fixtures in `recipeDetailsTemplate.test.ts` vom lokalen Alpha-Foto entkoppeln: die drei betroffenen Fixtures unter Alias importieren und fuer die Tests lokale Kopien mit dem bestehenden `quarkbroetchenDetailsFixture.image` verwenden. Alle Textdaten, Zutaten, Schritte und Presentation-Werte unveraendert uebernehmen. Keine neue Fixture-Datei oder Bilddatei erforderlich.

Die visuellen Approval-Fixtures und ihre Render-Skripte bleiben unveraendert, damit deren echte Alpha-Fotos erhalten bleiben. Die Testbezeichnung der Alpha-Fixture gegebenenfalls als Alpha-Rezeptdaten mit offline Referenzfoto praezisieren.

Out of Scope: Renderer-Layout, Fehlervertrag, Golden-Bilder, Runner-Pinning, neue Dependencies, Live-AI, Tier-2-Contract-Tests und Deployment. Keine KB-Verhaltensabweichung festgestellt; die dokumentierte Offline-Eigenschaft von Tier 1 wird wiederhergestellt, nicht neu definiert.

## Acceptance Criteria

1. AC-1: Alle 23 Detailtemplate-Tests bestehen auch ohne `backend/output/alpha-recipe-assets`; insbesondere alle acht gemeldeten Fehlerfaelle.
2. AC-2: Die bisherigen PNG-Abmessungen, Fontgroessen-Assertions, Layoutgrenzen und `TEMPLATE_FIELD_OVERFLOW` fuer die ueberlange Description bleiben unveraendert geprueft. Keine Tests werden entfernt, uebersprungen oder gemockt, um Rendering zu umgehen.
3. AC-3: Alle drei Typechecks, Offline-Prompt-Guard, gesamte Backend-Unit-Suite und Encoding-Check bestehen. `build:verify` besteht nach der Backend-Testaenderung ebenfalls.
4. AC-4: Die betroffenen Tests funktionieren in einem frischen Linux-Checkout mit Node 24 und installierten Lockfile-Dependencies, ohne lokale Alpha-Fotos, Secrets, Azure-Aufrufe oder Netzwerkzugriffe fuer Fixture-Bilder.
5. AC-5: Produktionsrenderer und visuelle Approval-Fixtures bleiben unveraendert; keine Alpha-Fotos werden versehentlich versioniert.

## B-1: Test-Fixtures korrigieren

Agent: Backend

Goal: Die Testdaten mit dem vorhandenen versionierten Bild lokal in der Unit-Testdatei kombinieren.

Required Knowledge Base:
- docs/kb/domain/06-recipes.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts
- backend/src/lib/instagramRenderer/fixtures/gefluegelfrikadellen-details.ts
- backend/src/lib/instagramRenderer/fixtures/nine-ingredients-details.ts
- backend/src/lib/instagramRenderer/fixtures/twenty-ingredients-details.ts
- backend/src/lib/instagramRenderer/fixtures/quarkbroetchen-details.ts
- backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts
- backend/src/lib/instagramRenderer/render.ts

Required Skills: None

Relevant Acceptance Criteria: AC-1, AC-2, AC-5

Dependencies: None

Expected Handoff: Minimale Testdatei-Aenderung, fokussiertes Testergebnis und Nachweis ohne Alpha-Output. Fuer Red/Green einen isolierten Checkout oder eine gezielte fehlende-Alpha-Datei-Probe verwenden; bestehende lokale Fotos nicht loeschen. Bei weiterem Fehlschlag zuerst `error.cause` erfassen und die Hypothese neu pruefen, nicht Assertions abschwaechen.

## Q-1: Vollstaendige Verifikation

Agent: QA

Goal: Alle Acceptance Criteria verifizieren, insbesondere frischen Checkout statt nur vorhandener lokaler Assets.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/domain/06-recipes.md

Required Repository Context:
- backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts
- backend/vitest.config.mts
- backend/package.json
- .github/workflows/ci.yml

Required Skills: None

Relevant Acceptance Criteria: AC-1, AC-2, AC-3, AC-4, AC-5

Dependencies: B-1 Handoff

Expected Handoff: Befehle, Exitcodes, Testergebnisse und Linux-Checkout-Nachweis. Nicht verfuegbare Linux-Ausfuehrung explizit als UNVERIFIED melden. Zusaetzlich `npm run build:verify --workspace=backend` ausfuehren; keine Builds durch den Planner.

## Execution Order

1. Backend: B-1, unmittelbar danach fokussierter Detailtemplate-Test.
2. QA: Q-1, alle Tier-1-Gates und `build:verify`, danach Linux-CI-Ergebnis pruefen.

## Umsetzung und Verifikation vom 2026-10-03

- Die drei Alpha-abhaengigen Unit-Fixtures verwenden lokale Kopien mit dem vorhandenen versionierten Referenzfoto. Produktionsrenderer und visuelle Approval-Fixtures sind unveraendert.
- Ein permanenter File-Read-Guard in der Testdatei verweigert lokale Alpha-Output-Fotos. Vor der Korrektur reproduzierte er exakt die acht gemeldeten Fehler; nach der Korrektur bestehen alle 23 Detailtemplate-Tests mit unveraenderten Assertions.
- Vollstaendiger Unit-Lauf: Backend 1160 Tests in 62 Dateien, Shared 450 Tests in 10 Dateien, Mobile 560 Tests in 51 Dateien; alle bestanden, insgesamt 2170 Tests.
- Alle drei Produktions-Typechecks, Backend `build:verify`, Offline-Prompt-Guard und Encoding-Check bestanden.
- Der zusaetzliche Typecheck ueber `backend/tsconfig.test.json` meldet 39 bestehende Diagnosen. Ein Compiler-Baseline-Vergleich mit der Original-Testdatei aus Git bestaetigt 39 Diagnosen zuvor und danach, ohne neue Diagnosen. Diese bestehenden Probleme sind nicht Teil der acht CI-Testfehler und wurden nicht veraendert.
- `docs/kb/tech/08-testing.md` dokumentiert die Offline-Fixtures und den Regressionsschutz.
- UNVERIFIED: echter frischer Linux-Checkout/CI-Lauf. Die fehlende-Alpha-Foto-Bedingung wurde lokal auf Windows reproduziert und mit aktivem Guard erfolgreich getestet. Keine Tier-2-Contract- oder Live-AI-Eval-Tests ausgefuehrt; diese gehoeren nicht zu Tier 1.