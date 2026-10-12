# B-18 Kurzfassung: Wiederhergestellter Backend-Handoff

- Report: docs/User Stories/Reciepe/B-18_Recipe-Kurzfassung-Review_Handoff_2026-10-09.md
- Status: Backendstand vorhanden, Offline-Gates PASS; Paketabschluss BLOCKED durch neue Recipe-/Gesamt-Live-FAILs, fokussiertes Livegate UNVERIFIED und fehlende Originalchronologie/Redcapture.
- Datum: 2026-10-09. Recovery-Offlinelaeufe 10:13:13 bis 10:16:52 UTC; Versionsguards danach separat.
- Autorisierte Handoffcompletion: 2026-10-09, drei neue einzelne Aufrufe 10:23:20.047 bis 10:27:19.655 UTC auf eingefrorenem Import v16 / Preparation v3. Keine Source-/Prompt-/Testaenderung, keine Wiederholung; keine Rekonstruktion frueherer Live-Ergebnisse.
- HEAD: `b637ee5b59a4f72b7d822443680c1951a01f9dc4`.
- Vertrag: [v18, B-18 und Abschnitte 3/4/7/8](PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18.md); [vollstaendiges Q-18R-Inventar](../../qa/reports/PLAN_US-10_Recipe-Export-Preparation_Kurzfassung-Technisches-Review_2026-10-09-v18-Vorreview.md), Review gate READY, dokumentierter No-op ueber K-1..K-8 hinaus.
- Kein QA-Verdict, keine Registryclosure, keine Merge-/Release-/Deploymentfreigabe.

## Tatsaechlicher Eingangsstand

Es wurde im vorigen B-18-Aufruf gearbeitet: drei dauerhafte B-18-Artefakte und neun geaenderte Backenddateien waren bereits vorhanden. Der vorgefundene eigene Patch dokumentiert v16/v3, selektive Referenzvalidierung, Entfernung ausschliesslicher Coveragediagnostik, Exportkernrubriken, Testnachfolger und eine Rendererprobe. Ein Handoff und dauerhafte Test-/Live-Captures fehlten. Dateiinhalte und Patch sind belegbar; urspruengliche Laufzeit, Testchronologie und Live-Ergebnisse sind dadurch nicht belegt.

Diese damalige Offline-Recovery hat vor dem ersten Edit die vorhandenen Artefakte/Codehunks geprueft. Einziger zusaetzlicher Sourceedit damals: dieselbe vorhandene Rendererprobe um 2 und 3 Schritte ergaenzt und auf 1..5 umbenannt. Keine Promptnachbesserung. Neue Offlinepruefungen, dieser Bericht, eigener Enddiff und Evidencegenerator wurden hinzugefuegt. In der damaligen Recovery kein Liveprovideraufruf und kein Lesen von Settings/Secrets oder privaten Rezepttexten. Die jetzt autorisierte Livecompletion steht getrennt unten. Kein anderer Agent oder Routingfallback.

## Repositorymanifest und Diffbasis

Alle Belege sind Repositorydateien; keine Session-/Tempdatei ist Handoffvoraussetzung.

| Artefakt | Bedeutung |
|---|---|
| [Ausgangsdiff](B-18_Recipe-Kurzfassung_Ausgangsdiff_2026-10-09.patch) | Vorgefunden; kumulierter HEAD-zu-B-18-Eingangsstand, kein eigener B-18-Editdiff. SHA256 `096e4ca97562ca6681e6a758f5058ac669ec383165a5673d821e5fa75478fc97`. |
| [Urspruenglicher Eigendiff](B-18_Recipe-Kurzfassung_EigenerDiff_2026-10-09.patch) | Vorgefunden, unveraendert erhalten; neun Dateien/46 Hunks vor Recovery, Renderer noch 1/4/5. |
| [Urspruenglicher Preservationbeleg](B-18_Recipe-Kurzfassung_Preservation_2026-10-09.json) | Vorgefunden; 18 dokumentierte Input-/Constraint-/Sourceinvarianten und damalige Hunkheader. Kein historischer Testlauf. |
| [Eigener Enddiff](B-18_Recipe-Kurzfassung_Enddiff_2026-10-09.patch) | Neun Dateien/46 Hunks: B-18-Eingangsstand gegen aktuellen Code, inklusive Recovery-Rendererergaenzung. SHA256 `da861b25b8af9bbaa91079b039e8f835e3017d4368c63d8cd323ef0474afb40e`. |
| [Offline-Evidence](B-18_Recipe-Kurzfassung_OfflineEvidence_2026-10-09.json) | Neue Commands/Exitcodes, echter numerischer Red/Green-Replay, Input und Validatorresultate, Source-SHA256, Endhunks, Preservationvergleich. |
| [Verificationgenerator](B-18_Recipe-Kurzfassung_Verification_2026-10-09.mjs) | Offline-Replay/Gates/Enddiff-Erzeugung ohne Credentials oder Livecalls. Isolierter Git-Index, danach entfernt; kein Worktreerestore. Nachtraeglicher Preservationabgleich und Guardlauf stehen im Evidence-JSON. |
| [Neue Live-Evidence](B-18_Recipe-Kurzfassung_LiveEvidence_2026-10-09.json) | Drei zeitgestempelte neue Commands/Exits, bereinigte komplette Ausgaben, synthetischer Preparationraw/Source-/Kernmatrix, beobachtete Zaehler und 641 Vor-/Nachhashes. Gate1 UNVERIFIED trotz Exit0; Gate2/3 FAIL. |
| [Live-Capture](B-18_Recipe-Kurzfassung_LiveCapture_2026-10-09.mjs) | Evidence-only Capture, pro Aufruf genau ein npm-Gate; sperrt doppelte/ungeordnete Aufrufe und Sourceabweichung. Kein Produkt-/Test-/Runneredit. Privates Laden durch vorhandenen Evalrunner, keine Settingscopy oder Endpoint-/Secretausgabe. |
| Dieser Bericht | Recoverymanifest, K-/Inventarmapping, Ersatzmatrix, Gates und offene Grenzen. |

Der eigene Enddiff wurde aus einem isolierten Index erzeugt: HEAD plus vorhandener Ausgangsdiff, beschraenkt auf die neun folgenden Sourcepfade, gegen heutigen Worktree. Er umfasst keine vorherigen Benutzerhunks, KB oder Registry. Die acht urspruenglichen Backenddateien ausser der Rendererprobe bestehen den Reverse-Check des unveraenderten urspruenglichen Eigendiffs mit Exit 0. Der komplette alte Reverse-Check hat wegen der expliziten Rendererergaenzung Exit 1; kein Patch wurde angewendet. Der Benutzerindex ist weiterhin leer (Exit 0). LF-normalisierte Gitdiffs sind kein historischer Byte-/EOL-Identitaetsnachweis.

## Dateiliste und Hunkmapping

H1..Hn bezeichnet die Reihenfolge der Hunkheader innerhalb der jeweiligen Datei im eigenen Enddiff. Vollstaendige Header stehen unter `endHunks` im Evidence-JSON. Damit sind alle 46 Hunks zugeordnet; keine Zusatzfindingliste wurde implementiert.

| Tatsaechlich B-18-geaenderter Sourcepfad | Hunks -> Aktion / Q-18R-Inventar |
|---|---|
| [backend/src/lib/recipeAnalyzeValidation.ts](../../../backend/src/lib/recipeAnalyzeValidation.ts) | H1..3: K-1 MIN_STEPS, VA-01/02, PL-04; H4..5: K-2 Diagnosepayload/projection, VA-05; H6: K-1 globale Unique-/Ascending-Teiltrace, VA-03/04, PL-01/05. |
| [backend/src/lib/recipeAnalyzeValidation.test.ts](../../../backend/src/lib/recipeAnalyzeValidation.test.ts) | H1..2: K-4 Source-/Exporttrennung und sechs Kernnegative, UT-01/03; H3: K-1/K-4 Gaps, Grenzen, echte Fehler, Auslassungspositiven, UT-03/04/05; H4: K-1/K-2 Duplicate statt Coveragepayload, UT-05/08; H5: K-1 echte Referenznegative statt missing-only, UT-05; H6..7: K-4 historische Texte nach neuem Kern, UT-06; H8..9: K-4 Preparationkern-/Widerspruchsnachfolger, UT-07; H10: K-1/K-2 Gap positiv statt Coveragediagnose, UT-08. |
| [backend/src/functions/recipes.ts](../../../backend/src/functions/recipes.ts) | H1..3: K-2 ausschliesslich Coveragehelper/import/find/spread entfernt, HD-02/04. JSON-Projektion, saved authority und generic diagnostics bleiben K-5/K-7. |
| [backend/src/functions/recipes.test.ts](../../../backend/src/functions/recipes.test.ts) | H1..4: K-2/K-7 echter Unknownfehler und vollstaendige Privacypruefung, HT-02; H5..6: K-1/K-5 Teiltrace200/Usage1/no writes und AI-only Unknown422 gegen saved authority, HT-04. |
| [backend/src/lib/prompts/recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts) | H1: K-3 v16/v3, PR-01; H2: K-3 Preparationkernblock, PR-04 (PR-02/03 bleiben); H3: K-3 genehmigte Exportklauseln, PR-05..09; H4: K-3 letzte Teiltracepruefung, PR-09/10. PR-07/08/10 bleiben historisch ungeklaert, neue Autorisation statt behaupteter Restore. |
| [backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts) | H1..2: K-4 test-only Widerspruchs-/source-backed Temperaturcheck, FX-02; H3: K-4 eigenstaendige Preparationkernrubrik, FX-05; H4..5: K-4 Importexportkern statt blanket Sourcekopie, FX-07. FX-01/03/04/06/Inputbasis bleiben K-7. |
| [backend/src/lib/prompts/recipeAnalyze.eval.test.ts](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) | H1: K-3 Guardversionen, EV-01; H2..3: K-4 min/max und ordered subset, EV-03/04; H4..5: K-4/K-6 separate Source-/Kernmatrix und synthetischer Rawoutput, EV-05/06; H6: K-6 explizite write counters, EV-05/07; H7..8: K-4 Teiltrace/1..5/Orders, EV-07. Echter Harness bleibt, keine Live-Erfolgsbehauptung aus Code. |
| [backend/src/functions/ai.test.ts](../../../backend/src/functions/ai.test.ts) | H1: K-3 Preparation-v3-Literal, AT-01; H2..3: K-1 echte Referenzfehler statt missing-only, AT-03/04. |
| [backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts](../../../backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts) | H1: K-1/K-4, PL-02, X-03; bestehender Produktionsrenderer fuer 1..5/90/1080x1350. Recovery fuegte nur 2/3 zur bereits vorhandenen Probe hinzu. |

Die weiteren sechs B-18-Belegdateien plus dieser Bericht stehen im Manifest oben. Generierte Buildausgaben sind keine Sourceedits. Der kumulierte HEAD-Diff der neun Codepfade betraegt 1255 Insertions/53 Deletions; diese Zahl ist ausdruecklich NICHT die eigene B-18-Editmenge.

## Bewahrung und Vertragsgrenzen

- Neue Q-18R-Rawhashpruefung: 39 von 40 nicht B-18-editierten Baselinepfaden identisch, darunter alle fuenf KB-Dateien, B-1-Ruecknahme/-Ausgang/-Enddiff/-Handoff, B-16/D-16 und historische Reports/Plaene. Einzelhashes im Evidence-JSON. Acht Importinputs, erste sieben Constraints und volle Source-/Preparationbasis sind im vorgefundenen Preservationbeleg dokumentiert und wurden in Recovery nicht geaendert.
- Ausnahme: [QA-Register](../../qa/findings.md), Q-18R-SHA256 `62F865F88F25959F53AE3BCCC8A5CCE8EF6A22668AE9CD0CA0DC60DF1128F2A0`, heute `C6BE307A222ECE1EB38A626A8E58026A88BAD2D2BAF31F4AFBF35DCAF7EBED9E`. Fremder vorhandener Stand, nicht durch Recovery editiert; Ursache/Autor nicht attribuiert, kein Restore. Deshalb Exit 1 des strikten Q-18R-Preservationchecks, kein pauschaler 40/40-PASS.
- [openai.ts](../../../backend/src/lib/openai.ts), Shared/Savevalidation, ai.ts, Runner/Configs und Rendererlayout/assets/fonts sind gegen Q-18R unveraendert. JSON-Context, volle Strict-Shape, 0.2/2048, ein Call, saved authority, Auth/ETag/Quota/V2/Privacy/no writes bleiben erhalten und im Offlineslice getestet.
- Runtime akzeptiert geordnete eindeutige Teilreferenzen, prueft aber keine allgemeine Kochsemantik. Die kleine Test-only Rubrik ist keine Garantie fuer beliebige sprachliche Widersprueche oder sichere Zubereitung. Nutzerreview bleibt erforderlich.
- Codeversionen Import v16 / Preparation v3; Guards dieselben Werte. KB beschreibt weiterhin v15/v2/Volltrace: bekannte Phaseabweichung, K-8/D-18 bewusst nicht ausgefuehrt. Keine KB-, QA-/Registry-, Story-, Mobile-, Shared-, Infrastruktur- oder Deploymentedits in Recovery.

## Testentfernungs- und Ersatzmatrix

Keine Testdatei entfernt. Kein Timeout-, Runner-, Skip- oder Providerbudgettuning. Alte historische FAILs wurden nicht umgeschrieben. Zweckentfall betrifft nur die genehmigte Export-Vollpflicht, nicht Sourceextraktion oder echte Schutzfehler.

| Alter Zweck / konkrete Aenderung | Begruendung und jetziger Nachfolger |
|---|---|
| UT-01 Source-/Exportassertionorders beide 1..8 | Source bleibt 1..8; Export jetzt eigenstaendiger Kochkern [1,2,5,6]. Zwei vorhandene alternative Gruppierungen bleiben positiv. |
| UT-02 35 Sourceverlustmutationen | Unveraendert erhalten: Aktionen, Komponenten, Zeiten, Gefaess/Hitze, Wuerzen, Ruhen und Servieren in voller Sourceextraktion; source/export Temperaturinvention und Swaptests bleiben. |
| UT-03 35 gespiegelte Exportdetailnegative | Blanket Pflicht entfernt, nicht 35 Sourcechecks. Sechs konkrete Negative: Kartoffelkochen->Lagern, Bohnen->Reis, Anbraten->Waschen, Fertiggaren->Waschen, Kartoffel18->8, Brat4->6. Kartoffel-/Bohnenzeitswap, falsche Textgruppe und erfundene Temperatur bleiben separat negativ. Optionaldetails und Serving duerfen fehlen; neue zweistufige Kernkurzfassung positiv. Nicht ausgewaehlte Details sind nicht erneut allgemeine Exportpflicht. |
| UT-06 dokumentierte v15-Fuenftexte negativ wegen Details | Gleiche Texte/Laengen/Trace bleiben, jetzt nach freigegebenem selektivem Kern positiv. Keine rueckwirkende Neubewertung des damaligen Q16-FAILs. |
| UT-07 20 Preparationdetailmutationen | Acht Nachfolger: Schneiden->Waschen, Braten->Waschen, Reiskochen->Lagern, Reis->Bohnen, Reis12->8, Fertiggaren->Waschen, weitere6->4, erfundene180C. Rice/Serving-Swap bleibt negativ. Vier Kerntexte ohne Detail-/Servierpflicht positiv; fehlendes Reiskochen und blosse Reisnennung separat qualitativ negativ trotz gueltiger IDs. |
| UT-05/08 Coverage-/Mismatchpflicht und missing-only Negative | Exakter [1],[2],[3],[4],[6,7]-Teiltrace jetzt positiv in beiden Validators; Gap innerhalb/zwischen Gruppen positiv. Globale/local Duplicate, Unknown, Reorder, Sourceidentity, Export1..K und no-mutation bleiben/werden explizit geprueft. Coveragepayload entfaellt, echte stabile Fehlercodes bleiben. |
| HT-02/04/AT-03 omission422 und numeric log assertions | Teiltracehandler jetzt200/Usage1/no writes; separate AI-only Order gegen gespeicherte Basis422/Usage0/no writes. Privacy durch echten Unknownfehler, alle log/warn/error-Argumente und verschachtelte Marker; nur Coveragefelder entfernt. AI missing-only Fall entfaellt zielbedingt, weitere echte Negative bleiben. |
| EV-03/04/06/07 exact-min, volle Exporttrace/blanket Matrix | 1..5/1..K, unique ordered subset; komplette Sourcematrix getrennt von vier Exportkernaktionen. Vollstaendiger synthetischer Raw-/Count-/Writeoutput im existierenden Harness vor spaeteren Assertions. Implementation allein ist kein ausgefuehrter Livebeleg. |
| UT-04/PL-04 Grenzen | 1/4/5 und90 positiv;0/6/91/blank/fehlende Kochbasis negativ, keine Fallbacks. Rendererprobe neu fuer jede Schrittzahl1..5, Produktionsfonts und reale PNG-Metadaten1080x1350; alte Overflowchecks bestehen. |
| CL/HD/HT-03/AT/X-04 Schutzvertrag | Keine Reduktion von Auth, Ownership, exact ETag vor Quota,429/502/echte422, Strict/ein Call, Usage nach Erfolg, text-only V2, Nutzerconfirmation, Save-/Share-/Fingerprint. Fokus schliesst unveraenderte Savevalidation ein. |

Normale Testzahl jetzt1397 statt historisch1407; Fokus288 statt historisch299. Dies sind neue Laufresultate nach zielbedingt veraenderten Exporttests, kein geerbter PASS oder behauptete Reduktionsquote.

## Echter Teiltrace-Replay und neue Offline-Gates

Lokale Hypothese bestaetigt: Vollcoverage weist eine geordnete Auswahl allein wegen fehlender Quellen zurueck. Neues Replay fuehrt denselben synthetischen Input Source1..8/Export[1],[2],[3],[4],[6,7] gegen aus dem Ausgangsdiff rekonstruierten Validator und aktuellen Validator aus. Beide Ausgangspfade `ok:false`, Preparationcode `source_step_coverage_mismatch`, Position5 erwartete5/aktuelle6; beide aktuellen Pfade `ok:true`, Input unveraendert. Rawinput und volle Resultate stehen im Evidence-JSON. Kein Livecall und kein Restore.

Dies ist ein tatsaechlich ausgefuehrter Red/Green-Vergleich, aber KEIN nachtraeglich behaupteter urspruenglicher test-first Ablauf. Originaler Redlauf/erste Validatoreditchronologie bleibt UNVERIFIED. Der jetzige GREEN-Unit-Slice prueft zusaetzlich echte Fehler und qualitative Reisnegative; der strukturelle Replay allein beweist keinen Kochkern.

Die Vitest-/tsc-Kommandos wurden direkt per Node-CLI (nicht ueber npm/npx) ausgefuehrt; absolute tatsaechliche Executable-/Argumentpfade und Exitcodes stehen im JSON. Folgende workspace-relative Darstellung ist aequivalent, nicht ein weiterer behaupteter npm-Lauf. Cwd jeweils backend, soweit nicht Root genannt.

| Command / Aufruf | Exit | Neues Resultat |
|---|---:|---|
| `node --check <B-18 Verificationgenerator>` | 0 | Generator syntaktisch gueltig. |
| `node <B-18 Verificationgenerator>` | 0 | Replay und folgende neun Offlinekommandos abgeschlossen. |
| `node ../node_modules/vitest/vitest.mjs run src/lib/recipeAnalyzeValidation.test.ts` | 0 | 1 Datei,102/102 PASS. |
| `node ../node_modules/vitest/vitest.mjs run src/functions/ai.test.ts src/functions/recipes.test.ts src/lib/recipeAnalyzeValidation.test.ts src/lib/recipeValidation.test.ts` | 0 | 4 Dateien,288/288 PASS; Handler/Client/Save-Slice. |
| `node ../node_modules/vitest/vitest.mjs run src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts` | 0 | 34/34 PASS;1..5/90, Produktionsfonts/1080x1350, bestehende Overflownegative. |
| `node ../node_modules/vitest/vitest.mjs run` | 0 | Normale unveraenderte Konfiguration:66 Dateien,1397/1397 PASS. Keine Contract-/Livefiles. |
| `node ../node_modules/typescript/bin/tsc --noEmit` | 0 | Typecheck PASS. |
| `node ../node_modules/typescript/bin/tsc --project tsconfig.json` | 0 | Buildbestandteil1 PASS. |
| `node scripts/copy-instagram-assets.mjs` | 0 | Buildbestandteil2 PASS. |
| `node scripts/verify-build.mjs` | 0 | Buildbestandteil3 PASS. Genau die bestehende build:verify-Kette, kein behaupteter neuer npm-Wrapperlauf. |
| `git diff --check` | 0 | Whitespacegate PASS vor Reportedit. |
| `node ../node_modules/vitest/vitest.mjs run --config vitest.eval.config.mts src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "prompt version matches fixture expectations"` | 0 | Nur2 Offlineguards PASS,9 Livecases abgewaehlt/skipped. KEIN Recipe-/Gesamt-Live-PASS. |
| Q18R-Rawhashvergleich,40 ausgeschlossene Sourcepfade | 1 |39 unveraendert, vorhandene Registryabweichung oben. Kein Produkt-Test-FAIL und keine fremde Reparatur. |
| Root `git diff --cached --quiet` | 0 | Benutzerindex erhalten. |
| Root `git apply --reverse --check --exclude=backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts -- <urspruenglicher Eigendiff>` | 0 | Acht Originaldateien passen. Nur Check, keine Anwendung. |

Zusatzcheckhistorie transparent: `rg` nicht installiert (Exit1, danach begrenzte PowerShell-Dateisuche); erster Patchcheck aus falschem Cwd konnte Patch nicht oeffnen; kompletter alter Patchcheck nach Rendererergaenzung scheitert erwartet am geaenderten Hunk; Ausgangsblob-Kurz-ID nicht als Gitobjekt vorhanden (Exit1, danach Ausgangsdiff/isolierter Index). Eine parallele Terminalerfassung wurde abgebrochen und seriell neu erfasst; keine unvollstaendige Ausgabe als PASS. Kein Providerretry.

## Live-Gates und konkrete Blocker

### Originalchronologie bleibt offen

In der gezielten Repositorysuche existierten beim Recoveryeingang ausschliesslich die drei genannten B-18-Artefakte, kein B-18-Livelog/Rawcapture. Andere vorhandene Logs betreffen OFF-Import und wurden nicht als Evidence gelesen. Ob der urspruengliche Aufruf die drei Livekommandos ausgefuehrt hat, bleibt UNVERIFIED: urspruenglicher Command/Exit/DatumZeit/Raw/Counts sind nicht wiederhergestellt. Fehlender urspruenglicher Redcapture bleibt UNVERIFIED; der oben dokumentierte rekonstruierte Replay bleibt unveraendert erhalten. Neue Resultate ersetzen oder reinterpretieren diese unbekannten Aufrufe nicht.

### Neue ausdruecklich autorisierte Verifikation

Orchestrator-/Nutzerklarstellung 2026-10-09 autorisierte JETZT genau einen beobachteten Aufruf je drei Pflichtbefehle auf demselben Kandidaten. Ausfuehrung ueber Evidence-Capture mit Windows `cmd.exe /d /s /c`, Cwd `backend`, anschliessend unveraendertem npm-/Evalrunner. Alle folgenden Resultate sind NEU, nicht historisch. Keine Retries, selektiven Rechecks, Prompt-/Code-/Renderer-/Testedits oder Offline-Vollsuiten; Gate2 und Gate3 wurden unabhaengig vom vorherigen Befund ausgefuehrt. Vorhandene Credentials wurden privat genutzt; kein Missing-Credentials-Exit2 beobachtet.

| Neuer separater Aufruf (je genau einmal) | UTC Beginn -> Ende, 2026-10-09 | Exit / Resultat |
|---|---|---|
| `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation"` | 10:23:20.047 -> 10:23:21.676 | 0 / UNVERIFIED: 5 Dateien/39 Tests ausschliesslich skipped, Recipe11 inklusive Guards/Preparation nicht ausgefuehrt. Keine Raw-/Handler-/Call-Evidence. Ursache der Auswahl/Skips UNVERIFIED; kein Wiederholungsversuch. Der Backslash vor Pipe ist nur Markdown-Tabellenescaping; exakter Command steht im JSON. |
| `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts` | 10:23:34.354 -> 10:25:00.014 | 1 / FAIL: 1 Datei,10 PASS/1 FAIL. Eigene acht Imports PASS, Import-v16-/Preparation-v3-Guard PASS, Preparation FAIL wegen fehlender Exportreferenz6/Fertiggaren. |
| `npm run test:eval` | 10:25:08.419 -> 10:27:19.655 | 1 / FAIL: 5 Dateien,2 FAIL/3 PASS;39 Tests,36 PASS/3 FAIL. Recipe wieder8 Imports+2 Guards PASS/Preparation FAIL; Daily16 PASS/2 FAIL; Scale3, Weekly4, Weeklydiagnose3 PASS. |

Die vollstaendige bereinigte Ausgabe steht je `runs[0..2].output` in der Live-Evidence, synthetische strukturierte Belege je `observedSyntheticEvidence`. Keine Endpoint-/Secretwerte oder private Originaltexte persistiert; Deploymentname bewusst redigiert, API-Version und Samplingparameter erhalten. Die geplanten Providerbudgets wurden nicht veraendert. Gesamte SDK-/HTTP-Callzahl und Import-/Daily-Einzelcallzahlen sind nicht instrumentiert/beobachtet und bleiben UNVERIFIED, nicht aus Testanzahl als gemessene Calls abgeleitet. Gate1 liefert keine beobachtete Providerzahl.

### Beobachtete Preparation-Evidence und getrennte Befunde

In Gate2 UND Gate3 beobachtet: `sdkCalls:1`, `analyzeCalls:1`, API `2024-08-01-preview`, temperature0.2/maxTokens2048, finishReason `stop`, Source8, Export5, Laengen32/40/31/54/61, Status200, Usage1, update0/replace0/create0, `unchanged:true`. Das initiale synthetische Repositorysetup liegt vor den Write-Spies; no writes gilt fuer den beobachteten Preparationhandler. Quota/Provider-/No-write-/Saved-Unchanged-Assertions vor der Semantikpruefung liefen ohne Failure. Die nachfolgende text-only-V2-Body-/Usage-Order-Assertion wurde wegen Semantik-FAIL NICHT erreicht: V2 und Usage-Reihenfolge UNVERIFIED, kein Code-als-Evidence-PASS.

Beide vollstaendigen synthetischen Providerrawobjekte enthalten alle acht unveraenderten Sourceschritte, aber Exportreferenzen nur `[1],[2],[3],[4],[5]`. Alle Sourcepatternchecks fuer1..8 true. Exportkern1/4/5 true, Widerspruchspatterns false; Kern6/Fertiggaren fehlt, sein Exportpattern false. Kein Kochkern-PASS trotz Status200 und Usage1. Importfixture8 hat ebenfalls persistierte synthetische Source-/Export-Evidence; vollstaendige Importraws1..7 und deren SDK-Counts gibt der unveraenderte Harness nicht aus und bleiben fehlend/UNVERIFIED. Die acht Import-Testresultate sind hingegen beobachtetes PASS, keine Behauptung ueber nicht ausgegebene Rawfelder.

Daily getrennt/fremd: `phase-progress-open-day` FAIL wegen fehlender required concept group1 (trend/wochenverlauf/gewichtsverlauf/richtung); `stale-weight` FAIL mit `DailyInsightValidationError: Daily insight judges an open day as completed`. Volle Failureausgaben im Gate3-Capture. Keine Reparatur, keine behauptete Kausalitaet durch B-18 und keine Umdeutung historischer FT069-Befunde.

### Sourcehashschutz und Expected-Artefakte

641 Repositorypfade (Backendsource inkl. Tests/Prompts, Scripts/Configs, Shared, Mobile-Source, Infra, KB/QA und weitere Rootkonfiguration) vor Gate1 und nach JEDEM Gate byteweise SHA256-identisch. `changedPaths:[]` fuer alle3; Sourcebestand vor Gate2/3 ebenfalls identisch. Geordneter Sourcehashmanifest-SHA256 `b6ab41b148af1b4dc4ce3e6fee845c4d6050ed2663a7ed2e91a2270cdc0b3eb5`; Einzelhashes in `before`, jedem `runs[].after` und `after`. Settings sind ausgeschlossen und wurden nicht kopiert/gehasht/persistiert. Keine Produktimplementierung geaendert.

Lokale Completionchecks 2026-10-09, keine weiteren Provider-/Testlaeufe: `node --check` fuer den Live-Capture Exit0; strukturierter `node -e`-Evidencecheck Exit0 (genau3 Captures, Exits0/1/1, UNVERIFIED/FAIL/FAIL, DatumZeit/Output, alle641 Sourcehashes/Manifesthash, beobachtete Preparationzaehler, ASCII-Handoff und enthaltene Pflichtpassagen); darin Root `git diff --check` Exit0. Zusaetzlicher Privacy-/Pfadmengencheck via `node --input-type=module -e`: erster Versuch Exit1/SyntaxError durch Terminalaufbereitung von JavaScriptoperatoren, vor jeglichem Provideraufruf; korrigierter ausschliesslich lokaler Check Exit0 um10:29:54.771 UTC, keine konfigurierten sensiblen Werte in Capture/Evidence/Handoff und keine neuen/entfernten geschuetzten Pfade. Dies ist kein wiederholtes Pflichtgate und kein korrigiertes Live-Ergebnis. Die drei Pflichtcommands samt Parametern und ungekapselten beobachteten Resultaten bleiben im JSON unveraendert.

Abgleich Expected Handoff aus v18/B-18: eigener Diff, Editmapping, Guards, Ersatzmatrix und rekonstruierter Replay sind bereits im Manifest erhalten. Neue drei Command-/Exit-/Zeit-/Resultcaptures und synthetischer Preparationraw/Kern-/Call-/Status-/Usage-/No-write-/Unchanged-Beleg liegen nun dauerhaft vor, aber mit den oben genannten FAILs/UNVERIFIED-Grenzen. Noch fehlend: urspruengliche Livechronologie/-Captures und urspruenglicher Redcapture; erfolgreiche fokussierte Preparationprobe; Preparation-Kochkern-PASS und erreichte text-only-V2-Body-/Usage-Order-Evidence; gesamte gemessene Providercallzahlen und nicht ausgegebene Importraws1..7. Keine dieser Luecken wird als PASS geschlossen.

Blockerowner Orchestrator: ausdruecklich autorisierte aktuelle Verifikation ist ausgefuehrt und braucht keine nachtraegliche Nutzerfreigabe. Neue Pflichtgate-FAILs und Gate1-UNVERIFIED blockieren AC-8/Paketabschluss/Merge/Release; weitere Runs oder Reparaturen benoetigen einen neuen begrenzten Auftrag, werden hier nicht gestartet. Original-Live-/Redcaptures bereitstellen, falls vorhanden, sonst nicht wiederherstellbare Originalchronologie explizit offenlassen. Eigene Preparation-Kernluecke an Backend nur nach neuem Auftrag; Dailybefunde separat routen, keine Kausalitaet unterstellen. Kein QA-/Register-/Deploy-/KB-Abschluss und keine Closure FT063..069/VER015.

## AC- und Phasenstatus

| AC | B-18-Status / Evidence |
|---|---|
| AC-1 | Offline PASS: beide Validators, Gaps, Codes, Referenz-/Source-/Ordernegative, keine Mutation;102 Units. |
| AC-2 | Offline PASS: Grenzen plus echte Rendererprobe1..5/90/1080x1350;34 Rendererunits. |
| AC-3 | Offline PASS; neue Live-Source-/Kernmatrix vorhanden: Source1..8 PASS, Exportkern6 fehlt -> Preparation FAIL in Gate2/3. |
| AC-4 | Offline PASS der Kern-/Komponenten-/Swap-/Temperaturnegative; keine allgemeine Runtime-Semantikgarantie. |
| AC-5 | Code v16/v3, beide Offlineguards und neue Liveguards Gate2/3 PASS; Source-/Contextschutz erhalten, Preparation-Kernwirkung FAIL. |
| AC-6 | Offline Fokus PASS; Gate2/3 echter Providerstatus200/SDK1/analyze1/Usage1/writes0/unchanged true beobachtet; spaetere V2-Body-/Usage-Order-Assertions nicht erreicht -> UNVERIFIED. |
| AC-7 | Eigene Eingangs-/Endbasis und alle46 Hunks zugeordnet, B-1 bewahrt; urspruengliche Laufchronologie nicht wiederherstellbar, Registryabweichung sichtbar. |
| AC-8 | Offline PASS unveraendert; neue Gate1 UNVERIFIED (Exit0/Skips), Gate2/3 FAIL (Exit1); Original-Live-/Redchronologie UNVERIFIED; Paketabschluss BLOCKED. |
| AC-9 | D-18/QA ausserhalb dieses Auftrags; KB-Abweichung explizit, nicht umgesetzt. |
| AC-11 | Q18R-Inventarbezug und eigener Enddiff vorhanden; drei historische Importurspruenge weiterhin offen, kein Restore. |
| AC-12 | Q18R-No-op ueber K1..8 hinaus eingehalten; kein weiterer Refactor-/Schema-/Architekturauftrag. |
| AC-13 | K1..4 Code/Testnachfolger dokumentiert, K5..7 erhalten; K8 separat D18. Keine unabhaengige QA-Abnahme behauptet. |
| AC-14 | Handoff vorhanden, aber Gesamtabschluss/QA/Doku/Live nicht abgeschlossen. |

US-10 AC-15/16: selektive Kurzfassung und volle Sourcebasis offline geprueft nach ausdruecklicher v18-Klarstellung; keine unabhaengige QA-Abnahme oder private/Alpha-Replayaussage. Q18R-AC10..12-READY ist unveraendert Vorreviewevidence, kein neuer Backend-QA-PASS.

Weitere UNVERIFIED/MANUAL-Grenzen: historischer v13-before-v14 Snapshot/Byteherkunft fehlt; private Originalquelle und deployed Revision fehlen; keine Cosmoscontract-, Device-, Save/Share-Environment- oder Alpha-/Deploymentpruefung. Keine externen Sitzungsabhaengigkeiten im Manifest. K8/D18 und unabhaengige QA werden vom Orchestrator separat beauftragt, nicht durch diese Recovery gestartet.