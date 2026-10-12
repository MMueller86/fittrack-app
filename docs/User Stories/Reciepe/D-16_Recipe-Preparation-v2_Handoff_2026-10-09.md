# D-16 Recipe Preparation v2 KB Handoff

Datum: 2026-10-09. Agent: Backend. Auftrag: ausdruecklich freigegebenes v16-Paket D-16, ausschliesslich KB-Abgleich zum B-16-Preparationpfad.
Status: Dokumentationsabgleich erstellt und fokussiert geprueft; unabhaengige QA offen. B-16 bleibt FAIL, kein Inhaltsfix-PASS, keine Abnahme und keine Merge-/Releasefreigabe. Keine spaeteren Pakete ausgefuehrt.

## Vollstaendiges eigenes Pfadmanifest

| Datei | D-16-Aktion / Grenze |
|---|---|
| [docs/kb/domain/06-recipes.md](../../kb/domain/06-recipes.md) | Nur Transient Export-View Preparation: JSON-Quelle, exklusiver v2-Prompt, Import v15, unveraenderter Providervertrag, gespeicherte Validierungsbasis und Inhaltsgrenze |
| [docs/kb/domain/07-ai-features.md](../../kb/domain/07-ai-features.md) | Nur Recipe Analyzer: beide aktuellen Versionen, beibehaltene v13-Importregeln als Promptanforderungen, Preparation V2/Text-only und Evidenzgrenze |
| [docs/kb/tech/02-backend.md](../../kb/tech/02-backend.md) | Nur Preparationdiagnose: begrenzte Orders/Mismatch statt Rezept-/Providertextlogs |
| [docs/kb/tech/06-ai-integrations.md](../../kb/tech/06-ai-integrations.md) | Nur Recipe Analyzer: Versionen, unveraenderter voller Vertrag/Einmalaufruf und abgegrenzter Preparation-v2-Code-/Livebefund |
| [docs/kb/tech/09-api-reference.md](../../kb/tech/09-api-reference.md) | Nur Preparation: JSON/Systemprompt, gespeicherte Basis und Text-only-Validierungsgrenze; Route/Body/Response unveraendert |
| [docs/User Stories/Reciepe/D-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch](D-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch) | Neues vollstaendiges eigenes Fuenfdateien-KB-Diffartefakt |
| [docs/User Stories/Reciepe/D-16_Recipe-Preparation-v2_Handoff_2026-10-09.md](D-16_Recipe-Preparation-v2_Handoff_2026-10-09.md) | Dieses neue Handoff; kein Edit einer bestehenden Story |

Keine Anwendungscodes, Tests, QA-Dateien, Register, historischen Plaene/Reports/Stories, shared/mobile/infra, Deployments, Ressourcen, Dependencies, Commits oder Branches geaendert. Vorhandene fremde Dirty-Hunks bleiben erhalten. Keine pauschale KB-Bereinigung: bestehende Importregeln und fremde AI-/Backend-/API-Abschnitte bleiben bestehen; die v13-Absaetze wurden nur als in Import v15 geerbte Anforderungen eingeordnet, nicht als neuer Live-PASS.

## Repository-Evidenz und eigener Diffursprung

Autoritative B-16-Evidenz: [Handoff](B-16_Recipe-Preparation-v2_Handoff_2026-10-09.md) und [eigener B-16-Diff](B-16_Recipe-Preparation-v2_EigenerDiff_2026-10-09.patch). Beide unveraendert.

Gelesener Produktionspfad: [Promptmodul](../../../backend/src/lib/prompts/recipeAnalyze.ts), [bestehender Client](../../../backend/src/lib/openai.ts), [Preparationhandler](../../../backend/src/functions/recipes.ts). B-16 aendert den exklusiven Prompt und dessen Auswahl; der gespeicherte Kontext, Handler, Runtimevalidator und Providervertrag wurden von B-16 nicht geaendert.

Vor dem ersten D-16-Edit wurden die fuenf aktuellen KB-Texte im Speicher erfasst, nicht aus HEAD rekonstruiert. Vier dieser KB-Dateien waren bereits dirty; API-Referenz war clean. Zusaetzlich wurden 773 vorhandene geschuetzte Dateien per SHA-256 erfasst (tracked Dateien ausser den fuenf KB-Dateien sowie bestehende Recipe-/QA-Artefakte). Die erste Erfassung mit gequoteten Git-Unicodepfaden war unvollstaendig; sie wurde noch vor jedem Edit mit `git -c core.quotepath=false ls-files` und Fehlerabbruch vollstaendig wiederholt. Kein gruener Ausgangsworktree behauptet.

Der eigene Diff wurde mechanisch im Speicher mit Python-stdlib `difflib.unified_diff` aus den erfassten Vorhertexten und finalen KB-Texten erzeugt, dann per apply_patch als Repositoryartefakt abgelegt. Python las/schrieb keine Dateien. Minus = unmittelbar vor D-16, Plus = finaler D-16-Stand. Das Artefakt enthaelt ausschliesslich die fuenf KB-Dateien, nicht den gesamten HEAD-gegen-Worktree-Diff und nicht die beiden neuen Handoffartefakte. Zusammen mit dem finalen KB-Bestand ist der D-16-Ausgangsinhalt LF-normalisiert rekonstruierbar. Keine externen Sitzungsdateien sind dafuer erforderlich.

Eigener Diff: 5 Dateien, 123 insertions / 17 deletions. Diffartefakt-Dateibyte-SHA-256: `96DB90866D378B765D51E903BEC3B8C5CCEA7577ACAB5D128C88EF2CC4AAA454`.
B-16-Diff-Dateibyte-SHA-256: `FA5F46B93F88C229C2A7DC8765A89D55B335BFFA5E01F09E993320917E736163`.
B-16-Handoff-Dateibyte-SHA-256: `2DF4D7E2AC7A825ADC8F34AE1F9F51D5769E1EC789F03AF239B5F5447A0C2CF3`.

Folgende SHA-256-Werte beziehen sich auf UTF-8 ohne BOM mit LF-normalisierten KB-Inhalten, nicht auf historische Dateibytes:

| KB-Datei | Vor D-16 | Nach D-16 |
|---|---|---|
| domain/06-recipes.md | E8E4C1BFEB68574F792C21A538DF0DE93F99ACBCFD30BCFE02DBCE22AAE64630 | 6C6C2C743BF70F4FC67182FA81AF965013E920960F0AC482819BCD3D9607563C |
| domain/07-ai-features.md | 07568FB98C724520400275477A0D916BA2C1A58E9F1790182C302C1C5AB143F8 | 12183D4997D61D8A4DFD353E456706C24AED11D5C4EB47AF738FB41C4549B8E1 |
| tech/02-backend.md | CDC570F884C1E30B17E842CB95042BFE353DEF2C0F024C6DE9E06FF6D3DDA33F | D3CD133C2AE867E5661C2611AB2D78A5879C3DD03AF42556396C545D29AA7FEA |
| tech/06-ai-integrations.md | 5A4718035CBA7ED30AB5B099A6F5F1099D454A0BD1336E8A3A187755D3FE148F | E37E6B2DF00F91490245B8790D48364E47934B1B31888DA39470AC5D1738FAFC |
| tech/09-api-reference.md | 27833528547AB2CE91FDF37D67B3075C9A6A255D8F130D4B7EEBDC9162CE8BD2 | EACD825C9BCC01E78702E7E16BDA696669FA1231E9EFB79BEBB3ECF18E24DFEA |

## Code-/Versionsabgleich

| Grenze | Tatsaechlicher Stand |
|---|---|
| Import | `RECIPE_ANALYZE_PROMPT_VERSION = 'v15'`; Importpromptkoerper und Importrequest unveraendert |
| Preparation | `RECIPE_PREPARATION_PROMPT_VERSION = 'v2'`; einziges Systemprompt ist `RECIPE_PREPARATION_SYSTEM_PROMPT`, ohne Importkoerper oder Addendum |
| Eingang | Genau zwei Nachrichten; JSON nur im Userdatenkanal, mit `recipeContext` und gespeicherten `steps`; originale Arrayreihenfolge/order/title/description; fehlender title modellseitig null |
| Provider | Bestehendes `analyzeRecipeText('', preparationContext)`, ein SDK-Call, volle Strict `recipe_analyze`-/`AiRecipeRaw`-Shape, unveraenderte Modellwahl, 0.2/2048; kein neues Verfahren, Feld, Schema, Zwischenoutput, Retry oder Fallback |
| Versionen | Exportversion 1; Preparationrequest/-response contractVersion 2; Prompt-/Evalguards laut B-16 Import v15 und Preparation v2 |
| Runtimebasis | Handler ersetzt modellseitige steps fuer die Validation durch gespeicherte `recipe.steps`; keine neue Extraktion als Validierungsquelle |
| Text-only V2 | Nur Teaser, nullable Zeit/Schwierigkeit und order/description; sourceEtag kompatibel; keine Zutaten-IDs/Resolution; ungenutzte Ingredientfelder/Keys blockieren Preparation nicht; Importvollvalidator bleibt bestehen |
| Fehler/Invarianten | Auth vor Arbeit, optionales exaktes ETag vor Quota, fehlende/duplizierte/unbekannte/vertauschte Source-IDs, Leertexte und Limits -> 422; Quota 429, Provider/leer/Parse 502; Usage einmal nur nach validem Erfolg; keine Persistenz |
| Privacydiagnose | Maximal acht phase/code/path-Diagnosen; Trace-Orders maximal 32 pro Liste plus Trunkierung/erster Mismatch; keine Rezept-/Kontext-/generierten Texte, Rawpayloads oder Zutatenwerte in Preparationlogs |
| Inhaltsgrenze | Kein allgemeiner Runtime-Inhaltsvalidator. Vollstaendige IDs, Count und Zeichenlimit beweisen keine vollstaendigen Handlungen/Details |

Alle fuenf finalen B-16-Dateibytehashes wurden gegen dessen Handoff erfolgreich verglichen: Promptmodul, Client, [ai.test.ts](../../../backend/src/functions/ai.test.ts), [recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts), [recipeAnalyzeValidation.test.ts](../../../backend/src/lib/recipeAnalyzeValidation.test.ts). Keine Testausfuehrung oder Testaenderung in D-16. Der Preparationhandler und alle anderen geschuetzten Dateien wurden gegen die unmittelbare D-16-Ausgangsbasis auf Unveraendertheit geprueft.

## Eigene Pruefbefunde und Grenzen

| Check | Exit / Befund |
|---|---|
| D16-C1, unmittelbar nach erstem KB-Edit | 0 / PASS: Promptversionen, exklusive Auswahl, JSON/Strict/0.2/2048, Handlerbasis/V2/32-Order-Anker, Repositorylinks der fuenf KB-Dateien, 773 geschuetzte Hashes, `git diff --check` am Root |
| D16-C2, unmittelbar nach Versionsabgrenzung | 0 / PASS: geerbte v13-Anforderungen abgegrenzt, fuenf B-16-Sourcehashes und B-16-Diffhash stimmen exakt; `git diff --check -- docs/kb` |
| Eigener Diffvergleich, erster Versuch | 1 / FAIL: nur finale LF-Zeile im neuen Artefakt fehlte; per apply_patch ergaenzt |
| Eigener exakter LF-normalisierter Vergleich, Wiederholung | PASS: exakt identisch zum aus Vor-/Nachtexten abgeleiteten Diff |
| `git apply --reverse --check` fuer eigenes Artefakt | 1 / FAIL: strikter Kontextcheck scheitert an domain/06-recipes.md:182; nicht als PASS ausgegeben, keine Anwendung |
| `git ls-files --eol` fuer fuenf KB-Dateien | 0: Index LF; Worktree domain/06 LF, andere vier CRLF; keine pauschale EOL-Neuformatierung |
| D16-C3-final: exakter normalisierter Vergleich plus `git apply --reverse --check --ignore-space-change` | 0 / PASS: nur Kontextwhitespace toleriert, separater Inhaltsvergleich bleibt exakt; kein Apply/Reverse-Apply ausgefuehrt |
| `git apply --stat` fuer eigenes Artefakt | 0: genau fuenf KB-Dateien, 123+/17- |
| D16-C4, unmittelbar nach Handoffanlage | 0 / PASS: Siebendateienmanifest, vier AC-Zeilen, alle lokalen Links, ASCII, KB-Vorher-/Nachherhashes, eigener exakter Diff/Bytehash, 773 geschuetzte Hashes, drei B-1-Artefakthashes laut B-16, Added-Content-Secretcheck, Reverse-Kontextcheck ohne Anwendung, Root-Whitespacegate |
| Editor-Diagnosen fuer alle sieben Lieferdateien | Keine Fehler gemeldet; Toolbefund, kein Shell-Exitcode und kein Runtime-/Markdownsemantikbeweis |

Die Ursache des strikten Git-Kontextfehlers ist nicht abschliessend bewiesen; gemischte Worktree-Zeilenenden sind nachgewiesen. Keine byteidentische oder strikt rueckwaerts anwendbare KB-Dateirekonstruktion behauptet: der Nachweis ist LF-normalisiert, der Git-Kontextcheck toleriert Whitespace. Artefakt-Dateibytehash und unveraenderte geschuetzte Dateibytes sind davon getrennt. CRLF/LF-Hinweise im Root-Whitespacegate sind keine Fehler. D16-C4 ist Dokumentations-/Scopevalidation, keine unabhaengige QA oder fachliche Abnahme.

Manueller enger Diff-/Privacyreview: nur statische Dokumentation und Repository-Evidenzlinks, keine privaten Rezepttexte, Providerrohtexte, Endpoints, Credentials oder neuen Secrets. Unicode in Patch-Kontext stammt aus bestehenden KB-Zeilen; Handofftext ist ASCII. Keine neue Liveausfuehrung, Testsuite, Typecheck oder Build: deren unten genannte Ergebnisse stammen ausschliesslich aus B-16, nicht aus einem D-16-Wiederholungslauf.

## Offene Gates Explizit An QA

1. B-16 Request-Red/Green: Exit 1 -> 0; fokussierte 294 und volle 1407 Tests, Typecheck/Build/Rootdiff Exit 0. Dies beweist Requestisolation und Offlineinvarianten, keine Inhaltsabnahme.
2. Preparationserienlauf 1: Exit 1 / FAIL. IDs 1..7 statt 1..8, Servieren/Beilagenbezug und mittlere Hitze fehlen, im Serienlauf auch Abdeckung. Echter Handler 422, Usage 0, ein Provideraufruf, gespeichertes Rezept/ETag unveraendert. Laeufe 2/3 nicht ausgefuehrt: UNVERIFIED. Kein Dreiernachweis, keine Ersatzlaeufe.
3. Separates Recipe-Livegate: Exit 1, acht Imports 0/8 und Preparation FAIL. Gesamtgate: Exit 1, 12 FAIL / 27 PASS; fremde Daily-Insightbefunde bleiben fremd. Gesamtrawoutput teilweise UNVERIFIED; keine Rekonstruktion aus anderen Outputs. Unreached 200/V2/Usage-Erfolgsassertions sind kein PASS. Live-FAIL blockiert Paketabschluss/Release.
4. Sourcebindung v15 funktionierte bereits bei fehlenden Exporttexten. Kein Beweis fuer Modellursache, Promptdominanz, Tokenmangel oder Unmoeglichkeit; beide vollstaendig erfassten Antworten hatten finish_reason stop. V2-Inhaltsstrategie bleibt unbestaetigte Modellhypothese. Kein naechster Promptversuch im D-16-Paket.
5. Privates historisches Originalrezept und deployed Revision fehlen: MANUAL VALIDATION REQUIRED. Synthetische gespeicherte Fixture ist kein HistoryReplay, share-bundle-/Renderer-/Alpha-Nachweis oder historische Fehlerreproduktion.
6. PO-1/exakte Countregel unveraendert offen. B-1-Ruecknahmen und drei unbekannte Importhunks erhalten; keine Provenienzentscheidung, generische Finding-Schliessung oder Importkausalitaetsbehauptung. QA muss diese offenen Grenzen unabhaengig bewerten; D-16 nimmt keine Abnahme vorweg.

## Zugeordnete ACs

| AC | D-16-Stand / Grenze |
|---|---|
| AC-1 Dokumentationsabgleich | Exklusiver Preparation-v2-Prompt, JSON/Steps/Import-v15-Kompatibilitaet und unveraenderter Vertrag/Call dokumentiert und gegen Repository geprueft; kein Live-PASS |
| AC-4 Doku | Gespeicherte Tracebasis/422, Leertext/Limits, Auth/ETag/429/502/einCall/UsageNurErfolg/Privacy/Transienz/V2 abgeglichen; kein allgemeiner Inhaltsvalidator behauptet |
| AC-6 Doku | B-16-FAIL und UNVERIFIED explizit erhalten; Abschluss/Release blockiert, Preparation kein HistoryReplay; keine heutige Live-Abnahme |
| AC-7 | Nur fuenf zugeordnete KB-Dateien plus zwei eigene Evidenzartefakte; v15-Behalten/B-1-Ruecknahmen/fremde Hunks erhalten; unabhaengige QA folgt, keine allgemeinen Findings geschlossen |

An Orchestrator/QA: D-16 ist ein enger Repository-/Dokumentationsabgleich, keine Korrektur der weiterhin fehlenden Liveinhalte und keine Planinvaliditaetsfeststellung. Alle oben offenen Nachweise bleiben offen. Keine QA-/Register-/Deploymentphase oder spaeteres Paket eigenstaendig ausgefuehrt.
